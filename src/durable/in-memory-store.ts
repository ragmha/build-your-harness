import { HarnessError } from "../core/errors";
import type {
  CommitRequest,
  EventEnvelope,
  RunSnapshot,
  RunStore,
  StoredRun,
} from "./contracts";

export class InMemoryRunStore implements RunStore {
  readonly #runs = new Map<string, StoredRun>();

  async read(runId: string): Promise<StoredRun | undefined> {
    // TODO(step-4): Return a deep clone so callers cannot mutate the store.
    void runId;
    throw new Error("Not implemented: InMemoryRunStore.read");
  }

  async commit(request: CommitRequest): Promise<StoredRun> {
    // TODO(step-4): Enforce expectedVersion, append contiguous envelopes with
    // stable IDs, preserve any checkpoint, and clone all stored values.
    void request;
    throw new Error("Not implemented: InMemoryRunStore.commit");
  }

  async saveCheckpoint(
    runId: string,
    expectedVersion: number,
    snapshot: RunSnapshot,
  ): Promise<StoredRun> {
    // TODO(step-4): Save a snapshot through the current version. Reject stale
    // writers and clone both input and returned data.
    void runId;
    void expectedVersion;
    void snapshot;
    throw new Error("Not implemented: InMemoryRunStore.saveCheckpoint");
  }
}

export function versionConflict(
  runId: string,
  expectedVersion: number,
  actualVersion: number,
): HarnessError {
  return new HarnessError(
    "VERSION_CONFLICT",
    `Run "${runId}" expected version ${expectedVersion}, found ${actualVersion}`,
  );
}

export function envelope(
  runId: string,
  version: number,
  event: EventEnvelope["event"],
): EventEnvelope {
  return {
    runId,
    version,
    eventId: `event:${JSON.stringify([runId, version])}`,
    at: new Date().toISOString(),
    event: structuredClone(event),
  };
}
