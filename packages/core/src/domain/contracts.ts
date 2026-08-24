import type {
  Asset,
  AssetIdentifier,
  LiquidityPool,
  PriceObservation,
  ProviderStatus,
} from "./models";

export interface TokenMetadataProvider {
  readonly name: string;
  search(query: string, limit: number): Promise<readonly Asset[]>;
  resolveAsset(identifier: AssetIdentifier): Promise<Asset | null>;
}

export interface PriceProvider {
  readonly name: string;
  getPrice(asset: Asset): Promise<readonly PriceObservation[]>;
}

export interface LiquidityProvider {
  readonly name: string;
  getPools(asset: Asset): Promise<readonly LiquidityPool[]>;
}

export interface ProviderHealthProvider {
  getStatus(): readonly ProviderStatus[];
}
