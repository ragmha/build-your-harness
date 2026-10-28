import { DurableHarness } from "./durable/harness";
import { InMemoryRunStore } from "./durable/in-memory-store";
import { StaticToolPolicy } from "./durable/policy";
import { ScriptedModel } from "./providers/scripted-model";
import { registerFileTools } from "./tools/filesystem";
import { ToolRegistry } from "./tools/registry";

const tools = new ToolRegistry();
registerFileTools(tools, "./workspace");

const policy = new StaticToolPolicy({
  list_files: { kind: "allow" },
  read_file: { kind: "allow" },
  edit_file: { kind: "require_approval", reason: "Review the proposed file change" },
});

const model = new ScriptedModel([
  {
    content: "",
    toolCalls: [{
      id: "read-1",
      name: "read_file",
      arguments: { path: "notes.txt" },
    }],
  },
  {
    content: "",
    toolCalls: [{
      id: "edit-1",
      name: "edit_file",
      arguments: { path: "notes.txt", oldText: "TODO", newText: "Done" },
    }],
  },
  { content: "Updated notes.txt." },
]);

const harness = new DurableHarness(
  model,
  tools,
  new InMemoryRunStore(),
  policy,
);
const run = await harness.start("coding-demo", [
  { role: "user", content: "Replace TODO with Done in notes.txt." },
]);
if (run.status === "waiting_for_approval") {
  console.log(run.status);
  console.log(JSON.stringify(run.approval.toolCall.arguments));
}
