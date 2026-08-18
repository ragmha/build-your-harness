export type HarnessErrorCode =
  | "UNKNOWN_TOOL"
  | "INVALID_ARGUMENTS"
  | "MAX_STEPS"
  | "ABORTED"
  | "MODEL_EXHAUSTED"
  | "RUN_EXISTS"
  | "RUN_NOT_FOUND"
  | "VERSION_CONFLICT"
  | "DUPLICATE_TOOL_CALL"
  | "APPROVAL_NOT_FOUND"
  | "APPROVAL_CONFLICT";

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
