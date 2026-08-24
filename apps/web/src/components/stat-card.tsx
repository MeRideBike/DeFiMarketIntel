import type { ReactNode } from "react";

export function StatCard({
  label,
  value,
  detail,
  accent = "cyan",
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  accent?: "cyan" | "violet" | "emerald" | "amber";
}) {
  const accentClasses = {
    cyan: "from-cyan-400/20",
    violet: "from-violet-400/20",
    emerald: "from-emerald-400/20",
    amber: "from-amber-400/20",
  };
  return (
    <section className="border-white/8 relative overflow-hidden rounded-2xl border bg-[#111a2a] p-4">
      <div
        className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${accentClasses[accent]} to-transparent`}
      />
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">{value}</p>
      {detail ? <p className="mt-1.5 text-xs leading-5 text-slate-400">{detail}</p> : null}
    </section>
  );
}
