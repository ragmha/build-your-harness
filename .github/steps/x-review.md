## Congratulations!

You built a small AI agent harness from first principles without an agent framework or model API.

### What you accomplished

- Defined provider-neutral messages, model responses, and tool call contracts.
- Built a deterministic model adapter for secret-free testing.
- Added an allowlisted, Zod-validated tool registry.
- Implemented a bounded model/tool loop with cancellation, timeouts, typed failures, and trace events.
- Loaded reusable skill instructions and references.
- Ran deterministic evaluations and emitted a machine-readable JSON report.
- Projected bounded model context without confusing it with durable history.
- Replayed semantic events through a reducer and recovered from checkpoints.
- Persisted policy decisions and retried a synthetic effect with a stable idempotency key.
- Paused for durable approval and resumed without duplicate execution.

### The architecture you now understand

```text
context -> model -> proposed call -> policy -> validated tool
   ^                                  |             |
   |                                  v             v
history <- reducer <- durable events <-+-------- result
                       |
                 checkpoint/store
                       |
                  restart/resume
```

Frameworks can add databases, distributed leases, hosted tools, and provider integrations, but they still build on these same primitives.

### From seams to plugins

Your model adapter and tool registry are already extension seams: callers depend on contracts rather than concrete providers. Larger runtimes can apply the same idea to every subsystem.

Three useful rules carry forward without adopting a framework:

1. Keep the contract, provider, and consumer roles distinct.
2. Use one registry as the authority for what the model can discover and what the runtime can execute.
3. Define event meaning explicitly. Live trace events support observation; durable events must be sufficient to reconstruct model-visible history.

A dynamic plugin loader is deliberately outside this exercise. Add one only when independent capabilities truly need configuration-driven loading, lifecycle cleanup, or replacement at runtime.

### Production failure modes to recognize

You implemented each responsibility with deterministic in-memory components. In production, examine these harder boundaries:

- **Durability**: replace the in-memory store with transactional storage and define event-schema migrations.
- **Idempotency**: verify each external destination's key scope, retention, and conflict behavior.
- **Context hydration**: replace the message-count budget with measured tokens, redaction, and relevance policies.
- **Policy and approval**: authenticate approvers, expire requests, revoke stale grants, and audit decisions.
- **Recovery**: add leases, backoff, poison-event handling, compensation, and operational alerts.

### Go further

- Add another harmless read-only tool and evaluation case.
- Add a provider adapter behind the existing `ModelAdapter` interface.
- Compare exact-match evaluation with rubric or property-based scoring.
- Replace the in-memory store with a transactional adapter and test event-schema migration.
- Review [Bun testing](https://bun.sh/docs/test), [Zod](https://zod.dev/), [JSON Schema](https://json-schema.org/draft/2020-12), and the optional [MCP tools specification](https://modelcontextprotocol.io/specification/latest/server/tools).

### Optional: compare one SDK adapter

Implement one ungraded adapter behind `ModelAdapter` using a provider or SDK you already have access to. Keep `ScriptedModel` for every automated test, load credentials only from the environment, and compare how the SDK maps messages, tool schemas, tool calls, cancellation, and errors. Do not move policy, validation, durability, or approval into the adapter; those remain harness responsibilities.
