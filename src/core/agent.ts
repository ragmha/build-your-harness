import type {
  Message,
  ModelAdapter,
  TraceEvent,
  TraceListener,
} from "./contracts";
import { HarnessError } from "./errors";
import type { ToolRegistry } from "../tools/registry";
import {
  projectContext,
  type ContextProjectionOptions,
} from "../context/project-context";

export interface AgentOptions {
  maxSteps?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  onTrace?: TraceListener;
  context?: ContextProjectionOptions;
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
  const maxSteps = options.maxSteps ?? 8;
  const messages: Message[] = structuredClone([...initialMessages]);
  const trace: TraceEvent[] = [];
  const emit = (event: TraceEvent) => {
    trace.push(event);
    options.onTrace?.(event);
  };
  const now = () => new Date().toISOString();

  const timeout = new AbortController();
  const timer =
    options.timeoutMs === undefined
      ? undefined
      : setTimeout(
          () => timeout.abort(new Error(`Agent run timed out after ${options.timeoutMs}ms`)),
          options.timeoutMs,
        );
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeout.signal])
    : timeout.signal;

  let step = 0;
  emit({ type: "run.started", at: now() });

  try {
    while (true) {
      if (signal.aborted) {
        throw abortedError(signal.reason);
      }
      if (step >= maxSteps) {
        throw new HarnessError("MAX_STEPS", `Agent exceeded ${maxSteps} model steps`);
      }

      step += 1;
      emit({ type: "model.requested", at: now(), step });
      const context = options.context
        ? projectContext(messages, options.context).messages
        : messages;
      const response = await model.complete(
        { messages: context, tools: tools.definitions() },
        signal,
      );
      const toolCalls = response.toolCalls ?? [];
      emit({ type: "model.responded", at: now(), step, toolCallCount: toolCalls.length });

      messages.push({
        role: "assistant",
        content: response.content,
        ...(toolCalls.length > 0 ? { toolCalls } : {}),
      });

      if (toolCalls.length === 0) {
        emit({ type: "run.finished", at: now(), step });
        return { output: response.content, messages, trace, steps: step };
      }

      for (const call of toolCalls) {
        emit({ type: "tool.started", at: now(), step, toolCallId: call.id, toolName: call.name });
        const result = await tools.execute(call.name, call.arguments, {
          signal,
          toolCallId: call.id,
        });
        emit({ type: "tool.finished", at: now(), step, toolCallId: call.id, toolName: call.name });
        messages.push({
          role: "tool",
          content: JSON.stringify(result),
          toolCallId: call.id,
          name: call.name,
        });
      }
    }
  } catch (error) {
    const failure = signal.aborted ? abortedError(signal.reason) : error;
    emit({
      type: "run.failed",
      at: now(),
      step,
      error: failure instanceof Error ? failure.message : String(failure),
    });
    throw failure;
  } finally {
    clearTimeout(timer);
  }
}

export function abortedError(reason?: unknown): HarnessError {
  const message = reason instanceof Error ? reason.message : "Agent run was cancelled";
  return new HarnessError("ABORTED", message, { cause: reason });
}
