import { z } from "zod";
import type { EvaluationCase, EvaluationReport } from "./types";
import type { LoadedSkill } from "../skills/load-skill";

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
  // TODO(step-3): For each case, create a fresh ScriptedModel and ToolRegistry,
  // run the agent with the rendered skill prompt, and aggregate exact output
  // matches. A fresh model prevents state leaking between cases.
  void skill;
  void cases;
  throw new Error("Not implemented: runEvaluations");
}

export async function writeEvaluationReport(
  report: EvaluationReport,
  outputPath: string,
): Promise<void> {
  await Bun.write(outputPath, `${JSON.stringify(report, null, 2)}\n`);
}
