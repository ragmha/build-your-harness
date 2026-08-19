import type { ModelAdapter, ModelRequest, ModelResponse } from "../core/contracts";
import { HarnessError } from "../core/errors";

export class ScriptedModel implements ModelAdapter {
  readonly #responses: readonly ModelResponse[];
  #cursor = 0;

  constructor(responses: readonly ModelResponse[]) {
    this.#responses = structuredClone(responses);
  }

  async complete(_request: ModelRequest, signal: AbortSignal): Promise<ModelResponse> {
    // TODO(step-1): Respect cancellation, return the next cloned response, and
    // throw HarnessError("MODEL_EXHAUSTED", ...) when the script is exhausted.
    void signal;
    throw new Error("Not implemented: ScriptedModel.complete");
  }

  get remaining(): number {
    return this.#responses.length - this.#cursor;
  }
}
