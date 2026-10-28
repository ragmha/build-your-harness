import { runAgent } from "./src/core/agent";
import { ScriptedModel } from "./src/providers/scripted-model";
import { ToolRegistry } from "./src/tools/registry";
import { lookupCodeTool } from "./src/tools/lookup-code";

const model = new ScriptedModel([
  { content: "", toolCalls: [{ id: "call-1", name: "lookup_code", arguments: { code: "alpha" } }] },
  { content: "Alpha is the first synthetic entry." },
]);
const tools = new ToolRegistry().register(lookupCodeTool);

const result = await runAgent(
  model,
  tools,
  [{ role: "user", content: "What does ALPHA mean?" }],
  { onTrace: (event) => console.log(event.type) },
);
console.log(result.output);
