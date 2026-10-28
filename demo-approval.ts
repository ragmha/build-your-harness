import { z } from "zod";
import { DurableHarness } from "./src/durable/harness";
import { InMemoryRunStore } from "./src/durable/in-memory-store";
import { StaticToolPolicy } from "./src/durable/policy";
import { ScriptedModel } from "./src/providers/scripted-model";
import { ToolRegistry } from "./src/tools/registry";

const tools = new ToolRegistry().register({
  name: "send_note",
  description: "Send a short note.",
  effect: "write",
  schema: z.object({ text: z.string() }),
  execute: ({ text }) => ({ sent: text }),
});
const policy = new StaticToolPolicy({
  send_note: { kind: "require_approval", reason: "Writes need a human" },
});
const store = new InMemoryRunStore();

const firstModel = new ScriptedModel([
  { content: "", toolCalls: [{ id: "c1", name: "send_note", arguments: { text: "hi" } }] },
]);
const first = await new DurableHarness(firstModel, tools, store, policy).start("run-1", [
  { role: "user", content: "Send hi" },
]);
console.log(first.status);
if (first.status !== "waiting_for_approval") throw new Error("expected a pause");

// A brand-new harness instance reuses the same in-memory store.
const model = new ScriptedModel([{ content: "Note sent." }]);
const done = await new DurableHarness(model, tools, store, policy).resolveApproval("run-1", {
  approvalId: first.approval.approvalId,
  commandId: "cmd-1",
  decision: "approve",
});
console.log(done.status, done.status === "completed" ? done.output : "");
