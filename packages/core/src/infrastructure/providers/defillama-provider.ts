import Decimal from "decimal.js";
import { z } from "zod";

import type { PriceProvider, ProviderHealthProvider } from "../../domain/contracts";
import type { Asset, PriceObservation, ProviderStatus } from "../../domain/models";
import { TtlCache } from "../cache";
import { fetchValidatedJson, ProviderRuntime } from "../provider-runtime";

const providerName = "DefiLlama";
const defaultApiBase = "https://coins.llama.fi";
const responseSchema = z.object({
  coins: z.record(
    z.object({
      price: z.number().finite().positive(),
      timestamp: z.number().int().positive().optional(),
      confidence: z.number().finite().min(0).max(1).optional(),
    }),
  ),
});

export class DefiLlamaPriceProvider implements PriceProvider, ProviderHealthProvider {
  public readonly name = providerName;

  private readonly cache = new TtlCache(500);
  private readonly runtime = new ProviderRuntime(150);

  public constructor(
    private readonly apiBase = defaultApiBase,
    private readonly timeoutMs = 8_000,
  ) {}

  public async getPrice(asset: Asset): Promise<readonly PriceObservation[]> {
    const key = `price:${asset.chain.defiLlamaChainId}:${asset.identifier.value.toLowerCase()}`;
    return this.cache.getOrLoad(key, 20_000, async () => {
      const coinKey = `${asset.chain.defiLlamaChainId}:${asset.identifier.value}`;
      const url = `${this.apiBase}/prices/current/${encodeURIComponent(coinKey)}`;
      const response = await this.runtime.execute(providerName, () =>
        fetchValidatedJson(providerName, url, responseSchema, { timeoutMs: this.timeoutMs }),
      );
      const coin = response.coins[coinKey] ?? Object.values(response.coins)[0];
      if (!coin) {
        return [];
      }
      return [
        {
          assetId: asset.id,
          chainId: asset.chain.id,
          provider: providerName,
          source: "DefiLlama Coins",
          sourceUrl: "https://defillama.com/docs/api",
          observedAt: coin.timestamp ? new Date(coin.timestamp * 1_000) : new Date(),
          blockNumber: null,
          blockTimestamp: null,
          methodology:
            "Provider USD price reference. It is an independent observation, not an executable quote.",
          priceUsd: new Decimal(coin.price.toString()),
          liquidityUsd: null,
          protocol: null,
          poolId: null,
          quoteAssetQuality: "trusted",
          derivation: ["DefiLlama Coins USD reference"],
        },
      ];
    });
  }

  public getStatus(): readonly ProviderStatus[] {
    return this.runtime.getStatus();
  }
}
