import type {
  Asset,
  AssetReport,
  LiquidityPool,
  PriceObservation,
  TradeEstimate,
} from "@defi-market-intel/core";

function decimal(value: { toString(): string } | null): string | null {
  return value?.toString() ?? null;
}

function date(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

function safeExternalUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const trusted = ["dexscreener.com", "defillama.com"];
    if (
      url.protocol === "https:" &&
      trusted.some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`))
    ) {
      return url.toString();
    }
  } catch {
    return null;
  }
  return null;
}

export function assetDto(asset: Asset) {
  return {
    id: asset.id,
    name: asset.name,
    symbol: asset.symbol,
    chain: {
      id: asset.chain.id,
      name: asset.chain.name,
      family: asset.chain.family,
      explorerUrl: asset.chain.explorerUrl,
    },
    identifier: asset.identifier.value,
    identifierKind: asset.identifier.kind,
    decimals: asset.decimals,
    tokenStandard: asset.tokenStandard,
    verification: asset.verification,
    canonicalAssetKey: asset.canonicalAssetKey,
    source: asset.source,
  };
}

function observationDto(observation: PriceObservation) {
  return {
    provider: observation.provider,
    source: observation.source,
    sourceUrl: safeExternalUrl(observation.sourceUrl),
    observedAt: observation.observedAt.toISOString(),
    priceUsd: decimal(observation.priceUsd),
    liquidityUsd: decimal(observation.liquidityUsd),
    protocol: observation.protocol,
    quoteAssetQuality: observation.quoteAssetQuality,
    derivation: observation.derivation,
    methodology: observation.methodology,
  };
}

function poolDto(pool: LiquidityPool) {
  return {
    id: pool.id,
    chainId: pool.chainId,
    protocol: pool.protocol,
    poolAddress: pool.poolAddress,
    pairLabel: pool.pairLabel,
    baseAsset: {
      id: pool.baseAsset.id,
      name: pool.baseAsset.name,
      symbol: pool.baseAsset.symbol,
      identifier: pool.baseAsset.identifier.value,
    },
    quoteAsset: {
      id: pool.quoteAsset.id,
      name: pool.quoteAsset.name,
      symbol: pool.quoteAsset.symbol,
      identifier: pool.quoteAsset.identifier.value,
    },
    feeBps: pool.feeBps,
    priceUsd: decimal(pool.priceUsd),
    totalLiquidityUsd: decimal(pool.totalLiquidityUsd),
    activeLiquidityUsd: decimal(pool.activeLiquidityUsd),
    executableLiquidityUsd: decimal(pool.executableLiquidityUsd),
    liquidityPrecision: pool.liquidityPrecision,
    volume24hUsd: decimal(pool.volume24hUsd),
    priceDeviationPercent: decimal(pool.priceDeviationPercent),
    isConcentratedLiquidity: pool.isConcentratedLiquidity,
    poolCreatedAt: date(pool.poolCreatedAt),
    source: pool.source,
    sourceUrl: safeExternalUrl(pool.sourceUrl),
    observedAt: pool.observedAt.toISOString(),
    methodology: pool.methodology,
  };
}

function tradeDto(estimate: TradeEstimate) {
  return {
    side: estimate.side,
    inputUsd: decimal(estimate.inputUsd),
    effectivePriceUsd: decimal(estimate.effectivePriceUsd),
    estimatedOutput: decimal(estimate.estimatedOutput),
    estimatedProtocolFeeUsd: decimal(estimate.estimatedProtocolFeeUsd),
    priceImpactPercent: decimal(estimate.priceImpactPercent),
    bestPoolId: estimate.bestPoolId,
    bestVenue: estimate.bestVenue,
    route: estimate.route,
    precision: estimate.precision,
    rationale: estimate.rationale,
  };
}

export function reportDto(report: AssetReport) {
  return {
    asset: assetDto(report.asset),
    price: {
      referencePriceUsd: decimal(report.price.referencePriceUsd),
      liquidityWeightedPriceUsd: decimal(report.price.liquidityWeightedPriceUsd),
      medianPriceUsd: decimal(report.price.medianPriceUsd),
      observationLowUsd: decimal(report.price.observationLowUsd),
      observationHighUsd: decimal(report.price.observationHighUsd),
      sourceCount: report.price.sourceCount,
      acceptedObservationCount: report.price.acceptedObservationCount,
      outlierCount: report.price.outlierCount,
      confidenceScore: report.price.confidenceScore,
      confidenceLabel: report.price.confidenceLabel,
      observations: report.price.observations.map(observationDto),
      excludedObservations: report.price.excludedObservations.map(observationDto),
    },
    liquidity: {
      totalObservedLiquidityUsd: decimal(report.liquidity.totalObservedLiquidityUsd),
      usableLiquidityUsd: decimal(report.liquidity.usableLiquidityUsd),
      liquidityScore: report.liquidity.liquidityScore,
      liquidityLabel: report.liquidity.liquidityLabel,
      venueDistribution: report.liquidity.venueDistribution.map((entry) => ({
        key: entry.key,
        liquidityUsd: decimal(entry.liquidityUsd),
        sharePercent: decimal(entry.sharePercent),
      })),
      protocolDistribution: report.liquidity.protocolDistribution.map((entry) => ({
        key: entry.key,
        liquidityUsd: decimal(entry.liquidityUsd),
        sharePercent: decimal(entry.sharePercent),
      })),
      chainDistribution: report.liquidity.chainDistribution.map((entry) => ({
        key: entry.key,
        liquidityUsd: decimal(entry.liquidityUsd),
        sharePercent: decimal(entry.sharePercent),
      })),
      largestPoolSharePercent: decimal(report.liquidity.largestPoolSharePercent),
      topThreePoolSharePercent: decimal(report.liquidity.topThreePoolSharePercent),
    },
    pools: report.pools.map(poolDto),
    tradeEstimates: report.tradeEstimates.map(tradeDto),
    warnings: report.warnings,
    providerStatuses: report.providerStatuses,
    generatedAt: report.generatedAt.toISOString(),
    partial: report.partial,
  };
}

export type AssetDto = ReturnType<typeof assetDto>;
export type MarketReportDto = ReturnType<typeof reportDto>;
