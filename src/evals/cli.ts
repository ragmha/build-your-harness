import { dirname, resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { loadEvaluationCases, runEvaluations, writeEvaluationReport } from "./run-evals";
import { loadSkill } from "../skills/load-skill";

const root = resolve(import.meta.dir, "../..");
const outputPath = resolve(root, "reports/eval-report.json");

const skill = await loadSkill(resolve(root, "fixtures/sample-skill"));
const cases = await loadEvaluationCases(resolve(root, "evals/evals.json"));
const report = await runEvaluations(skill, cases);

await mkdir(dirname(outputPath), { recursive: true });
await writeEvaluationReport(report, outputPath);

console.log(JSON.stringify(report.totals));
if (report.totals.failed > 0) {
  process.exitCode = 1;
}
