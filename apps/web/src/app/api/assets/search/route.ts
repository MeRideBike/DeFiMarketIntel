import { isValidSearchQuery } from "@defi-market-intel/core";
import { NextRequest } from "next/server";

import { assetDto } from "@/lib/dto";
import { errorJson, marketJson, rejectRateLimitedRequest } from "@/lib/http";
import { searchService } from "@/lib/market";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rateLimited = rejectRateLimitedRequest(request, "search");
  if (rateLimited) return rateLimited;
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const rawLimit = Number(request.nextUrl.searchParams.get("limit") ?? "10");
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(Math.floor(rawLimit), 20)) : 10;
  if (!isValidSearchQuery(query)) {
    return errorJson("Query must contain 1–100 printable characters.", 400);
  }
  const results = await searchService.search(query, limit);
  return marketJson({
    results: results.map((result) => ({ ...assetDto(result.asset), rank: result.rank })),
  });
}
