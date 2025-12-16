import React, { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
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

export default function SweepChart2D({ sweep, metricSpec }) {
  const [viewMode, setViewMode] = useState("absolute");
  // "absolute" | "delta" | "percent"

  if (!sweep) return null;

  const { xParam, seriesParam, results } = sweep;
  const label = metricLabel(metricSpec);

  const { chartData, seriesKeys, isNumericX } = useMemo(() => {
    const byX = new Map();
    const seriesSet = new Set();
    const order = new Map();
    let idx = 0;

    for (const row of results || []) {
      const xKey = String(row.x);
      const sKey = String(row.series);
      const y = computeY(row.stats, metricSpec);

      if (!byX.has(xKey)) {
        byX.set(xKey, { x: row.x });
        order.set(xKey, idx++);
      }

      byX.get(xKey)[sKey] = y;
      seriesSet.add(sKey);
    }

    const rows = Array.from(byX.entries())
      .sort((a, b) => order.get(a[0]) - order.get(b[0]))
      .map(([, value]) => value);

    return {
      chartData: rows,
      seriesKeys: Array.from(seriesSet.values()).sort(),
      isNumericX: rows.every((r) => typeof r.x === "number"),
    };
  }, [results, metricSpec]);

  const transformed = useMemo(() => {
    if (viewMode === "absolute") return chartData;

    return chartData.map((row) => {
      const values = seriesKeys
        .map((k) => row[k])
        .filter((v) => typeof v === "number" && Number.isFinite(v));

      const mean =
        values.length > 0
          ? values.reduce((a, b) => a + b, 0) / values.length
          : 0;

      const out = { ...row };
      for (const k of seriesKeys) {
        const y = row[k];
        if (typeof y !== "number" || !Number.isFinite(y)) {
          out[k] = null;
          continue;
        }
        if (viewMode === "delta") out[k] = y - mean;
        if (viewMode === "percent") out[k] = mean === 0 ? null : (y - mean) / mean;
      }
      return out;
    });
  }, [chartData, seriesKeys, viewMode]);

  const yDomain = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;

    for (const row of transformed) {
      for (const k of seriesKeys) {
        const v = row[k];
        if (typeof v === "number" && Number.isFinite(v)) {
          min = Math.min(min, v);
          max = Math.max(max, v);
        }
      }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) return undefined;

    if (viewMode !== "absolute") {
      const m = Math.max(Math.abs(min), Math.abs(max));
      const pad = Math.max(m * 0.08, viewMode === "percent" ? 0.02 : 0.05);
      return [-(m + pad), m + pad];
    }

    const range = max - min;
    const pad = Math.max(range * 0.08, Math.abs(max) * 0.01, 0.001);
    const tinyBoost = range < 1e-6 ? Math.max(Math.abs(max) * 0.02, 0.01) : 0;
    return [min - pad - tinyBoost, max + pad + tinyBoost];
  }, [transformed, seriesKeys, viewMode]);

  const yTickFormatter = (v) => {
    if (!Number.isFinite(v)) return "";
    if (viewMode === "percent") return `${(v * 100).toFixed(1)}%`;
    return Math.abs(v) >= 1000 ? v.toFixed(0) : v.toFixed(3);
  };

  const tooltipFormatter = (v) => {
    if (!Number.isFinite(v)) return "";
    if (viewMode === "percent") return `${(v * 100).toFixed(2)}%`;
    return v.toFixed(6);
  };

  const colors = [
    "#3366cc",
    "#dc3912",
    "#ff9900",
    "#109618",
    "#990099",
    "#0099c6",
    "#dd4477",
    "#66aa00",
  ];

  return (
    <div style={{ marginTop: 20 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <h2 style={{ margin: 0 }}>
          {label} vs {xParam} (series: {seriesParam})
        </h2>

        <div style={{ fontSize: 12 }}>
          <label>
            View:&nbsp;
            <select value={viewMode} onChange={(e) => setViewMode(e.target.value)}>
              <option value="absolute">Absolute</option>
              <option value="delta">Δ from avg at X</option>
              <option value="percent">% from avg at X</option>
            </select>
          </label>
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        <LineChart width={820} height={380} data={transformed}>
          <CartesianGrid stroke="#eee" />
          <XAxis
            dataKey="x"
            type={isNumericX ? "number" : "category"}
            label={{ value: xParam, position: "insideBottom", dy: 10 }}
          />
          <YAxis
            tickFormatter={yTickFormatter}
            domain={yDomain}
            label={{
              value:
                viewMode === "absolute"
                  ? label
                  : viewMode === "delta"
                  ? `${label} (Δ vs avg at X)`
                  : `${label} (% vs avg at X)`,
              angle: -90,
              position: "insideLeft",
              style: { textAnchor: "middle" },
            }}
          />
          <Tooltip
            formatter={(v) => tooltipFormatter(v)}
            labelFormatter={(l) => `${xParam} = ${l}`}
          />
          {viewMode !== "absolute" && (
            <ReferenceLine y={0} stroke="#999" strokeDasharray="4 4" />
          )}
          {seriesKeys.map((key, idx) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              dot
              stroke={colors[idx % colors.length]}
              connectNulls={false}
            />
          ))}
        </LineChart>

        <div
          style={{
            marginTop: 12,
            paddingTop: 8,
            borderTop: "1px solid #ddd",
            fontSize: 15,
          }}
        >
          <div style={{ marginBottom: 6 }}>
            <strong>{seriesParam}:</strong>
          </div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            {seriesKeys.map((key, idx) => (
              <div key={key} style={{ display: "flex", alignItems: "center" }}>
                <span
                  style={{
                    width: 16,
                    height: 3,
                    backgroundColor: colors[idx % colors.length],
                    marginRight: 6,
                  }}
                />
                <span>{key}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
