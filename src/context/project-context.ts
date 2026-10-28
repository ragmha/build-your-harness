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
  const messages: Message[] = [];
  if (options.instructions) {
    messages.push({ role: "system", content: options.instructions });
  }

  const facts = Object.entries(options.facts ?? {}).sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0,
  );
  if (facts.length > 0) {
    const lines = facts.map(([key, value]) => `${key}: ${value}`);
    messages.push({ role: "system", content: ["Known facts:", ...lines].join("\n") });
  }

  // Walk blocks from newest to oldest. The block that crosses the target is
  // kept whole, so a tool result never arrives without its tool call.
  const target = options.historyMessageTarget ?? history.length;
  const blocks = toBlocks(history);
  const selected: Message[][] = [];
  let included = 0;
  for (let index = blocks.length - 1; index >= 0 && included < target; index -= 1) {
    const block = blocks[index]!;
    selected.unshift(block);
    included += block.length;
  }

  messages.push(...structuredClone(selected.flat()));
  return {
    messages,
    includedHistoryMessages: included,
    omittedHistoryMessages: history.length - included,
  };
}

function toBlocks(history: readonly Message[]): Message[][] {
  const blocks: Message[][] = [];
  for (const message of history) {
    const previous = blocks.at(-1);
    if (message.role === "tool" && previous?.[0]?.toolCalls) {
      previous.push(message);
    } else {
      blocks.push([message]);
    }
  }
  return blocks;
}
