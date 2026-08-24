# Adding a DEX or liquidity adapter

## Choose the right integration level

The current application gets broad venue discovery from DexScreener. If a DEX is already represented in DexScreener's returned token-pair data for a registered chain, its `dexId` will appear automatically in pool and price results. That is useful observed coverage, but it is not a protocol-native adapter: fee data may be absent, reserves may be inferred, and concentrated-liquidity behavior remains estimated.

Add a protocol-specific adapter when the product needs data that the generic provider cannot support reliably, such as verified pool identity, tick-aware concentrated-liquidity depth, protocol fee tiers, exact route quotes, block provenance, or a protocol-specific pool-discovery method.

## Adapter contracts

Implement the narrowest applicable core contract:

```ts
class ExampleDexProvider implements LiquidityProvider, PriceProvider {
  readonly name = "Example DEX";

  async getPools(asset: Asset): Promise<readonly LiquidityPool[]> {
    // Normalize verified provider or chain data here.
  }

  async getPrice(asset: Asset): Promise<readonly PriceObservation[]> {
    // Emit independently attributable observations here.
  }
}
```

Only implement `TokenMetadataProvider` when the DEX is an appropriate asset-discovery source. A DEX adapter should not fabricate token metadata from a symbol or assume an unknown asset is verified.

Place the adapter under `packages/core/src/infrastructure/providers`, then register one instance in the relevant list in `apps/web/src/lib/market.ts`. The registration point is intentionally explicit: it makes live provider coverage reviewable and prevents an untested adapter from changing report behavior implicitly.

## Required normalization

Every `LiquidityPool` returned by an adapter must include an honest representation of these boundaries:

| Field        | Requirement                                                                                                                      |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Identity     | Stable adapter pool ID, chain ID, protocol name, pool address, and pair label. Do not reuse a pool ID across chains.             |
| Assets       | Chain-scoped base/quote assets with `AssetIdentifier` values, not symbols alone.                                                 |
| Numbers      | Parse amounts with `Decimal`; use `null` when a value is unavailable. Never downcast raw integer amounts to JavaScript `number`. |
| Provenance   | Provider, source, source URL when safe, observed time, methodology, and available block number/timestamp.                        |
| TVL vs depth | Keep `totalLiquidityUsd`, `activeLiquidityUsd`, and `executableLiquidityUsd` distinct.                                           |
| Precision    | Use `exact` only when an adapter has evidence that supports it; otherwise use `estimated` or `unavailable`.                      |
| Fees         | Supply `feeBps` when known. A missing value causes the generic depth engine to use its disclosed 30 bps fallback.                |

For `PriceObservation`, identify the price source, pool when relevant, quote-asset quality, liquidity, method, and derivation path. The price engine can then preserve and weigh the observation without knowing vendor-specific payload shapes.

## Concentrated liquidity

Do not report concentrated-pool TVL as if it were immediately tradeable depth. A protocol-native concentrated-liquidity adapter should obtain the pool's current state and apply the protocol's swap math, including the active range, liquidity, price state, fee, and tick traversal for the requested direction and size.

Until the adapter can perform that work, set active liquidity to `null`, use a conservative executable-liquidity estimate only when it can be explained, and mark the result `estimated` or `unavailable`. The generic engine currently recognizes likely concentrated venues by a DexScreener label/DEX-ID heuristic and does not simulate ticks; a native adapter is the path to an exact depth model.

## Provider boundary and resilience

Use the existing provider boundary rather than calling a vendor directly from a page or route:

1. Define a Zod schema for the external response before consuming it.
2. Use `fetchValidatedJson` for HTTPS enforcement, timeout handling, and error normalization, or provide equivalent controls for a non-HTTP source.
3. Wrap calls in `ProviderRuntime` to report latency/availability and to honor a provider-local request interval.
4. Cache immutable or short-lived results with a bounded key space. Do not cache a quote beyond its meaningful freshness window.
5. Return an empty result or throw a scoped provider failure when the source cannot support the request; `MarketReportService` can return partial data from other providers.

An adapter must never accept a browser-provided URL, RPC endpoint, or arbitrary provider host. Endpoints belong in audited server configuration, and provider responses remain untrusted after transport succeeds.

## Registration and behavior review

After adding the adapter, review how its data changes the report:

- A new `PriceProvider` can contribute observations, source count, outlier filtering, confidence, and price-dislocation calculations.
- A new `LiquidityProvider` can contribute pool totals, protocol/venue/chain distributions, concentration, liquidity score, and depth candidates.
- If two sources describe the same pool, deduplicate before returning it or introduce a stable report-level deduplication rule. The current aggregate assumes providers return distinct pools.
- A depth provider with a route-aware exact quote should not be forced through the generic constant-product estimator; model the distinction explicitly before displaying it as exact.

## Test matrix

Use deterministic fixtures for the adapter's raw payloads and test at least:

- valid pool discovery for both sides of a pair;
- unsupported chain and invalid asset identifier behavior;
- decimal and raw-reserve precision;
- malformed, stale, negative, and missing provider values;
- fee treatment and no-fee fallback behavior;
- concentrated-liquidity active/depth handling;
- source provenance and safe URL handling;
- failure isolation alongside the existing DexScreener and DefiLlama providers; and
- effects on aggregation, concentration, and trade-estimate selection.

Only describe a DEX as directly supported once the running provider composition includes the adapter and its documented capabilities are verified against real protocol data.
