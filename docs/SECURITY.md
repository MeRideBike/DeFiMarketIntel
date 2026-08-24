# Security architecture and public-repository guidance

## Security posture

DeFi Market Intel is read-only market-intelligence software. It does not request seed phrases, handle private keys, sign transactions, custody assets, or submit trades. Its security boundary is still important because the application processes untrusted user input and untrusted blockchain/provider metadata, and its output may influence financial decisions.

For vulnerability disclosure policy and the private reporting channel, see the repository-level [Security Policy](../SECURITY.md). The repository is maintained exclusively by its owner; public issues are appropriate for reproducible bugs and documentation feedback, while code contributions are governed by [CONTRIBUTING.md](../CONTRIBUTING.md).

## Current controls

| Boundary             | Control in the current implementation                                                                                                                                                                      |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Search input         | Queries must be 1–100 printable characters with no control characters. Search limits are bounded.                                                                                                          |
| Asset identifiers    | EVM input must match a 40-hex-character `0x` address and is lowercased; Solana input must match the supported base58 mint pattern and preserves case.                                                      |
| Depth input          | Positive USD amount no greater than 1,000,000,000 and no more than eight decimal places.                                                                                                                   |
| API request volume   | A bounded process-local fixed-window limiter permits 120 health, 30 search, or 20 market requests per minute per normalized client identity; rejections return `429`, `Retry-After`, and no-store headers. |
| Provider transport   | Outbound provider requests require HTTPS and use an abortable timeout.                                                                                                                                     |
| Provider endpoints   | Web configuration accepts only HTTPS DexScreener and `llama.fi` hosts or dot-boundary subdomains; malformed values fall back to audited defaults.                                                          |
| Provider payloads    | Zod validates expected response shape before adapter code uses it.                                                                                                                                         |
| Metadata             | DexScreener-derived names/symbols have control characters stripped and bounded lengths; unrecognized metadata remains unknown/unverified.                                                                  |
| External links       | API DTOs pass source URLs only when HTTPS and hosted by the exact trusted domain or a dot-boundary subdomain of DexScreener or DefiLlama.                                                                  |
| Browser headers      | Next.js sends `nosniff`, `DENY` framing, strict-origin referrer policy, and restrictive camera/microphone/geolocation permissions.                                                                         |
| Financial arithmetic | Core calculations use `Decimal`, and API values are serialized as strings.                                                                                                                                 |
| Dependencies         | CI runs a production dependency audit; Dependabot is configured for npm and GitHub Actions updates.                                                                                                        |

React renders token name and symbol text as escaped content. That reduces XSS risk but does not make provider metadata trustworthy; verification state, asset identifier, source, and chain must remain visible to users.

## Provider and data integrity risks

Provider data can be stale, manipulated, incomplete, or inconsistent. The application addresses this by retaining provenance, quote-asset quality, observation time, methodology, exclusions, warnings, and provider status. It also marks reserve-derived depth and concentrated-liquidity results as estimates.

Those controls do not prove that a token is legitimate, that an asset is canonical, that liquidity is withdrawable, or that a calculated trade could execute. Operators should not suppress market-quality warnings, infer safety from a common symbol, or promote a price as guaranteed execution.

The current runtime has no direct RPC verification, retry/circuit-breaker layer, persistent audit log, distributed provider quota enforcement, or server-side user authentication. Use deployment controls to absorb abuse and monitor provider failure modes.

## Public repository rules

- Keep `.env`, production Compose overrides, cloud credentials, RPC URLs with embedded credentials, database dumps, access tokens, and private incident details out of Git.
- Treat every `NEXT_PUBLIC_*` value as browser-visible. Never place provider keys, database credentials, or privileged RPC URLs there.
- Use GitHub secret scanning, push protection, two-factor authentication, and a least-privilege deploy token or workload identity for the repository and deployment environment.
- Protect the default branch with required CI checks and restrict force pushes. The checked-in `CODEOWNERS` file assigns repository ownership to `@MeRideBike`; branch settings must be enabled in GitHub separately.
- Keep public issues free of live secrets, private customer data, exploit payloads, or unredacted proprietary provider responses.
- Pin and review CI actions, inspect dependency updates, and keep lockfile changes attributable to their intended upgrade.

If a secret reaches a public commit, revoke or rotate it immediately, invalidate affected deployment credentials, assess access logs, and remove the secret from current configuration. Rewriting history alone does not revoke exposed credentials.

## Production deployment requirements

Place the app behind TLS termination and an edge or reverse proxy that enforces request-size limits, abuse detection, and rate limiting. The TypeScript runtime includes a bounded process-local fixed-window limiter as a safety layer, but it is not distributed and each application instance keeps independent buckets. Configure the edge as the authoritative limiter and make it overwrite, rather than forward untrusted, client-IP headers before requests reach the app.

Run the container as its non-root `nextjs` user, keep PostgreSQL and Redis private to the deployment network, and use encrypted secrets supplied by the deployment platform. Docker Compose binds its database and Redis ports to `127.0.0.1` for local use; production topology still needs a network policy appropriate to the hosting environment.

Allow only audited provider endpoint overrides. The live adapters read `DEXSCREENER_API_BASE_URL`, `DEFILLAMA_API_BASE_URL`, and `MARKET_PROVIDER_TIMEOUT_MS`; invalid endpoint hosts fall back to the defaults instead of becoming arbitrary server-side fetch targets. The current example configuration intentionally omits provider keys and RPC URLs because no active adapter uses them.

## Operational response

Monitor API error rates, provider availability/latency in report responses, dependency alerts, and proxy rate-limit events. `/api/health` is a process-liveness endpoint only; it does not prove that external providers, PostgreSQL, or Redis are healthy.

For a suspected application vulnerability, preserve relevant non-secret logs, stop exposure if user safety is at risk, rotate affected credentials, and use the private disclosure process. Do not publish exploit steps or customer-sensitive evidence while remediation is in progress.
