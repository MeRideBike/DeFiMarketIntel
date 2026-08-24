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
  return report
    ? marketJson(reportDto(report))
    : errorJson("Asset was not found or its identifier is invalid.", 404);
}
