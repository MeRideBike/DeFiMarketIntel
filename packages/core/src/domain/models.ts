import Decimal from "decimal.js";

/** A chain identifier is intentionally opaque so domain code does not assume EVM semantics. */
export type ChainId = string;

export type ChainFamily = "evm" | "solana";
export type AssetIdentifierKind = "evm-address" | "solana-mint" | "native";
export type VerificationStatus = "verified" | "unverified" | "unknown";
export type AssetRelationshipKind = "native" | "wrapped" | "bridged" | "canonical";
export type QuoteAssetQuality = "trusted" | "derived" | "unknown" | "untrusted";
export type LiquidityPrecision = "exact" | "estimated" | "unavailable";

export interface Chain {
  readonly id: ChainId;
  readonly name: string;
  readonly family: ChainFamily;
  readonly nativeAssetSymbol: string;
  readonly explorerUrl: string;
  readonly dexScreenerChainId: string;
  readonly defiLlamaChainId: string;
  readonly supportedProtocols: readonly string[];
}

export interface AssetIdentifier {
  readonly chainId: ChainId;
  readonly value: string;
  readonly kind: AssetIdentifierKind;
}

export interface AssetRelationship {
  readonly kind: AssetRelationshipKind;
  readonly relatedAssetId: string;
  readonly note?: string;
}

export interface Asset {
  readonly id: string;
  readonly chain: Chain;
  readonly identifier: AssetIdentifier;
  readonly name: string;
  readonly symbol: string;
  readonly decimals: number | null;
  readonly tokenStandard: string | null;
  readonly verification: VerificationStatus;
  readonly logoUrl: string | null;
  readonly canonicalAssetKey: string | null;
  readonly relationships: readonly AssetRelationship[];
  readonly source: string;
}

export interface SourceProvenance {
  readonly provider: string;
  readonly source: string;
  readonly sourceUrl: string | null;
  readonly observedAt: Date;
  readonly blockNumber: bigint | null;
  readonly blockTimestamp: Date | null;
  readonly methodology: string;
}

export interface PriceObservation extends SourceProvenance {
  readonly assetId: string;
  readonly chainId: ChainId;
  readonly priceUsd: Decimal;
  readonly liquidityUsd: Decimal | null;
  readonly protocol: string | null;
  readonly poolId: string | null;
  readonly quoteAssetQuality: QuoteAssetQuality;
  readonly derivation: readonly string[];
}

export interface LiquidityPool extends SourceProvenance {
  readonly id: string;
  readonly chainId: ChainId;
  readonly protocol: string;
  readonly poolAddress: string;
  readonly pairLabel: string;
  readonly baseAsset: Pick<Asset, "id" | "name" | "symbol" | "identifier">;
  readonly quoteAsset: Pick<Asset, "id" | "name" | "symbol" | "identifier">;
  readonly feeBps: number | null;
  readonly priceUsd: Decimal | null;
  readonly totalLiquidityUsd: Decimal | null;
  readonly activeLiquidityUsd: Decimal | null;
  readonly executableLiquidityUsd: Decimal | null;
  readonly liquidityPrecision: LiquidityPrecision;
  readonly assetReserve: Decimal | null;
  readonly quoteReserveUsd: Decimal | null;
  readonly volume24hUsd: Decimal | null;
  readonly priceDeviationPercent: Decimal | null;
  readonly isConcentratedLiquidity: boolean;
  readonly poolCreatedAt: Date | null;
}

export interface PriceAggregate {
  readonly referencePriceUsd: Decimal | null;
  readonly liquidityWeightedPriceUsd: Decimal | null;
  readonly medianPriceUsd: Decimal | null;
  readonly observationLowUsd: Decimal | null;
  readonly observationHighUsd: Decimal | null;
  readonly sourceCount: number;
  readonly acceptedObservationCount: number;
  readonly outlierCount: number;
  readonly confidenceScore: number;
  readonly confidenceLabel: ConfidenceLabel;
  readonly observations: readonly PriceObservation[];
  readonly excludedObservations: readonly PriceObservation[];
}

export type ConfidenceLabel = "Very High" | "High" | "Moderate" | "Low" | "Very Low" | "Unreliable";

export interface LiquidityAggregate {
  readonly totalObservedLiquidityUsd: Decimal;
  readonly usableLiquidityUsd: Decimal;
  readonly liquidityScore: number;
  readonly liquidityLabel: "Deep" | "Healthy" | "Limited" | "Thin" | "Unavailable";
  readonly venueDistribution: readonly DistributionEntry[];
  readonly protocolDistribution: readonly DistributionEntry[];
  readonly chainDistribution: readonly DistributionEntry[];
  readonly largestPoolSharePercent: Decimal | null;
  readonly topThreePoolSharePercent: Decimal | null;
}

export interface DistributionEntry {
  readonly key: string;
  readonly liquidityUsd: Decimal;
  readonly sharePercent: Decimal;
}

export interface TradeEstimate {
  readonly side: "buy" | "sell";
  readonly inputUsd: Decimal;
  readonly effectivePriceUsd: Decimal | null;
  readonly estimatedOutput: Decimal | null;
  readonly estimatedProtocolFeeUsd: Decimal | null;
  readonly priceImpactPercent: Decimal | null;
  readonly bestPoolId: string | null;
  readonly bestVenue: string | null;
  readonly route: readonly string[];
  readonly precision: LiquidityPrecision;
  readonly rationale: string;
}

export interface MarketWarning {
  readonly code:
    | "LOW_LIQUIDITY"
    | "HIGH_PRICE_IMPACT"
    | "PRICE_DISLOCATION"
    | "SINGLE_POOL_DEPENDENCY"
    | "STALE_PRICE_DATA"
    | "UNVERIFIED_TOKEN"
    | "LOW_PROVIDER_AGREEMENT"
    | "INSUFFICIENT_MARKET_DATA"
    | "CONCENTRATED_LIQUIDITY_UNAVAILABLE";
  readonly severity: "info" | "warning" | "critical";
  readonly title: string;
  readonly detail: string;
}

export interface ProviderStatus {
  readonly provider: string;
  readonly available: boolean;
  readonly latencyMs: number | null;
  readonly detail: string | null;
}

export interface AssetReport {
  readonly asset: Asset;
  readonly price: PriceAggregate;
  readonly liquidity: LiquidityAggregate;
  readonly pools: readonly LiquidityPool[];
  readonly tradeEstimates: readonly TradeEstimate[];
  readonly warnings: readonly MarketWarning[];
  readonly providerStatuses: readonly ProviderStatus[];
  readonly generatedAt: Date;
  readonly partial: boolean;
}
