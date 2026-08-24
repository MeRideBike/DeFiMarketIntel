# Data model

## Identity first

An asset identity is the tuple **(chain ID, identifier)**. Symbols and names are searchable display data only and are never treated as globally unique.

At runtime, an asset ID is derived as `chainId:normalizedIdentifier`. EVM identifiers are lowercased after validation; Solana mint values retain their canonical case. This runtime ID is distinct from the Prisma `Asset.id`, which is a database `cuid` when persistence is enabled.

```text
Chain
  └── Asset (unique: chainId + identifier)
        ├── PriceObservation
        ├── PriceSnapshot
        ├── LiquiditySnapshot
        ├── PoolAsset ◄── Pool ── Protocol
        ├── AssetRelationship ── Asset
        ├── WatchlistAsset ◄── Watchlist ── User
        └── Alert ◄────────────── User
```

## Runtime domain objects

| Object               | Important fields                                                                 | Meaning                                                            |
| -------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `Chain`              | `id`, `family`, explorer, provider-specific chain IDs                            | A chain registry record, not an EVM-only network object.           |
| `AssetIdentifier`    | `chainId`, `value`, `kind`                                                       | `evm-address`, `solana-mint`, or `native`.                         |
| `Asset`              | chain, identifier, symbol, decimals, token standard, verification, canonical key | A chain-scoped token or native-asset representation.               |
| `PriceObservation`   | USD price, liquidity, quote quality, provenance, derivation                      | One provider observation, not an assertion of an executable quote. |
| `LiquidityPool`      | protocol, pair, TVL, active/executable liquidity, reserves, precision            | A normalized observable venue.                                     |
| `PriceAggregate`     | reference, median, weighted price, range, confidence, exclusions                 | Explainable price-engine output.                                   |
| `LiquidityAggregate` | observed/usable totals, distributions, concentration, score                      | Explainable liquidity-engine output.                               |
| `TradeEstimate`      | side, input, effective price, impact, fee, pool, route, precision                | A single-pool reserve-based estimate.                              |

All economic quantities in core models use `Decimal`. Raw on-chain integers are reserved for `BigInt` fields such as an optional observation block number. API DTOs serialize decimals as strings so JSON does not silently truncate financial values.

## Curated assets and discovered assets

The curated registry contains 16 known assets across Ethereum, Arbitrum, Base, Polygon, BNB Chain, Avalanche, and Solana. These are returned with `verification: "verified"`, known decimals, a token standard, and a `canonicalAssetKey`.

Assets discovered through DexScreener market data have `verification: "unknown"`, no trusted decimal value, no logo URL, and provider-derived name/symbol text. The provider strips control characters and bounds names and symbols before constructing the domain object. A familiar ticker on a discovered asset does not confer verification.

The known-asset definitions record native, wrapped, bridged, or canonical intent internally. The runtime `Asset.relationships` array is currently empty, and no cross-chain aggregation UI or persistence workflow materializes those relations. `canonicalAssetKey` is therefore a grouping hint, not proof that different chain representations are interchangeable.

## PostgreSQL schema

The Prisma schema targets PostgreSQL and is a forward-looking persistence model; no current request path reads or writes it.

### Core reference data

- `Chain` has a stable string primary key, family, native symbol, explorer URL, and timestamps.
- `Asset` has a `cuid` primary key and a unique `(chainId, identifier)` constraint. It indexes symbol, canonical key, and `(chainId, symbol)`.
- `AssetRelationship` records directed source/related asset links with a relationship type and unique `(sourceAssetId, relatedAssetId, type)` tuple.
- `Provider` and `Protocol` keep stable keys, names, operational timestamps, and enablement metadata.

### Pools and observations

- `Pool` is unique on `(chainId, address)`, belongs to a protocol, and records fee, concentrated-liquidity flag, and liquidity precision.
- `PoolAsset` uses `(poolId, assetId)` as a composite key and can retain raw reserve and USD reserve values with high-precision PostgreSQL decimals.
- `PriceObservation` records provider, optional pool, USD price, optional liquidity, quote quality, derivation JSON, methodology, source URL, block context, and observation timestamp. It indexes recent asset, provider, and pool timelines.
- `PriceSnapshot` stores an aggregate price, confidence score, source count, timestamp, and granularity. Its unique key is `(assetId, granularitySeconds, observedAt)`.
- `LiquiditySnapshot` stores asset-level or pool-level liquidity, usable liquidity, 24-hour volume, timestamp, and granularity.

`PriceObservation.priceUsd` and associated USD values use `Decimal(38,18)`; `PoolAsset.reserveRaw` uses `Decimal(65,0)`; and block numbers use PostgreSQL-backed `BigInt` through Prisma. These types avoid JavaScript safe-integer assumptions.

### User-shaped models

`User`, `Watchlist`, `WatchlistAsset`, and `Alert` define the relational basis for a later user feature. Watchlist names are unique per user; watchlist membership is a composite key; alerts index asset/condition and user/enabled state. There is no authentication flow, alert evaluator, notification delivery, or runtime data access for these models in this revision.

## Relationship and verification semantics

| Field or relationship | Interpretation                                                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `verification`        | `verified` is limited to the repository's curated registry; `unknown` and `unverified` require independent identifier verification. |
| `canonicalAssetKey`   | A human-curated grouping label. It is not a bridge guarantee, redemption claim, or price-parity rule.                               |
| `native`              | A native asset representation.                                                                                                      |
| `wrapped`             | A tokenized representation of a chain-native asset.                                                                                 |
| `bridged`             | An asset representation delivered through a bridge.                                                                                 |
| `canonical`           | The selected primary representation for a curated asset grouping.                                                                   |

Any persistence implementation should create explicit `AssetRelationship` rows only after validating the relationship's issuer, bridge, and economic semantics. Symbol matching is not sufficient evidence.

## Historical-data boundary

The schema supports snapshots at arbitrary `granularitySeconds`, but the repository does not schedule collection, backfill historical data, downsample observations, or enforce retention. A production persistence rollout must define those policies before enabling writes, so high-frequency market observations do not grow without bound and historical series remain interpretable.
