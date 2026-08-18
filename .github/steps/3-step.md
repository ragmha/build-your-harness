## Step 3: Load a skill and evaluate behavior

Production harnesses need more than a loop. They need repeatable instructions, supporting references, evaluation cases, and a report that automation can inspect.

### Theory: skills are context; evaluations are evidence

This exercise treats a skill as:

- `SKILL.md`: primary instructions.
- `references/*.md`: supporting context loaded in stable path order.

Keep three concepts distinct:

- **State** is what the runtime currently knows, such as the model cursor and step count.
- **History** is what happened, represented here by messages and trace events.
- **Context** is the selected information sent to the model for the current turn, including the rendered skill.

This exercise can send the full short history because it is bounded and synthetic. A production harness hydrates context deliberately and applies a token budget rather than assuming history and context are the same thing.

`evals/evals.json` contains synthetic prompts, expected outputs, and scripted model responses. Exact-match assertions are intentionally simple: the goal is to learn the evaluation plumbing before introducing subjective graders.

Read more:

- [Bun file I/O](https://bun.sh/docs/api/file-io)
- [Bun JSON imports and files](https://bun.sh/docs/runtime/file-types)
- [TypeScript narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)

### Activity: load, run, and report

1. Implement `loadSkill` in `src/skills/load-skill.ts`.

   - Read `<root>/SKILL.md`.
   - Find Markdown files under `<root>/references`.
   - Store paths relative to the skill root using `/` separators.
   - Sort references by path before reading or returning them.
   - Let missing or unreadable required files fail clearly.

1. Implement `runEvaluations` in `src/evals/run-evals.ts`.

   - Create a fresh `ScriptedModel` for each case.
   - Register `lookupCodeTool` in a fresh `ToolRegistry`.
   - Run the agent with a system message from `renderSkillPrompt(skill)` and the case's user prompt.
   - Compare the final output with `expectedOutput`.
   - Return per-case results and aggregate `cases`, `passed`, and `failed`.
   - Set `generatedAt` to an ISO timestamp.

1. Run the focused tests and report CLI:

   ```bash
   bun run typecheck
   bun run grade:step3
   bun run eval
   ```

   Expected outcome: three loader and evaluation tests pass, the CLI prints `{"cases":2,"passed":2,"failed":0}`, and `reports/eval-report.json` contains the same totals plus per-case results.

1. Run the complete suite:

   ```bash
   bun test
   ```

1. Commit and push to `main`. The final workflow will grade all three steps and post your review.

### Hints

- `new Bun.Glob("references/**/*.md").scan({ cwd: root })` can discover reference files.
- Normalize Windows path separators before storing report paths.
- Do not reuse one `ScriptedModel` across cases; its cursor is stateful.
- If a push does not start grading, open the Actions tab and run the enabled **Step 3** workflow manually.
