## Step 5: Add policy gates and idempotent effects

Durability prevents lost progress, but it does not decide whether a proposed tool is allowed or close the failure window between an external effect and recording its completion.

### Theory: persist decisions; make effects retry-safe

The model proposes a tool call. The harness resolves its registered effect class and asks `PolicyGate` for one of:

- `allow`
- `deny`
- `require_approval`

Persist the decision before acting. Recovery then reuses the exact decision instead of silently applying a changed policy to an in-flight call.

For writes, runtime replay protection is not enough. A process can stop after the tool performs an effect but before `tool.completed` is committed. A canonical, unambiguous key derived from the run ID, tool name, call ID, and arguments lets an idempotency-aware destination return the original result on retry.

Read more:

- [Retry pattern](https://learn.microsoft.com/azure/architecture/patterns/retry)
- [Idempotent Consumer pattern](https://microservices.io/patterns/communication-style/idempotent-consumer.html)
- [Zod schemas](https://zod.dev/)

### Activity: gate tools and close the effect gap

1. Implement `StaticToolPolicy.evaluate` in `src/durable/policy.ts`.

   - Match exact tool names.
   - Return a deep clone of the configured decision.
   - Deny by default when no decision is configured.

1. Implement `InMemoryEffectSink.recordOnce` in `src/durable/effect-sink.ts`.

   - Store the first value for an idempotency key.
   - On a retry, return the original value with `created: false`.
   - Never overwrite the first effect.

1. Implement the Step 5 parts of `DurableHarness.drive`.

   - Resolve the effect class with `ToolRegistry.effectOf`.
   - Commit `policy.decided` before execution and call the policy fault hook.
   - Reuse persisted decisions after restart.
   - Convert denial into a deterministic tool result so the model can recover.
   - Pass `runId`, `toolCallId`, and the canonical stable idempotency key to the tool.
   - Call the effect-before-commit fault hook after execution but before `tool.completed`.

1. Run:

   ```bash
   bun run typecheck
   bun run grade:step5
   ```

   Expected outcome: all cumulative tests through Step 5 pass, including deny-by-default behavior, persisted decisions, denial feedback, and one synthetic effect across a crash and retry.

1. Commit and push to `main`.

### Hints

- Policy is evaluated once per tool-call ID, not once per process.
- Denial is a tool outcome, not an executor invocation.
- Runtime caching gives at-most-once replay after a recorded completion. Destination idempotency handles the unrecorded effect window.
- Exactly-once behavior is not generally possible unless the destination participates in the idempotency contract.
