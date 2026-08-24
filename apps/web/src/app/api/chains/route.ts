import { listChains } from "@defi-market-intel/core";
import { NextRequest } from "next/server";

import { marketJson, rejectRateLimitedRequest } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rateLimited = rejectRateLimitedRequest(request, "market");
  if (rateLimited) return rateLimited;
  return marketJson({
    chains: listChains().map((chain) => ({
      id: chain.id,
      name: chain.name,
      family: chain.family,
      nativeAssetSymbol: chain.nativeAssetSymbol,
      explorerUrl: chain.explorerUrl,
      supportedProtocols: chain.supportedProtocols,
    })),
  });
}
