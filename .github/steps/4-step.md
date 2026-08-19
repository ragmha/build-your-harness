## Step 4: Make execution durable and recoverable

An in-memory call stack disappears when a process stops. A durable harness records semantic facts before moving to the next side effect, then reconstructs current state by replaying those facts.

### Theory: history is the source; state is a projection

This step introduces four separate objects:

1. `RunEvent` records what happened.
2. `RunState` records the current control position.
3. `RunSnapshot` combines projected state with message history.
4. `RunCheckpoint` caches a projection through one event version.

The append-only event list remains authoritative. A checkpoint is only an optimization: recovery must apply every event after `throughVersion`.

Failures are terminal and propagate as thrown `HarnessError`s. `DurableRunResult` therefore represents only completed and waiting runs; resuming a failed run throws its persisted failure.

`InMemoryRunStore` demonstrates optimistic concurrency with `expectedVersion`. It survives reconstruction of `DurableHarness` inside the same process, which is enough to test restart semantics without adding a database.

Read more:

- [Event sourcing pattern](https://learn.microsoft.com/azure/architecture/patterns/event-sourcing)
- [Compensating transaction pattern](https://learn.microsoft.com/azure/architecture/patterns/compensating-transaction)
- [JavaScript structured clone](https://developer.mozilla.org/docs/Web/API/Window/structuredClone)

### Activity: store, reduce, checkpoint, resume

1. Implement `applyRunEvent` and `replayEvents` in `src/durable/reducer.ts`.

   - Treat the reducer as a pure function.
   - Append `run.started` initial messages to history.
   - Append model responses as assistant messages.
   - Reject a tool-call ID that was already seen in the run.
   - Remove completed or denied calls from `pendingToolCalls`.
   - Append tool results to history.
   - Derive waiting and terminal statuses from events.
   - When a checkpoint exists, apply only its event tail.

1. Implement `InMemoryRunStore` in `src/durable/in-memory-store.ts`.

   - Require `expectedVersion` to match the current version.
   - Assign contiguous versions and stable event IDs.
   - Preserve an existing checkpoint when appending.
   - Deep-clone data on write and read.
   - Save checkpoints only at the current version.

1. Implement the Step 4 parts of `DurableHarness` in `src/durable/harness.ts`.

   - `start` commits `run.started`, checkpoints it, then drives execution.
   - `resume` loads a run or throws `RUN_NOT_FOUND`.
   - Persist every model response before acting on its tool calls.
   - Skip tool calls that already have a durable completion.
   - Save checkpoints after semantic transitions.
   - Return completed runs without calling the model again.
   - Let the supplied fault hook simulate a process crash without writing a normal failure event.

   Use this control-flow skeleton:

   ```text
   load events + checkpoint
   reduce checkpoint + event tail
   if terminal: return or throw persisted failure
   if pending tool calls:
       process the first pending call
       persist its result
       checkpoint and reload
   else:
       enforce the persisted max-step budget
       project fresh model context
       request one model response
       persist the response before acting on calls
       checkpoint and reload
   ```

   Always drain pending tool calls before requesting another model response. A response may contain multiple calls; process them sequentially in their recorded order.

1. Run:

   ```bash
   bun run typecheck
   bun run grade:step4
   ```

   Expected outcome: all cumulative tests through Step 4 pass, including immutable storage, stale-writer rejection, checkpoint-tail replay, restart recovery, completed-run no-op, and missing-run errors.

1. Commit and push to `main`.

### Hints

- A new run starts at version `0`; its first committed event becomes version `1`.
- Use `structuredClone` at every store boundary.
- Checkpoint replay must work from the checkpoint plus its tail even if compacted pre-checkpoint events are unavailable.
- A crash after a committed model response must resume from its pending calls, not ask for that response again.
- If a push does not start grading, run the enabled **Step 4** workflow manually.
