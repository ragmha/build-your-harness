# Build Your Agent Harness

Build a small, provider-neutral AI agent harness from first principles with TypeScript and Bun. The exercise uses a deterministic scripted model, so it needs no API key, secrets, or network model calls.

The central idea is that **agent systems are workflow systems**: the model proposes the next semantic step, while the harness owns state, execution, policy, limits, errors, and observability.

## Welcome

- **Who is this for**: TypeScript developers who want to understand what agent frameworks do underneath the abstractions.
- **What you'll learn**: Model contracts, tool calling, schema validation, bounded execution, cancellation, traces, skill loading, and deterministic evaluation.
- **What you'll build**: A safe harness that runs scripted model responses, invokes typed read-only tools, loads a local skill, and writes a machine-readable evaluation report.
- **Prerequisites**:
  - Basic TypeScript knowledge.
  - A GitHub account with Actions enabled.
- **Included toolchain**: Bun 1.3.14, TypeScript 7.0.2, Node.js 24.19.0 LTS, and npm 12.0.2.
- **How long**: About 60 minutes.

In this exercise, you will:

1. Define provider-neutral messages, tool calls, model responses, and a deterministic scripted adapter.
2. Build a Zod-backed tool registry and a bounded agent loop with errors, cancellation, timeouts, and traces.
3. Load a `SKILL.md` with references and run repeatable evaluation cases into a JSON report.

The starter project type-checks, but focused methods contain `TODO` markers and throw `Not implemented` errors. Each lesson's tests guide you toward one small, working increment.

## How to start this exercise

Copy the exercise to your account. Give Mona about 20 seconds to prepare the first lesson, then refresh the new repository page.

[![Copy Exercise](https://img.shields.io/badge/Copy%20Exercise-%E2%86%92-1f883d?style=for-the-badge&logo=github&labelColor=197935)](https://github.com/new?template_owner=ragmha&template_name=build-your-harness&owner=%40me&name=build-your-harness&description=Build+a+small+AI+agent+harness+from+first+principles+with+TypeScript+and+Bun&visibility=public)

### Recommended: open a Codespace

Like the [Secure Code Game](https://github.com/skills/secure-code-game#getting-started), this exercise is configured to run in the browser with no manual tool installation.

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

This compact exercise focuses on the runtime core. Production harnesses extend the same primitives with durable checkpoints, idempotency for side effects, context budgets, policy gates, human approval, and resumable workflows. Those are intentionally discussed but not implemented here, keeping the learner focused and the project secret-free.

## Architecture at a glance

```text
 SKILL.md + references          User prompt
            \                      /
             +----> Messages <----+
                       |
                       v
             +------------------+
             | Bounded agent    |<---- cancel / timeout / max steps
             | loop             |
             +--------+---------+
                      |
                      v
             Scripted model adapter
                 |             |
          final answer      tool call
                 |             |
                 |             v
                 |      Typed tool registry
                 |             |
                 |      Zod validation
                 |             |
                 |      Safe lookup tool
                 |             |
                 +<----- tool result
                 |
                 v
          Trace events + evaluation report
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
bun test
bun run eval
```

`bun run eval` writes `reports/eval-report.json`. Generated reports are intentionally ignored by Git.

## Continue learning

The production failure-mode framing in [Hendrixer/harness-engineering](https://github.com/Hendrixer/harness-engineering) is a useful next read: durability, state/history/context separation, policy gates, resumable approvals, and recovery. That course uses production libraries in later lessons; this exercise intentionally implements only the core contracts and runtime loop directly, without an agent SDK.
