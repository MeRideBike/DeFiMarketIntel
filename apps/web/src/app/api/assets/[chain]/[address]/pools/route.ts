import { NextRequest } from "next/server";

import { reportDto } from "@/lib/dto";
import { errorJson, marketJson, rejectRateLimitedRequest } from "@/lib/http";
import { getMarketReport } from "@/lib/market";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ chain: string; address: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimited = rejectRateLimitedRequest(request, "market");
  if (rateLimited) return rateLimited;
  const { chain, address } = await context.params;
  const report = await getMarketReport(chain, address);
  if (!report) return errorJson("Asset was not found or its identifier is invalid.", 404);
  const dto = reportDto(report);
  return marketJson({
    asset: dto.asset,
    pools: dto.pools,
    partial: dto.partial,
    generatedAt: dto.generatedAt,
  });
}
