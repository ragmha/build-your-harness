import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { loadEvaluationCases, runEvaluations } from "../src/evals/run-evals";
import { loadSkill, renderSkillPrompt } from "../src/skills/load-skill";

const root = resolve(import.meta.dir, "..");

describe("Step 3: skills and evaluations", () => {
  test("loads SKILL.md and sorted references", async () => {
    const skill = await loadSkill(resolve(root, "fixtures/sample-skill"));

    expect(skill.instructions).toContain("Synthetic Code Helper");
    expect(skill.references.map((reference) => reference.path)).toEqual(["references/codes.md"]);
    expect(renderSkillPrompt(skill)).toContain("Reference: references/codes.md");
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
});
