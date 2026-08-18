export type MessageRole = "system" | "user" | "assistant" | "tool";

export interface ToolCall {
  id: string;
  name: string;
  arguments: unknown;
}

export interface Message {
  role: MessageRole;
  content: string;
  toolCallId?: string;
  name?: string;
  toolCalls?: ToolCall[];
}

export interface ModelRequest {
  messages: readonly Message[];
  tools: readonly ToolDefinition[];
}

export interface ModelResponse {
  content: string;
  toolCalls?: ToolCall[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ModelAdapter {
  complete(request: ModelRequest, signal: AbortSignal): Promise<ModelResponse>;
}

export type TraceEvent =
  | { type: "run.started"; at: string }
  | { type: "model.requested"; at: string; step: number }
  | { type: "model.responded"; at: string; step: number; toolCallCount: number }
  | { type: "tool.started"; at: string; step: number; toolCallId: string; toolName: string }
  | { type: "tool.finished"; at: string; step: number; toolCallId: string; toolName: string }
  | { type: "run.finished"; at: string; step: number }
  | { type: "run.failed"; at: string; step: number; error: string };

export type TraceListener = (event: TraceEvent) => void;
