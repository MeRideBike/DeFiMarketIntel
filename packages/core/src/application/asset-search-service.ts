import type { TokenMetadataProvider } from "../domain/contracts";
import type { Asset } from "../domain/models";
import { isValidSearchQuery } from "../domain/validation";
import { searchKnownAssets } from "../infrastructure/providers/dexscreener-provider";

export interface SearchResult {
  readonly asset: Asset;
  readonly rank: number;
}

function rankAsset(asset: Asset, query: string): number {
  const normalized = query.trim().toLowerCase();
  const exactAddress = asset.identifier.value.toLowerCase() === normalized;
  const exactSymbol = asset.symbol.toLowerCase() === normalized;
  const startsWithSymbol = asset.symbol.toLowerCase().startsWith(normalized);
  const verified = asset.verification === "verified" ? 50 : 0;
  return (
    (exactAddress ? 1_000 : 0) + (exactSymbol ? 500 : 0) + (startsWithSymbol ? 100 : 0) + verified
  );
}

export class AssetSearchService {
  public constructor(private readonly providers: readonly TokenMetadataProvider[]) {}

  public async search(query: string, limit = 20): Promise<readonly SearchResult[]> {
    if (!isValidSearchQuery(query)) {
      return [];
    }
    const boundedLimit = Math.max(1, Math.min(limit, 50));
    const curatedAssets = searchKnownAssets(query);
    // Curated identities are immediately useful and do not depend on a network round-trip.
    // Discovery remains the fallback for assets that are not in the canonical registry.
    if (curatedAssets.length > 0) {
      return curatedAssets
        .map((asset) => ({ asset, rank: rankAsset(asset, query) }))
        .sort(
          (left, right) =>
            right.rank - left.rank || left.asset.symbol.localeCompare(right.asset.symbol),
        )
        .slice(0, boundedLimit);
    }
    const providerResults = await Promise.allSettled(
      this.providers.map((provider) => provider.search(query, boundedLimit)),
    );
    const assets = new Map<string, Asset>();
    for (const result of providerResults) {
      if (result.status !== "fulfilled") {
        continue;
      }
      for (const asset of result.value) {
        const existing = assets.get(asset.id);
        if (!existing || existing.verification !== "verified") {
          assets.set(asset.id, asset);
        }
      }
    }
    return [...assets.values()]
      .map((asset) => ({ asset, rank: rankAsset(asset, query) }))
      .sort(
        (left, right) =>
          right.rank - left.rank || left.asset.symbol.localeCompare(right.asset.symbol),
      )
      .slice(0, boundedLimit);
  }
}
