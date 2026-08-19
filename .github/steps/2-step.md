## Step 2: Build a safe tool-calling loop

A harness turns model-proposed tool calls into controlled program execution. The model may propose a name and arguments, but your code decides which tools exist, validates every input, bounds the loop, and records what happened.

Think of this as a tiny workflow runtime: the model chooses a semantic next step, but the harness remains the control plane.

### Theory: the model proposes, the harness disposes

The key safety boundaries are:

1. **Allowlist**: only tools registered in `ToolRegistry` may run.
2. **Validation**: Zod parses unknown model input into a typed value.
3. **Bounds**: `maxSteps` prevents an endless model/tool cycle.
4. **Cancellation**: a caller signal or timeout stops model and tool work.
5. **Traceability**: trace events make the control flow observable.

The trace is an execution record, not model context. Keeping those concepts separate makes it possible to add persistence or replay later without automatically sending the entire history back to a model.

Native model tool-call formats vary by provider. This exercise defines a small provider-neutral contract and relies on these official primitives:

- [Zod schemas](https://zod.dev/)
- [JSON Schema 2020-12](https://json-schema.org/draft/2020-12)
- [WHATWG AbortController and AbortSignal](https://dom.spec.whatwg.org/#abortcontroller)
- [Bun and TypeScript](https://bun.sh/docs/runtime/typescript)

For comparison, the [Model Context Protocol tools specification](https://modelcontextprotocol.io/specification/latest/server/tools) standardizes tool discovery and invocation between clients and servers. The local registry in this exercise is not an MCP implementation.

### Activity: register tools and run the loop

1. Implement `ToolRegistry.execute` in `src/tools/registry.ts`.

   - Throw `UNKNOWN_TOOL` when the name is not registered.
   - Call `tool.schema.safeParse(input)`.
   - Throw `INVALID_ARGUMENTS` with useful Zod issue text when parsing fails.
   - Call `tool.execute(parsed.data, context)` only after validation.

1. Implement `runAgent` in `src/core/agent.ts`.

   - Default to 8 model steps.
   - Combine the optional caller signal with a timeout signal.
   - Build each `ModelRequest` with `tools.definitions()` so the model sees only allowlisted tools and their JSON schemas.
   - Emit `run.started`, model, tool, finish, and failure trace events in order.
   - Append each assistant response to message history.
   - Execute tool calls sequentially and append `tool` messages with `JSON.stringify(result)`.
   - Return when an assistant response has no tool calls.
   - Throw `MAX_STEPS` before making a model request beyond the limit.
   - Normalize cancellation and timeout failures to `HarnessError` code `ABORTED`.

1. Run:

   ```bash
   bun run typecheck
   bun run grade:step2
   ```

   Expected outcome: seven tests pass, including tool advertisement, valid execution, invalid arguments, unknown tools, step limits, caller cancellation, timeout cancellation, and success/failure traces.

1. Commit and push to `main`.

### Hints

- A small local `emit(event)` helper can append to the trace and call `onTrace`.
- Use an `AbortController` plus `setTimeout` for the deadline, then combine its signal with the optional caller signal using `AbortSignal.any`. Clear the timer in `finally`.
- Put model and tool calls inside the same error boundary so `run.failed` is always emitted.
- The final assistant response counts as a model step.
- If a push does not start grading, open the Actions tab and run the enabled **Step 2** workflow manually.
