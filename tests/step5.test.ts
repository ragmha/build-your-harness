import { describe, expect, test } from "bun:test";
import { z } from "zod";
import type { ModelAdapter, ModelRequest } from "../src/core/contracts";
import { InMemoryEffectSink } from "../src/durable/effect-sink";
import { DurableHarness, idempotencyKey } from "../src/durable/harness";
import { InMemoryRunStore } from "../src/durable/in-memory-store";
import { StaticToolPolicy } from "../src/durable/policy";
import { ScriptedModel } from "../src/providers/scripted-model";
import { ToolRegistry, type Tool } from "../src/tools/registry";

describe("Step 5: policy and idempotency", () => {
  test("builds collision-safe keys with a canonical request fingerprint", () => {
    const left = idempotencyKey("a", {
      id: "b:tool:c",
      name: "record",
      arguments: { z: 1, a: "same" },
    });
    const reordered = idempotencyKey("a", {
      id: "b:tool:c",
      name: "record",
      arguments: { a: "same", z: 1 },
    });
    const differentRun = idempotencyKey("a:tool:b", {
      id: "c",
      name: "record",
      arguments: { a: "same", z: 1 },
    });
    const differentArguments = idempotencyKey("a", {
      id: "b:tool:c",
      name: "record",
      arguments: { a: "changed", z: 1 },
    });

    expect(left).toBe(reordered);
    expect(left).not.toBe(differentRun);
    expect(left).not.toBe(differentArguments);
  });

  test("denies unlisted tools without invoking their executor", async () => {
    let executions = 0;
    const writeTool: Tool<{ note: string }, { saved: string }> = {
      name: "record_note",
      description: "Record a synthetic note.",
      effect: "write",
      schema: z.object({ note: z.string() }),
      execute: ({ note }) => {
        executions += 1;
        return { saved: note };
      },
    };
    const result = await new DurableHarness(
      new ScriptedModel([
        {
          content: "",
          toolCalls: [
            {
              id: "call-denied",
              name: "record_note",
              arguments: { note: "demo" },
            },
          ],
        },
        { content: "The note was denied." },
      ]),
      new ToolRegistry().register(writeTool),
      new InMemoryRunStore(),
      new StaticToolPolicy({}),
    ).start("run-denied", [{ role: "user", content: "record demo" }]);

    expect(result).toMatchObject({
      status: "completed",
      output: "The note was denied.",
    });
    expect(executions).toBe(0);
  });

  test("persists policy decisions instead of reevaluating after restart", async () => {
    const store = new InMemoryRunStore();
    let evaluations = 0;
    let executions = 0;
    let crashed = false;
    const registry = new ToolRegistry().register({
      name: "echo",
      description: "Echo.",
      effect: "write",
      schema: z.object({ value: z.string() }),
      execute: ({ value }) => {
        executions += 1;
        return { value };
      },
    });
    const policy = {
      evaluate() {
        evaluations += 1;
        return { kind: "allow" as const };
      },
    };
    const first = new DurableHarness(
      new ScriptedModel([
        {
          content: "",
          toolCalls: [
            { id: "call-policy", name: "echo", arguments: { value: "x" } },
          ],
        },
      ]),
      registry,
      store,
      policy,
      {
        fault(point) {
          if (!crashed && point === "after-policy-commit") {
            crashed = true;
            throw new Error("restart after policy");
          }
        },
      },
    );

    await expect(
      first.start("run-policy", [{ role: "user", content: "echo" }]),
    ).rejects.toThrow("restart after policy");
    expect(executions).toBe(0);

    const noReevaluation = {
      evaluate(): never {
        throw new Error("policy should not be reevaluated");
      },
    };
    const result = await new DurableHarness(
      new ScriptedModel([{ content: "done" }]),
      registry,
      store,
      noReevaluation,
    ).resume("run-policy");

    expect(result.status).toBe("completed");
    expect(evaluations).toBe(1);
    expect(executions).toBe(1);
  });

  test("uses a stable idempotency key across an effect-before-commit crash", async () => {
    const store = new InMemoryRunStore();
    const sink = new InMemoryEffectSink<string>();
    let crashed = false;
    const writeTool: Tool<{ note: string }, { saved: string }> = {
      name: "record_note",
      description: "Record a synthetic note.",
      effect: "write",
      schema: z.object({ note: z.string() }),
      execute: ({ note }, context) => {
        const result = sink.recordOnce(context.idempotencyKey ?? "", note);
        return { saved: result.value };
      },
    };
    const registry = new ToolRegistry().register(writeTool);
    const policy = new StaticToolPolicy({
      record_note: { kind: "allow" },
    });
    const first = new DurableHarness(
      new ScriptedModel([
        {
          content: "",
          toolCalls: [
            {
              id: "call-write",
              name: "record_note",
              arguments: { note: "only once" },
            },
          ],
        },
      ]),
      registry,
      store,
      policy,
      {
        fault(point) {
          if (!crashed && point === "after-tool-execute-before-commit") {
            crashed = true;
            throw new Error("crash after effect");
          }
        },
      },
    );

    await expect(
      first.start("run-effect", [{ role: "user", content: "record" }]),
    ).rejects.toThrow("crash after effect");
    expect(sink.records()).toEqual([
      {
        key: 'tool:["run-effect","record_note","call-write",{"note":"only once"}]',
        value: "only once",
      },
    ]);

    const result = await new DurableHarness(
      new ScriptedModel([{ content: "saved" }]),
      registry,
      store,
      policy,
    ).resume("run-effect");

    expect(result).toMatchObject({ status: "completed", output: "saved" });
    expect(sink.records()).toEqual([
      {
        key: 'tool:["run-effect","record_note","call-write",{"note":"only once"}]',
        value: "only once",
      },
    ]);
  });

  test("feeds a denied result back to the next model turn", async () => {
    const requests: ModelRequest[] = [];
    const responses = [
      {
        content: "",
        toolCalls: [
          { id: "call-deny", name: "echo", arguments: { value: "x" } },
        ],
      },
      { content: "handled" },
    ];
    const model: ModelAdapter = {
      async complete(request) {
        requests.push(structuredClone(request));
        return responses.shift() ?? { content: "unexpected" };
      },
    };

    await new DurableHarness(
      model,
      new ToolRegistry().register({
        name: "echo",
        description: "Echo.",
        schema: z.object({ value: z.string() }),
        execute: ({ value }) => ({ value }),
      }),
      new InMemoryRunStore(),
      new StaticToolPolicy({
        echo: { kind: "deny", reason: "blocked by test policy" },
      }),
    ).start("run-denial-context", [{ role: "user", content: "echo" }]);

    expect(requests[1]?.messages.at(-1)).toMatchObject({
      role: "tool",
      toolCallId: "call-deny",
      content: '{"denied":true,"reason":"blocked by test policy"}',
    });
  });
});
