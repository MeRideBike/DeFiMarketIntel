import Link from "next/link";

import { SiteHeader } from "@/components/site-header";

export default function NotFound() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-28 text-center sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
          Asset unavailable
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">
          We could not resolve that asset.
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-slate-400">
          Check the chain and contract or mint address. A token symbol alone is not a canonical
          identity.
        </p>
        <Link
          className="mt-8 inline-flex rounded-lg bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
          href="/"
        >
          Search assets
        </Link>
      </main>
    </div>
  );
}
