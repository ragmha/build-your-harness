import type {
  Message,
  ModelResponse,
  ToolCall,
} from "../core/contracts";
import type { HarnessErrorCode } from "../core/errors";

export type RunStatus =
  | "running"
  | "waiting_for_approval"
  | "completed"
  | "failed";

export type PolicyDecision =
  | { kind: "allow" }
  | { kind: "deny"; reason: string }
  | { kind: "require_approval"; reason: string };

export interface ApprovalRequest {
  approvalId: string;
  runId: string;
  toolCall: ToolCall;
  reason: string;
}

export interface ApprovalCommand {
  approvalId: string;
  commandId: string;
  decision: "approve" | "reject";
}

export interface ApprovalResolution extends ApprovalCommand {
  toolCallId: string;
}

export type RunEvent =
  | {
      type: "run.started";
      initialMessages: readonly Message[];
      maxSteps: number;
    }
  | { type: "model.responded"; response: ModelResponse }
  | {
      type: "policy.decided";
      toolCallId: string;
      decision: PolicyDecision;
    }
  | { type: "approval.requested"; request: ApprovalRequest }
  | { type: "approval.resolved"; resolution: ApprovalResolution }
  | {
      type: "tool.completed";
      toolCall: ToolCall;
      result: unknown;
      idempotencyKey: string;
    }
  | { type: "tool.denied"; toolCall: ToolCall; reason: string }
  | { type: "run.completed"; output: string }
  | {
      type: "run.failed";
      code: HarnessErrorCode;
      message: string;
    };

export interface EventEnvelope {
  runId: string;
  version: number;
  eventId: string;
  at: string;
  event: RunEvent;
}

export interface RunState {
  runId: string;
  status: RunStatus;
  steps: number;
  maxSteps: number;
  pendingToolCalls: ToolCall[];
  seenToolCallIds: string[];
  policyDecisions: Record<string, PolicyDecision>;
  approvalRequests: Record<string, ApprovalRequest>;
  approvalResolutions: Record<string, ApprovalResolution>;
  output?: string;
  failure?: { code: HarnessErrorCode; message: string };
}

export interface RunSnapshot {
  state: RunState;
  history: Message[];
}

export interface RunCheckpoint {
  throughVersion: number;
  snapshot: RunSnapshot;
}

export interface StoredRun {
  version: number;
  events: EventEnvelope[];
  checkpoint?: RunCheckpoint;
}

export interface CommitRequest {
  runId: string;
  expectedVersion: number;
  events: readonly RunEvent[];
}

export interface RunStore {
  read(runId: string): Promise<StoredRun | undefined>;
  commit(request: CommitRequest): Promise<StoredRun>;
  saveCheckpoint(
    runId: string,
    expectedVersion: number,
    snapshot: RunSnapshot,
  ): Promise<StoredRun>;
}

export interface PolicyInput {
  runId: string;
  call: ToolCall;
  effect: "read" | "write";
}

export interface PolicyGate {
  evaluate(input: PolicyInput): PolicyDecision;
}

export type DurableRunResult =
  | {
      runId: string;
      status: "completed";
      output: string;
      state: RunState;
    }
  | {
      runId: string;
      status: "waiting_for_approval";
      approval: ApprovalRequest;
      state: RunState;
    };
