## Congratulations!

You built a small AI agent harness from first principles without an agent framework or model API.

### What you accomplished

- Defined provider-neutral messages, model responses, and tool call contracts.
- Built a deterministic model adapter for secret-free testing.
- Added an allowlisted, Zod-validated tool registry.
- Implemented a bounded model/tool loop with cancellation, timeouts, typed failures, and trace events.
- Loaded reusable skill instructions and references.
- Ran deterministic evaluations and emitted a machine-readable JSON report.

### The architecture you now understand

```text
messages -> model adapter -> response
                    |
                    v
             validated tool call
                    |
                    v
             tool result message
                    |
                    +----> model adapter
```

Frameworks can add persistence, orchestration, hosted tools, and provider integrations, but they still build on these same primitives.

### From seams to plugins

Your model adapter and tool registry are already extension seams: callers depend on contracts rather than concrete providers. Larger runtimes can apply the same idea to every subsystem.

Three useful rules carry forward without adopting a framework:

1. Keep the contract, provider, and consumer roles distinct.
2. Use one registry as the authority for what the model can discover and what the runtime can execute.
3. Define event meaning explicitly. Live trace events support observation; durable events must be sufficient to reconstruct model-visible history.

A dynamic plugin loader is deliberately outside this exercise. Add one only when independent capabilities truly need configuration-driven loading, lifecycle cleanup, or replacement at runtime.

### Production failure modes to recognize

You deliberately kept this exercise small, but you can now identify the next harness responsibilities:

- **Durability**: checkpoint completed model and tool steps so a restart does not lose progress.
- **Idempotency**: prevent a retried tool call from repeating an irreversible side effect.
- **Context hydration**: separate state, history, and the token-budgeted context for one turn.
- **Policy and approval**: gate privileged tools before execution; never treat a blocked function call as durable human-in-the-loop.
- **Recovery**: represent pause, failure, retry, and resume as explicit workflow states.

### Go further

- Add another harmless read-only tool and evaluation case.
- Add a provider adapter behind the existing `ModelAdapter` interface.
- Compare exact-match evaluation with rubric or property-based scoring.
- Add an append-only event log, deterministic checkpoints, and idempotency keys without changing the model contract.
- Review [Bun testing](https://bun.sh/docs/test), [Zod](https://zod.dev/), [JSON Schema](https://json-schema.org/draft/2020-12), and the optional [MCP tools specification](https://modelcontextprotocol.io/specification/latest/server/tools).
