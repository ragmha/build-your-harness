export type HarnessErrorCode =
  | "UNKNOWN_TOOL"
  | "INVALID_ARGUMENTS"
  | "MAX_STEPS"
  | "ABORTED"
  | "MODEL_EXHAUSTED";

export class HarnessError extends Error {
  constructor(
    public readonly code: HarnessErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "HarnessError";
  }
}
