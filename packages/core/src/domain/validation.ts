import type { AssetIdentifier, Chain } from "./models";

const evmAddressPattern = /^0x[a-fA-F0-9]{40}$/;
const solanaMintPattern = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function normalizeIdentifier(chain: Chain, rawValue: string): AssetIdentifier | null {
  const value = rawValue.trim();

  if (chain.family === "evm" && evmAddressPattern.test(value)) {
    return { chainId: chain.id, value: value.toLowerCase(), kind: "evm-address" };
  }

  if (chain.family === "solana" && solanaMintPattern.test(value)) {
    return { chainId: chain.id, value, kind: "solana-mint" };
  }

  return null;
}

export function isValidSearchQuery(value: string): boolean {
  if (/[\u0000-\u001F\u007F]/.test(value)) {
    return false;
  }
  const normalized = value.trim();
  return normalized.length >= 1 && normalized.length <= 100;
}
