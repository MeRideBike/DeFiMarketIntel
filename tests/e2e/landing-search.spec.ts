import { expect, test } from "@playwright/test";

const wethResult = {
  id: "ethereum:0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
  name: "Wrapped Ether",
  symbol: "WETH",
  chain: {
    id: "ethereum",
    name: "Ethereum",
    family: "evm",
    explorerUrl: "https://etherscan.io",
  },
  identifier: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
  identifierKind: "evm-address",
  decimals: 18,
  tokenStandard: "ERC-20",
  verification: "verified",
  canonicalAssetKey: "ethereum",
  source: "Curated canonical-asset registry",
  rank: 650,
};

test("landing page provides a searchable, chain-specific asset result", async ({ page }) => {
  await page.route(/\/api\/assets\/search\?/, async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.searchParams.get("q") === "WETH") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ results: [wethResult] }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: /Know the price\. Know the liquidity\./ }),
  ).toBeVisible();
  const search = page.getByRole("textbox", {
    name: "Search token symbol, name, contract address, or Solana mint",
  });
  await search.fill("WETH");

  const result = page.getByRole("link", { name: /WETH.*Wrapped Ether.*Ethereum/i });
  await expect(result).toBeVisible();
  await expect(result).toHaveAttribute(
    "href",
    "/asset/ethereum/0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
  );
});

test("market API returns 429 after its bounded request limit", async ({ request }) => {
  const headers = { "x-forwarded-for": "203.0.113.10" };

  for (let count = 0; count < 20; count += 1) {
    const response = await request.get("/api/chains", { headers });
    expect(response.status()).toBe(200);
  }

  const limited = await request.get("/api/chains", { headers });
  expect(limited.status()).toBe(429);
  expect(limited.headers()["retry-after"]).toBeDefined();
  expect(limited.headers()["cache-control"]).toBe("no-store");
});
