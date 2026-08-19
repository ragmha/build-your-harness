import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { loadEvaluationCases, runEvaluations } from "../src/evals/run-evals";
import { loadSkill, renderSkillPrompt } from "../src/skills/load-skill";
import { projectContext } from "../src/context/project-context";
import { runAgent } from "../src/core/agent";
import type { ModelRequest } from "../src/core/contracts";
import { ToolRegistry } from "../src/tools/registry";
import { lookupCodeTool } from "../src/tools/lookup-code";

const root = resolve(import.meta.dir, "..");

describe("Step 3: skills and evaluations", () => {
  test("loads SKILL.md and sorted references", async () => {
    const skill = await loadSkill(resolve(root, "fixtures/sample-skill"));

    expect(skill.instructions).toContain("Synthetic Code Helper");
    expect(skill.references.map((reference) => reference.path)).toEqual([
      "references/aliases.md",
      "references/codes.md",
    ]);
    expect(renderSkillPrompt(skill)).toContain(
      "Reference: references/codes.md",
    );
  });

  test("runs every deterministic case and aggregates a report", async () => {
    const skill = await loadSkill(resolve(root, "fixtures/sample-skill"));
    const cases = await loadEvaluationCases(resolve(root, "evals/evals.json"));
    const report = await runEvaluations(skill, cases);

    expect(report.totals).toEqual({ cases: 2, passed: 2, failed: 0 });
    expect(report.results).toHaveLength(2);
    expect(report.results.every((result) => result.passed)).toBeTrue();
    expect(new Date(report.generatedAt).toISOString()).toBe(report.generatedAt);
  });

  test("counts output mismatches as failed cases", async () => {
    const skill = await loadSkill(resolve(root, "fixtures/sample-skill"));
    const report = await runEvaluations(skill, [
      {
        id: "intentional-mismatch",
        prompt: "Return the scripted output.",
        expectedOutput: "expected",
        script: [{ content: "actual" }],
      },
    ]);

    expect(report.totals).toEqual({ cases: 1, passed: 0, failed: 1 });
    expect(report.results[0]).toMatchObject({
      id: "intentional-mismatch",
      passed: false,
      expectedOutput: "expected",
      actualOutput: "actual",
    });
  });

  test("projects instructions, sorted facts, and recent history", () => {
    const projection = projectContext(
      [
        { role: "user", content: "old" },
        { role: "assistant", content: "middle" },
        { role: "user", content: "new" },
      ],
      {
        instructions: "Follow the synthetic skill.",
        facts: { zone: "test", account: "demo" },
        historyMessageTarget: 2,
      },
    );

    expect(projection.messages).toEqual([
      { role: "system", content: "Follow the synthetic skill." },
      {
        role: "system",
        content: "Known facts:\naccount: demo\nzone: test",
      },
      { role: "assistant", content: "middle" },
      { role: "user", content: "new" },
    ]);
    expect(projection.includedHistoryMessages).toBe(2);
    expect(projection.omittedHistoryMessages).toBe(1);
  });

  test("never splits a tool call from its contiguous results", () => {
    const projection = projectContext(
      [
        { role: "user", content: "old" },
        {
          role: "assistant",
          content: "",
          toolCalls: [
            { id: "call-1", name: "lookup", arguments: { code: "A1" } },
          ],
        },
        {
          role: "tool",
          content: '{"label":"Alpha"}',
          toolCallId: "call-1",
          name: "lookup",
        },
        { role: "user", content: "summarize" },
      ],
      { historyMessageTarget: 2 },
    );

    expect(projection.messages.map((message) => message.role)).toEqual([
      "assistant",
      "tool",
      "user",
    ]);
    expect(projection.includedHistoryMessages).toBe(3);
    expect(projection.omittedHistoryMessages).toBe(1);
  });

  test("reprojects context after each tool result", async () => {
    const requests: ModelRequest[] = [];
    const responses = [
      {
        content: "",
        toolCalls: [
          {
            id: "call-context",
            name: "lookup_code",
            arguments: { code: "alpha" },
          },
        ],
      },
      { content: "done" },
    ];
    await runAgent(
      {
        async complete(request) {
          requests.push(structuredClone(request));
          return responses.shift() ?? { content: "unexpected" };
        },
      },
      new ToolRegistry().register(lookupCodeTool),
      [{ role: "user", content: "look up alpha" }],
      {
        context: {
          instructions: "Synthetic instructions",
          historyMessageTarget: 2,
        },
      },
    );

    expect(requests[0]?.messages).toEqual([
      { role: "system", content: "Synthetic instructions" },
      { role: "user", content: "look up alpha" },
    ]);
    expect(requests[1]?.messages.map((message) => message.role)).toEqual([
      "system",
      "assistant",
      "tool",
    ]);
    expect(requests[1]?.messages.at(-1)).toMatchObject({
      role: "tool",
      toolCallId: "call-context",
      content: '{"found":true,"value":"Alpha is the first synthetic entry."}',
    });
  });
});
