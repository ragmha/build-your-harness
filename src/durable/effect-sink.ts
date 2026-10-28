export interface EffectRecord<T> {
  key: string;
  value: T;
}

export class InMemoryEffectSink<T> {
  readonly #records = new Map<string, T>();

  recordOnce(key: string, value: T): { created: boolean; value: T } {
    if (!this.#records.has(key)) {
      this.#records.set(key, structuredClone(value));
      return { created: true, value: structuredClone(value) };
    }
    return { created: false, value: structuredClone(this.#records.get(key) as T) };
  }

  records(): EffectRecord<T>[] {
    return [...this.#records.entries()].map(([key, value]) => ({
      key,
      value: structuredClone(value),
    }));
  }
}
