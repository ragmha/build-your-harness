import type { ModelAdapter, ModelRequest, ModelResponse } from "../core/contracts";
import { HarnessError } from "../core/errors";

export class ScriptedModel implements ModelAdapter {
  readonly #responses: readonly ModelResponse[];
  #cursor = 0;

  constructor(responses: readonly ModelResponse[]) {
    this.#responses = structuredClone(responses);
  }

  async complete(_request: ModelRequest, signal: AbortSignal): Promise<ModelResponse> {
    if (signal.aborted) {
      throw new HarnessError("ABORTED", "Model request was cancelled", {
        cause: signal.reason,
      });
    }

    const response = this.#responses[this.#cursor];
    if (!response) {
      throw new HarnessError("MODEL_EXHAUSTED", "Scripted model has no responses left");
    }
    this.#cursor += 1;
    return structuredClone(response);
  }

  get remaining(): number {
    return this.#responses.length - this.#cursor;
  }
}
