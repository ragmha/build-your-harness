import { describe, expect, test } from "bun:test";
import { HarnessError } from "../src/core/errors";
import { ScriptedModel } from "../src/providers/scripted-model";

const request = { messages: [], tools: [] };

describe("Step 1: scripted model", () => {
  test("returns scripted responses in order without sharing mutable values", async () => {
    const shared = {
      content: "scripted",
      toolCalls: [{ id: "1", name: "demo", arguments: { n: 1 } }],
    };
    const model = new ScriptedModel([shared, shared]);
    const signal = new AbortController().signal;

    const first = await model.complete(request, signal);
    first.toolCalls?.push({ id: "2", name: "changed", arguments: {} });
    const second = await model.complete(request, signal);

    expect(first.toolCalls).toHaveLength(2);
    expect(second.toolCalls).toHaveLength(1);
    expect(model.remaining).toBe(0);
  });

  test("reports exhaustion with a typed error", async () => {
    const model = new ScriptedModel([]);

    await expect(
      model.complete(request, new AbortController().signal),
    ).rejects.toMatchObject({
      name: "HarnessError",
      code: "MODEL_EXHAUSTED",
    } satisfies Partial<HarnessError>);
  });

  test("respects cancellation", async () => {
    const controller = new AbortController();
    controller.abort("stop");

    await expect(
      new ScriptedModel([{ content: "unused" }]).complete(
        request,
        controller.signal,
      ),
    ).rejects.toMatchObject({ code: "ABORTED" });
  });
});
