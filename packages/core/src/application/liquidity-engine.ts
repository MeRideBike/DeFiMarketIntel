import Decimal from "decimal.js";

import type {
  DistributionEntry,
  LiquidityAggregate,
  LiquidityPool,
  LiquidityPrecision,
  TradeEstimate,
} from "../domain/models";

function toDistribution(
  entries: ReadonlyMap<string, Decimal>,
  total: Decimal,
): DistributionEntry[] {
  return [...entries.entries()]
    .map(([key, liquidityUsd]) => ({
      key,
      liquidityUsd,
      sharePercent: total.greaterThan(0) ? liquidityUsd.div(total).mul(100) : new Decimal(0),
    }))
    .sort((left, right) => right.liquidityUsd.comparedTo(left.liquidityUsd));
}

function addToDistribution(entries: Map<string, Decimal>, key: string, value: Decimal): void {
  entries.set(key, (entries.get(key) ?? new Decimal(0)).plus(value));
}

function liquidityLabel(score: number): LiquidityAggregate["liquidityLabel"] {
  if (score >= 80) return "Deep";
  if (score >= 60) return "Healthy";
  if (score >= 30) return "Limited";
  if (score > 0) return "Thin";
  return "Unavailable";
}

export function aggregateLiquidity(pools: readonly LiquidityPool[]): LiquidityAggregate {
  const eligiblePools = pools.filter(
    (pool) => pool.totalLiquidityUsd?.isFinite() && pool.totalLiquidityUsd.greaterThan(0),
  );
  const totalObservedLiquidityUsd = eligiblePools.reduce(
    (total, pool) => total.plus(pool.totalLiquidityUsd ?? 0),
    new Decimal(0),
  );
  const usableLiquidityUsd = eligiblePools.reduce(
    (total, pool) => total.plus(pool.executableLiquidityUsd ?? 0),
    new Decimal(0),
  );
  const byProtocol = new Map<string, Decimal>();
  const byVenue = new Map<string, Decimal>();
  const byChain = new Map<string, Decimal>();
  for (const pool of eligiblePools) {
    const liquidity = pool.totalLiquidityUsd ?? new Decimal(0);
    addToDistribution(byProtocol, pool.protocol, liquidity);
    addToDistribution(byVenue, `${pool.protocol} · ${pool.pairLabel}`, liquidity);
    addToDistribution(byChain, pool.chainId, liquidity);
  }
  const venueDistribution = toDistribution(byVenue, totalObservedLiquidityUsd);
  const protocolDistribution = toDistribution(byProtocol, totalObservedLiquidityUsd);
  const chainDistribution = toDistribution(byChain, totalObservedLiquidityUsd);
  const sortedPoolShares = eligiblePools
    .map((pool) =>
      (pool.totalLiquidityUsd ?? new Decimal(0)).div(totalObservedLiquidityUsd).mul(100),
    )
    .sort((left, right) => right.comparedTo(left));
  const largestPoolSharePercent = sortedPoolShares[0] ?? null;
  const topThreePoolSharePercent = sortedPoolShares.length
    ? sortedPoolShares.slice(0, 3).reduce((total, share) => total.plus(share), new Decimal(0))
    : null;

  const depthComponent = Math.min(Number(totalObservedLiquidityUsd.add(1).logarithm(10)) * 8, 50);
  const venueComponent = Math.min(eligiblePools.length * 4, 20);
  const concentrationPenalty = largestPoolSharePercent
    ? Math.max(0, Number(largestPoolSharePercent.minus(35).div(2)))
    : 0;
  const executableRatio = totalObservedLiquidityUsd.greaterThan(0)
    ? usableLiquidityUsd.div(totalObservedLiquidityUsd)
    : new Decimal(0);
  const executabilityComponent = Number(executableRatio.mul(15));
  const liquidityScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(depthComponent + venueComponent + executabilityComponent - concentrationPenalty),
    ),
  );

  return {
    totalObservedLiquidityUsd,
    usableLiquidityUsd,
    liquidityScore,
    liquidityLabel: liquidityLabel(liquidityScore),
    venueDistribution,
    protocolDistribution,
    chainDistribution,
    largestPoolSharePercent,
    topThreePoolSharePercent,
  };
}

