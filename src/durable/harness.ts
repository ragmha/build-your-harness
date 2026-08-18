import type { Message, ModelAdapter, ToolCall } from "../core/contracts";
import { HarnessError } from "../core/errors";
import type { ContextProjectionOptions } from "../context/project-context";
import type { ToolRegistry } from "../tools/registry";
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
    // TODO(step-4): Create version 1 with run.started, reject existing run IDs,
    // checkpoint the initial snapshot, then drive the durable loop.
    void runId;
    void initialMessages;
    throw new Error("Not implemented: DurableHarness.start");
  }

  async resume(runId: string): Promise<DurableRunResult> {
    // TODO(step-4): Load and replay the run, then continue without repeating
    // completed model or tool work.
    void runId;
    throw new Error("Not implemented: DurableHarness.resume");
  }

  async resolveApproval(
    runId: string,
    command: ApprovalCommand,
  ): Promise<DurableRunResult> {
    // TODO(step-6): Bind the command to the persisted pending approval.
    // Identical command retries are idempotent; conflicts must be rejected.
    void runId;
    void command;
    throw new Error("Not implemented: DurableHarness.resolveApproval");
  }

  private async drive(runId: string): Promise<DurableRunResult> {
    // TODO(step-4): Implement model response persistence, read-tool recovery,
    // max steps, and checkpoints.
    // TODO(step-5): Persist policy decisions, handle denial as a tool result,
    // pass stable idempotency keys, and survive an effect-before-commit crash.
    // TODO(step-6): Pause on approval requests and continue after a durable
    // approval resolution.
    void runId;
    throw new Error("Not implemented: DurableHarness.drive");
  }
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
  return await store.commit({
    runId: stored.events[0]?.runId ?? "",
    expectedVersion: stored.version,
    events: [event],
  });
}
