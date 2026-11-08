/** Share concurrent reads only. No stored-response cache, TTL or user data reuse. */
export class ReadCoalescer {
  private generation = 0;
  private pending = new Map<string, Promise<unknown>>();

  invalidate() {
    this.generation++;
    this.pending.clear();
  }

  async read<T>(key: string, load: () => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const generation = this.generation;
      let promise = this.pending.get(key) as Promise<T> | undefined;
      if (!promise) {
        promise = Promise.resolve().then(load);
        this.pending.set(key, promise);
      }
      let value: T;
      try { value = await promise; }
      finally { if (this.pending.get(key) === promise) this.pending.delete(key); }
      // A write overlapped this read: fetch again rather than return old records.
      if (generation === this.generation) return value;
    }
    throw new Error("Your records changed while loading. Reload them before continuing.");
  }
}