function estimateFromPool(
  pool: LiquidityPool,
  side: TradeEstimate["side"],
  inputUsd: Decimal,
  referencePriceUsd: Decimal,
): TradeEstimate | null {
  if (
    pool.isConcentratedLiquidity ||
    !pool.assetReserve ||
    !pool.quoteReserveUsd ||
    !pool.assetReserve.greaterThan(0) ||
    !pool.quoteReserveUsd.greaterThan(0)
  ) {
    return null;
  }

  const feeBps = pool.feeBps ?? 30;
  const feeRate = new Decimal(feeBps).div(10_000);
  const estimatedProtocolFeeUsd = inputUsd.mul(feeRate);
  const inputAfterFeeUsd = inputUsd.minus(estimatedProtocolFeeUsd);
  if (!inputAfterFeeUsd.greaterThan(0)) {
    return null;
  }

  if (side === "buy") {
    const output = pool.assetReserve
      .mul(inputAfterFeeUsd)
      .div(pool.quoteReserveUsd.plus(inputAfterFeeUsd));
    if (!output.greaterThan(0)) {
      return null;
    }
    const effectivePriceUsd = inputUsd.div(output);
    return {
      side,
      inputUsd,
      effectivePriceUsd,
      estimatedOutput: output,
      estimatedProtocolFeeUsd,
      priceImpactPercent: effectivePriceUsd.div(referencePriceUsd).minus(1).mul(100),
      bestPoolId: pool.id,
      bestVenue: `${pool.protocol} ${pool.pairLabel}`,
      route: [pool.pairLabel],
      precision: pool.liquidityPrecision,
      rationale:
        pool.feeBps === null
          ? "Estimated from reported reserves using a 30 bps fallback fee; this is not a firm quote."
          : "Estimated from reported reserves and the pool fee; this is not a firm quote.",
    };
  }

  const inputAsset = inputUsd.div(referencePriceUsd);
  const inputAfterFeeAsset = inputAsset.mul(new Decimal(1).minus(feeRate));
  const outputUsd = pool.quoteReserveUsd
    .mul(inputAfterFeeAsset)
    .div(pool.assetReserve.plus(inputAfterFeeAsset));
  if (!outputUsd.greaterThan(0)) {
    return null;
  }
  const effectivePriceUsd = outputUsd.div(inputAsset);
  return {
    side,
    inputUsd,
    effectivePriceUsd,
    estimatedOutput: outputUsd,
    estimatedProtocolFeeUsd,
    priceImpactPercent: new Decimal(1).minus(effectivePriceUsd.div(referencePriceUsd)).mul(100),
    bestPoolId: pool.id,
    bestVenue: `${pool.protocol} ${pool.pairLabel}`,
    route: [pool.pairLabel],
    precision: pool.liquidityPrecision,
    rationale:
      pool.feeBps === null
        ? "Estimated from reported reserves using a 30 bps fallback fee; this is not a firm quote."
        : "Estimated from reported reserves and the pool fee; this is not a firm quote.",
  };
}

function unavailableEstimate(side: TradeEstimate["side"], inputUsd: Decimal): TradeEstimate {
  return {
    side,
    inputUsd,
    effectivePriceUsd: null,
    estimatedOutput: null,
    estimatedProtocolFeeUsd: null,
    priceImpactPercent: null,
    bestPoolId: null,
    bestVenue: null,
    route: [],
    precision: "unavailable",
    rationale: "Insufficient pool-reserve data to produce an estimate.",
  };
}

export function estimateTrade(
  pools: readonly LiquidityPool[],
  side: TradeEstimate["side"],
  inputUsd: Decimal,
  referencePriceUsd: Decimal | null,
): TradeEstimate {
  if (!referencePriceUsd || !referencePriceUsd.greaterThan(0) || !inputUsd.greaterThan(0)) {
    return unavailableEstimate(side, inputUsd);
  }

  const candidates = pools
    .map((pool) => estimateFromPool(pool, side, inputUsd, referencePriceUsd))
    .filter((candidate): candidate is TradeEstimate => candidate !== null)
    .sort((left, right) => {
      const leftImpact = left.priceImpactPercent ?? new Decimal(Infinity);
      const rightImpact = right.priceImpactPercent ?? new Decimal(Infinity);
      return leftImpact.comparedTo(rightImpact);
    });
  return candidates[0] ?? unavailableEstimate(side, inputUsd);
}

export function estimateMarketDepth(
  pools: readonly LiquidityPool[],
  referencePriceUsd: Decimal | null,
  sizes: readonly Decimal[],
): readonly TradeEstimate[] {
  return sizes.flatMap((size) => [
    estimateTrade(pools, "buy", size, referencePriceUsd),
    estimateTrade(pools, "sell", size, referencePriceUsd),
  ]);
}

export function maxPrecision(estimates: readonly TradeEstimate[]): LiquidityPrecision {
  if (estimates.some((estimate) => estimate.precision === "estimated")) return "estimated";
  if (estimates.some((estimate) => estimate.precision === "exact")) return "exact";
  return "unavailable";
}
