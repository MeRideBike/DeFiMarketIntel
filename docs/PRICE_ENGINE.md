# Price engine

## Purpose

The price engine produces an explainable **reference USD price** from fresh provider observations. It does not produce a transaction quote, price guarantee, routing recommendation, or financial advice.

Current live inputs are:

| Provider        | Observation behavior                                                                                                                               |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| DexScreener     | One USD observation for each returned pair where the requested asset is the pair's base token. Reported pair liquidity is attached when available. |
| DefiLlama Coins | One independent USD reference observation when the provider returns a matching coin key. It has no pool or liquidity value.                        |

DexScreener recognizes quote assets as `trusted` by ticker only for `USDC`, `USDT`, `DAI`, `WETH`, `WBTC`, and `SOL`; all other quote tickers are `unknown`. The engine also supports `derived` and `untrusted` qualities for future adapters, but no current adapter emits `derived` or `untrusted`.

## Acceptance and exclusion

For a calculation time `now`, an observation is initially accepted only when:

- `priceUsd` is finite and greater than zero; and
- it is no more than 10 minutes old.

The engine calculates the median of those valid prices, then excludes each valid observation whose absolute deviation from that initial median is **greater than 20%**. Invalid, stale, and outlier observations remain in `excludedObservations` for transparency; they do not contribute to the reference price or confidence.

There is no cross-provider entity resolution at this layer. Several DexScreener pair observations can be accepted, while the reported `sourceCount` still counts the distinct provider name only.

## Reference-price calculation

The accepted observation weight is:

```text
sqrt(max(liquidityUsd, 1)) × freshnessWeight × quoteQualityWeight
```

When liquidity is absent, the liquidity term is 1. The freshness weight decays linearly from 1.0 at observation time to 0.25 at 10 minutes. Quote-quality weights are:

| Quality     | Weight |
| ----------- | -----: |
| `trusted`   |   1.00 |
| `derived`   |   0.80 |
| `unknown`   |   0.55 |
| `untrusted` |   0.20 |

The engine reports the ordinary median, low, high, and a liquidity/freshness/quality-weighted price. The **reference price** is the weighted price when total weight is positive; otherwise it falls back to the accepted median. Decimal arithmetic is used throughout.

## Confidence score

Confidence is an operational quality signal from 0–100, not a probability. It is calculated from the accepted set and clamped to that range:

```text
min(distinct provider count × 18, 36)
+ min(log10(sum(liquidityUsd) + 1) × 2.5, 20)
+ max(0, 22 − observed price spread percent)
+ (trusted observation fraction × 12)
+ (mean freshness weight × 10)
```

The score is rounded to an integer and labeled as follows:

|  Score | Label      |
| -----: | ---------- |
| 85–100 | Very High  |
|  70–84 | High       |
|  50–69 | Moderate   |
|  30–49 | Low        |
|  10–29 | Very Low   |
|    0–9 | Unreliable |

This model rewards independent providers, observable liquidity, narrow price dispersion, trusted quote assets, and freshness. It does not verify a pool on-chain, assess token-transfer behavior, prove a bridge relationship, or establish that a provider's reported liquidity is spendable.

## Provenance

Every core observation carries provider, source label, source URL, observation time, optional block number/timestamp, methodology, protocol, pool ID, quote quality, and derivation steps. The API exposes source, URL, time, price, liquidity, protocol, quote quality, derivation, and methodology. Block fields stay available in the core model but are currently `null` for both live providers and are not emitted in the web DTO.

The report marks itself `partial` when a price or liquidity provider call fails, or a provider runtime status is unavailable. A report can still contain a reference price during partial provider availability; consumers should use the displayed source count, freshness, exclusions, and provider status when evaluating it.

## Observable limitations

- Provider USD values can be delayed, incomplete, or wrong. The engine does not perform direct RPC verification.
- Quote-asset quality is currently ticker-based for DexScreener data, not a chain-specific trusted-asset registry lookup.
- DefiLlama prices have no attached pool liquidity, so they affect agreement and freshness without gaining a liquidity weight above the minimum.
- A price observation for an asset that appears as a DexScreener pair's quote token is not emitted by the current DexScreener price adapter, although the pool adapter still includes that pool.
- There are no retries, circuit breakers, persistent observation storage, or historical price charts in the live runtime.

For executable-price methodology and its limits, see [Liquidity engine](LIQUIDITY_ENGINE.md).
