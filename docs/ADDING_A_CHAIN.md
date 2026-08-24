# Adding a chain

## Design boundary

Adding a chain starts with a registry record, not a global search-and-replace of EVM assumptions. The core model identifies assets with `AssetIdentifier { chainId, value, kind }`; `ChainId` is an opaque string. Existing validation supports only the `evm` and `solana` families, so an additional EVM chain follows the existing path while a new family requires explicit domain work.

A new registry entry only enables a chain for providers that can actually serve it. It does not create an RPC integration, direct DEX adapter, or full protocol coverage.

## Add an EVM or Solana chain

1. Choose a stable lower-case internal ID, such as `linea`. Do not use a display name as the identifier.
2. Confirm the provider's chain identifiers and supported token lookup behavior. Record the exact DexScreener and DefiLlama IDs separately; they need not be the same as the internal ID.
3. Add a `Chain` record to `packages/core/src/registry/chains.ts` with:
   - `id`, `name`, and `family`;
   - native asset symbol and canonical explorer base URL;
   - `dexScreenerChainId` and `defiLlamaChainId`; and
   - a descriptive `supportedProtocols` list.
4. Add curated assets to `packages/core/src/registry/assets.ts` only after independently verifying the chain-specific identifier, decimals, token standard, and intended canonical/bridged/wrapped classification.
5. Exercise search, identifier resolution, prices, pools, and depth through the API for a known asset on the new chain. Verify that returned pair data actually maps back to the registry record.
6. Add deterministic tests for identifier normalization and the provider mapping before depending on the new chain in production.

For EVM, the current validator accepts `0x` plus exactly 40 hexadecimal characters and lowercases the value. For Solana, it accepts base58-style mint strings between 32 and 44 characters and preserves case. These validators deliberately reject arbitrary free-form identifiers.

## Add a new chain family

The Prisma schema has `EVM`, `SOLANA`, and `OTHER`, but the live TypeScript `ChainFamily` union is only `"evm" | "solana"`. A new family must be implemented as a complete vertical boundary:

1. Extend the domain chain-family and asset-identifier-kind types.
2. Extend `normalizeIdentifier` with strict, native identifier validation and normalization rules.
3. Update provider adapters so comparison, query encoding, metadata conversion, and token identity do not assume EVM case behavior or Solana mint rules.
4. Ensure persistence enum/migration decisions match the new family when database storage is activated.
5. Add fixture-driven tests that include malformed, case-sensitive, and valid identifiers for the family.

Do not route a new family through an EVM-address code path merely to reuse a provider interface. The interface is intentionally chain-neutral; only the family-specific normalization belongs at the edge.

## Provider mapping requirements

DexScreener search maps a returned `chainId` via `getChainByDexScreenerId`. If this mapping is absent, its search results are ignored, even if DexScreener has markets on the chain. Its token-pair response is filtered using the registry's same mapping.

DefiLlama price lookup constructs `{defiLlamaChainId}:{assetIdentifier}`. Verify the provider's expected key for native, wrapped, and token assets before relying on it. A lookup may legitimately return no observation; that is not evidence that the asset lacks a market.

`supportedProtocols` is a UI/registry description. Add only protocols that actually operate on the chain, but do not treat this list as proof that the live adapter is fetching them. Current pool coverage remains whatever DexScreener returns.

## Curated-asset policy

Curated entries are privileged because they are ranked higher in search and marked `verified`. Each entry must use an authoritative identifier source, correct decimals, correct token standard, and an accurate relationship label. Similar symbol, similar logo, or provider search rank is insufficient.

Use separate asset records for native, wrapped, and bridged representations. A shared `canonicalAssetKey` is a grouping aid only. Do not merge balances, liquidity, price observations, or pools across chains solely because assets share a symbol or key.

## Deployment check

The current runtime obtains live data from DexScreener and DefiLlama only. It has no RPC adapter configuration and does not persist a new chain to PostgreSQL. Before describing a chain as live-supported, verify that a real search or direct report request returns fresh provider observations and that its identifier behavior matches the chain registry.
