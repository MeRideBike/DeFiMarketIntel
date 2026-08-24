import Decimal from "decimal.js";
import { NextRequest } from "next/server";

import { estimateMarketDepth } from "@defi-market-intel/core";

import { reportDto } from "@/lib/dto";
import { errorJson, marketJson, rejectRateLimitedRequest } from "@/lib/http";
import { getMarketReport } from "@/lib/market";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ chain: string; address: string }>;
}

function parseAmount(value: string | null): Decimal | null {
  if (!value || !/^\d+(?:\.\d{1,8})?$/.test(value)) return null;
  try {
    const amount = new Decimal(value);
    return amount.greaterThan(0) && amount.lessThanOrEqualTo(1_000_000_000) ? amount : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimited = rejectRateLimitedRequest(request, "market");
  if (rateLimited) return rateLimited;
  const { chain, address } = await context.params;
  const amount = parseAmount(request.nextUrl.searchParams.get("amount"));
  if (request.nextUrl.searchParams.has("amount") && !amount) {
    return errorJson("amount must be a positive USD value no greater than 1,000,000,000.", 400);
  }
  const report = await getMarketReport(chain, address);
  if (!report) return errorJson("Asset was not found or its identifier is invalid.", 404);
  const dto = reportDto(report);
  const estimates = amount
    ? estimateMarketDepth(report.pools, report.price.referencePriceUsd, [amount]).map(
        (estimate) => ({
          side: estimate.side,
          inputUsd: estimate.inputUsd.toString(),
          effectivePriceUsd: estimate.effectivePriceUsd?.toString() ?? null,
          estimatedOutput: estimate.estimatedOutput?.toString() ?? null,
          estimatedProtocolFeeUsd: estimate.estimatedProtocolFeeUsd?.toString() ?? null,
          priceImpactPercent: estimate.priceImpactPercent?.toString() ?? null,
          bestPoolId: estimate.bestPoolId,
          bestVenue: estimate.bestVenue,
          route: estimate.route,
          precision: estimate.precision,
          rationale: estimate.rationale,
        }),
      )
    : dto.tradeEstimates;
  return marketJson({
    asset: dto.asset,
    referencePriceUsd: dto.price.referencePriceUsd,
    estimates,
  });
}
