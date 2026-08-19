import type { ModelResponse } from "../core/contracts";

export interface EvaluationCase {
  id: string;
  prompt: string;
  expectedOutput: string;
  script: ModelResponse[];
}

export interface EvaluationResult {
  id: string;
  passed: boolean;
  expectedOutput: string;
  actualOutput: string;
  steps: number;
}

export interface EvaluationReport {
  generatedAt: string;
  totals: {
    cases: number;
    passed: number;
    failed: number;
  };
  results: EvaluationResult[];
}
