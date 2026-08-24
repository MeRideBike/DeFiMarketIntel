import { NextResponse } from "next/server";

import {
  apiRateLimiter,
  requestClientKey,
  type RateLimitDecision,
  type RateLimitPolicy,
} from "@/lib/rate-limit";

type ApiRateLimitScope = "health" | "search" | "market";

const rateLimitPolicies: Record<ApiRateLimitScope, RateLimitPolicy> = {
  health: { maxRequests: 120, windowMs: 60_000 },
  search: { maxRequests: 30, windowMs: 60_000 },
  market: { maxRequests: 20, windowMs: 60_000 },
};

function rateLimitHeaders(decision: RateLimitDecision): HeadersInit {
  return {
    "Cache-Control": "no-store",
    "RateLimit-Limit": decision.limit.toString(),
    "RateLimit-Remaining": decision.remaining.toString(),
    "Retry-After": decision.retryAfterSeconds.toString(),
    "X-Robots-Tag": "noindex",
  };
}

export function rejectRateLimitedRequest(
  request: Request,
  scope: ApiRateLimitScope,
): NextResponse | null {
  const decision = apiRateLimiter.take(
    `${scope}:${requestClientKey(request.headers)}`,
    rateLimitPolicies[scope],
  );
  if (decision.allowed) {
    return null;
  }
  return NextResponse.json(
    { error: "Too many requests. Please retry shortly." },
    { status: 429, headers: rateLimitHeaders(decision) },
  );
}

export function marketJson(payload: unknown, status = 200): NextResponse {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "private, max-age=0, s-maxage=10, stale-while-revalidate=20",
      "X-Robots-Tag": "noindex",
    },
  });
}

export function errorJson(error: string, status: number): NextResponse {
  return marketJson({ error }, status);
}
