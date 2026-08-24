"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { AssetDto } from "@/lib/dto";
import { shortenIdentifier } from "@/lib/format";

interface SearchResult extends AssetDto {
  readonly rank: number;
}

function isSearchPayload(payload: unknown): payload is { results: SearchResult[] } {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "results" in payload &&
    Array.isArray((payload as { results?: unknown }).results)
  );
}

export function SearchBox({ compact = false }: { compact?: boolean }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const normalized = query.trim();
    requestRef.current?.abort();
    if (!normalized) {
      setResults([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    requestRef.current = controller;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/assets/search?q=${encodeURIComponent(normalized)}`, {
          signal: controller.signal,
        });
        const payload: unknown = await response.json();
        if (!controller.signal.aborted && response.ok && isSearchPayload(payload)) {
          setResults(payload.results);
          setOpen(true);
        }
      } catch {
        // Search stays usable through the curated results available on the next successful request.
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return (
    <div className={`relative ${compact ? "w-full max-w-xl" : "w-full max-w-3xl"}`}>
      <label className="sr-only" htmlFor="asset-search">
        Search token symbol, name, contract address, or Solana mint
      </label>
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 shadow-2xl shadow-black/20 transition focus-within:border-cyan-300/60 focus-within:ring-4 focus-within:ring-cyan-400/10">
        <Search aria-hidden="true" className="size-5 shrink-0 text-cyan-300" />
        <input
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
          id="asset-search"
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search symbol, name, contract address, or Solana mint"
          value={query}
        />
        {query ? (
          <button
            aria-label="Clear search"
            className="rounded p-1 text-slate-500 transition hover:bg-white/10 hover:text-white"
            onClick={() => setQuery("")}
            type="button"
          >
            <X className="size-4" />
          </button>
        ) : null}
        {loading ? (
          <span aria-label="Searching" className="size-3 animate-pulse rounded-full bg-cyan-300" />
        ) : null}
      </div>
      {open ? (
        <div className="absolute z-30 mt-2 max-h-[28rem] w-full overflow-auto rounded-2xl border border-white/10 bg-[#101827]/95 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl">
          {results.length ? (
            results.map((result) => (
              <Link
                className="hover:bg-white/8 focus:bg-white/8 flex items-center justify-between gap-3 rounded-xl px-3 py-3 transition focus:outline-none"
                href={`/asset/${encodeURIComponent(result.chain.id)}/${encodeURIComponent(result.identifier)}`}
                key={result.id}
                onClick={() => setOpen(false)}
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-sm font-semibold text-white">
                    <span className="truncate">{result.symbol}</span>
                    {result.verification === "verified" ? (
                      <span className="bg-emerald-400/12 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-300">
                        Curated
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-slate-400">
                    {result.name}
                  </span>
                </span>
                <span className="shrink-0 text-right text-xs text-slate-500">
                  <span className="block text-slate-300">{result.chain.name}</span>
                  <span className="font-mono text-[10px]">
                    {shortenIdentifier(result.identifier, 7, 5)}
                  </span>
                </span>
              </Link>
            ))
          ) : (
            <p className="px-3 py-4 text-sm text-slate-400">No supported assets found.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
