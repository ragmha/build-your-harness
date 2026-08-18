import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { runAgent } from "../src/core/agent";
import { ScriptedModel } from "../src/providers/scripted-model";
import { ToolRegistry, type Tool } from "../src/tools/registry";

const doubleTool: Tool<{ value: number }, { value: number }> = {
  name: "double",
  description: "Double a synthetic number.",
  schema: z.object({ value: z.number() }),
  execute: ({ value }) => ({ value: value * 2 }),
};

describe("Step 2: tools and loop", () => {
  test("validates and executes a tool call, then returns the final response", async () => {
    const model = new ScriptedModel([
      {
        content: "",
        toolCalls: [{ id: "call-1", name: "double", arguments: { value: 4 } }],
      },
      { content: "The answer is 8." },
    ]);
    const tools = new ToolRegistry().register(doubleTool);
    const events: string[] = [];

    const result = await runAgent(model, tools, [{ role: "user", content: "Double 4" }], {
      onTrace: (event) => events.push(event.type),
    });

    expect(result.output).toBe("The answer is 8.");
    expect(result.messages.at(-2)).toMatchObject({
      role: "tool",
      toolCallId: "call-1",
      content: '{"value":8}',
    });
    expect(events).toEqual([
      "run.started",
      "model.requested",
      "model.responded",
      "tool.started",
      "tool.finished",
      "model.requested",
      "model.responded",
      "run.finished",
    ]);
  });

  test("rejects invalid tool arguments", async () => {
    const tools = new ToolRegistry().register(doubleTool);

    await expect(
      tools.execute("double", { value: "four" }, { signal: new AbortController().signal }),
    ).rejects.toMatchObject({ code: "INVALID_ARGUMENTS" });
  });

  test("rejects unknown tools", async () => {
    await expect(
      new ToolRegistry().execute("missing", {}, { signal: new AbortController().signal }),
    ).rejects.toMatchObject({ code: "UNKNOWN_TOOL" });
  });

  test("stops at the configured maximum number of model steps", async () => {
    const calls = Array.from({ length: 3 }, (_, index) => ({
      content: "",
      toolCalls: [{ id: `call-${index}`, name: "double", arguments: { value: index } }],
    }));

    await expect(
      runAgent(
        new ScriptedModel(calls),
        new ToolRegistry().register(doubleTool),
        [{ role: "user", content: "Keep going" }],
        { maxSteps: 2 },
      ),
    ).rejects.toMatchObject({ code: "MAX_STEPS" });
  });

  test("cancels a run when its timeout expires", async () => {
    const waitingModel = {
      complete: async (_request: unknown, signal: AbortSignal) =>
        await new Promise<never>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        }),
    };

    await expect(
      runAgent(waitingModel, new ToolRegistry(), [{ role: "user", content: "Wait" }], {
        timeoutMs: 5,
      }),
    ).rejects.toMatchObject({ code: "ABORTED" });
  });
});
