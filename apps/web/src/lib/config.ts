function readHttpsEndpoint(
  name: string,
  fallback: string,
  allowedHosts: readonly string[],
): string {
  const rawValue = process.env[name] ?? fallback;
  try {
    const url = new URL(rawValue);
    const matchesHost = allowedHosts.some(
      (domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`),
    );
    if (url.protocol === "https:" && matchesHost) {
      return url.toString().replace(/\/$/, "");
    }
  } catch {
    // Falling back to the audited default keeps a malformed deployment variable from becoming SSRF.
  }
  return fallback;
}

function readTimeoutMs(): number {
  const value = Number(process.env.MARKET_PROVIDER_TIMEOUT_MS ?? "8000");
  return Number.isInteger(value) && value >= 1_000 && value <= 30_000 ? value : 8_000;
}

export const marketConfig = {
  dexScreenerApiBase: readHttpsEndpoint("DEXSCREENER_API_BASE_URL", "https://api.dexscreener.com", [
    "dexscreener.com",
  ]),
  defiLlamaApiBase: readHttpsEndpoint("DEFILLAMA_API_BASE_URL", "https://coins.llama.fi", [
    "llama.fi",
  ]),
  providerTimeoutMs: readTimeoutMs(),
};
