import type { Message, ModelAdapter, ToolCall } from "../core/contracts";
import { HarnessError } from "../core/errors";
import { projectContext, type ContextProjectionOptions } from "../context/project-context";
import type { ToolRegistry } from "../tools/registry";
import { replayStoredRun } from "./reducer";
import type {
  ApprovalCommand,
  DurableRunResult,
  PolicyGate,
  RunEvent,
  RunSnapshot,
  RunStore,
  StoredRun,
} from "./contracts";

export type FaultPoint =
  | "after-model-response-commit"
  | "after-policy-commit"
  | "after-tool-execute-before-commit";

export interface DurableHarnessOptions {
  maxSteps?: number;
  signal?: AbortSignal;
  context?: ContextProjectionOptions;
  fault?: (point: FaultPoint) => void;
}

export class DurableHarness {
  constructor(
    private readonly model: ModelAdapter,
    private readonly tools: ToolRegistry,
    private readonly store: RunStore,
    private readonly policy: PolicyGate,
    private readonly options: DurableHarnessOptions = {},
  ) {}

  async start(
    runId: string,
    initialMessages: readonly Message[],
  ): Promise<DurableRunResult> {
    if (await this.store.read(runId)) {
      throw new HarnessError("RUN_EXISTS", `Run "${runId}" already exists`);
    }
    const stored = await this.store.commit({
      runId,
      expectedVersion: 0,
      events: [
        {
          type: "run.started",
          initialMessages,
          maxSteps: this.options.maxSteps ?? 8,
        },
      ],
    });
    await this.store.saveCheckpoint(runId, stored.version, replayStoredRun(stored));
    return await this.drive(runId);
  }

  async resume(runId: string): Promise<DurableRunResult> {
    requireStoredRun(runId, await this.store.read(runId));
    return await this.drive(runId);
  }

  async resolveApproval(
    runId: string,
    command: ApprovalCommand,
  ): Promise<DurableRunResult> {
    const stored = requireStoredRun(runId, await this.store.read(runId));
    const { state } = replayStoredRun(stored);

    const request = Object.hasOwn(state.approvalRequests, command.approvalId)
      ? state.approvalRequests[command.approvalId]
      : undefined;
    if (!request) {
      throw new HarnessError(
        "APPROVAL_NOT_FOUND",
        `Approval "${command.approvalId}" was not found`,
      );
    }

    const existing = Object.hasOwn(state.approvalResolutions, command.approvalId)
      ? state.approvalResolutions[command.approvalId]
      : undefined;
    if (existing) {
      if (
        existing.commandId !== command.commandId ||
        existing.decision !== command.decision
      ) {
        throw new HarnessError(
          "APPROVAL_CONFLICT",
          `Approval "${command.approvalId}" was already resolved`,
        );
      }
      return await this.drive(runId);
    }

    // Bind the decision to the persisted call; the command cannot change it.
    await this.record(runId, stored, {
      type: "approval.resolved",
      resolution: {
        approvalId: request.approvalId,
        commandId: command.commandId,
        decision: command.decision,
        toolCallId: request.toolCall.id,
      },
    });
    return await this.drive(runId);
  }

  private async drive(runId: string): Promise<DurableRunResult> {
    while (true) {
      const stored = requireStoredRun(runId, await this.store.read(runId));
      const snapshot = replayStoredRun(stored);
      const { state } = snapshot;
      const call = pendingToolCall(snapshot);

      if (state.status === "completed") {
        return completedResult(snapshot);
      }
      if (state.status === "failed" && state.failure) {
        throw new HarnessError(state.failure.code, state.failure.message);
      }
      if (state.status === "waiting_for_approval" && call) {
        return waitingResult(snapshot, call);
      }

      if (call) {
        await this.processToolCall(stored, snapshot, call);
      } else if (state.steps > 0 && snapshot.history.at(-1)?.role === "assistant") {
        // The last model response asked for no tools: it is the final answer.
        const output = snapshot.history.at(-1)?.content ?? "";
        await this.record(runId, stored, { type: "run.completed", output });
      } else if (state.steps >= state.maxSteps) {
        await this.record(runId, stored, {
          type: "run.failed",
          code: "MAX_STEPS",
          message: `Run exceeded ${state.maxSteps} model steps`,
        });
      } else {
        const messages = this.options.context
          ? projectContext(snapshot.history, this.options.context).messages
          : snapshot.history;
        const response = await this.model.complete(
          { messages, tools: this.tools.definitions() },
          this.signal(),
        );
        await this.record(runId, stored, { type: "model.responded", response });
        this.options.fault?.("after-model-response-commit");
      }
    }
  }

