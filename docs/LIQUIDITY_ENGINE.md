# Liquidity engine

## What “liquidity” means here

Liquidity is reported only for pools observable through the active provider path. It is not a measure of all liquidity across a chain, protocol, bridge, centralized venue, or potential route.

| Term                         | Current meaning                                                                                                                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Total observed liquidity** | Sum of positive, finite `totalLiquidityUsd` values from eligible normalized pools. For the live adapter, this is DexScreener-reported pair TVL.                                          |
| **Usable liquidity**         | Sum of each eligible pool's `executableLiquidityUsd`. It is an estimate, not an on-chain simulation result.                                                                              |
| **Active liquidity**         | For non-concentrated pairs, the adapter reports total TVL; for identified concentrated pairs, it reports `null` because tick-level active liquidity is unavailable.                      |
| **Executable liquidity**     | Full reported TVL for non-concentrated pairs, labeled as estimated. For a pair heuristically identified as concentrated, `null` until protocol-native tick and quote data are available. |
| **Liquidity precision**      | `estimated` for every live DexScreener pool. `exact` is reserved for an adapter with protocol-native quote/depth evidence; `unavailable` means no estimate is possible.                  |

The provider returns only public, externally observed data. A pool's `totalLiquidityUsd` can be unavailable even when a price or pair is returned.

## Pool normalization

`LiquidityPool` retains both source values and the quality boundary around them:

- chain, protocol/dex ID, pool address, pair label, provider source, URL, and time;
- base and quote asset identity data;
- fee when a provider supplies it, otherwise `null`;
- reported total TVL, active liquidity, executable liquidity, reserves, and 24-hour volume;
- a price only where the requested asset is the pair base token;
- a calculation methodology and precision label; and
- a price deviation filled in after the reference price is calculated.

DexScreener pair data is the only live pool source. Its `dexId` becomes the protocol field. The registry's protocol list is not a second pool source and does not prove venue coverage.

For a requested base asset, the adapter uses the reported base reserve as `assetReserve`. It estimates the opposite-side USD reserve as reported TVL minus `baseReserve × priceUsd` when that is positive, or one half of TVL otherwise. For a requested quote asset, it uses the reported quote reserve as `assetReserve` and estimates the base-side USD reserve as `baseReserve × priceUsd`, falling back to one half of TVL. These inferred reserves are a modeling convenience and should not be interpreted as verified on-chain balances.

## Aggregation and concentration

Only pools with finite positive total TVL are eligible. The engine sums their observed TVL and executable estimates, then groups observed TVL by:

- protocol;
- venue key (`protocol · pairLabel`); and
- chain.

Shares always use total observed TVL as their denominator. The report also exposes the largest-pool share and the combined share of the three largest pools. A largest-pool share above 70% creates a **Single-pool dependency** warning.

The liquidity score is bounded from 0 to 100:

```text
min(log10(totalObservedLiquidityUsd + 1) × 8, 50)
+ min(eligible pool count × 4, 20)
+ executableLiquidityUsd / totalObservedLiquidityUsd × 15
− max(0, (largest pool share percent − 35) / 2)
```

Scores are rounded and labeled `Deep` (80+), `Healthy` (60–79), `Limited` (30–59), `Thin` (1–29), or `Unavailable` (0). This is a comparative market-quality indicator, not a solvency or execution guarantee.

## Trade-size estimates

The full report estimates each side for $100, $1,000, $10,000, and $100,000. The depth endpoint accepts one custom positive USD amount up to $1 billion, with at most eight decimal places.

For every pool with positive target-asset and opposite-side reserves, the engine makes a **single-pool constant-product** estimate. With `x` as target-asset reserve, `y` as opposite-side USD reserve, and `a` as the input after fees:

```text
buy output = x × a / (y + a)
effective buy price = input USD / buy output
```

For a sell, the engine converts the USD input to target units using the reference price, applies the fee, and estimates USD output with the corresponding constant-product curve. If the provider did not report a fee, it assumes 30 bps and says so in the estimate rationale. Candidates are ordered by lowest calculated impact; the first candidate is returned as the best observed venue.

Price impact is measured against the reference price:

- buy: `(effectivePrice / referencePrice − 1) × 100`;
- sell: `(1 − effectivePrice / referencePrice) × 100`.

The returned route contains exactly one pair label. The engine does not optimize split routes, multihop routes, gas, token taxes, transfer fees, MEV, quote-asset slippage, or transaction ordering.

## Concentrated-liquidity boundary

The live adapter identifies potentially concentrated pools with a case-insensitive heuristic over DexScreener's DEX ID and labels: `v3`, `v4`, `clmm`, `dlmm`, or `concentrated`. For these pairs it retains reported TVL only as observed liquidity and deliberately leaves active liquidity, executable liquidity, and reserve inputs unavailable.

The trade estimator refuses to use a constant-product calculation for a heuristically concentrated pool. It does not read ticks, `sqrtPrice`, liquidity ranges, or protocol swap math. A `CONCENTRATED_LIQUIDITY_UNAVAILABLE` informational warning makes this boundary explicit. Protocol-native quote support is required before a depth estimate can be returned for these pools.

## Warnings produced by the report service

| Condition                                      | Warning                                  |
| ---------------------------------------------- | ---------------------------------------- |
| Non-curated verification status                | Unverified token metadata                |
| No accepted price observation                  | Insufficient market data                 |
| Confidence below 50 with a price               | Low price confidence                     |
| Liquidity score below 30                       | Low observed liquidity                   |
| Largest pool share above 70%                   | Single-pool dependency                   |
| A $10,000 estimate exceeds 3% impact           | High $10,000 price impact                |
| A pool differs by more than 10% from reference | Price dislocation                        |
| Any pool is identified as concentrated         | Concentrated-liquidity depth unavailable |

Price dislocation is an observed deviation, not an arbitrage claim. A large deviation can reflect thin liquidity, stale provider data, a different asset representation, a restricted token, or inaccurate source data.

## Accuracy boundary

The engine uses `Decimal` for all core calculations, but its inputs are provider-reported TVL, price, and reserves. It has no direct chain RPC path, exact protocol quoting, pool-state block number, or deterministic route simulation. Use the source time, methodology, precision, provider status, and warnings alongside every displayed estimate.
