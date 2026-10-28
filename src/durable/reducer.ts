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
      policyDecisions: Object.create(null),
      approvalRequests: Object.create(null),
      approvalResolutions: Object.create(null),
    },
    history: [],
  };
}

export function applyRunEvent(
  snapshot: RunSnapshot,
  event: RunEvent,
): RunSnapshot {
  const next = structuredClone(snapshot);
  const { state, history } = next;

  switch (event.type) {
    case "run.started":
      state.maxSteps = event.maxSteps;
      history.push(...structuredClone(event.initialMessages));
      break;
    case "model.responded":
      for (const call of event.response.toolCalls ?? []) {
        if (state.seenToolCallIds.includes(call.id)) {
          throw new HarnessError("DUPLICATE_TOOL_CALL", `Tool call "${call.id}" was already used`);
        }
        state.seenToolCallIds.push(call.id);
      }
      state.steps += 1;
      state.pendingToolCalls = structuredClone(event.response.toolCalls ?? []);
      history.push(assistantMessage(event));
      break;
    case "policy.decided":
      Object.defineProperty(state.policyDecisions, event.toolCallId, {
        value: structuredClone(event.decision),
        writable: true,
        enumerable: true,
        configurable: true,
      });
      break;
    case "approval.requested":
      Object.defineProperty(state.approvalRequests, event.request.approvalId, {
        value: structuredClone(event.request),
        writable: true,
        enumerable: true,
        configurable: true,
      });
      state.status = "waiting_for_approval";
      break;
    case "approval.resolved":
      Object.defineProperty(state.approvalResolutions, event.resolution.approvalId, {
        value: structuredClone(event.resolution),
        writable: true,
        enumerable: true,
        configurable: true,
      });
      state.status = "running";
      break;
    case "tool.completed":
      state.pendingToolCalls = withoutPendingCall(state.pendingToolCalls, event.toolCall.id);
      history.push(toolMessage(event.toolCall, event.result));
      break;
    case "tool.denied":
      state.pendingToolCalls = withoutPendingCall(state.pendingToolCalls, event.toolCall.id);
      history.push(toolMessage(event.toolCall, { denied: true, reason: event.reason }));
      break;
    case "run.completed":
      state.status = "completed";
      state.output = event.output;
      break;
    case "run.failed":
      state.status = "failed";
      state.failure = { code: event.code, message: event.message };
      break;
  }

  return next;
}

export function replayEvents(
  runId: string,
  events: readonly EventEnvelope[],
  checkpoint?: RunCheckpoint,
): RunSnapshot {
  const start = checkpoint ? structuredClone(checkpoint.snapshot) : initialSnapshot(runId);
  const throughVersion = checkpoint?.throughVersion ?? 0;
  return events
    .filter((entry) => entry.version > throughVersion)
    .reduce((snapshot, entry) => applyRunEvent(snapshot, entry.event), start);
}

function toolMessage(call: ToolCall, result: unknown): Message {
  return {
    role: "tool",
    content: JSON.stringify(result),
    toolCallId: call.id,
    name: call.name,
  };
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
