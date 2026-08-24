/**
 * Bounded in-memory TTL cache with request coalescing. A Redis-backed implementation can
 * satisfy the same call pattern when deployments need cache sharing across instances.
 */
export class TtlCache {
  private readonly values = new Map<string, { expiresAt: number; value: unknown }>();
  private readonly inFlight = new Map<string, Promise<unknown>>();

  public constructor(private readonly maxEntries = 500) {}

  public async getOrLoad<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const cached = this.values.get(key);
    if (cached && cached.expiresAt > now) {
      this.values.delete(key);
      this.values.set(key, cached);
      return cached.value as T;
    }

    const pending = this.inFlight.get(key);
    if (pending) {
      return pending as Promise<T>;
    }

    const request = loader()
      .then((value) => {
        this.values.set(key, { value, expiresAt: Date.now() + ttlMs });
        this.trim();
        return value;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, request);
    return request;
  }

  public clear(): void {
    this.values.clear();
    this.inFlight.clear();
  }

  private trim(): void {
    while (this.values.size > this.maxEntries) {
      const leastRecentlyUsed = this.values.keys().next().value;
      if (typeof leastRecentlyUsed !== "string") {
        return;
      }
      this.values.delete(leastRecentlyUsed);
    }
  }
}
