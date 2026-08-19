import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { DurableHarness } from "../src/durable/harness";
import { InMemoryEffectSink } from "../src/durable/effect-sink";
import { InMemoryRunStore } from "../src/durable/in-memory-store";
import { StaticToolPolicy } from "../src/durable/policy";
import { ScriptedModel } from "../src/providers/scripted-model";
import { ToolRegistry, type Tool } from "../src/tools/registry";

function approvalFixture() {
  const store = new InMemoryRunStore();
  let executions = 0;
  const tool: Tool<{ note: string }, { saved: string }> = {
    name: "record_note",
    description: "Record a synthetic note.",
    effect: "write",
    schema: z.object({ note: z.string() }),
    execute: ({ note }) => {
      executions += 1;
      return { saved: note };
    },
  };
  const registry = new ToolRegistry().register(tool);
  const policy = new StaticToolPolicy({
    record_note: {
      kind: "require_approval",
      reason: "Synthetic writes require review",
    },
  });
  return { store, registry, policy, executions: () => executions };
}

describe("Step 6: resumable approvals", () => {
  test("persists a pending approval across runtime reconstruction", async () => {
    const fixture = approvalFixture();
    const waiting = await new DurableHarness(
      new ScriptedModel([
        {
          content: "",
          toolCalls: [
            {
              id: "call-approval",
              name: "record_note",
              arguments: { note: "review me" },
            },
          ],
        },
      ]),
      fixture.registry,
      fixture.store,
      fixture.policy,
    ).start("run-approval", [{ role: "user", content: "record" }]);

    expect(waiting).toMatchObject({
      status: "waiting_for_approval",
      approval: {
        approvalId: 'approval:["run-approval","call-approval"]',
        reason: "Synthetic writes require review",
      },
    });
    expect(fixture.executions()).toBe(0);

    const resumed = await new DurableHarness(
      new ScriptedModel([]),
      fixture.registry,
      fixture.store,
      fixture.policy,
    ).resume("run-approval");
    expect(resumed).toEqual(waiting);
  });

  test("approves, executes once, and completes", async () => {
    const fixture = approvalFixture();
    const firstRuntime = new DurableHarness(
      new ScriptedModel([
        {
          content: "",
          toolCalls: [
            {
              id: "call-approved",
              name: "record_note",
              arguments: { note: "approved" },
            },
          ],
        },
      ]),
      fixture.registry,
      fixture.store,
      fixture.policy,
    );
    const waiting = await firstRuntime.start("run-approved", [
      { role: "user", content: "record" },
    ]);
    if (waiting.status !== "waiting_for_approval") {
      throw new Error("Expected a pending approval");
    }

    const resumedRuntime = new DurableHarness(
      new ScriptedModel([{ content: "saved after approval" }]),
      fixture.registry,
      fixture.store,
      fixture.policy,
    );
    const result = await resumedRuntime.resolveApproval("run-approved", {
      approvalId: waiting.approval.approvalId,
      commandId: "command-1",
      decision: "approve",
    });

    expect(result).toMatchObject({
      status: "completed",
      output: "saved after approval",
    });
    expect(fixture.executions()).toBe(1);

    const retry = await resumedRuntime.resolveApproval("run-approved", {
      approvalId: waiting.approval.approvalId,
      commandId: "command-1",
      decision: "approve",
    });
    expect(retry).toMatchObject({ status: "completed" });
    expect(fixture.executions()).toBe(1);
  });

  test("rejects unknown and conflicting approval commands", async () => {
    const fixture = approvalFixture();
    const harness = new DurableHarness(
      new ScriptedModel([
        {
          content: "",
          toolCalls: [
            {
              id: "call-conflict",
              name: "record_note",
              arguments: { note: "review" },
            },
          ],
        },
        { content: "done" },
      ]),
      fixture.registry,
      fixture.store,
      fixture.policy,
    );
    const waiting = await harness.start("run-conflict", [
      { role: "user", content: "record" },
    ]);
    if (waiting.status !== "waiting_for_approval") {
      throw new Error("Expected a pending approval");
    }

    await expect(
      harness.resolveApproval("run-conflict", {
        approvalId: "wrong",
        commandId: "bad-command",
        decision: "approve",
      }),
    ).rejects.toMatchObject({ code: "APPROVAL_NOT_FOUND" });

    await harness.resolveApproval("run-conflict", {
      approvalId: waiting.approval.approvalId,
      commandId: "decision-command",
      decision: "approve",
    });
    await expect(
      harness.resolveApproval("run-conflict", {
        approvalId: waiting.approval.approvalId,
        commandId: "decision-command",
        decision: "reject",
      }),
    ).rejects.toMatchObject({ code: "APPROVAL_CONFLICT" });
    await expect(
      harness.resolveApproval("run-conflict", {
        approvalId: waiting.approval.approvalId,
        commandId: "different-command",
        decision: "approve",
      }),
    ).rejects.toMatchObject({ code: "APPROVAL_CONFLICT" });
  });

  test("keeps an approved write idempotent across an effect crash", async () => {
    const store = new InMemoryRunStore();
    const sink = new InMemoryEffectSink<string>();
    const registry = new ToolRegistry().register({
      name: "record_note",
      description: "Record a synthetic note.",
      effect: "write",
      schema: z.object({ note: z.string() }),
      execute: ({ note }, context) => ({
        saved: sink.recordOnce(context.idempotencyKey ?? "", note).value,
      }),
    });
    const policy = new StaticToolPolicy({
      record_note: {
        kind: "require_approval",
        reason: "Review the write",
      },
    });
    const waiting = await new DurableHarness(
      new ScriptedModel([
        {
          content: "",
          toolCalls: [
            {
              id: "call-approved-crash",
              name: "record_note",
              arguments: { note: "once" },
            },
          ],
        },
      ]),
      registry,
      store,
      policy,
    ).start("run-approved-crash", [{ role: "user", content: "record" }]);
    if (waiting.status !== "waiting_for_approval") {
      throw new Error("Expected a pending approval");
    }

    let crashed = false;
    await expect(
      new DurableHarness(
        new ScriptedModel([]),
        registry,
        store,
        policy,
        {
          fault(point) {
            if (!crashed && point === "after-tool-execute-before-commit") {
              crashed = true;
              throw new Error("approved effect crash");
            }
          },
        },
      ).resolveApproval("run-approved-crash", {
        approvalId: waiting.approval.approvalId,
        commandId: "approve-crash",
        decision: "approve",
      }),
    ).rejects.toThrow("approved effect crash");

    const afterCrash = await store.read("run-approved-crash");
    expect(
      afterCrash?.events.some(
        (entry) => entry.event.type === "approval.resolved",
      ),
    ).toBeTrue();
    expect(
      afterCrash?.events.some((entry) => entry.event.type === "tool.completed"),
    ).toBeFalse();
    expect(sink.records()).toHaveLength(1);

    const result = await new DurableHarness(
      new ScriptedModel([{ content: "approved and saved" }]),
      registry,
      store,
      policy,
    ).resume("run-approved-crash");
    expect(result).toMatchObject({
      status: "completed",
      output: "approved and saved",
    });
    expect(sink.records()).toHaveLength(1);
  });

  test("rejection executes no tool and lets the model recover", async () => {
    const fixture = approvalFixture();
    const harness = new DurableHarness(
      new ScriptedModel([
        {
          content: "",
          toolCalls: [
            {
              id: "call-rejected",
              name: "record_note",
              arguments: { note: "reject" },
            },
          ],
        },
        { content: "continued without writing" },
      ]),
      fixture.registry,
      fixture.store,
      fixture.policy,
    );
    const waiting = await harness.start("run-rejected", [
      { role: "user", content: "record" },
    ]);
    if (waiting.status !== "waiting_for_approval") {
      throw new Error("Expected a pending approval");
    }

    const result = await harness.resolveApproval("run-rejected", {
      approvalId: waiting.approval.approvalId,
      commandId: "reject-command",
      decision: "reject",
    });

    expect(result).toMatchObject({
      status: "completed",
      output: "continued without writing",
    });
    expect(fixture.executions()).toBe(0);
  });
});
