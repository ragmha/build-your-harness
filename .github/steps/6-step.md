## Step 6: Pause and resume with durable approval

Human approval cannot be represented by a Promise waiting in memory. A real pause must be a durable workflow state that another process can inspect and resolve later.

### Theory: approval is a command bound to recorded intent

When policy returns `require_approval`, persist an `ApprovalRequest` containing the exact tool call and a stable approval ID. Return `waiting_for_approval` without executing the tool.

An `ApprovalCommand` contains:

- the approval ID being resolved;
- a command ID for retry-safe submission;
- `approve` or `reject`.

The runtime accepts the same command twice as an idempotent retry, but rejects unknown approvals, changed decisions, or a different command that tries to resolve an already completed request.

Read more:

- [Scheduler Agent Supervisor pattern](https://learn.microsoft.com/azure/architecture/patterns/scheduler-agent-supervisor)
- [Claim Check pattern](https://learn.microsoft.com/azure/architecture/patterns/claim-check)
- [TypeScript discriminated unions](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions)

### Activity: persist, resolve, and resume

1. Implement approval handling in `applyRunEvent`.

   - `approval.requested` changes status to `waiting_for_approval`.
   - `approval.resolved` stores the command and changes status back to `running`.

1. Implement `DurableHarness.resolveApproval`.

   - Load the run and find the exact persisted request.
   - Throw `APPROVAL_NOT_FOUND` for an unknown ID.
   - Treat an identical command retry as idempotent.
   - Throw `APPROVAL_CONFLICT` for changed or competing resolutions.
   - Commit the resolution, checkpoint, and continue the run.

1. Complete approval behavior in `DurableHarness.drive`.

   - Persist one stable request for an unresolved approval-required call.
   - Return the same waiting result after runtime reconstruction.
   - Execute only after approval.
   - Convert rejection into a deterministic denied tool result.
   - Preserve the Step 5 idempotency behavior after approval.

1. Run final grading:

   ```bash
   bun run typecheck
   bun run grade:step6
   bun run eval
   ```

   Expected outcome: the full suite passes, approvals survive runtime reconstruction, approved tools execute once, rejected tools execute zero times, conflicting commands fail, and the deterministic evaluation report succeeds.

1. Commit and push to `main`. The final workflow will post your review and finish the exercise.

### Hints

- Bind approval to the persisted call; never accept replacement arguments from the command.
- Build `approvalId` with the provided helper; it encodes the run and call IDs without delimiter collisions.
- Resolving approval changes durable state before any executor is called.
- A rejected call should still produce a tool message so the model can choose another action.
