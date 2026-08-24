import { describe, expect, it } from "vitest";

import {
  AssetSearchService,
  MarketReportService,
  type LiquidityProvider,
  type PriceProvider,
  type ProviderStatus,
  type TokenMetadataProvider,
} from "@defi-market-intel/core";

import { decimal, fixtureAsset, makeObservation, makePool } from "./fixtures";

describe("provider-independent asset handling", () => {
  it("keeps curated assets searchable when an external metadata provider is unavailable", async () => {
    const unavailableMetadata: TokenMetadataProvider = {
      name: "Unavailable metadata provider",
      search: async () => Promise.reject(new Error("provider offline")),
      resolveAsset: async () => Promise.reject(new Error("provider offline")),
    };

    const results = await new AssetSearchService([unavailableMetadata]).search("WETH");

    expect(
      results.some(
        (result) => result.asset.id === "ethereum:0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
      ),
    ).toBe(true);
    expect(results.find((result) => result.asset.symbol === "WETH")?.asset.verification).toBe(
      "verified",
    );
  });

  it("returns a partial report using healthy price and liquidity observations when a peer fails", async () => {
    const metadata: TokenMetadataProvider = {
      name: "Fixture metadata",
      search: async () => [fixtureAsset],
      resolveAsset: async (identifier) =>
        identifier.value === fixtureAsset.identifier.value ? fixtureAsset : null,
    };
    const healthyPrice: PriceProvider = {
      name: "Healthy price provider",
      getPrice: async () => [
        makeObservation({ provider: "Healthy price provider", observedAt: new Date() }),
      ],
    };
    const unavailablePrice: PriceProvider & { getStatus(): readonly ProviderStatus[] } = {
      name: "Unavailable price provider",
      getPrice: async () => Promise.reject(new Error("price provider offline")),
      getStatus: () => [
        {
          provider: "Unavailable price provider",
          available: false,
          latencyMs: null,
          detail: "price provider offline",
        },
      ],
    };
    const healthyLiquidity: LiquidityProvider = {
      name: "Healthy liquidity provider",
      getPools: async () => [makePool({ provider: "Healthy liquidity provider" })],
    };
    const service = new MarketReportService(
      [metadata],
      [healthyPrice, unavailablePrice],
      [healthyLiquidity],
    );

    const report = await service.getReport(fixtureAsset.chain.id, fixtureAsset.identifier.value, [
      decimal(100),
    ]);

    expect(report).not.toBeNull();
    expect(report?.asset).toEqual(fixtureAsset);
    expect(report?.partial).toBe(true);
    expect(report?.price.acceptedObservationCount).toBe(1);
    expect(report?.liquidity.totalObservedLiquidityUsd.toString()).toBe("100000");
    expect(report?.pools).toHaveLength(1);
    expect(report?.tradeEstimates).toHaveLength(2);
    expect(report?.providerStatuses).toContainEqual({
      provider: "Unavailable price provider",
      available: false,
      latencyMs: null,
      detail: "price provider offline",
    });
  });
});
