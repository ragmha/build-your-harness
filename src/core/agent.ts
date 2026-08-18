import type {
  Message,
  ModelAdapter,
  TraceEvent,
  TraceListener,
} from "./contracts";
import { HarnessError } from "./errors";
import type { ToolRegistry } from "../tools/registry";

export interface AgentOptions {
  maxSteps?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  onTrace?: TraceListener;
}

export interface AgentResult {
  output: string;
  messages: Message[];
  trace: TraceEvent[];
  steps: number;
}

export async function runAgent(
  model: ModelAdapter,
  tools: ToolRegistry,
  initialMessages: readonly Message[],
  options: AgentOptions = {},
): Promise<AgentResult> {
  // TODO(step-2): Implement the bounded model/tool loop. Use maxSteps (default
  // 8), combine timeout and caller cancellation, append assistant/tool
  // messages, serialize tool results as JSON, and emit every trace event.
  void model;
  void tools;
  void initialMessages;
  void options;
  throw new Error("Not implemented: runAgent");
}

export function abortedError(reason?: unknown): HarnessError {
  const message = reason instanceof Error ? reason.message : "Agent run was cancelled";
  return new HarnessError("ABORTED", message, { cause: reason });
}
