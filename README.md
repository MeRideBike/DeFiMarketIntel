# DeFi Market Intel

Cross-chain, read-only DeFi market intelligence for answering a question a ticker alone cannot: **is the displayed price supported by liquidity you could plausibly use?**

The web app resolves an asset by its chain plus contract or mint, gathers independent live market observations, exposes source provenance, discovers supported DEX pools, and estimates single-venue buy or sell impact for common and custom USD sizes.

> Market data is informational and may be delayed, incomplete, or inaccurate. Estimated depth is not a firm quote, a guarantee of liquidity, financial advice, or an invitation to transact.

## What runs today

- Chain-neutral asset identity for Ethereum, Arbitrum, Optimism, Base, Polygon, BNB Chain, Avalanche, and Solana.
- Symbol, name, contract-address, and Solana-mint discovery, with a curated registry for well-known assets and clear unverified-market-data status for discovered assets.
- Live DEX pair discovery, pool observations, and price observations through the replaceable DexScreener adapter.
- Independent USD reference observations through the replaceable DefiLlama adapter.
- Decimal-based reference-price aggregation with liquidity, freshness, quote-asset-quality weighting and outlier exclusion.
- Explicit price confidence, source count, observation range, liquidity score, concentration metrics, objective warnings, and provider-degradation state.
- Conservative reserve-based single-pool buy/sell estimates. Concentrated-liquidity TVL remains observed only; active liquidity and depth stay unavailable without protocol-native tick and quote data.
- Bounded, in-process API rate limits for search, report, and health endpoints, backed by a required deployment edge limit for multi-instance protection.
- Responsive, accessible dark-first UI, internal JSON API, health endpoint, Docker setup, PostgreSQL/Redis development services, GitHub Actions, and deterministic unit/E2E coverage.

The repository also contains a production-oriented Prisma schema for asset relationships, observations, snapshots, watchlists, and alerts. The live query path is intentionally stateless until persistent snapshot collection and protocol-native quote adapters are enabled; it therefore never implies that historical coverage or exact route execution exists when it does not.

## Architecture

```text
apps/web                 Next.js App Router UI + server-only JSON API
packages/core/domain     Chain-neutral contracts, types, validation
packages/core/application Price aggregation, liquidity/depth, report orchestration
packages/core/infrastructure Replaceable providers, timeout/rate/cache runtime
packages/core/registry   Chain and curated canonical-asset registry
prisma                   PostgreSQL model for durable history and product state
```

The application boundary is intentionally separate from provider adapters. Browser code never receives provider credentials, invokes RPC, or performs price aggregation.

## Quick start

Prerequisites: Node.js 22+ and pnpm 11+.

```bash
corepack enable
pnpm install
Copy-Item .env.example .env
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). No API key is required for the bundled public-market-data adapters. `.env` is ignored by Git; do not place credentials in a `NEXT_PUBLIC_*` variable.

For a containerized development stack:

```bash
docker compose up --build
```

This starts the web app with PostgreSQL and Redis available for the schema-backed persistence/cache integrations. The live report flow remains usable without either service.

## Quality checks

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
pnpm db:validate
pnpm audit:production
```

CI executes the same checks on pushes to `main` and pull requests. Its pnpm allowlist is explicit and limited to reviewed native build dependencies.

## Internal API

| Endpoint                                             | Purpose                                                              |
| ---------------------------------------------------- | -------------------------------------------------------------------- |
| `GET /api/chains`                                    | Supported chains and protocol registry                               |
| `GET /api/assets/search?q=WETH`                      | Ranked identity-aware asset search                                   |
| `GET /api/assets/:chain/:address`                    | Complete price, liquidity, pool, depth, warning, and provider report |
| `GET /api/assets/:chain/:address/price`              | Price aggregate and provenance                                       |
| `GET /api/assets/:chain/:address/liquidity`          | Liquidity aggregate and concentration                                |
| `GET /api/assets/:chain/:address/pools`              | Normalized observed pools                                            |
| `GET /api/assets/:chain/:address/depth?amount=10000` | Custom USD buy/sell estimate                                         |
| `GET /api/health`                                    | Liveness response                                                    |

All route inputs are bounded and identifiers are validated according to the selected chain family. API responses serialize decimal values as strings so no JavaScript floating-point value silently represents a monetary amount.

## Price and liquidity methodology

- A reference price is a weighted aggregation of accepted fresh observations—not a simple average.
- Weighting uses observed liquidity, freshness, and quote-asset quality. Observations deviating materially from their median are excluded and counted.
- `Total observed liquidity` is the sum of supported provider-reported pool TVL. `Usable liquidity` is a conservative estimate used for market-quality scoring, not an assertion of transaction capacity.
- Depth uses reported pool reserves and a constant-product approximation, including an explicit fallback fee where the pool fee is unavailable. It evaluates buys and sells independently and returns the best observed single pool; it does not submit or simulate a multi-hop transaction.
- Concentrated-liquidity pools remain marked `estimated`: total TVL is not treated as all active at the current tick.

See [Price Engine](docs/PRICE_ENGINE.md) and [Liquidity Engine](docs/LIQUIDITY_ENGINE.md) for assumptions and extension points.

## Security and custody boundary

This product is read-only. It does not request seed phrases, hold private keys, custody assets, submit transactions, or require a wallet to inspect a market. External provider responses are validated at the boundary; token metadata is treated as untrusted; provider URLs are server-owned HTTPS endpoints; and rendered external source links are allowlisted.

See [Security](SECURITY.md) and [the technical security model](docs/SECURITY.md).

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Data model](docs/DATA_MODEL.md)
- [Price engine](docs/PRICE_ENGINE.md)
- [Liquidity engine](docs/LIQUIDITY_ENGINE.md)
- [Providers](docs/PROVIDERS.md)
- [Add a chain](docs/ADDING_A_CHAIN.md)
- [Add a DEX](docs/ADDING_A_DEX.md)
- [Deployment](docs/DEPLOYMENT.md)

## Public repository policy

This repository is publicly visible but maintained solely by its owner. [CONTRIBUTING.md](CONTRIBUTING.md) explains the collaboration boundary, and `.github/CODEOWNERS` records ownership. GitHub branch rules, collaborator settings, and repository visibility must be configured in the GitHub UI; local Git configuration cannot enforce those account-level controls.

No license is included intentionally. Public visibility alone does not grant reuse rights.
