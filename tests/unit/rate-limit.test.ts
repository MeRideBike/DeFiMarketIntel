import { describe, expect, it } from "vitest";

import { FixedWindowRateLimiter } from "../../apps/web/src/lib/rate-limit";

describe("FixedWindowRateLimiter", () => {
  const policy = { maxRequests: 2, windowMs: 60_000 } as const;

  it("enforces a fixed window and resets cleanly at its boundary", () => {
    const limiter = new FixedWindowRateLimiter();

    expect(limiter.take("market:client-a", policy, 1_000)).toMatchObject({
      allowed: true,
      remaining: 1,
    });
    expect(limiter.take("market:client-a", policy, 2_000)).toMatchObject({
      allowed: true,
      remaining: 0,
    });
    expect(limiter.take("market:client-a", policy, 3_000)).toMatchObject({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 58,
    });
    expect(limiter.take("market:client-a", policy, 61_000)).toMatchObject({
      allowed: true,
      remaining: 1,
    });
  });

  it("keeps rate-limit scopes and clients independent", () => {
    const limiter = new FixedWindowRateLimiter();

    limiter.take("market:client-a", policy, 1_000);
    limiter.take("market:client-a", policy, 1_000);

    expect(limiter.take("search:client-a", policy, 1_000).allowed).toBe(true);
    expect(limiter.take("market:client-b", policy, 1_000).allowed).toBe(true);
  });
});
