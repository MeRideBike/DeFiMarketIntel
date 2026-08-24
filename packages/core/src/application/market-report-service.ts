import Decimal from "decimal.js";

import type {
  LiquidityProvider,
  PriceProvider,
  ProviderHealthProvider,
  TokenMetadataProvider,
} from "../domain/contracts";
import type {
  Asset,
  AssetIdentifier,
  AssetReport,
  LiquidityPool,
  MarketWarning,
  PriceAggregate,
  ProviderStatus,
} from "../domain/models";
import { normalizeIdentifier } from "../domain/validation";
import { getKnownAsset } from "../registry/assets";
import { getChain } from "../registry/chains";
import { aggregateLiquidity, estimateMarketDepth } from "./liquidity-engine";
import { aggregatePrices } from "./price-engine";

const defaultTradeSizes = [100, 1_000, 10_000, 100_000].map((size) => new Decimal(size));

function isHealthProvider(provider: object): provider is ProviderHealthProvider {
  return "getStatus" in provider && typeof provider.getStatus === "function";
}

function providerStatuses(providers: readonly object[]): readonly ProviderStatus[] {
  const statuses = new Map<string, ProviderStatus>();
  for (const provider of providers) {
    if (!isHealthProvider(provider)) {
      continue;
    }
    for (const status of provider.getStatus()) {
      statuses.set(status.provider, status);
    }
  }
  return [...statuses.values()];
}

function enrichPoolDeviation(
  pools: readonly LiquidityPool[],
  price: PriceAggregate,
): readonly LiquidityPool[] {
  if (!price.referencePriceUsd) {
    return pools;
  }
  const referencePriceUsd = price.referencePriceUsd;
  return pools.map((pool) => ({
    ...pool,
    priceDeviationPercent: pool.priceUsd
      ? pool.priceUsd.minus(referencePriceUsd).div(referencePriceUsd).mul(100)
      : null,
  }));
}

function buildWarnings(
  asset: Asset,
  price: PriceAggregate,
  pools: readonly LiquidityPool[],
  depth: ReturnType<typeof estimateMarketDepth>,
  liquidityScore: number,
  largestPoolSharePercent: Decimal | null,
): readonly MarketWarning[] {
  const warnings: MarketWarning[] = [];
  if (asset.verification !== "verified") {
    warnings.push({
      code: "UNVERIFIED_TOKEN",
      severity: "warning",
      title: "Unverified token metadata",
      detail:
        "This asset was discovered from market data. Confirm its identifier before acting on it.",
    });
  }
  if (!price.referencePriceUsd || price.acceptedObservationCount === 0) {
    warnings.push({
      code: "INSUFFICIENT_MARKET_DATA",
      severity: "critical",
      title: "Insufficient market data",
      detail:
        "No fresh USD observation was accepted, so price and executable-depth estimates are unavailable.",
    });
  }
  if (price.confidenceScore < 50 && price.referencePriceUsd) {
    warnings.push({
      code: "LOW_PROVIDER_AGREEMENT",
      severity: "warning",
      title: "Low price confidence",
      detail: `The current confidence score is ${price.confidenceScore}/100; use individual sources and freshness before relying on the reference price.`,
    });
  }
  if (liquidityScore < 30) {
    warnings.push({
      code: "LOW_LIQUIDITY",
      severity: "warning",
      title: "Low observed liquidity",
      detail: "Reported pool liquidity and usable depth are limited relative to a liquid market.",
    });
  }
  if (largestPoolSharePercent && largestPoolSharePercent.greaterThan(70)) {
    warnings.push({
      code: "SINGLE_POOL_DEPENDENCY",
      severity: "warning",
      title: "Single-pool dependency",
      detail: `${largestPoolSharePercent.toDecimalPlaces(1).toString()}% of observed liquidity is concentrated in the largest pool.`,
    });
  }
  const highImpact = depth.find(
    (estimate) =>
      estimate.inputUsd.eq(10_000) && (estimate.priceImpactPercent?.greaterThan(3) ?? false),
  );
  if (highImpact) {
    warnings.push({
      code: "HIGH_PRICE_IMPACT",
      severity: "warning",
      title: "High $10,000 price impact",
      detail: `The best observed ${highImpact.side} estimate shows ${highImpact.priceImpactPercent?.toDecimalPlaces(2).toString()}% impact.`,
    });
  }
  const dislocated = pools.find((pool) => pool.priceDeviationPercent?.abs().greaterThan(10));
  if (dislocated) {
    warnings.push({
      code: "PRICE_DISLOCATION",
      severity: "warning",
      title: "Price dislocation",
      detail: `${dislocated.protocol} ${dislocated.pairLabel} differs by ${dislocated.priceDeviationPercent?.abs().toDecimalPlaces(1).toString()}% from the reference price. This is not an arbitrage claim.`,
    });
  }
  if (pools.some((pool) => pool.isConcentratedLiquidity)) {
    warnings.push({
      code: "CONCENTRATED_LIQUIDITY_UNAVAILABLE",
      severity: "info",
      title: "Concentrated-liquidity depth unavailable",
      detail:
        "At least one pool uses concentrated liquidity. Its reported TVL remains observable, but active liquidity and reserve-based depth need protocol-native tick and quote data.",
    });
  }
  return warnings;
}

