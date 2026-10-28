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
    return structuredClone(this.#runs.get(runId));
  }

  async commit(request: CommitRequest): Promise<StoredRun> {
    const current = this.#runs.get(request.runId) ?? { version: 0, events: [] };
    if (request.expectedVersion !== current.version) {
      throw versionConflict(request.runId, request.expectedVersion, current.version);
    }

    const events = request.events.map((event, index) =>
      envelope(request.runId, current.version + index + 1, event),
    );
    const next: StoredRun = {
      ...current,
      version: current.version + events.length,
      events: [...current.events, ...events],
    };
    this.#runs.set(request.runId, structuredClone(next));
    return structuredClone(next);
  }

  async saveCheckpoint(
    runId: string,
    expectedVersion: number,
    snapshot: RunSnapshot,
  ): Promise<StoredRun> {
    const current = this.#runs.get(runId);
    if (!current) {
      throw new HarnessError("RUN_NOT_FOUND", `Run "${runId}" was not found`);
    }
    if (expectedVersion !== current.version) {
      throw versionConflict(runId, expectedVersion, current.version);
    }

    const next: StoredRun = {
      ...current,
      checkpoint: { throughVersion: current.version, snapshot: structuredClone(snapshot) },
    };
    this.#runs.set(runId, next);
    return structuredClone(next);
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
