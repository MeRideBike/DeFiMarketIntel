import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-white/8 border-b bg-[#080d16]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-5 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-semibold tracking-tight text-white"
        >
          <span className="grid size-7 place-items-center rounded-lg bg-cyan-400 font-mono text-xs font-black text-slate-950">
            Δ
          </span>
          DeFi Market Intel
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-5 text-xs text-slate-400">
          <Link className="transition hover:text-white" href="/#methodology">
            Methodology
          </Link>
          <a
            className="transition hover:text-white"
            href="https://github.com/MeRideBike/DeFiMarketIntel"
            rel="noreferrer"
            target="_blank"
          >
            Source
          </a>
        </nav>
      </div>
    </header>
  );
}
