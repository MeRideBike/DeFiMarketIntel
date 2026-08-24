import Link from "next/link";
import { Activity, Database, Network, SearchCheck, ShieldCheck, Waves } from "lucide-react";

import { SearchBox } from "@/components/search-box";
import { SiteHeader } from "@/components/site-header";

const curatedAssets = [
  {
    label: "Ethereum WETH",
    href: "/asset/ethereum/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  },
  {
    label: "Ethereum USDC",
    href: "/asset/ethereum/0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  },
  {
    label: "Base USDC",
    href: "/asset/base/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  },
  {
    label: "Solana USDC",
    href: "/asset/solana/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden px-4 pb-24 pt-20 sm:px-6 sm:pt-28 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-4xl">
              <p className="bg-cyan-300/8 mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 px-3 py-1.5 text-xs font-medium text-cyan-200">
                <span className="size-1.5 rounded-full bg-cyan-300" />
                Read-only cross-chain market intelligence
              </p>
              <h1 className="max-w-4xl text-balance text-4xl font-semibold tracking-[-0.045em] text-white sm:text-6xl lg:text-7xl">
                Know the price. <span className="text-cyan-300">Know the liquidity.</span> Know
                whether you can actually trade it.
              </h1>
              <p className="mt-7 max-w-2xl text-pretty text-base leading-7 text-slate-400 sm:text-lg">
                Inspect market-price provenance, DEX pools, observable liquidity, and estimated buy
                or sell impact across EVM networks and Solana.
              </p>
              <div className="mt-9">
                <SearchBox />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>Try a curated asset:</span>
                {curatedAssets.map((asset) => (
                  <Link
                    className="rounded-full border border-white/10 px-2.5 py-1 transition hover:border-cyan-300/50 hover:text-cyan-200"
                    href={asset.href}
                    key={asset.label}
                  >
                    {asset.label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="mt-16 grid gap-3 md:grid-cols-3">
              <article className="border-white/8 rounded-2xl border bg-[#111a2a]/80 p-5">
                <SearchCheck className="size-5 text-cyan-300" />
                <h2 className="mt-6 text-base font-semibold text-white">Identity before ticker</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Every result binds its symbol to a chain and contract or mint. Duplicate tickers
                  are never silently merged.
                </p>
              </article>
              <article className="border-white/8 rounded-2xl border bg-[#111a2a]/80 p-5">
                <Activity className="size-5 text-violet-300" />
                <h2 className="mt-6 text-base font-semibold text-white">Price with provenance</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Reference prices retain source, freshness, pool, liquidity, and derivation
                  context—not an opaque number.
                </p>
              </article>
              <article className="border-white/8 rounded-2xl border bg-[#111a2a]/80 p-5">
                <Waves className="size-5 text-emerald-300" />
                <h2 className="mt-6 text-base font-semibold text-white">Depth over TVL theater</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Trade-size estimates expose usable depth and flag concentrated-liquidity
                  uncertainty instead of presenting total TVL as executable.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section
          className="border-white/7 border-y bg-slate-950/30 px-4 py-20 sm:px-6 lg:px-8"
          id="methodology"
        >
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.17em] text-cyan-300">
                Designed for discernment
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                The displayed price is not automatically the tradable price.
              </h2>
              <p className="mt-5 max-w-xl text-sm leading-7 text-slate-400">
                The application weighs fresh, liquidity-backed observations; surfaces dispersion and
                exclusions; then estimates single-venue trade impact from reported pool reserves.
                Every estimate stays visibly estimated.
              </p>
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="border-white/8 rounded-xl border bg-[#111a2a] p-4">
                <Network className="size-5 text-cyan-300" />
                <dt className="mt-4 text-sm font-semibold text-white">8 chains</dt>
                <dd className="mt-1 text-xs leading-5 text-slate-400">
                  Ethereum, major EVM L2s and L1s, plus first-class Solana identifiers.
                </dd>
              </div>
              <div className="border-white/8 rounded-xl border bg-[#111a2a] p-4">
                <Database className="size-5 text-violet-300" />
                <dt className="mt-4 text-sm font-semibold text-white">Adapter seams</dt>
                <dd className="mt-1 text-xs leading-5 text-slate-400">
                  Market, metadata, RPC, and liquidity sources remain replaceable server-side
                  adapters.
                </dd>
              </div>
              <div className="border-white/8 rounded-xl border bg-[#111a2a] p-4">
                <ShieldCheck className="size-5 text-emerald-300" />
                <dt className="mt-4 text-sm font-semibold text-white">No custody</dt>
                <dd className="mt-1 text-xs leading-5 text-slate-400">
                  No wallet is required; the product does not collect keys or transmit trades.
                </dd>
              </div>
              <div className="border-white/8 rounded-xl border bg-[#111a2a] p-4">
                <Activity className="size-5 text-amber-300" />
                <dt className="mt-4 text-sm font-semibold text-white">Partial by design</dt>
                <dd className="mt-1 text-xs leading-5 text-slate-400">
                  Provider failures reduce confidence without turning a partial report into a blank
                  page.
                </dd>
              </div>
            </dl>
          </div>
        </section>
      </main>
      <footer className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-xs leading-5 text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>
          Informational market data only. It can be delayed, incomplete, or inaccurate and is not
          financial advice.
        </p>
        <p>DeFi Market Intel · Read-only</p>
      </footer>
    </div>
  );
}
