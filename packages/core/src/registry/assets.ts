import type { Asset, Chain } from "../domain/models";
import { getChain } from "./chains";

interface KnownAssetDefinition {
  readonly chainId: string;
  readonly address: string;
  readonly name: string;
  readonly symbol: string;
  readonly decimals: number;
  readonly tokenStandard: string;
  readonly canonicalAssetKey: string;
  readonly relationship: "native" | "wrapped" | "bridged" | "canonical";
}

const knownAssetDefinitions: readonly KnownAssetDefinition[] = [
  {
    chainId: "ethereum",
    address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    name: "Wrapped Ether",
    symbol: "WETH",
    decimals: 18,
    tokenStandard: "ERC-20",
    canonicalAssetKey: "ethereum",
    relationship: "wrapped",
  },
  {
    chainId: "ethereum",
    address: "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    name: "USD Coin",
    symbol: "USDC",
    decimals: 6,
    tokenStandard: "ERC-20",
    canonicalAssetKey: "usdc",
    relationship: "canonical",
  },
  {
    chainId: "ethereum",
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    name: "Tether USD",
    symbol: "USDT",
    decimals: 6,
    tokenStandard: "ERC-20",
    canonicalAssetKey: "usdt",
    relationship: "canonical",
  },
  {
    chainId: "ethereum",
    address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    name: "Dai Stablecoin",
    symbol: "DAI",
    decimals: 18,
    tokenStandard: "ERC-20",
    canonicalAssetKey: "dai",
    relationship: "canonical",
  },
  {
    chainId: "arbitrum",
    address: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
    name: "Wrapped Ether",
    symbol: "WETH",
    decimals: 18,
    tokenStandard: "ERC-20",
    canonicalAssetKey: "ethereum",
    relationship: "wrapped",
  },
  {
    chainId: "arbitrum",
    address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    name: "USD Coin",
    symbol: "USDC",
    decimals: 6,
    tokenStandard: "ERC-20",
    canonicalAssetKey: "usdc",
    relationship: "canonical",
  },
  {
    chainId: "base",
    address: "0x4200000000000000000000000000000000000006",
    name: "Wrapped Ether",
    symbol: "WETH",
    decimals: 18,
    tokenStandard: "ERC-20",
    canonicalAssetKey: "ethereum",
    relationship: "wrapped",
  },
  {
    chainId: "base",
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    name: "USD Coin",
    symbol: "USDC",
    decimals: 6,
    tokenStandard: "ERC-20",
    canonicalAssetKey: "usdc",
    relationship: "canonical",
  },
  {
    chainId: "polygon",
    address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
    name: "Wrapped Ether",
    symbol: "WETH",
    decimals: 18,
    tokenStandard: "ERC-20",
    canonicalAssetKey: "ethereum",
    relationship: "wrapped",
  },
  {
    chainId: "polygon",
    address: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359",
    name: "USD Coin",
    symbol: "USDC",
    decimals: 6,
    tokenStandard: "ERC-20",
    canonicalAssetKey: "usdc",
    relationship: "canonical",
  },
  {
    chainId: "bsc",
    address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    name: "Wrapped BNB",
    symbol: "WBNB",
    decimals: 18,
    tokenStandard: "BEP-20",
    canonicalAssetKey: "bnb",
    relationship: "wrapped",
  },
  {
    chainId: "bsc",
    address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    name: "USD Coin",
    symbol: "USDC",
    decimals: 18,
    tokenStandard: "BEP-20",
    canonicalAssetKey: "usdc",
    relationship: "bridged",
  },
  {
    chainId: "avalanche",
    address: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
    name: "Wrapped AVAX",
    symbol: "WAVAX",
    decimals: 18,
    tokenStandard: "ERC-20",
    canonicalAssetKey: "avalanche",
    relationship: "wrapped",
  },
  {
    chainId: "avalanche",
    address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
    name: "USD Coin",
    symbol: "USDC",
    decimals: 6,
    tokenStandard: "ERC-20",
    canonicalAssetKey: "usdc",
    relationship: "canonical",
  },
  {
    chainId: "solana",
    address: "So11111111111111111111111111111111111111112",
    name: "Wrapped SOL",
    symbol: "SOL",
    decimals: 9,
    tokenStandard: "SPL",
    canonicalAssetKey: "solana",
    relationship: "wrapped",
  },
  {
    chainId: "solana",
    address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    name: "USD Coin",
    symbol: "USDC",
    decimals: 6,
    tokenStandard: "SPL",
    canonicalAssetKey: "usdc",
    relationship: "canonical",
  },
];

function toAsset(definition: KnownAssetDefinition, chain: Chain): Asset {
  const identifierKind = chain.family === "evm" ? "evm-address" : "solana-mint";
  const normalizedAddress =
    chain.family === "evm" ? definition.address.toLowerCase() : definition.address;

  return {
    id: `${chain.id}:${normalizedAddress}`,
    chain,
    identifier: {
      chainId: chain.id,
      value: normalizedAddress,
      kind: identifierKind,
    },
    name: definition.name,
    symbol: definition.symbol,
    decimals: definition.decimals,
    tokenStandard: definition.tokenStandard,
    verification: "verified",
    logoUrl: null,
    canonicalAssetKey: definition.canonicalAssetKey,
    relationships: [],
    source: "Curated canonical-asset registry",
  };
}

export function listKnownAssets(): readonly Asset[] {
  return knownAssetDefinitions.flatMap((definition) => {
    const chain = getChain(definition.chainId);
    return chain ? [toAsset(definition, chain)] : [];
  });
}

export function getKnownAsset(chainId: string, address: string): Asset | null {
  const chain = getChain(chainId);
  if (!chain) {
    return null;
  }

  const comparableAddress = chain.family === "evm" ? address.toLowerCase() : address;
  const definition = knownAssetDefinitions.find(
    (candidate) =>
      candidate.chainId === chain.id &&
      (chain.family === "evm"
        ? candidate.address.toLowerCase() === comparableAddress
        : candidate.address === comparableAddress),
  );

  return definition ? toAsset(definition, chain) : null;
}
