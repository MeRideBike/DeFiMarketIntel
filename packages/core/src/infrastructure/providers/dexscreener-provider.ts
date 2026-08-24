import Decimal from "decimal.js";
import { z } from "zod";

import type {
  LiquidityProvider,
  PriceProvider,
  ProviderHealthProvider,
  TokenMetadataProvider,
} from "../../domain/contracts";
import type {
  Asset,
  AssetIdentifier,
  Chain,
  LiquidityPool,
  PriceObservation,
  ProviderStatus,
  QuoteAssetQuality,
} from "../../domain/models";
import { getKnownAsset, listKnownAssets } from "../../registry/assets";
import { getChain, getChainByDexScreenerId } from "../../registry/chains";
import { TtlCache } from "../cache";
import { fetchValidatedJson, ProviderRuntime } from "../provider-runtime";

const providerName = "DexScreener";
const defaultApiBase = "https://api.dexscreener.com";

const pairSchema = z.object({
  chainId: z.string().min(1),
  dexId: z.string().min(1),
  url: z.string().url().optional(),
  pairAddress: z.string().min(1),
  baseToken: z.object({
    address: z.string().min(1),
    name: z.string().min(1).max(512),
    symbol: z.string().min(1).max(128),
  }),
  quoteToken: z.object({
    address: z.string().min(1),
    name: z.string().min(1).max(512),
    symbol: z.string().min(1).max(128),
  }),
  priceUsd: z.string().optional(),
  liquidity: z
    .object({
      usd: z.number().finite().nonnegative().optional(),
      base: z.number().finite().nonnegative().optional(),
      quote: z.number().finite().nonnegative().optional(),
    })
    .optional(),
  volume: z.object({ h24: z.number().finite().nonnegative().optional() }).optional(),
  labels: z.array(z.string().max(64)).optional(),
  pairCreatedAt: z.number().int().nonnegative().optional(),
});

const pairsResponseSchema = z.object({ pairs: z.array(pairSchema).nullable().optional() });
const pairListSchema = z.array(pairSchema);

type DexPair = z.infer<typeof pairSchema>;

function cleanMetadata(value: string, maxLength: number): string {
  return (
    value
      .replace(/[\u0000-\u001F\u007F]/g, "")
      .trim()
      .slice(0, maxLength) || "Unknown"
  );
}

function sameAddress(chain: Chain, left: string, right: string): boolean {
  return chain.family === "evm" ? left.toLowerCase() === right.toLowerCase() : left === right;
}

function assetFromToken(chain: Chain, token: DexPair["baseToken"], source: string): Asset {
  const known = getKnownAsset(chain.id, token.address);
  if (known) {
    return known;
  }

  const address = chain.family === "evm" ? token.address.toLowerCase() : token.address;
  return {
    id: `${chain.id}:${address}`,
    chain,
    identifier: {
      chainId: chain.id,
      value: address,
      kind: chain.family === "evm" ? "evm-address" : "solana-mint",
    },
    name: cleanMetadata(token.name, 160),
    symbol: cleanMetadata(token.symbol, 32),
    decimals: null,
    tokenStandard: chain.family === "evm" ? "ERC-20 / unknown" : "SPL / unknown",
    verification: "unknown",
    logoUrl: null,
    canonicalAssetKey: null,
    relationships: [],
    source,
  };
}

function decimalOrNull(value: string | number | undefined): Decimal | null {
  if (value === undefined || value === "" || value === null) {
    return null;
  }
  try {
    const parsed = new Decimal(value);
    return parsed.isFinite() && parsed.greaterThan(0) ? parsed : null;
  } catch {
    return null;
  }
}

function isConcentratedPair(pair: DexPair): boolean {
  const values = [pair.dexId, ...(pair.labels ?? [])].join(" ").toLowerCase();
  return /\bv[34]\b|clmm|dlmm|concentrated/.test(values);
}

function quoteQuality(symbol: string): QuoteAssetQuality {
  return ["USDC", "USDT", "DAI", "WETH", "WBTC", "SOL"].includes(symbol.toUpperCase())
    ? "trusted"
    : "unknown";
}

