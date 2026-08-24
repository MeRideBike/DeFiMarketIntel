"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { MarketReportDto } from "@/lib/dto";

type Estimate = MarketReportDto["tradeEstimates"][number];

export function DepthChart({ estimates }: { estimates: readonly Estimate[] }) {
  const hasEstimatedImpact = estimates.some((estimate) => estimate.priceImpactPercent !== null);
  if (!hasEstimatedImpact) {
    return (
      <p className="text-sm text-slate-400">
        No reserve-backed market-depth estimate is available.
      </p>
    );
  }
  const sizes = [...new Set(estimates.map((estimate) => estimate.inputUsd))];
  const data = sizes.map((size) => {
    const buy = estimates.find((estimate) => estimate.inputUsd === size && estimate.side === "buy");
    const sell = estimates.find(
      (estimate) => estimate.inputUsd === size && estimate.side === "sell",
    );
    return {
      size: `$${Number(size).toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
      buy: Number(buy?.priceImpactPercent ?? 0),
      sell: Number(sell?.priceImpactPercent ?? 0),
    };
  });

  if (!data.length) {
    return (
      <p className="text-sm text-slate-400">
        No reserve-backed market-depth estimate is available.
      </p>
    );
  }

  return (
    <div aria-label="Estimated market depth chart" className="h-60 w-full">
      <ResponsiveContainer height="100%" width="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="#26344b" strokeDasharray="3 3" vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="size"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            tickFormatter={(value: number) => `${value}%`}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "#101827",
              border: "1px solid #26344b",
              borderRadius: "12px",
              color: "#e2e8f0",
            }}
            formatter={(value: number) => `${value.toFixed(2)}%`}
          />
          <Legend wrapperStyle={{ color: "#cbd5e1", fontSize: "12px" }} />
          <Bar dataKey="buy" fill="#22d3ee" name="Buy impact" radius={[4, 4, 0, 0]} />
          <Bar dataKey="sell" fill="#a78bfa" name="Sell impact" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
