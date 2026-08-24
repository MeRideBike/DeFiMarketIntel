import { describe, expect, it } from "vitest";

import { aggregatePrices } from "@defi-market-intel/core";

import { decimal, makeObservation } from "./fixtures";

describe("aggregatePrices", () => {
  const now = new Date("2026-08-23T12:00:00.000Z");

  it("uses fresh, agreeing observations and excludes stale, invalid, and outlier prices", () => {
    const aggregate = aggregatePrices(
      [
        makeObservation({
          provider: "Venue A",
          priceUsd: decimal(100),
          liquidityUsd: decimal(1_000_000),
        }),
        makeObservation({
          provider: "Venue B",
          priceUsd: decimal(100.5),
          liquidityUsd: decimal(100_000),
          observedAt: new Date("2026-08-23T11:58:00.000Z"),
          quoteAssetQuality: "derived",
        }),
        makeObservation({
          provider: "Venue C",
          priceUsd: decimal(101),
          liquidityUsd: decimal(200_000),
        }),
        makeObservation({ provider: "Outlier", priceUsd: decimal(160) }),
        makeObservation({
          provider: "Stale venue",
          priceUsd: decimal(99),
          observedAt: new Date("2026-08-23T11:49:59.999Z"),
        }),
        makeObservation({ provider: "Invalid venue", priceUsd: decimal(0) }),
      ],
      now,
    );

    expect(aggregate.acceptedObservationCount).toBe(3);
    expect(aggregate.sourceCount).toBe(3);
    expect(aggregate.outlierCount).toBe(1);
    expect(aggregate.excludedObservations).toHaveLength(3);
    expect(aggregate.medianPriceUsd?.toString()).toBe("100.5");
    expect(aggregate.observationLowUsd?.toString()).toBe("100");
    expect(aggregate.observationHighUsd?.toString()).toBe("101");
    expect(aggregate.referencePriceUsd?.toNumber()).toBeGreaterThan(100);
    expect(aggregate.referencePriceUsd?.toNumber()).toBeLessThan(101);
    expect(aggregate.observations.map((observation) => observation.provider)).not.toContain(
      "Outlier",
    );
  });

  it("returns an explicitly unreliable aggregate when no observation can be accepted", () => {
    const aggregate = aggregatePrices(
      [
        makeObservation({ priceUsd: decimal(-1) }),
        makeObservation({
          priceUsd: decimal(100),
          observedAt: new Date("2026-08-23T11:49:00.000Z"),
        }),
        makeObservation({
          priceUsd: decimal(100),
          observedAt: new Date("2026-08-23T13:00:00.000Z"),
        }),
      ],
      now,
    );

    expect(aggregate.referencePriceUsd).toBeNull();
    expect(aggregate.liquidityWeightedPriceUsd).toBeNull();
    expect(aggregate.medianPriceUsd).toBeNull();
    expect(aggregate.acceptedObservationCount).toBe(0);
    expect(aggregate.confidenceScore).toBe(0);
    expect(aggregate.confidenceLabel).toBe("Unreliable");
  });
});
