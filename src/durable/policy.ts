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
    const decision = Object.hasOwn(this.decisions, input.call.name)
      ? this.decisions[input.call.name]
      : undefined;
    return structuredClone(decision ?? this.fallback);
  }
}

export const allowAllPolicy: PolicyGate = {
  evaluate: () => ({ kind: "allow" }),
};
