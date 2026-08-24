export interface RateLimitPolicy {
  readonly maxRequests: number;
  readonly windowMs: number;
}

export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly limit: number;
  readonly remaining: number;
  readonly retryAfterSeconds: number;
}

interface RateLimitBucket {
  requestCount: number;
  resetAt: number;
  lastSeenAt: number;
}

/**
 * A bounded, process-local fixed-window limiter. It is an application safety
 * layer, not a substitute for a shared edge limiter in a multi-instance deployment.
 */
export class FixedWindowRateLimiter {
  private readonly buckets = new Map<string, RateLimitBucket>();

  public constructor(private readonly maxBuckets = 5_000) {}

  public take(key: string, policy: RateLimitPolicy, now = Date.now()): RateLimitDecision {
    this.prune(now);
    const existing = this.buckets.get(key);
    const bucket =
      !existing || now >= existing.resetAt
        ? {
            requestCount: 0,
            resetAt: now + policy.windowMs,
            lastSeenAt: now,
          }
        : existing;

    bucket.lastSeenAt = now;
    bucket.requestCount = Math.min(policy.maxRequests + 1, bucket.requestCount + 1);
    this.buckets.set(key, bucket);

    const allowed = bucket.requestCount <= policy.maxRequests;
    return {
      allowed,
      limit: policy.maxRequests,
      remaining: Math.max(0, policy.maxRequests - bucket.requestCount),
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000)),
    };
  }

  private prune(now: number): void {
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
    while (this.buckets.size >= this.maxBuckets) {
      const oldestKey = this.buckets.keys().next().value;
      if (!oldestKey) {
        return;
      }
      this.buckets.delete(oldestKey);
    }
  }
}

type GlobalWithRateLimiter = typeof globalThis & {
  __defiMarketIntelRateLimiter?: FixedWindowRateLimiter;
};

const globalScope = globalThis as GlobalWithRateLimiter;

export const apiRateLimiter =
  globalScope.__defiMarketIntelRateLimiter ??
  (globalScope.__defiMarketIntelRateLimiter = new FixedWindowRateLimiter());

/**
 * Uses only a normalized address supplied by the deployment's trusted proxy.
 * Direct deployments fall back to one anonymous bucket rather than retaining arbitrary header data.
 */
export function requestClientKey(headers: Headers): string {
  const forwarded = [
    headers.get("cf-connecting-ip"),
    headers.get("x-vercel-forwarded-for"),
    headers.get("x-forwarded-for")?.split(",")[0],
    headers.get("x-real-ip"),
  ]
    .find((value) => value?.trim())
    ?.trim()
    .toLowerCase();

  return forwarded && /^[a-f0-9:.]{1,64}$/i.test(forwarded) ? `ip:${forwarded}` : "ip:anonymous";
}
