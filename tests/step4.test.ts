import { describe, expect, test } from "bun:test";
import { z } from "zod";
import type { ModelAdapter } from "../src/core/contracts";
import { DurableHarness } from "../src/durable/harness";
import { InMemoryRunStore } from "../src/durable/in-memory-store";
import { allowAllPolicy } from "../src/durable/policy";
import { replayStoredRun } from "../src/durable/reducer";
import { ScriptedModel } from "../src/providers/scripted-model";
import { ToolRegistry, type Tool } from "../src/tools/registry";

const echoTool: Tool<{ value: string }, { value: string }> = {
  name: "echo",
  description: "Return a synthetic value.",
  schema: z.object({ value: z.string() }),
  execute: ({ value }) => ({ value }),
};

describe("Step 4: durability and recovery", () => {
  test("stores immutable events and rejects stale writers", async () => {
    const store = new InMemoryRunStore();
    const initialMessages = [{ role: "user" as const, content: "hello" }];
    const stored = await store.commit({
      runId: "run-store",
      expectedVersion: 0,
      events: [
        { type: "run.started", initialMessages, maxSteps: 4 },
      ],
    });

    initialMessages[0]!.content = "mutated";
    stored.events[0]!.event.type = "run.completed";

    const reread = await store.read("run-store");
    expect(reread?.version).toBe(1);
    expect(reread?.events[0]?.event).toMatchObject({
      type: "run.started",
      initialMessages: [{ content: "hello" }],
    });

    await expect(
      store.commit({
        runId: "run-store",
        expectedVersion: 0,
        events: [{ type: "run.completed", output: "stale" }],
      }),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
  });

  test("replays a checkpoint plus its event tail", async () => {
    const store = new InMemoryRunStore();
    let stored = await store.commit({
      runId: "run-replay",
      expectedVersion: 0,
      events: [
        {
          type: "run.started",
          initialMessages: [{ role: "user", content: "hello" }],
          maxSteps: 4,
        },
        { type: "model.responded", response: { content: "first" } },
      ],
    });
    const checkpointSnapshot = replayStoredRun(stored);
    stored = await store.saveCheckpoint(
      "run-replay",
      stored.version,
      checkpointSnapshot,
    );
    stored = await store.commit({
      runId: "run-replay",
      expectedVersion: stored.version,
      events: [{ type: "run.completed", output: "first" }],
    });

    const replayed = replayStoredRun(stored);
    expect(replayed.state).toMatchObject({
      status: "completed",
      steps: 1,
      output: "first",
    });
    expect(replayed.history.map((message) => message.content)).toEqual([
      "hello",
      "first",
    ]);
  });

  test("rejects a reused tool-call ID during replay", async () => {
    const store = new InMemoryRunStore();
    const call = { id: "duplicate", name: "echo", arguments: { value: "x" } };
    const stored = await store.commit({
      runId: "run-duplicate",
      expectedVersion: 0,
      events: [
        {
          type: "run.started",
          initialMessages: [{ role: "user", content: "hello" }],
          maxSteps: 4,
        },
        {
          type: "model.responded",
          response: { content: "", toolCalls: [call] },
        },
        { type: "tool.denied", toolCall: call, reason: "test" },
        {
          type: "model.responded",
          response: { content: "", toolCalls: [call] },
        },
      ],
    });

    expect(() => replayStoredRun(stored)).toThrow(
      expect.objectContaining({ code: "DUPLICATE_TOOL_CALL" }),
    );
  });

  test("resumes after a committed model response without requesting it again", async () => {
    const store = new InMemoryRunStore();
    let crashed = false;
    const firstRuntime = new DurableHarness(
      new ScriptedModel([
        {
          content: "",
          toolCalls: [
            { id: "call-1", name: "echo", arguments: { value: "safe" } },
          ],
        },
      ]),
      new ToolRegistry().register(echoTool),
      store,
      allowAllPolicy,
      {
        fault(point) {
          if (!crashed && point === "after-model-response-commit") {
            crashed = true;
            throw new Error("simulated crash");
          }
        },
      },
    );

    await expect(
      firstRuntime.start("run-restart", [
        { role: "user", content: "echo safe" },
      ]),
    ).rejects.toThrow("simulated crash");

    const resumed = await new DurableHarness(
      new ScriptedModel([{ content: "finished" }]),
      new ToolRegistry().register(echoTool),
      store,
      allowAllPolicy,
    ).resume("run-restart");

    expect(resumed).toMatchObject({
      status: "completed",
      output: "finished",
    });
    const stored = await store.read("run-restart");
    expect(
      stored?.events.filter((entry) => entry.event.type === "model.responded"),
    ).toHaveLength(2);
    expect(
      stored?.events.filter((entry) => entry.event.type === "tool.completed"),
    ).toHaveLength(1);
  });

  test("returns a completed run without calling the model again", async () => {
    const store = new InMemoryRunStore();
    const harness = new DurableHarness(
      new ScriptedModel([{ content: "done" }]),
      new ToolRegistry(),
      store,
      allowAllPolicy,
    );
    await harness.start("run-complete", [{ role: "user", content: "go" }]);

    const neverModel: ModelAdapter = {
      async complete() {
        throw new Error("model should not be called");
      },
    };
    const result = await new DurableHarness(
      neverModel,
      new ToolRegistry(),
      store,
      allowAllPolicy,
    ).resume("run-complete");

    expect(result).toMatchObject({ status: "completed", output: "done" });
    const stored = await store.read("run-complete");
    expect(stored?.checkpoint?.throughVersion).toBe(stored?.version);
    expect(stored?.checkpoint?.snapshot.state.status).toBe("completed");
  });

  test("persists failure when the durable step limit is reached", async () => {
    const store = new InMemoryRunStore();
    const model = new ScriptedModel([
      {
        content: "",
        toolCalls: [
          { id: "call-limit", name: "echo", arguments: { value: "again" } },
        ],
      },
      { content: "must not be requested" },
    ]);

    await expect(
      new DurableHarness(
        model,
        new ToolRegistry().register(echoTool),
        store,
        allowAllPolicy,
        { maxSteps: 1 },
      ).start("run-limit", [{ role: "user", content: "loop" }]),
    ).rejects.toMatchObject({ code: "MAX_STEPS" });

    const stored = await store.read("run-limit");
    expect(stored?.events.at(-1)?.event).toMatchObject({
      type: "run.failed",
      code: "MAX_STEPS",
    });
    expect(stored?.checkpoint?.snapshot.state.status).toBe("failed");
    expect(model.remaining).toBe(1);
  });

  test("keeps the persisted step budget after restart", async () => {
    const store = new InMemoryRunStore();
    let crashed = false;
    await expect(
      new DurableHarness(
        new ScriptedModel([
          {
            content: "",
            toolCalls: [
              {
                id: "call-budget",
                name: "echo",
                arguments: { value: "once" },
              },
            ],
          },
        ]),
        new ToolRegistry().register(echoTool),
        store,
        allowAllPolicy,
        {
          maxSteps: 1,
          fault(point) {
            if (!crashed && point === "after-model-response-commit") {
              crashed = true;
              throw new Error("restart with pending call");
            }
          },
        },
      ).start("run-budget", [{ role: "user", content: "loop" }]),
    ).rejects.toThrow("restart with pending call");

    const resumedModel = new ScriptedModel([
      { content: "must not be requested" },
    ]);
    await expect(
      new DurableHarness(
        resumedModel,
        new ToolRegistry().register(echoTool),
        store,
        allowAllPolicy,
        { maxSteps: 99 },
      ).resume("run-budget"),
    ).rejects.toMatchObject({ code: "MAX_STEPS" });
    expect(resumedModel.remaining).toBe(1);
  });

  test("rejects missing run IDs", async () => {
    await expect(
      new DurableHarness(
        new ScriptedModel([]),
        new ToolRegistry(),
        new InMemoryRunStore(),
        allowAllPolicy,
      ).resume("missing"),
    ).rejects.toMatchObject({ code: "RUN_NOT_FOUND" });
  });
});
