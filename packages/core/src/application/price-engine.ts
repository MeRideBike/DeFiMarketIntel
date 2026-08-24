import Decimal from "decimal.js";

import type { ConfidenceLabel, PriceAggregate, PriceObservation } from "../domain/models";

const maxObservationAgeMs = 10 * 60 * 1_000;
const maxFutureSkewMs = 30 * 1_000;
const outlierThresholdPercent = new Decimal(20);

function median(values: readonly Decimal[]): Decimal | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left.comparedTo(right));
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[middle] ?? null;
  }
  const lower = sorted[middle - 1];
  const upper = sorted[middle];
  return lower && upper ? lower.plus(upper).div(2) : null;
}

function ageWeight(observedAt: Date, now: Date): Decimal {
  const ageMs = Math.max(0, now.getTime() - observedAt.getTime());
  const remaining = new Decimal(maxObservationAgeMs - Math.min(ageMs, maxObservationAgeMs));
  return remaining.div(maxObservationAgeMs).mul(0.75).plus(0.25);
}

function quoteQualityWeight(quality: PriceObservation["quoteAssetQuality"]): Decimal {
  switch (quality) {
    case "trusted":
      return new Decimal(1);
    case "derived":
      return new Decimal(0.8);
    case "unknown":
      return new Decimal(0.55);
    case "untrusted":
      return new Decimal(0.2);
  }
}

function observationWeight(observation: PriceObservation, now: Date): Decimal {
  const liquidityWeight = observation.liquidityUsd
    ? Decimal.max(observation.liquidityUsd, 1).sqrt()
    : new Decimal(1);
  return liquidityWeight
    .mul(ageWeight(observation.observedAt, now))
    .mul(quoteQualityWeight(observation.quoteAssetQuality));
}

function labelForScore(score: number): ConfidenceLabel {
  if (score >= 85) return "Very High";
  if (score >= 70) return "High";
  if (score >= 50) return "Moderate";
  if (score >= 30) return "Low";
  if (score >= 10) return "Very Low";
  return "Unreliable";
}

function scoreConfidence(
  accepted: readonly PriceObservation[],
  medianPrice: Decimal | null,
  low: Decimal | null,
  high: Decimal | null,
  now: Date,
): number {
  if (!medianPrice || !low || !high || accepted.length === 0) {
    return 0;
  }

  const providerCount = new Set(accepted.map((observation) => observation.provider)).size;
  const trustedCount = accepted.filter(
    (observation) => observation.quoteAssetQuality === "trusted",
  ).length;
  const liquidity = accepted.reduce(
    (total, observation) => total.plus(observation.liquidityUsd ?? 0),
    new Decimal(0),
  );
  const spreadPercent = high.minus(low).div(medianPrice).mul(100);
  const freshnessScore = accepted
    .reduce(
      (total, observation) => total.plus(ageWeight(observation.observedAt, now)),
      new Decimal(0),
    )
    .div(accepted.length);

  const sources = Math.min(providerCount * 18, 36);
  const liquidityScore = Math.min(Math.max(Number(liquidity.add(1).logarithm(10)) * 2.5, 0), 20);
  const agreementScore = Math.max(0, 22 - Math.min(Number(spreadPercent), 22));
  const qualityScore = (trustedCount / accepted.length) * 12;
  const freshness = Number(freshnessScore.mul(10));
  return Math.max(
    0,
    Math.min(100, Math.round(sources + liquidityScore + agreementScore + qualityScore + freshness)),
  );
}

/**
 * Aggregates independent observations without treating a simple arithmetic mean as a market
 * price. Weighting remains explainable: liquidity, freshness, and quote-asset quality only.
 */
export function aggregatePrices(
  observations: readonly PriceObservation[],
  now = new Date(),
): PriceAggregate {
  const valid = observations.filter((observation) => {
    const ageMs = now.getTime() - observation.observedAt.getTime();
    return (
      observation.priceUsd.isFinite() &&
      observation.priceUsd.greaterThan(0) &&
      ageMs <= maxObservationAgeMs &&
      ageMs >= -maxFutureSkewMs
    );
  });
  const initialMedian = median(valid.map((observation) => observation.priceUsd));
  const excluded = observations.filter((observation) => !valid.includes(observation));
  const outliers = initialMedian
    ? valid.filter((observation) =>
        observation.priceUsd
          .minus(initialMedian)
          .abs()
          .div(initialMedian)
          .mul(100)
          .greaterThan(outlierThresholdPercent),
      )
    : [];
  const accepted = valid.filter((observation) => !outliers.includes(observation));
  const prices = accepted.map((observation) => observation.priceUsd);
  const medianPriceUsd = median(prices);
  const observationLowUsd = prices.length ? Decimal.min(...prices) : null;
  const observationHighUsd = prices.length ? Decimal.max(...prices) : null;

  let totalWeight = new Decimal(0);
  let totalWeightedPrice = new Decimal(0);
  for (const observation of accepted) {
    const weight = observationWeight(observation, now);
    totalWeight = totalWeight.plus(weight);
    totalWeightedPrice = totalWeightedPrice.plus(observation.priceUsd.mul(weight));
  }
  const liquidityWeightedPriceUsd = totalWeight.greaterThan(0)
    ? totalWeightedPrice.div(totalWeight)
    : null;
  const referencePriceUsd = liquidityWeightedPriceUsd ?? medianPriceUsd;
  const confidenceScore = scoreConfidence(
    accepted,
    medianPriceUsd,
    observationLowUsd,
    observationHighUsd,
    now,
  );

  return {
    referencePriceUsd,
    liquidityWeightedPriceUsd,
    medianPriceUsd,
    observationLowUsd,
    observationHighUsd,
    sourceCount: new Set(accepted.map((observation) => observation.provider)).size,
    acceptedObservationCount: accepted.length,
    outlierCount: outliers.length,
    confidenceScore,
    confidenceLabel: labelForScore(confidenceScore),
    observations: accepted,
    excludedObservations: [...excluded, ...outliers],
  };
}
