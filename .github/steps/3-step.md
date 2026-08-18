## Step 3: Project context and evaluate behavior

Production harnesses need more than a loop. They need repeatable instructions, supporting references, deliberate context selection, evaluation cases, and a report that automation can inspect.

### Theory: skills are context; evaluations are evidence

This exercise treats a skill as:

- `SKILL.md`: primary instructions.
- `references/*.md`: supporting context loaded in stable path order.

Keep three concepts distinct:

- **State** is what the runtime currently knows, such as the model cursor and step count.
- **History** is what happened, represented here by messages and trace events.
- **Context** is the selected information sent to the model for the current turn, including the rendered skill.

`projectContext` uses a deterministic soft message target rather than a tokenizer. It includes instructions, sorted durable facts, and the newest history blocks. An assistant tool call and its contiguous tool results form one indivisible block, so the projection may exceed the target rather than send an orphaned result.

`evals/evals.json` contains synthetic prompts, expected outputs, and scripted model responses. Exact-match assertions are intentionally simple: the goal is to learn the evaluation plumbing before introducing subjective graders.

Read more:

- [Bun file I/O](https://bun.sh/docs/api/file-io)
- [Bun JSON imports and files](https://bun.sh/docs/runtime/file-types)
- [TypeScript narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- [JSON Schema 2020-12](https://json-schema.org/draft/2020-12)

### Activity: load, project, run, and report

1. Implement `loadSkill` in `src/skills/load-skill.ts`.

   - Read `<root>/SKILL.md`.
   - Find Markdown files under `<root>/references`.
   - Store paths relative to the skill root using `/` separators.
   - Sort references by path before reading or returning them.
   - Let missing or unreadable required files fail clearly.

1. Implement `projectContext` in `src/context/project-context.ts`.

   - Add the optional instructions as the first system message.
   - Render facts as `key: value` lines sorted by key.
   - Group an assistant tool-call message with its contiguous tool results.
   - Select the newest complete blocks toward `historyMessageTarget`.
   - Allow the boundary block to exceed the target rather than split a tool exchange.
   - Report included and omitted history-message counts.
   - Return clones so model code cannot mutate stored history.

1. Update `runAgent` in `src/core/agent.ts`.

   - When `options.context` is provided, call `projectContext` for each model request.
   - Continue storing the full history in `AgentResult.messages`.
   - Do not place trace events in model context.

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

   Expected outcome: six skill, context, and evaluation tests pass, the CLI prints `{"cases":2,"passed":2,"failed":0}`, and `reports/eval-report.json` contains the same totals plus per-case results.

1. Run the complete suite:

   ```bash
   bun test
   ```

1. Commit and push to `main`. The workflow will post Step 4 after all cumulative checks pass.

### Hints

- `new Bun.Glob("references/**/*.md").scan({ cwd: root })` can discover reference files.
- Normalize Windows path separators before storing report paths.
- Do not reuse one `ScriptedModel` across cases; its cursor is stateful.
- Build blocks before applying the message budget; truncating first can orphan a tool result.
- If a push does not start grading, open the Actions tab and run the enabled **Step 3** workflow manually.