export class DexScreenerProvider
  implements TokenMetadataProvider, PriceProvider, LiquidityProvider, ProviderHealthProvider
{
  public readonly name = providerName;

  private readonly cache = new TtlCache(750);
  private readonly runtime = new ProviderRuntime(125);

  public constructor(
    private readonly apiBase = defaultApiBase,
    private readonly timeoutMs = 8_000,
  ) {}

  public async search(query: string, limit: number): Promise<readonly Asset[]> {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      return [];
    }

    const key = `search:${normalizedQuery.toLowerCase()}:${limit}`;
    return this.cache.getOrLoad(key, 60_000, async () => {
      const url = `${this.apiBase}/latest/dex/search/?q=${encodeURIComponent(normalizedQuery)}`;
      const response = await this.runtime.execute(providerName, () =>
        fetchValidatedJson(providerName, url, pairsResponseSchema, { timeoutMs: this.timeoutMs }),
      );
      const result = new Map<string, Asset>();

      for (const pair of response.pairs ?? []) {
        const chain = getChainByDexScreenerId(pair.chainId);
        if (!chain) {
          continue;
        }
        for (const token of [pair.baseToken, pair.quoteToken]) {
          const asset = assetFromToken(chain, token, "DexScreener market metadata");
          result.set(asset.id, asset);
          if (result.size >= limit) {
            return [...result.values()];
          }
        }
      }

      return [...result.values()];
    });
  }

  public async resolveAsset(identifier: AssetIdentifier): Promise<Asset | null> {
    const chain = getChain(identifier.chainId);
    if (!chain) {
      return null;
    }
    const known = getKnownAsset(chain.id, identifier.value);
    if (known) {
      return known;
    }
    const pairs = await this.getPairsForToken(chain, identifier.value);
    const pair = pairs.find(
      (candidate) =>
        candidate.chainId.toLowerCase() === chain.dexScreenerChainId &&
        (sameAddress(chain, candidate.baseToken.address, identifier.value) ||
          sameAddress(chain, candidate.quoteToken.address, identifier.value)),
    );
    if (!pair) {
      return null;
    }
    const token = sameAddress(chain, pair.baseToken.address, identifier.value)
      ? pair.baseToken
      : pair.quoteToken;
    return assetFromToken(chain, token, "DexScreener market metadata");
  }

  public async getPrice(asset: Asset): Promise<readonly PriceObservation[]> {
    const pairs = await this.getPairsForToken(asset.chain, asset.identifier.value);
    const observations: PriceObservation[] = [];

    for (const pair of pairs) {
      if (pair.chainId.toLowerCase() !== asset.chain.dexScreenerChainId) {
        continue;
      }
      if (!sameAddress(asset.chain, pair.baseToken.address, asset.identifier.value)) {
        continue;
      }
      const priceUsd = decimalOrNull(pair.priceUsd);
      if (!priceUsd) {
        continue;
      }
      const liquidityUsd = decimalOrNull(pair.liquidity?.usd);
      observations.push({
        assetId: asset.id,
        chainId: asset.chain.id,
        provider: providerName,
        source: `${pair.dexId} ${cleanMetadata(pair.baseToken.symbol, 32)}/${cleanMetadata(pair.quoteToken.symbol, 32)}`,
        sourceUrl: pair.url ?? null,
        observedAt: new Date(),
        blockNumber: null,
        blockTimestamp: null,
        methodology:
          "DEX Screener reported pair USD price; weighted later by reported liquidity and freshness.",
        priceUsd,
        liquidityUsd,
        protocol: pair.dexId,
        poolId: `${asset.chain.id}:${pair.pairAddress}`,
        quoteAssetQuality: quoteQuality(pair.quoteToken.symbol),
        derivation: [
          `${cleanMetadata(pair.baseToken.symbol, 32)} → ${cleanMetadata(pair.quoteToken.symbol, 32)}`,
          "DEX Screener USD pair observation",
        ],
      });
    }

    return observations;
  }

  public async getPools(asset: Asset): Promise<readonly LiquidityPool[]> {
    const pairs = await this.getPairsForToken(asset.chain, asset.identifier.value);
    const pools: LiquidityPool[] = [];

    for (const pair of pairs) {
      if (pair.chainId.toLowerCase() !== asset.chain.dexScreenerChainId) {
        continue;
      }
      const assetIsBase = sameAddress(asset.chain, pair.baseToken.address, asset.identifier.value);
      const assetIsQuote = sameAddress(
        asset.chain,
        pair.quoteToken.address,
        asset.identifier.value,
      );
      if (!assetIsBase && !assetIsQuote) {
        continue;
      }

      const baseAsset = assetFromToken(asset.chain, pair.baseToken, "DexScreener market metadata");
      const quoteAsset = assetFromToken(
        asset.chain,
        pair.quoteToken,
        "DexScreener market metadata",
      );
      const totalLiquidityUsd = decimalOrNull(pair.liquidity?.usd);
      const reportedBaseReserve = decimalOrNull(pair.liquidity?.base);
      const reportedQuoteReserve = decimalOrNull(pair.liquidity?.quote);
      const reportedBasePriceUsd = decimalOrNull(pair.priceUsd);
      const concentrated = isConcentratedPair(pair);
      const targetReserve = assetIsBase ? reportedBaseReserve : reportedQuoteReserve;
      const oppositeReserveUsd = assetIsBase
        ? this.estimateQuoteReserveUsd(totalLiquidityUsd, reportedBaseReserve, reportedBasePriceUsd)
        : reportedBaseReserve && reportedBasePriceUsd
          ? reportedBaseReserve.mul(reportedBasePriceUsd)
          : (totalLiquidityUsd?.div(2) ?? null);
      const executableLiquidityUsd = concentrated ? null : totalLiquidityUsd;
      const assetReserve = concentrated ? null : targetReserve;
      const quoteReserveUsd = concentrated ? null : oppositeReserveUsd;

      pools.push({
        id: `${asset.chain.id}:${pair.pairAddress}`,
        chainId: asset.chain.id,
        protocol: pair.dexId,
        poolAddress: pair.pairAddress,
        pairLabel: `${baseAsset.symbol}/${quoteAsset.symbol}`,
        baseAsset: {
          id: baseAsset.id,
          name: baseAsset.name,
          symbol: baseAsset.symbol,
          identifier: baseAsset.identifier,
        },
        quoteAsset: {
          id: quoteAsset.id,
          name: quoteAsset.name,
          symbol: quoteAsset.symbol,
          identifier: quoteAsset.identifier,
        },
        feeBps: null,
        priceUsd: assetIsBase ? reportedBasePriceUsd : null,
        totalLiquidityUsd,
        activeLiquidityUsd: concentrated ? null : totalLiquidityUsd,
        executableLiquidityUsd,
        liquidityPrecision: "estimated",
        assetReserve,
        quoteReserveUsd,
        volume24hUsd: decimalOrNull(pair.volume?.h24),
        priceDeviationPercent: null,
        isConcentratedLiquidity: concentrated,
        poolCreatedAt: pair.pairCreatedAt ? new Date(pair.pairCreatedAt) : null,
        provider: providerName,
        source: `${pair.dexId} pair data`,
        sourceUrl: pair.url ?? null,
        observedAt: new Date(),
        blockNumber: null,
        blockTimestamp: null,
        methodology: concentrated
          ? "Reported TVL is retained as observed liquidity only. Active liquidity and reserve-based depth are unavailable without protocol-native tick and quote data."
          : "Reserve-based constant-product estimate using reported pair liquidity; not a transaction quote.",
      });
    }
    return pools;
  }

  public getStatus(): readonly ProviderStatus[] {
    return this.runtime.getStatus();
  }

  private async getPairsForToken(chain: Chain, address: string): Promise<readonly DexPair[]> {
    const key = `token:${chain.dexScreenerChainId}:${address.toLowerCase()}`;
    return this.cache.getOrLoad(key, 15_000, async () => {
      const url = `${this.apiBase}/token-pairs/v1/${encodeURIComponent(chain.dexScreenerChainId)}/${encodeURIComponent(address)}`;
      const response = await this.runtime.execute(providerName, () =>
        fetchValidatedJson(providerName, url, pairListSchema, { timeoutMs: this.timeoutMs }),
      );
      return response;
    });
  }

  private estimateQuoteReserveUsd(
    totalLiquidityUsd: Decimal | null,
    baseReserve: Decimal | null,
    basePriceUsd: Decimal | null,
  ): Decimal | null {
    if (!totalLiquidityUsd) {
      return null;
    }
    if (baseReserve && basePriceUsd) {
      const inferred = totalLiquidityUsd.minus(baseReserve.mul(basePriceUsd));
      if (inferred.greaterThan(0)) {
        return inferred;
      }
    }
    return totalLiquidityUsd.div(2);
  }
}

/** Curated assets remain searchable even while external discovery is unavailable. */
export function searchKnownAssets(query: string): readonly Asset[] {
  const normalized = query.trim().toLowerCase();
  return listKnownAssets().filter(
    (asset) =>
      asset.symbol.toLowerCase().includes(normalized) ||
      asset.name.toLowerCase().includes(normalized) ||
      asset.identifier.value.toLowerCase() === normalized,
  );
}
