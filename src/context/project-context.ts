import type { Message } from "../core/contracts";

export interface ContextProjectionOptions {
  instructions?: string;
  facts?: Readonly<Record<string, string>>;
  historyMessageTarget?: number;
}

export interface ContextProjection {
  messages: Message[];
  includedHistoryMessages: number;
  omittedHistoryMessages: number;
}

export function projectContext(
  history: readonly Message[],
  options: ContextProjectionOptions = {},
): ContextProjection {
  // TODO(step-3): Build deterministic model context instead of treating all
  // history as context. Include instructions, sorted facts, and the newest
  // complete message blocks toward historyMessageTarget. Never split an
  // assistant tool-call message from its contiguous tool results.
  void history;
  void options;
  throw new Error("Not implemented: projectContext");
}
