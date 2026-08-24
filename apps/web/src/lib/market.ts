import {
  AssetSearchService,
  DefiLlamaPriceProvider,
  DexScreenerProvider,
  MarketReportService,
  TtlCache,
} from "@defi-market-intel/core";

import { marketConfig } from "./config";

const dexScreener = new DexScreenerProvider(
  marketConfig.dexScreenerApiBase,
  marketConfig.providerTimeoutMs,
);
const defiLlama = new DefiLlamaPriceProvider(
  marketConfig.defiLlamaApiBase,
  marketConfig.providerTimeoutMs,
);
const reportService = new MarketReportService(
  [dexScreener],
  [dexScreener, defiLlama],
  [dexScreener],
);
const searchService = new AssetSearchService([dexScreener]);
const reportCache = new TtlCache(250);

export { searchService };

export async function getMarketReport(chain: string, address: string, amounts?: readonly string[]) {
  const normalizedAmounts = amounts?.join(",") ?? "default";
  const key = `report:${chain.toLowerCase()}:${address.toLowerCase()}:${normalizedAmounts}`;
  return reportCache.getOrLoad(key, 12_000, () => reportService.getReport(chain, address));
}
