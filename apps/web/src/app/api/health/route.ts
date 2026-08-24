import { NextRequest } from "next/server";

import { marketJson, rejectRateLimitedRequest } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rateLimited = rejectRateLimitedRequest(request, "health");
  if (rateLimited) return rateLimited;
  return marketJson({
    status: "ok",
    service: "defi-market-intel-web",
    timestamp: new Date().toISOString(),
  });
}
