import { describe, expect, it } from "vitest";

import { aggregateLiquidity, estimateMarketDepth, estimateTrade } from "@defi-market-intel/core";

import { decimal, makePool } from "./fixtures";

describe("aggregateLiquidity", () => {
  it("separates observed and executable liquidity and summarizes distributions", () => {
    const aggregate = aggregateLiquidity([
      makePool({
        id: "ethereum:pool-a",
        protocol: "AlphaSwap",
        pairLabel: "FIX/USDC",
        totalLiquidityUsd: decimal(4_000),
        executableLiquidityUsd: decimal(3_500),
      }),
      makePool({
        id: "ethereum:pool-b",
        protocol: "BetaSwap",
        pairLabel: "FIX/WETH",
        totalLiquidityUsd: decimal(3_000),
        executableLiquidityUsd: decimal(2_500),
      }),
      makePool({
        id: "arbitrum:pool-c",
        chainId: "arbitrum",
        protocol: "AlphaSwap",
        pairLabel: "FIX/USDC",
        totalLiquidityUsd: decimal(1_000),
        executableLiquidityUsd: null,
      }),
      makePool({ id: "ethereum:missing-tvl", totalLiquidityUsd: null }),
    ]);

    expect(aggregate.totalObservedLiquidityUsd.toString()).toBe("8000");
    expect(aggregate.usableLiquidityUsd.toString()).toBe("6000");
    expect(aggregate.protocolDistribution.map((entry) => entry.key)).toEqual([
      "AlphaSwap",
      "BetaSwap",
    ]);
    expect(aggregate.protocolDistribution[0]?.sharePercent.toString()).toBe("62.5");
    expect(aggregate.chainDistribution.map((entry) => entry.key)).toEqual(["ethereum", "arbitrum"]);
    expect(aggregate.largestPoolSharePercent?.toString()).toBe("50");
    expect(aggregate.topThreePoolSharePercent?.toString()).toBe("100");
    expect(aggregate.liquidityLabel).toBe("Limited");
  });

  it("uses null concentration values when no eligible pool exists", () => {
    const aggregate = aggregateLiquidity([makePool({ totalLiquidityUsd: null })]);

    expect(aggregate.largestPoolSharePercent).toBeNull();
    expect(aggregate.topThreePoolSharePercent).toBeNull();
    expect(aggregate.liquidityLabel).toBe("Unavailable");
  });
});

describe("estimateTrade", () => {
  const referencePrice = decimal(100);

  const shallowPool = makePool({
    id: "ethereum:shallow",
    assetReserve: decimal(100),
    quoteReserveUsd: decimal(10_000),
  });
  const deepPool = makePool({
    id: "ethereum:deep",
    assetReserve: decimal(1_000),
    quoteReserveUsd: decimal(100_000),
  });

  it("selects the pool with the lower reserve-based buy impact", () => {
    const estimate = estimateTrade([shallowPool, deepPool], "buy", decimal(1_000), referencePrice);

    expect(estimate.bestPoolId).toBe("ethereum:deep");
    expect(estimate.estimatedProtocolFeeUsd?.toString()).toBe("3");
    expect(estimate.effectivePriceUsd?.greaterThan(referencePrice)).toBe(true);
    expect(estimate.priceImpactPercent?.greaterThan(0)).toBe(true);
    expect(estimate.precision).toBe("exact");
  });

  it("estimates both buy and sell depth and declines quotes without usable reserves", () => {
    const estimates = estimateMarketDepth([deepPool], referencePrice, [decimal(100)]);
    const unavailable = estimateTrade(
      [makePool({ assetReserve: null, quoteReserveUsd: null })],
      "sell",
      decimal(100),
      referencePrice,
    );

    expect(estimates).toHaveLength(2);
    expect(estimates.map((estimate) => estimate.side)).toEqual(["buy", "sell"]);
    expect(estimates.every((estimate) => estimate.priceImpactPercent?.greaterThan(0))).toBe(true);
    expect(unavailable.precision).toBe("unavailable");
    expect(unavailable.estimatedOutput).toBeNull();
  });

  it("does not invent a constant-product estimate for concentrated liquidity", () => {
    const estimate = estimateTrade(
      [makePool({ isConcentratedLiquidity: true })],
      "buy",
      decimal(1_000),
      referencePrice,
    );

    expect(estimate.precision).toBe("unavailable");
    expect(estimate.priceImpactPercent).toBeNull();
  });
});
