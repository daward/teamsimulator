import React, { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

function computeY(stats, metricSpec) {
  if (!stats) return null;

  if (metricSpec.mode === "single") {
    const v = stats[metricSpec.key];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  }

  const a = stats[metricSpec.numeratorKey];
  const b = stats[metricSpec.denominatorKey];
  if (typeof a !== "number" || !Number.isFinite(a)) return null;
  if (typeof b !== "number" || !Number.isFinite(b) || b === 0) return null;
  return a / b;
}

function metricLabel(metricSpec) {
  if (metricSpec.mode === "single") return metricSpec.key;
  return `${metricSpec.numeratorKey} / ${metricSpec.denominatorKey}`;
}

function formatTickShort(value) {
  if (!Number.isFinite(value)) return value;
  const abs = Math.abs(value);
  if (abs >= 1000) return value.toFixed(0);
  if (abs >= 1) return value.toFixed(3);
  return value.toPrecision(3);
}

export default function SweepChart1D({ sweep, metricSpec }) {
  if (!sweep) return null;

  const { paramName, results } = sweep;

  const label = metricLabel(metricSpec);

  const chartData = useMemo(() => {
    return (results || []).map((r) => ({
      x: r.x,
      y: computeY(r.stats, metricSpec),
    }));
  }, [results, metricSpec]);

  const isNumericX = chartData.every((r) => typeof r.x === "number");

  const yDomain = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const r of chartData) {
      const v = r.y;
      if (typeof v === "number" && Number.isFinite(v)) {
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) return undefined;

    const range = max - min;
    const pad = Math.max(range * 0.08, Math.abs(max) * 0.01, 0.001);
    const tinyBoost = range < 1e-6 ? Math.max(Math.abs(max) * 0.02, 0.01) : 0;
    return [min - pad - tinyBoost, max + pad + tinyBoost];
  }, [chartData]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm p-0 dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-3 w-full rounded-t-lg bg-slate-100 px-4 py-2 text-center text-lg font-semibold text-slate-900 border-b border-slate-200 dark:bg-slate-700/80 dark:text-white dark:border-slate-600">
        {label} vs {paramName}
      </div>

      <div className="flex justify-center">
        <LineChart
          width={820}
          height={380}
          data={chartData}
          margin={{ top: 20, right: 20, bottom: 30, left: 80 }}
        >
          <CartesianGrid />
          <XAxis
            dataKey="x"
            type={isNumericX ? "number" : "category"}
            tickFormatter={formatTickShort}
            label={{ value: paramName, position: "insideBottom", dy: 10 }}
          />
          <YAxis
            domain={yDomain}
            width={90}
            tickFormatter={formatTickShort}
            label={{
              value: label,
              angle: -90,
              position: "left",
              offset: 10,
              style: { textAnchor: "middle" },
            }}
          />
          <Tooltip
            formatter={(v) => (Number.isFinite(v) ? v.toFixed(6) : "")}
            labelFormatter={(l) => `${paramName} = ${l}`}
          />
          <Line type="monotone" dataKey="y" dot stroke="#3366cc" strokeWidth={2.2} />
        </LineChart>
      </div>
    </div>
  );
}