  private async processToolCall(
    stored: StoredRun,
    snapshot: RunSnapshot,
    call: ToolCall,
  ): Promise<void> {
    const { runId } = snapshot.state;
    const decision = Object.hasOwn(snapshot.state.policyDecisions, call.id)
      ? snapshot.state.policyDecisions[call.id]
      : undefined;

    if (!decision) {
      const decided = this.policy.evaluate({
        runId,
        call: structuredClone(call),
        effect: this.tools.effectOf(call.name),
      });
      await this.record(runId, stored, {
        type: "policy.decided",
        toolCallId: call.id,
        decision: decided,
      });
      this.options.fault?.("after-policy-commit");
      return;
    }

    if (decision.kind === "deny") {
      await this.record(runId, stored, {
        type: "tool.denied",
        toolCall: call,
        reason: decision.reason,
      });
      return;
    }

    if (decision.kind === "require_approval") {
      const id = approvalId(runId, call);
      const resolution = Object.hasOwn(snapshot.state.approvalResolutions, id)
        ? snapshot.state.approvalResolutions[id]
        : undefined;
      if (!resolution) {
        await this.record(runId, stored, {
          type: "approval.requested",
          request: { approvalId: id, runId, toolCall: call, reason: decision.reason },
        });
        return;
      }
      if (resolution.decision === "reject") {
        await this.record(runId, stored, {
          type: "tool.denied",
          toolCall: call,
          reason: "Approval was rejected",
        });
        return;
      }
    }

    const key = idempotencyKey(runId, call);
    const result = await this.tools.execute(call.name, call.arguments, {
      signal: this.signal(),
      runId,
      toolCallId: call.id,
      idempotencyKey: key,
    });
    this.options.fault?.("after-tool-execute-before-commit");
    await this.record(runId, stored, {
      type: "tool.completed",
      toolCall: call,
      result,
      idempotencyKey: key,
    });
  }

  // Commit one event, then checkpoint the projection through it.
  private async record(
    runId: string,
    stored: StoredRun,
    event: RunEvent,
  ): Promise<void> {
    const next = await appendEvent(this.store, stored, event);
    await this.store.saveCheckpoint(runId, next.version, replayStoredRun(next));
  }

  private signal(): AbortSignal {
    return this.options.signal ?? new AbortController().signal;
  }
}

function waitingResult(snapshot: RunSnapshot, call: ToolCall): DurableRunResult {
  const { runId } = snapshot.state;
  const id = approvalId(runId, call);
  const approval = Object.hasOwn(snapshot.state.approvalRequests, id)
    ? snapshot.state.approvalRequests[id]
    : undefined;
  if (!approval) {
    throw new HarnessError("APPROVAL_NOT_FOUND", `No approval request for "${call.id}"`);
  }
  return {
    runId,
    status: "waiting_for_approval",
    approval: structuredClone(approval),
    state: structuredClone(snapshot.state),
  };
}

export function approvalId(runId: string, call: ToolCall): string {
  return `approval:${JSON.stringify([runId, call.id])}`;
}

export function idempotencyKey(runId: string, call: ToolCall): string {
  return `tool:${JSON.stringify([
    runId,
    call.name,
    call.id,
    canonicalize(call.arguments),
  ])}`;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

export function requireStoredRun(
  runId: string,
  stored: StoredRun | undefined,
): StoredRun {
  if (!stored) {
    throw new HarnessError("RUN_NOT_FOUND", `Run "${runId}" was not found`);
  }
  return stored;
}

export function completedResult(snapshot: RunSnapshot): DurableRunResult {
  if (snapshot.state.status !== "completed" || snapshot.state.output === undefined) {
    throw new Error("Run is not completed");
  }
  return {
    runId: snapshot.state.runId,
    status: "completed",
    output: snapshot.state.output,
    state: structuredClone(snapshot.state),
  };
}

export function pendingToolCall(snapshot: RunSnapshot): ToolCall | undefined {
  return snapshot.state.pendingToolCalls[0];
}

export async function appendEvent(
  store: RunStore,
  stored: StoredRun,
  event: RunEvent,
): Promise<StoredRun> {
  const runId =
    stored.events[0]?.runId ?? stored.checkpoint?.snapshot.state.runId;
  if (!runId) {
    throw new HarnessError("RUN_NOT_FOUND", "Stored run has no run ID");
  }
  return await store.commit({
    runId,
    expectedVersion: stored.version,
    events: [event],
  });
}
