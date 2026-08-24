import { describe, expect, it } from "vitest";

import { getChain, isValidSearchQuery, normalizeIdentifier } from "@defi-market-intel/core";

function requiredChain(chainId: string) {
  const chain = getChain(chainId);
  if (!chain) {
    throw new Error(`${chainId} must be registered for validation tests.`);
  }
  return chain;
}

describe("normalizeIdentifier", () => {
  it("normalizes valid EVM addresses without leaking EVM rules into Solana", () => {
    const ethereum = requiredChain("ethereum");
    const solana = requiredChain("solana");
    const mixedCaseEvm = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
    const solanaMint = "So11111111111111111111111111111111111111112";

    expect(normalizeIdentifier(ethereum, `  ${mixedCaseEvm}  `)).toEqual({
      chainId: "ethereum",
      value: mixedCaseEvm.toLowerCase(),
      kind: "evm-address",
    });
    expect(normalizeIdentifier(solana, solanaMint)).toEqual({
      chainId: "solana",
      value: solanaMint,
      kind: "solana-mint",
    });
  });

  it("rejects malformed, wrong-family, and non-base58 identifiers", () => {
    const ethereum = requiredChain("ethereum");
    const solana = requiredChain("solana");

    expect(normalizeIdentifier(ethereum, "0x1234")).toBeNull();
    expect(normalizeIdentifier(ethereum, "0xG02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2")).toBeNull();
    expect(normalizeIdentifier(ethereum, "So11111111111111111111111111111111111111112")).toBeNull();
    expect(normalizeIdentifier(solana, "0OIl11111111111111111111111111111111111111")).toBeNull();
  });
});

describe("isValidSearchQuery", () => {
  it("allows bounded printable search input and rejects control characters", () => {
    expect(isValidSearchQuery("  WETH  ")).toBe(true);
    expect(isValidSearchQuery(" ")).toBe(false);
    expect(isValidSearchQuery("USDC\nETH")).toBe(false);
    expect(isValidSearchQuery("x".repeat(101))).toBe(false);
  });
});
