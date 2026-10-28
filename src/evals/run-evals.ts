import { z } from "zod";
import type { EvaluationCase, EvaluationReport, EvaluationResult } from "./types";
import { renderSkillPrompt, type LoadedSkill } from "../skills/load-skill";
import { runAgent } from "../core/agent";
import { ScriptedModel } from "../providers/scripted-model";
import { ToolRegistry } from "../tools/registry";
import { lookupCodeTool } from "../tools/lookup-code";

const evaluationCaseSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  expectedOutput: z.string(),
  script: z.array(
    z.object({
      content: z.string(),
      toolCalls: z
        .array(
          z.object({
            id: z.string().min(1),
            name: z.string().min(1),
            arguments: z.unknown(),
          }),
        )
        .optional(),
    }),
  ),
});

export async function loadEvaluationCases(path: string): Promise<EvaluationCase[]> {
  const value: unknown = await Bun.file(path).json();
  return z.array(evaluationCaseSchema).parse(value).map((evaluationCase) => ({
    id: evaluationCase.id,
    prompt: evaluationCase.prompt,
    expectedOutput: evaluationCase.expectedOutput,
    script: evaluationCase.script.map((response) => ({
      content: response.content,
      ...(response.toolCalls
        ? {
            toolCalls: response.toolCalls.map((toolCall) => ({
              id: toolCall.id,
              name: toolCall.name,
              arguments: toolCall.arguments,
            })),
          }
        : {}),
    })),
  }));
}

export async function runEvaluations(
  skill: LoadedSkill,
  cases: readonly EvaluationCase[],
): Promise<EvaluationReport> {
  const systemPrompt = renderSkillPrompt(skill);
  const results: EvaluationResult[] = [];

  for (const evaluationCase of cases) {
    const model = new ScriptedModel(evaluationCase.script);
    const tools = new ToolRegistry().register(lookupCodeTool);
    const run = await runAgent(model, tools, [
      { role: "system", content: systemPrompt },
      { role: "user", content: evaluationCase.prompt },
    ]);

    results.push({
      id: evaluationCase.id,
      passed: run.output === evaluationCase.expectedOutput,
      expectedOutput: evaluationCase.expectedOutput,
      actualOutput: run.output,
      steps: run.steps,
    });
  }

  const passed = results.filter((result) => result.passed).length;
  return {
    generatedAt: new Date().toISOString(),
    totals: { cases: results.length, passed, failed: results.length - passed },
    results,
  };
}

export async function writeEvaluationReport(
  report: EvaluationReport,
  outputPath: string,
): Promise<void> {
  await Bun.write(outputPath, `${JSON.stringify(report, null, 2)}\n`);
}
