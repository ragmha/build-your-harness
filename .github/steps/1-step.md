## Step 1: Define the model boundary

Agent frameworks begin with a small boundary: messages go in and a model response comes out. Keeping that boundary provider-neutral lets the rest of the harness work with a real API, a local model, or the deterministic adapter used here.

### Theory: contracts before providers

Open these files:

- `src/core/contracts.ts` defines messages, tool calls, model requests, responses, and `ModelAdapter`.
- `src/core/errors.ts` defines typed harness failures.
- `src/providers/scripted-model.ts` stores a fixed sequence of responses.

`ScriptedModel` is deliberately simple. Each `complete` call consumes one response. There is no API key, randomness, network call, or hidden global state, which makes every test repeatable.

Read more:

- [TypeScript interfaces](https://www.typescriptlang.org/docs/handbook/2/objects.html)
- [AbortSignal](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal)
- [Bun test runner](https://bun.sh/docs/test)

### Activity: implement the scripted adapter

1. Install dependencies:

   ```bash
   bun install
   ```

1. In `src/providers/scripted-model.ts`, implement `ScriptedModel.complete`.

   - If `signal.aborted` is true, throw a `HarnessError` with code `ABORTED`.
   - Read the response at `#cursor`, then increment the cursor.
   - If there is no response, throw a `HarnessError` with code `MODEL_EXHAUSTED`.
   - Return `structuredClone(response)` so callers cannot mutate the stored script.

1. Run the focused checks:

   ```bash
   bun run typecheck
   bun run grade:step1
   ```

   Expected outcome: TypeScript reports no errors and all three Step 1 tests pass.

1. Commit and push your changes to `main`. The exercise will grade the push and post Step 2 only after the checks pass.

### Hints

- Check cancellation before consuming a response.
- Use the existing `HarnessError` rather than a plain `Error`.
- `remaining` should reach zero after the last scripted response is consumed.
