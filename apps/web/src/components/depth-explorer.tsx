"use client";

import { LoaderCircle } from "lucide-react";
import { FormEvent, useState } from "react";

import type { MarketReportDto } from "@/lib/dto";
import { formatPercent, formatUsd } from "@/lib/format";

type Estimate = MarketReportDto["tradeEstimates"][number];

interface DepthPayload {
  estimates: Estimate[];
}

function isDepthPayload(payload: unknown): payload is DepthPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "estimates" in payload &&
    Array.isArray((payload as { estimates?: unknown }).estimates)
  );
}

export function DepthExplorer({
  chain,
  address,
  initialEstimates,
}: {
  chain: string;
  address: string;
  initialEstimates: readonly Estimate[];
}) {
  const [amount, setAmount] = useState("10000");
  const [estimates, setEstimates] = useState<readonly Estimate[]>(initialEstimates);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(
        `/api/assets/${encodeURIComponent(chain)}/${encodeURIComponent(address)}/depth?amount=${encodeURIComponent(amount)}`,
      );
      const payload: unknown = await response.json();
      if (!response.ok || !isDepthPayload(payload)) {
        setError("Enter a positive USD amount up to $1,000,000,000.");
        return;
      }
      setEstimates(payload.estimates);
    } catch {
      setError("The depth estimate could not be refreshed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="border-white/8 rounded-2xl border bg-[#111a2a] p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-base font-semibold text-white">Executable-price estimate</h2>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            A reserve-based estimate for a single observed venue. It is never a firm quote or a
            trade instruction.
          </p>
        </div>
        <form className="flex w-full gap-2 sm:w-auto" onSubmit={submit}>
          <label className="sr-only" htmlFor="depth-amount">
            Custom USD trade size
          </label>
          <div className="flex min-w-0 items-center rounded-lg border border-white/10 bg-slate-950 px-3">
            <span className="text-sm text-slate-500">$</span>
            <input
              className="w-24 bg-transparent py-2 text-sm text-white outline-none"
              id="depth-amount"
              inputMode="decimal"
              onChange={(event) => setAmount(event.target.value)}
              value={amount}
            />
          </div>
          <button
            className="inline-flex items-center justify-center rounded-lg bg-cyan-300 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-60"
            disabled={loading}
            type="submit"
          >
            {loading ? <LoaderCircle className="size-4 animate-spin" /> : "Estimate"}
          </button>
        </form>
      </div>
      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {estimates.map((estimate) => (
          <div
            className="border-white/7 rounded-xl border bg-slate-950/55 p-4"
            key={`${estimate.side}-${estimate.inputUsd}`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold capitalize text-white">
                {estimate.side} {formatUsd(estimate.inputUsd)}
              </p>
              <span
                className={`rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${estimate.precision === "estimated" ? "bg-amber-400/10 text-amber-300" : "bg-slate-700/50 text-slate-300"}`}
              >
                {estimate.precision}
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
              <div>
                <dt className="text-slate-500">Effective price</dt>
                <dd className="mt-1 font-medium text-slate-100">
                  {formatUsd(estimate.effectivePriceUsd, 5)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Price impact</dt>
                <dd className="mt-1 font-medium text-slate-100">
                  {formatPercent(estimate.priceImpactPercent)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Best observed venue</dt>
                <dd
                  className="mt-1 truncate font-medium text-slate-100"
                  title={estimate.bestVenue ?? undefined}
                >
                  {estimate.bestVenue ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Estimated fee</dt>
                <dd className="mt-1 font-medium text-slate-100">
                  {formatUsd(estimate.estimatedProtocolFeeUsd, 4)}
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}
