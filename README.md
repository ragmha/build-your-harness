# Build Your Agent Harness

Build a small, provider-neutral AI agent harness from first principles with TypeScript and Bun. The exercise uses a deterministic scripted model, so it needs no API key, secrets, or network model calls.

The central idea is that **agent systems are workflow systems**: the model proposes the next semantic step, while the harness owns state, execution, policy, limits, errors, and observability.

## Welcome

- **Who is this for**: TypeScript developers who want to understand what agent frameworks do underneath the abstractions.
- **What you'll learn**: Model contracts, tool calling, schema validation, context projection, bounded execution, event history, checkpoints, recovery, idempotency, policy gates, resumable approvals, traces, and deterministic evaluation.
- **What you'll build**: A safe, durable harness that runs scripted model responses, invokes typed tools under policy, survives simulated restarts, pauses for approval, resumes without duplicate effects, and writes a machine-readable evaluation report.
- **Prerequisites**:
  - Basic TypeScript knowledge.
  - A GitHub account with Actions enabled.
- **Included toolchain**: Bun 1.3.14, TypeScript 7.0.2, Node.js 24.19.0 LTS, and npm 12.0.2.
- **How long**: About 8 hours.

In this exercise, you will:

1. Define provider-neutral messages, tool calls, model responses, and a deterministic scripted adapter.
2. Build a Zod-backed tool registry and a bounded agent loop with errors, cancellation, timeouts, and traces.
3. Load a `SKILL.md`, project bounded model context, and run repeatable evaluation cases into a JSON report.
4. Persist semantic events, reduce them into state, checkpoint progress, and recover after a simulated restart.
5. Persist policy decisions and make a synthetic write idempotent across the effect-before-commit failure window.
6. Pause for durable human approval and resume safely after runtime reconstruction.

| Step | Focus | Estimated time |
| --- | --- | ---: |
| 1 | Provider-neutral contracts and scripted model | 45–60 minutes |
| 2 | Typed tools, bounded execution, cancellation, and traces | 60–75 minutes |
| 3 | Skill loading, context projection, and evaluations | 75–90 minutes |
| 4 | Event history, checkpoints, and restart recovery | 75–90 minutes |
| 5 | Policy decisions and idempotent effects | 75–90 minutes |
| 6 | Durable approvals and safe resume | 75–90 minutes |

The starter project type-checks, but focused methods contain `TODO` markers and throw `Not implemented` errors. Each lesson's tests guide you toward one small, working increment.

## How to start this exercise

Copy the exercise to your account. Give Mona about 20 seconds to prepare the first lesson, then refresh the new repository page.

