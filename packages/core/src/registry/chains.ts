import type { Chain, ChainId } from "../domain/models";

const chains: readonly Chain[] = [
  {
    id: "ethereum",
    name: "Ethereum",
    family: "evm",
    nativeAssetSymbol: "ETH",
    explorerUrl: "https://etherscan.io",
    dexScreenerChainId: "ethereum",
    defiLlamaChainId: "ethereum",
    supportedProtocols: ["Uniswap", "Curve", "Balancer", "Sushi"],
  },
  {
    id: "arbitrum",
    name: "Arbitrum",
    family: "evm",
    nativeAssetSymbol: "ETH",
    explorerUrl: "https://arbiscan.io",
    dexScreenerChainId: "arbitrum",
    defiLlamaChainId: "arbitrum",
    supportedProtocols: ["Uniswap", "Camelot", "Curve", "Sushi"],
  },
  {
    id: "optimism",
    name: "Optimism",
    family: "evm",
    nativeAssetSymbol: "ETH",
    explorerUrl: "https://optimistic.etherscan.io",
    dexScreenerChainId: "optimism",
    defiLlamaChainId: "optimism",
    supportedProtocols: ["Velodrome", "Uniswap", "Curve"],
  },
  {
    id: "base",
    name: "Base",
    family: "evm",
    nativeAssetSymbol: "ETH",
    explorerUrl: "https://basescan.org",
    dexScreenerChainId: "base",
    defiLlamaChainId: "base",
    supportedProtocols: ["Aerodrome", "Uniswap", "Sushi"],
  },
  {
    id: "polygon",
    name: "Polygon",
    family: "evm",
    nativeAssetSymbol: "POL",
    explorerUrl: "https://polygonscan.com",
    dexScreenerChainId: "polygon",
    defiLlamaChainId: "polygon",
    supportedProtocols: ["Uniswap", "QuickSwap", "Curve", "Balancer"],
  },
  {
    id: "bsc",
    name: "BNB Chain",
    family: "evm",
    nativeAssetSymbol: "BNB",
    explorerUrl: "https://bscscan.com",
    dexScreenerChainId: "bsc",
    defiLlamaChainId: "bsc",
    supportedProtocols: ["PancakeSwap", "Uniswap", "Thena"],
  },
  {
    id: "avalanche",
    name: "Avalanche",
    family: "evm",
    nativeAssetSymbol: "AVAX",
    explorerUrl: "https://snowtrace.io",
    dexScreenerChainId: "avalanche",
    defiLlamaChainId: "avax",
    supportedProtocols: ["Trader Joe", "Uniswap", "Curve", "Pangolin"],
  },
  {
    id: "solana",
    name: "Solana",
    family: "solana",
    nativeAssetSymbol: "SOL",
    explorerUrl: "https://solscan.io",
    dexScreenerChainId: "solana",
    defiLlamaChainId: "solana",
    supportedProtocols: ["Raydium", "Orca", "Meteora", "Jupiter"],
  },
];

const chainById = new Map(chains.map((chain) => [chain.id, chain]));
const chainByDexScreenerId = new Map(chains.map((chain) => [chain.dexScreenerChainId, chain]));

export function listChains(): readonly Chain[] {
  return chains;
}

export function getChain(chainId: ChainId): Chain | null {
  return chainById.get(chainId.toLowerCase()) ?? null;
}

export function getChainByDexScreenerId(chainId: string): Chain | null {
  return chainByDexScreenerId.get(chainId.toLowerCase()) ?? null;
}
