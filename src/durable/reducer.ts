import type { Message, ToolCall } from "../core/contracts";
import { HarnessError } from "../core/errors";
import type {
  EventEnvelope,
  RunCheckpoint,
  RunEvent,
  RunSnapshot,
  StoredRun,
} from "./contracts";

export function initialSnapshot(runId: string): RunSnapshot {
  return {
    state: {
      runId,
      status: "running",
      steps: 0,
      maxSteps: 0,
      pendingToolCalls: [],
      seenToolCallIds: [],
      policyDecisions: {},
      approvalRequests: {},
      approvalResolutions: {},
    },
    history: [],
  };
}

export function applyRunEvent(
  snapshot: RunSnapshot,
  event: RunEvent,
): RunSnapshot {
  // TODO(step-4): Apply one immutable event to the current state and history.
  // Reject reused tool-call IDs, append only message-bearing events to
  // history, and derive pending calls and terminal status.
  void snapshot;
  void event;
  throw new Error("Not implemented: applyRunEvent");
}

export function replayEvents(
  runId: string,
  events: readonly EventEnvelope[],
  checkpoint?: RunCheckpoint,
): RunSnapshot {
  // TODO(step-4): Begin at the checkpoint when present, then apply only the
  // event tail after checkpoint.throughVersion.
  void runId;
  void events;
  void checkpoint;
  throw new Error("Not implemented: replayEvents");
}

export function replayStoredRun(stored: StoredRun): RunSnapshot {
  const runId = stored.events[0]?.runId;
  if (!runId) {
    throw new HarnessError("RUN_NOT_FOUND", "Stored run has no events");
  }
  return replayEvents(runId, stored.events, stored.checkpoint);
}

export function assistantMessage(event: Extract<RunEvent, { type: "model.responded" }>): Message {
  const message: Message = {
    role: "assistant",
    content: event.response.content,
  };
  if (event.response.toolCalls) {
    message.toolCalls = structuredClone(event.response.toolCalls);
  }
  return message;
}

export function withoutPendingCall(
  calls: readonly ToolCall[],
  toolCallId: string,
): ToolCall[] {
  return calls.filter((call) => call.id !== toolCallId);
}
