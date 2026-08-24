# Architecture

## Scope and implementation status

DeFi Market Intel is a read-only, server-rendered market-intelligence application. This document describes the implementation in this repository, rather than a planned target architecture.

The live market-data path currently has two providers:

- **DexScreener** supplies asset discovery, token metadata discovered from markets, pair-level USD observations, and observable pool data.
- **DefiLlama Coins** supplies an independent USD reference observation.

PostgreSQL, Redis, direct RPC reads, background jobs, authentication, alerts, watchlists, historical collection, and protocol-native DEX adapters are not connected to the running request path. Prisma models and Compose services establish a persistence-shaped boundary for those capabilities without making the current application dependent on them.

## Runtime composition

```text
Browser
  │
  ├── Next.js pages and client components
  │       │ same-origin fetch
  │       ▼
  └── App Router API routes (/api/*)
          │
          ▼
      apps/web/src/lib/market.ts
          │
          ├── AssetSearchService ───────────► DexScreener search API
          └── MarketReportService
                  ├── DexScreener provider ─► token/pair API
                  └── DefiLlama provider ───► Coins API
                          │
                          ▼
                packages/core application engines
                  ├── price aggregation
                  ├── liquidity aggregation
                  ├── single-pool depth estimates
                  └── objective market warnings
```

`apps/web` is a Next.js 16 / React 19 App Router application. `packages/core` is a framework-independent TypeScript package containing domain models, validation, registries, provider contracts, provider infrastructure, and aggregation engines. It uses `decimal.js` for market calculations and Zod for external-provider response validation.

External market-data requests are made on the server. Browser code talks only to the application's same-origin API. No wallet connection, signing flow, custody feature, transaction submission, or private-key handling exists.

## Request flow

1. Each API request first passes through a bounded process-local fixed-window limiter: 120 health, 30 search, or 20 market requests per minute per normalized client identity. A deployment edge limiter remains authoritative across instances.
2. A search request is validated to 1–100 printable characters. `AssetSearchService` combines curated registry matches with DexScreener search results and ranks exact identifiers, symbols, prefixes, and curated assets.
3. A report request validates the chain and chain-specific identifier before resolving the asset. EVM identifiers are normalized to lowercase; Solana mints preserve case.
4. The report service requests price observations and pools concurrently. Provider failures are isolated with `Promise.allSettled`, so one failing price or liquidity request does not discard successful results from the others.
5. The price engine filters and aggregates fresh observations. The liquidity engine aggregates pools, computes distributions and scores, and generates reserve-based buy/sell estimates for the requested sizes.
6. The API DTO serializes `Decimal` values as strings, exposes source links only for HTTPS DexScreener or DefiLlama hosts (including valid subdomains), and returns provenance, warnings, provider state, and a `partial` flag.

All API routes are dynamic. Their responses use private cache headers with a 10-second shared-cache window and a 20-second stale-while-revalidate window, plus `X-Robots-Tag: noindex`.

## Package boundaries

| Area                               | Responsibility                                                                                       |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `apps/web/src/app`                 | Pages, components, and HTTP route handlers.                                                          |
| `apps/web/src/lib/market.ts`       | Runtime composition: provider instances, report service, search service, and report cache.           |
| `packages/core/src/domain`         | Chain-neutral models, provider contracts, and identifier/search validation.                          |
| `packages/core/src/registry`       | Supported-chain metadata and curated asset identities.                                               |
| `packages/core/src/application`    | Search, price aggregation, liquidity aggregation, depth estimates, report composition, and warnings. |
| `packages/core/src/infrastructure` | Bounded in-memory cache, provider runtime, JSON validation, and provider adapters.                   |
| `prisma/schema.prisma`             | PostgreSQL data model for a persistence layer that is not yet used by runtime code.                  |

The domain model intentionally calls an on-chain identifier an `AssetIdentifier` rather than a contract address. An `Asset` is identified by its chain plus identifier; a ticker is presentation metadata, not identity.

## Supported-chain registry

The current registry contains eight IDs: `ethereum`, `arbitrum`, `optimism`, `base`, `polygon`, `bsc`, `avalanche`, and `solana`. Each record supplies a family, native asset symbol, explorer URL, DexScreener mapping, DefiLlama mapping, and a list of protocol names.

The protocol list is descriptive registry metadata. It does not instantiate a protocol-native adapter, query a protocol directly, or guarantee that a provider returns markets for that protocol. Live DEX coverage is the subset of pair data DexScreener returns for the chain and asset at request time.

The TypeScript domain currently supports the `evm` and `solana` chain families. The Prisma schema also reserves an `OTHER` family, but a new family needs a corresponding domain and validation implementation before it can enter the live request path.

## Caching and provider reliability

Caching is process-local and bounded. It coalesces concurrent loads for the same key and removes least-recently-used entries once full.

| Cache                           |        TTL |    Capacity |
| ------------------------------- | ---------: | ----------: |
| Web market report               | 12 seconds | 250 entries |
| DexScreener token-pair response | 15 seconds | 750 entries |
| DexScreener search response     | 60 seconds | 750 entries |
| DefiLlama price response        | 20 seconds | 500 entries |

Provider requests require HTTPS, use a configurable 1–30 second timeout (8 seconds by default), validate the response shape with Zod, track latency/availability, and are spaced by a provider-local minimum start interval (125 ms for DexScreener and 150 ms for DefiLlama). The current runtime does not use Redis, retries, exponential backoff, distributed rate limits, or circuit breaking. Multiple application instances therefore do not share cache contents or provider quotas.

## API surface

| Endpoint                                        | Purpose                                                                                               |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `GET /api/health`                               | Process liveness response; it does not probe providers, PostgreSQL, or Redis.                         |
| `GET /api/chains`                               | Registered chain metadata and descriptive protocol list.                                              |
| `GET /api/assets/search?q=&limit=`              | Curated-plus-DexScreener asset search; `limit` is 1–20.                                               |
| `GET /api/assets/:chain/:address`               | Complete asset market report.                                                                         |
| `GET /api/assets/:chain/:address/price`         | Asset identity and price aggregate.                                                                   |
| `GET /api/assets/:chain/:address/liquidity`     | Asset identity and liquidity aggregate.                                                               |
| `GET /api/assets/:chain/:address/pools`         | Asset identity and normalized pools.                                                                  |
| `GET /api/assets/:chain/:address/depth?amount=` | Buy and sell estimates for a positive USD amount up to 1,000,000,000 with up to eight decimal places. |

The full report uses default trade sizes of $100, $1,000, $10,000, and $100,000. Custom depth requests recompute only the requested size.

## Persistence boundary

`prisma/schema.prisma` models chains, assets, relationships, providers, protocols, pools, observations, snapshots, users, watchlists, and alerts. No Prisma client is created, no repository is called, and no request writes or reads those models today. Likewise, Docker Compose starts PostgreSQL and Redis for local infrastructure parity, but the running application uses neither service.

This separation is intentional: live values come from explicitly identified providers and remain ephemeral until a persistence workflow is implemented with snapshot cadence, retention, migrations, and data-quality controls.
