# Deployment

## What is deployed

The deployable service is the Next.js application in `apps/web`, with the reusable domain and provider package in `packages/core`. Its live request path calls DexScreener and DefiLlama over HTTPS and keeps short-lived values in process memory.

PostgreSQL and Redis are included in `docker-compose.yml`, and Prisma defines a PostgreSQL schema, but the current application does not create a Prisma client, issue database queries, or use Redis. Starting those services is useful local infrastructure parity; it does not enable persistence, historical snapshots, shared caching, authentication, alerts, or background jobs.

## Requirements

- Node.js 22 or later
- pnpm 11 or later, managed through Corepack
- Docker with Docker Compose for the containerized path
- Network egress to DexScreener and DefiLlama

The CI workflow uses Node 22 and pnpm 11.19.0. The repository's package manager field is `pnpm@11.19.0`.

## Local Node.js run

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

The development server runs on port 3000 unless `PORT` is set. A production-style local run is:

```bash
pnpm build
pnpm start
```

Useful verification commands are:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
pnpm audit:production
```

`/api/health` confirms the web process can answer HTTP. It does not test live market-data availability or any database/cache connection.

## Configuration

Copy `.env.example` to `.env` for local development and keep the real file untracked. The following settings are read by the current web/runtime code:

| Variable                     | Use                              | Constraints / default                                                                                      |
| ---------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                   | Node/Next runtime mode           | Use `production` for deployed processes.                                                                   |
| `PORT`                       | Next.js listener port            | Docker exposes container port 3000.                                                                        |
| `NEXT_PUBLIC_APP_URL`        | Next metadata base URL           | Browser-visible; use the public HTTPS application URL in production.                                       |
| `DEXSCREENER_API_BASE_URL`   | DexScreener adapter endpoint     | Must be HTTPS on `dexscreener.com` or a dot-boundary subdomain; defaults to `https://api.dexscreener.com`. |
| `DEFILLAMA_API_BASE_URL`     | DefiLlama Coins adapter endpoint | Must be HTTPS on `llama.fi` or a dot-boundary subdomain; defaults to `https://coins.llama.fi`.             |
| `MARKET_PROVIDER_TIMEOUT_MS` | Provider request timeout         | Integer 1,000–30,000; defaults to 8,000.                                                                   |

The current web runtime does not consume `DATABASE_URL`; it is included for Prisma database commands once persistence is connected. Compose uses PostgreSQL/Redis variables to configure the supporting containers, but the running app does not connect to them. Do not add provider keys, RPC URLs, or other credentials until a reviewed adapter consumes them.

Endpoint override validation intentionally rejects arbitrary hosts to prevent a deployment environment variable from turning the app into an SSRF client. An invalid override falls back to the audited default endpoint.

## Docker Compose

For a local containerized stack:

```bash
docker compose up --build
```

This builds the Next standalone output, starts the app on `${PORT:-3000}`, and starts PostgreSQL 16 plus Redis 7. PostgreSQL and Redis ports bind to `127.0.0.1` by default. Compose's default database password is explicitly for local use; supply a strong deployment-specific secret outside the repository whenever those services store real data.

To stop the stack while retaining named volumes:

```bash
docker compose down
```

The Docker image uses a Node 22 builder, enables Corepack, performs a frozen-lockfile install, builds the web app, and runs the standalone server as the non-root `nextjs` user. It exposes port 3000.

## Production rollout

1. Run the verification commands in a clean environment and build the immutable image from the committed lockfile.
2. Supply `NODE_ENV=production`, the public HTTPS `NEXT_PUBLIC_APP_URL`, and only approved provider endpoint/timeout overrides through the hosting platform's secret or environment store.
3. Put the container behind a TLS-terminating proxy with a public HTTPS hostname, request-size limits, and rate limiting.
4. Keep the database, Redis, and any future worker network-private. Do not publish their ports to the internet.
5. Restrict outbound egress to required provider hosts when the platform supports it, and monitor provider errors and latency.
6. Perform a smoke request to `/api/health`, then a known curated asset page/API request and verify provenance, freshness, and partial-provider behavior.

The app's API responses are marked private with a short shared-cache window. If a CDN is used, preserve these cache semantics and do not cache personalized or future authenticated data as public content.

## Scaling and availability

The current cache and API request limiter are local to a Node process. Scaling to multiple instances increases cold provider calls and does not share request coalescing, provider status, cached reports, or inbound request buckets. A production scale-out should introduce a reviewed shared cache and coordinated provider quota/rate-limit layer before relying on horizontal capacity.

The report service is deliberately resilient to individual price or liquidity failures and can return `partial: true` with successful data from the remaining provider path. It does not retry failed providers or open a circuit breaker, so deployment monitoring and edge controls remain necessary.

## Database activation boundary

Do not run a schema migration solely because PostgreSQL is present in Compose. Persistence needs a Prisma client, repository layer, migration ownership, snapshot cadence, retention policy, and data-quality review before application code should write market observations. See [Data model](DATA_MODEL.md) for the schema boundary.
