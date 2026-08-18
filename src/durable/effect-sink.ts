export interface EffectRecord<T> {
  key: string;
  value: T;
}

export class InMemoryEffectSink<T> {
  readonly #records = new Map<string, T>();

  recordOnce(key: string, value: T): { created: boolean; value: T } {
    // TODO(step-5): Store the first value for an idempotency key and return it
    // for every retry. Never replace an existing effect.
    void key;
    void value;
    throw new Error("Not implemented: InMemoryEffectSink.recordOnce");
  }

  records(): EffectRecord<T>[] {
    return [...this.#records.entries()].map(([key, value]) => ({
      key,
      value: structuredClone(value),
    }));
  }
}
