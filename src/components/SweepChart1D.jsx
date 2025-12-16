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
    <div style={{ marginTop: 20 }}>
      <h2 style={{ margin: 0 }}>
        {label} vs {paramName}
      </h2>

      <div style={{ marginTop: 8 }}>
        <LineChart width={820} height={380} data={chartData}>
          <CartesianGrid stroke="#eee" />
          <XAxis
            dataKey="x"
            type={isNumericX ? "number" : "category"}
            label={{ value: paramName, position: "insideBottom", dy: 10 }}
          />
          <YAxis
            domain={yDomain}
            label={{
              value: label,
              angle: -90,
              position: "insideLeft",
              style: { textAnchor: "middle" },
            }}
          />
          <Tooltip
            formatter={(v) => (Number.isFinite(v) ? v.toFixed(6) : "")}
            labelFormatter={(l) => `${paramName} = ${l}`}
          />
          <Line type="monotone" dataKey="y" dot stroke="#3366cc" />
        </LineChart>
      </div>
    </div>
  );
}