[![Copy Exercise](https://img.shields.io/badge/Copy%20Exercise-%E2%86%92-1f883d?style=for-the-badge&logo=github&labelColor=197935)](https://github.com/new?template_owner=ragmha&template_name=build-your-harness&owner=%40me&name=build-your-harness&description=Build+a+small+AI+agent+harness+from+first+principles+with+TypeScript+and+Bun&visibility=public)

### Recommended: open a Codespace

This repository includes a Dev Container, so you can run the exercise in a browser without manually installing the toolchain.

1. In your copied repository, select **Code**.
2. Open the **Codespaces** tab and select **Create codespace on main**.
3. Wait for the setup command to finish. It installs the pinned npm and Bun versions, restores dependencies, and confirms the starter type-checks.
4. Open the exercise issue and begin Step 1.

Codespaces usage counts toward your account's included allowance.

### Local or Dev Container setup

The repository pins its development environment in:

- `.nvmrc`: Node.js 24.19.0 LTS.
- `.npmrc`: strict engine checks and reproducible package-save defaults.
- `package.json`: Bun 1.3.14, TypeScript 7.0.2, and supported engine ranges.
- `.devcontainer/devcontainer.json`: the same Node, npm, Bun, extensions, install, and type-check setup used by Codespaces.

To use the Dev Container locally, install [Docker](https://docs.docker.com/get-docker/), [VS Code](https://code.visualstudio.com/), and the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers). Clone your copied repository, open it in VS Code, and select **Dev Containers: Reopen in Container**.

To work without a container:

```bash
nvm install
nvm use
npm install --global npm@12.0.2 bun@1.3.14
bun install --frozen-lockfile
bun run typecheck
```

Use Bun—not npm—to install dependencies and run project scripts. npm is pinned only to provide a consistent Node.js toolchain and bootstrap Bun when needed.

<details>
<summary>Having trouble?</summary><br/>

- Create a public repository so the exercise can use free GitHub Actions minutes.
- Check the [Actions](../../actions) tab if the exercise issue does not appear after 20 seconds.
- Run `bun install`, `bun run typecheck`, and `bun test` locally to reproduce grading feedback.

</details>

## Safety and scope

All examples are synthetic. The harness includes only a deterministic in-memory model and a harmless lookup tool. It does not execute shell commands, access external services, mutate the filesystem, or require credentials.

This exercise implements the runtime core and its production failure boundaries with in-memory components. The store survives runtime reconstruction inside a test, not an operating-system restart. The synthetic effect sink honors idempotency keys atomically; arbitrary external systems may not. These constraints keep the project secret-free while making recovery behavior testable.

## Architecture at a glance

```text
 SKILL.md + facts + history
             |
             v
      Context projection
             |
             v
      Scripted model adapter
        |              |
 final answer       tool call
        |              |
        |              v
        |       Policy gate
        |       /    |     \
        |    allow  deny  approval
        |       \    |     /
        |        Tool registry
        |        Zod validation
        |              |
        +<-------- tool result
        |
        v
 Semantic events --> reducer --> current state
        |                            |
        +--> checkpoint/store <------+
                    |
             restart + resume
```

The model proposes the next semantic action. The harness owns what is allowed to run, validates inputs, enforces limits, records events, and decides when the workflow is complete.

### Why these boundaries?

This exercise treats each boundary as a small **capability seam**:

- A contract defines what a capability promises.
- A provider implements it, such as `ScriptedModel`.
- A consumer depends only on the contract, such as `runAgent`.
- The tool registry is the single source for both schemas advertised to the model and implementations allowed to execute.
- Trace events describe live execution. A production harness can later persist selected events as durable session facts.

We intentionally stop before dynamic plugin loading, dependency injection, hot reload, and event middleware so the learner can understand the underlying seams first.

## Project map

| Path | Purpose |
| --- | --- |
| `src/core` | Provider-neutral contracts and the agent loop |
| `src/providers` | Deterministic scripted model adapter |
| `src/tools` | Typed registry and safe example tool |
| `src/skills` | `SKILL.md` and reference loader |
| `src/context` | Deterministic state/history-to-context projection |
| `src/durable` | Events, reducer, checkpoints, recovery, policy, idempotency, and approvals |
| `src/evals` | Evaluation loader, runner, and report CLI |
| `fixtures/sample-skill` | Synthetic skill and references |
| `evals/evals.json` | Deterministic evaluation cases |
| `tests` | Lesson-focused and end-to-end tests |

## Useful commands

```bash
bun install --frozen-lockfile
bun run typecheck
bun run grade:step1
bun run grade:step2
bun run grade:step3
bun run grade:step4
bun run grade:step5
bun run grade:step6
bun test
bun run eval
```

`bun run eval` writes `reports/eval-report.json`. Generated reports are intentionally ignored by Git.

## Continue learning

- [Bun documentation](https://bun.sh/docs) for the runtime, package manager, and test runner.
- [TypeScript documentation](https://www.typescriptlang.org/docs/) for strict typing and discriminated unions.
- [Zod documentation](https://zod.dev/) and [JSON Schema 2020-12](https://json-schema.org/draft/2020-12) for runtime validation and model-facing schemas.
- [WHATWG AbortController and AbortSignal](https://dom.spec.whatwg.org/#abortcontroller) for cancellation primitives.
- [Model Context Protocol tools](https://modelcontextprotocol.io/specification/latest/server/tools) for an optional comparison with standardized tool discovery and invocation. This exercise does not implement MCP or JSON-RPC.

### Optional SDK adapter comparison

After completing all six graded steps, try adapting one real provider or SDK behind `ModelAdapter`. Keep `ScriptedModel` as the test double and do not place credentials in the repository. Compare only the boundary mapping: provider messages, tool schemas, tool calls, cancellation, and errors. This appendix is intentionally ungraded because authentication, network availability, model output, and SDK versions are not deterministic.

## Project status

This is an independent personal project maintained by `ragmha`. It is not affiliated with, endorsed by, or sponsored by any employer or organization.

---

© 2025 ragmha • [Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/code_of_conduct.md) • [MIT License](https://gh.io/mit)
