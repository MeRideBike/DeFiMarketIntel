# Providers

## Provider contracts

Core code separates external data from business logic through small interfaces:

```ts
interface TokenMetadataProvider {
  search(query: string, limit: number): Promise<readonly Asset[]>;
  resolveAsset(identifier: AssetIdentifier): Promise<Asset | null>;
}

interface PriceProvider {
  getPrice(asset: Asset): Promise<readonly PriceObservation[]>;
}

interface LiquidityProvider {
  getPools(asset: Asset): Promise<readonly LiquidityPool[]>;
}
```

Providers can also expose `getStatus()` through `ProviderHealthProvider`. `MarketReportService` receives separate metadata, price, and liquidity provider lists, which permits a provider to implement one or more capabilities without coupling the engines to a vendor.

## Live adapters

| Provider        | Metadata/search | Price | Pools/liquidity | Current endpoint behavior                                                                                   |
| --------------- | --------------- | ----- | --------------- | ----------------------------------------------------------------------------------------------------------- |
| DexScreener     | Yes             | Yes   | Yes             | Uses `/latest/dex/search` and chain-scoped `/token-pairs/v1` endpoints under `https://api.dexscreener.com`. |
| DefiLlama Coins | No              | Yes   | No              | Uses `https://coins.llama.fi/prices/current/{chain}:{identifier}`.                                          |

`apps/web/src/lib/market.ts` currently composes one `DexScreenerProvider` for all three DexScreener capabilities and one `DefiLlamaPriceProvider` as a second price source. Server configuration reads `DEXSCREENER_API_BASE_URL`, `DEFILLAMA_API_BASE_URL`, and `MARKET_PROVIDER_TIMEOUT_MS`; endpoint overrides must be HTTPS on audited provider domains or they fall back to the defaults. No provider keys, RPC URLs, or additional provider adapters are configured by the current runtime.

### DexScreener

DexScreener is the market-discovery and DEX-pool source. Search results are converted to chain-scoped assets only when the returned chain ID maps to a registered chain. Curated identities take precedence over provider metadata. Discovered assets are explicitly unknown/unverified and have no provider-verified decimals.

For prices, the adapter emits one observation per returned pair only when the requested asset is the pair base token and `priceUsd` is valid. For pools, it includes a returned pair when the asset occurs on either side. Pair liquidity, reserves, and volume are provider data; concentrated-liquidity labeling and reserve inference are documented in [Liquidity engine](LIQUIDITY_ENGINE.md).

### DefiLlama Coins

DefiLlama contributes one USD reference observation keyed by the registry's `defiLlamaChainId` and the asset identifier. It does not resolve assets, search, discover pools, provide volume, or supply an executable quote. Its observation is marked `trusted` quote quality and carries no liquidity value.

## Request controls

All provider calls run through `ProviderRuntime` and `fetchValidatedJson`.

| Control             | Current behavior                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Endpoint protocol   | HTTPS is required before a request is sent.                                                                        |
| Timeout             | Configurable 1–30 seconds via `AbortController`; default 8 seconds.                                                |
| Response validation | Zod schemas validate the JSON shape before adapter logic consumes it.                                              |
| Throttling          | Provider-local minimum request-start intervals: 125 ms for DexScreener, 150 ms for DefiLlama.                      |
| Status              | Latest availability, latency, and a bounded error detail are surfaced in market reports after a provider call.     |
| Caching             | In-memory TTL cache with request coalescing; see the architecture document for capacities and TTLs.                |
| Failure isolation   | Price and liquidity fan-out uses `Promise.allSettled`, so successful providers can still produce a partial report. |

The implementation currently has no retry loop, exponential backoff, circuit breaker, distributed rate limiter, or cache sharing between application instances. Deployments with public traffic should enforce an edge rate limit and monitor vendor quota/error behavior independently.

## Data normalization rules

An adapter must return domain objects rather than raw vendor payloads:

- Parse amounts with `Decimal`; reject non-finite or non-positive financial values.
- Preserve provider, source, observed time, URL, methodology, derivation, and any available block context.
- Use a chain registry mapping rather than inferring a chain from a display name.
- Keep quote-asset quality explicit; do not label a random pair as a reliable USD price.
- Treat token names, symbols, logos, URLs, and other provider metadata as untrusted input.
- Distinguish observed TVL, active liquidity, and executable liquidity, especially for concentrated pools.

The current DexScreener adapter removes control characters and bounds metadata lengths. API DTOs allow source links only when they use HTTPS and their hostname is the exact trusted domain or a dot-boundary subdomain of `dexscreener.com` or `defillama.com`.

## Provider failure behavior

An invalid provider payload, non-2xx response, timeout, or network error becomes a `ProviderFailure`. The runtime records provider status and rethrows; the report service ignores rejected price/pool promises while retaining fulfilled results. It reports `partial: true` when a price or liquidity request failed or a recorded provider status is unavailable.

Asset resolution similarly tries metadata providers with `Promise.allSettled`, after checking the curated registry. Curated assets remain resolvable even if external discovery is unavailable. Search merges curated results after provider attempts, so a DexScreener outage still leaves known registry matches available.

## Adding a provider

1. Implement the smallest applicable contract in `packages/core/src/infrastructure/providers`.
2. Use `fetchValidatedJson` or an equivalent boundary that enforces HTTPS, timeout, and schema validation.
3. Normalize all values into `Asset`, `PriceObservation`, or `LiquidityPool`; do not expose raw provider types beyond the adapter.
4. Give each observation an honest methodology and provenance string. Use `null` or `unavailable` when a data point cannot be supported.
5. Register the adapter in `apps/web/src/lib/market.ts` in the capability list it implements.
6. Test successful responses, malformed payloads, timeouts, unsupported chains, duplicate markets, and a partial-report scenario.

For protocol-specific pool support, follow [Adding a DEX](ADDING_A_DEX.md). For provider-to-chain mapping, follow [Adding a chain](ADDING_A_CHAIN.md).
