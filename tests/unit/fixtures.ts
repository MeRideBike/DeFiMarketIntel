import { aggregateLiquidity, getChain } from "@defi-market-intel/core";
import type { Asset, LiquidityPool, PriceObservation } from "@defi-market-intel/core";

const ethereum = getChain("ethereum");

if (!ethereum) {
  throw new Error("The Ethereum chain fixture must be registered.");
}

/**
 * Keep unit tests as consumers of the public core package: decimal.js is a core dependency,
 * rather than a root-workspace dependency.
 */
export function decimal(value: number | string) {
  return aggregateLiquidity([]).totalObservedLiquidityUsd.plus(value);
}

export const fixtureAsset: Asset = {
  id: "ethereum:0x1111111111111111111111111111111111111111",
  chain: ethereum,
  identifier: {
    chainId: "ethereum",
    value: "0x1111111111111111111111111111111111111111",
    kind: "evm-address",
  },
  name: "Fixture Token",
  symbol: "FIX",
  decimals: 18,
  tokenStandard: "ERC-20",
  verification: "verified",
  logoUrl: null,
  canonicalAssetKey: null,
  relationships: [],
  source: "Unit-test fixture",
};

export function makeObservation(overrides: Partial<PriceObservation> = {}): PriceObservation {
  return {
    assetId: fixtureAsset.id,
    chainId: fixtureAsset.chain.id,
    provider: "Fixture provider",
    source: "Fixture FIX/USDC market",
    sourceUrl: "https://example.test/fix-usdc",
    observedAt: new Date("2026-08-23T12:00:00.000Z"),
    blockNumber: null,
    blockTimestamp: null,
    methodology: "A deterministic unit-test price observation.",
    priceUsd: decimal(100),
    liquidityUsd: decimal(100_000),
    protocol: "FixtureSwap",
    poolId: "ethereum:fixture-pool",
    quoteAssetQuality: "trusted",
    derivation: ["FIX → USDC → USD"],
    ...overrides,
  };
}

export function makePool(overrides: Partial<LiquidityPool> = {}): LiquidityPool {
  return {
    id: "ethereum:fixture-pool",
    chainId: fixtureAsset.chain.id,
    protocol: "FixtureSwap",
    poolAddress: "0x2222222222222222222222222222222222222222",
    pairLabel: "FIX/USDC",
    baseAsset: {
      id: fixtureAsset.id,
      name: fixtureAsset.name,
      symbol: fixtureAsset.symbol,
      identifier: fixtureAsset.identifier,
    },
    quoteAsset: {
      id: "ethereum:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      name: "USD Coin",
      symbol: "USDC",
      identifier: {
        chainId: "ethereum",
        value: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        kind: "evm-address",
      },
    },
    feeBps: 30,
    priceUsd: decimal(100),
    totalLiquidityUsd: decimal(100_000),
    activeLiquidityUsd: decimal(100_000),
    executableLiquidityUsd: decimal(100_000),
    liquidityPrecision: "exact",
    assetReserve: decimal(1_000),
    quoteReserveUsd: decimal(100_000),
    volume24hUsd: decimal(50_000),
    priceDeviationPercent: null,
    isConcentratedLiquidity: false,
    poolCreatedAt: null,
    provider: "Fixture provider",
    source: "FixtureSwap pool data",
    sourceUrl: "https://example.test/pool",
    observedAt: new Date("2026-08-23T12:00:00.000Z"),
    blockNumber: null,
    blockTimestamp: null,
    methodology: "A deterministic unit-test constant-product pool.",
    ...overrides,
  };
}
