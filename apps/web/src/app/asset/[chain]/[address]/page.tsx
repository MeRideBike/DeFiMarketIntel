import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Layers3,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DepthChart } from "@/components/depth-chart";
import { DepthExplorer } from "@/components/depth-explorer";
import { SearchBox } from "@/components/search-box";
import { SiteHeader } from "@/components/site-header";
import { StatCard } from "@/components/stat-card";
import { reportDto } from "@/lib/dto";
import {
  formatCompactUsd,
  formatPercent,
  formatTime,
  formatUsd,
  shortenIdentifier,
} from "@/lib/format";
import { getMarketReport } from "@/lib/market";

interface PageProps {
  params: Promise<{ chain: string; address: string }>;
}

function explorerHref(chain: string, identifier: string, explorerUrl: string): string {
  const resource = chain === "solana" ? "token" : "address";
  return `${explorerUrl}/${resource}/${encodeURIComponent(identifier)}`;
}

export default async function AssetPage({ params }: PageProps) {
  const { chain, address } = await params;
  const report = await getMarketReport(chain, address);
  if (!report) notFound();
  const data = reportDto(report);
  const explorer = explorerHref(
    data.asset.chain.id,
    data.asset.identifier,
    data.asset.chain.explorerUrl,
  );
  const priceRange =
    data.price.observationLowUsd && data.price.observationHighUsd
      ? `${formatUsd(data.price.observationLowUsd, 5)} – ${formatUsd(data.price.observationHighUsd, 5)}`
      : "No fresh range";

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link className="text-xs text-slate-500 transition hover:text-cyan-200" href="/">
              ← Back to search
            </Link>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {data.asset.symbol}
              </h1>
              <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-300">
                {data.asset.chain.name}
              </span>
              {data.asset.verification === "verified" ? (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-300">
                  <CheckCircle2 className="size-3.5" /> Curated identity
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-amber-300">
                  <ShieldAlert className="size-3.5" /> Metadata not verified
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-slate-400">
              {data.asset.name} · {data.asset.tokenStandard ?? "Token standard unknown"}
            </p>
          </div>
          <div className="flex w-full max-w-xl items-center gap-3 lg:w-auto lg:min-w-[28rem]">
            <SearchBox compact />
            <a
              aria-label="Open asset in its block explorer"
              className="rounded-xl border border-white/10 bg-[#111a2a] p-3 text-slate-300 transition hover:border-cyan-300/40 hover:text-cyan-200"
              href={explorer}
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink className="size-4" />
            </a>
          </div>
        </div>

        {data.partial ? (
          <div className="bg-amber-300/7 mb-5 flex gap-3 rounded-xl border border-amber-300/20 p-3 text-xs leading-5 text-amber-100">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-300" />
            Some provider data is unavailable. The report preserves remaining observations and
            reduces confidence rather than presenting a complete market view.
          </div>
        ) : null}

        <section aria-label="Asset overview" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            accent="cyan"
            detail={`Range: ${priceRange}`}
            label="Reference price"
            value={formatUsd(data.price.referencePriceUsd, 5)}
          />
          <StatCard
            accent="violet"
            detail={`${data.price.sourceCount} independent provider${data.price.sourceCount === 1 ? "" : "s"} · ${data.price.outlierCount} excluded`}
            label="Price confidence"
            value={`${data.price.confidenceLabel} · ${data.price.confidenceScore}/100`}
          />
          <StatCard
            accent="emerald"
            detail={`Usable estimate: ${formatCompactUsd(data.liquidity.usableLiquidityUsd)}`}
            label="Observed DEX liquidity"
            value={formatCompactUsd(data.liquidity.totalObservedLiquidityUsd)}
          />
          <StatCard
            accent="amber"
            detail={
              data.liquidity.largestPoolSharePercent
                ? `Largest pool: ${formatPercent(data.liquidity.largestPoolSharePercent, 1)}`
                : "No pool concentration available"
            }
            label="Liquidity score"
            value={`${data.liquidity.liquidityScore}/100 · ${data.liquidity.liquidityLabel}`}
          />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
          <div className="border-white/8 rounded-2xl border bg-[#111a2a] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-white">Market depth</h2>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  Best single-pool reserve estimate at each size. Buy and sell estimates are
                  evaluated separately.
                </p>
              </div>
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <Clock3 className="size-3.5" />
                {formatTime(data.generatedAt)}
              </span>
            </div>
            <div className="mt-5">
              <DepthChart estimates={data.tradeEstimates} />
            </div>
          </div>
          <aside className="border-white/8 rounded-2xl border bg-[#111a2a] p-5">
            <h2 className="text-base font-semibold text-white">Market-quality signals</h2>
            <div className="mt-4 space-y-3">
              {data.warnings.length ? (
                data.warnings.map((warning) => (
                  <div
                    className={`rounded-xl border p-3 ${warning.severity === "critical" ? "bg-rose-400/8 border-rose-400/20" : warning.severity === "warning" ? "bg-amber-300/7 border-amber-300/20" : "border-cyan-300/15 bg-cyan-300/5"}`}
                    key={warning.code}
                  >
                    <p className="text-xs font-semibold text-slate-100">{warning.title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">{warning.detail}</p>
                  </div>
                ))
              ) : (
                <p className="rounded-xl border border-emerald-300/15 bg-emerald-300/5 p-3 text-sm text-emerald-100">
                  No objective market-quality warnings are currently triggered.
                </p>
              )}
            </div>
          </aside>
        </section>

        <div className="mt-6">
          <DepthExplorer
            address={data.asset.identifier}
            chain={data.asset.chain.id}
            initialEstimates={data.tradeEstimates}
          />
        </div>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="border-white/8 overflow-hidden rounded-2xl border bg-[#111a2a]">
            <div className="border-white/8 border-b p-5">
              <h2 className="text-base font-semibold text-white">Observed markets</h2>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Pool TVL, executable estimate, and price deviation remain distinct measurements.
              </p>
            </div>
            {data.pools.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead className="bg-slate-950/30 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                    <tr>
                      <th className="px-5 py-3 font-medium">Protocol / pair</th>
                      <th className="px-4 py-3 font-medium">Price</th>
                      <th className="px-4 py-3 font-medium">Observed TVL</th>
                      <th className="px-4 py-3 font-medium">Executable</th>
                      <th className="px-4 py-3 font-medium">24h volume</th>
                      <th className="px-5 py-3 font-medium">Deviation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-white/6 divide-y">
                    {data.pools.map((pool) => (
                      <tr className="text-slate-300" key={pool.id}>
                        <td className="px-5 py-4">
                          <p className="font-medium text-white">{pool.protocol}</p>
                          <p className="mt-0.5 text-slate-500">
                            {pool.pairLabel}
                            {pool.isConcentratedLiquidity ? " · concentrated" : ""}
                          </p>
                        </td>
                        <td className="px-4 py-4">{formatUsd(pool.priceUsd, 5)}</td>
                        <td className="px-4 py-4">{formatCompactUsd(pool.totalLiquidityUsd)}</td>
                        <td className="px-4 py-4">
                          <span className="text-slate-100">
                            {formatCompactUsd(pool.executableLiquidityUsd)}
                          </span>
                          <span className="ml-1 text-[10px] uppercase text-amber-300">
                            {pool.liquidityPrecision}
                          </span>
                        </td>
                        <td className="px-4 py-4">{formatCompactUsd(pool.volume24hUsd)}</td>
                        <td className="px-5 py-4">{formatPercent(pool.priceDeviationPercent)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="p-5 text-sm text-slate-400">
                No supported DEX pools were returned for this asset.
              </p>
            )}
          </div>
          <aside className="border-white/8 rounded-2xl border bg-[#111a2a] p-5">
            <h2 className="text-base font-semibold text-white">Liquidity distribution</h2>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              Distribution is based on observable pools, not all possible liquidity.
            </p>
            <div className="mt-5 space-y-4">
              {data.liquidity.protocolDistribution.length ? (
                data.liquidity.protocolDistribution.slice(0, 6).map((entry) => (
                  <div key={entry.key}>
                    <div className="flex justify-between gap-3 text-xs">
                      <span className="truncate text-slate-300">{entry.key}</span>
                      <span className="text-slate-400">{formatPercent(entry.sharePercent, 1)}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-400"
                        style={{ width: `${Math.min(Number(entry.sharePercent), 100)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {formatCompactUsd(entry.liquidityUsd)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400">No distribution is available.</p>
              )}
            </div>
          </aside>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="border-white/8 rounded-2xl border bg-[#111a2a] p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-white">Price sources</h2>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  Accepted observations are the inputs to the reference-price methodology.
                </p>
              </div>
              <Layers3 className="size-5 text-cyan-300" />
            </div>
            <div className="mt-5 space-y-3">
              {data.price.observations.length ? (
                data.price.observations.map((observation, index) => (
                  <article
                    className="border-white/7 rounded-xl border bg-slate-950/45 p-3"
                    key={`${observation.provider}-${observation.source}-${index}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-white">{observation.source}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {observation.provider} · {formatTime(observation.observedAt)} · quote
                          asset: {observation.quoteAssetQuality}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-cyan-200">
                        {formatUsd(observation.priceUsd, 5)}
                      </p>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-400">
                      {observation.methodology}
                    </p>
                    {observation.sourceUrl ? (
                      <a
                        className="mt-2 inline-flex items-center gap-1 text-xs text-cyan-300 hover:text-cyan-100"
                        href={observation.sourceUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Open source <ArrowUpRight className="size-3" />
                      </a>
                    ) : null}
                  </article>
                ))
              ) : (
                <p className="text-sm text-slate-400">No fresh price observations were accepted.</p>
              )}
            </div>
          </div>
          <aside className="border-white/8 rounded-2xl border bg-[#111a2a] p-5">
            <h2 className="text-base font-semibold text-white">Identity & data state</h2>
            <dl className="mt-5 space-y-4 text-xs">
              <div>
                <dt className="text-slate-500">Contract / mint</dt>
                <dd className="mt-1 flex items-center justify-between gap-2 font-mono text-slate-200">
                  <span title={data.asset.identifier}>
                    {shortenIdentifier(data.asset.identifier, 12, 10)}
                  </span>
                  <a
                    className="text-cyan-300 hover:text-cyan-100"
                    href={explorer}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Explorer
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Asset source</dt>
                <dd className="mt-1 text-slate-200">{data.asset.source}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Last report generation</dt>
                <dd className="mt-1 text-slate-200">{formatTime(data.generatedAt)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Provider status</dt>
                <dd className="mt-2 space-y-2">
                  {data.providerStatuses.length ? (
                    data.providerStatuses.map((status) => (
                      <div
                        className="flex items-center justify-between gap-2"
                        key={status.provider}
                      >
                        <span className="text-slate-300">{status.provider}</span>
                        <span className={status.available ? "text-emerald-300" : "text-rose-300"}>
                          {status.available ? `${status.latencyMs ?? "—"} ms` : "unavailable"}
                        </span>
                      </div>
                    ))
                  ) : (
                    <span className="text-slate-400">No provider call has completed.</span>
                  )}
                </dd>
              </div>
            </dl>
          </aside>
        </section>

        <p className="border-white/8 mt-8 border-t py-6 text-xs leading-5 text-slate-500">
          Market data is informational and may be delayed, incomplete, or inaccurate. “Estimated”
          values are not executable quotes, a guarantee of liquidity, a trade recommendation, or
          financial advice.
        </p>
      </main>
    </div>
  );
}