export class MarketReportService {
  public constructor(
    private readonly metadataProviders: readonly TokenMetadataProvider[],
    private readonly priceProviders: readonly PriceProvider[],
    private readonly liquidityProviders: readonly LiquidityProvider[],
  ) {}

  public async getReport(
    chainId: string,
    address: string,
    requestedTradeSizes: readonly Decimal[] = defaultTradeSizes,
  ): Promise<AssetReport | null> {
    const chain = getChain(chainId);
    if (!chain) {
      return null;
    }
    const identifier = normalizeIdentifier(chain, address);
    if (!identifier) {
      return null;
    }
    const resolution = await this.resolveAsset(identifier);
    if (!resolution) {
      return null;
    }
    const { asset, providerFailure: metadataProviderFailure } = resolution;

    const [priceResults, poolResults] = await Promise.all([
      Promise.allSettled(this.priceProviders.map((provider) => provider.getPrice(asset))),
      Promise.allSettled(this.liquidityProviders.map((provider) => provider.getPools(asset))),
    ]);
    const observations = priceResults.flatMap((result) =>
      result.status === "fulfilled" ? result.value : [],
    );
    const initialPools = poolResults.flatMap((result) =>
      result.status === "fulfilled" ? result.value : [],
    );
    const price = aggregatePrices(observations);
    const pools = enrichPoolDeviation(initialPools, price);
    const liquidity = aggregateLiquidity(pools);
    const validTradeSizes = requestedTradeSizes.filter(
      (size) => size.isFinite() && size.greaterThan(0) && size.lessThanOrEqualTo(1_000_000_000),
    );
    const tradeEstimates = estimateMarketDepth(pools, price.referencePriceUsd, validTradeSizes);
    const warnings = buildWarnings(
      asset,
      price,
      pools,
      tradeEstimates,
      liquidity.liquidityScore,
      liquidity.largestPoolSharePercent,
    );
    const allProviders: object[] = [
      ...this.metadataProviders,
      ...this.priceProviders,
      ...this.liquidityProviders,
    ];
    const statuses = providerStatuses(allProviders);
    const failures = [...priceResults, ...poolResults].some(
      (result) => result.status === "rejected",
    );

    return {
      asset,
      price,
      liquidity,
      pools: [...pools].sort((left, right) =>
        (right.totalLiquidityUsd ?? new Decimal(0)).comparedTo(
          left.totalLiquidityUsd ?? new Decimal(0),
        ),
      ),
      tradeEstimates,
      warnings,
      providerStatuses: statuses,
      generatedAt: new Date(),
      partial: metadataProviderFailure || failures || statuses.some((status) => !status.available),
    };
  }

  private async resolveAsset(
    identifier: AssetIdentifier,
  ): Promise<{ asset: Asset; providerFailure: boolean } | null> {
    const known = getKnownAsset(identifier.chainId, identifier.value);
    if (known) {
      return { asset: known, providerFailure: false };
    }
    const results = await Promise.allSettled(
      this.metadataProviders.map((provider) => provider.resolveAsset(identifier)),
    );
    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        return {
          asset: result.value,
          providerFailure: results.some((candidate) => candidate.status === "rejected"),
        };
      }
    }
    return null;
  }
}
