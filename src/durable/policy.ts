import type {
  PolicyDecision,
  PolicyGate,
  PolicyInput,
} from "./contracts";

export class StaticToolPolicy implements PolicyGate {
  constructor(
    private readonly decisions: Readonly<Record<string, PolicyDecision>>,
    private readonly fallback: PolicyDecision = {
      kind: "deny",
      reason: "Tool is not allowed by policy",
    },
  ) {}

  evaluate(input: PolicyInput): PolicyDecision {
    // TODO(step-5): Return a clone of the exact-name decision or the
    // deny-by-default fallback. Policy evaluation must not mutate inputs.
    void input;
    throw new Error("Not implemented: StaticToolPolicy.evaluate");
  }
}

export const allowAllPolicy: PolicyGate = {
  evaluate: () => ({ kind: "allow" }),
};
