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
import { pearson } from "../simulation/utils";

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

function mean(arr) {
  if (!arr?.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function formatNumber(x) {
  if (!Number.isFinite(x)) return "n/a";
  return x.toFixed(3);
}

function correlationColor(r) {
  if (!Number.isFinite(r)) return "inherit";
  if (r >= 0.5) return "#16a34a";
  if (r <= -0.5) return "#ef4444";
  return "inherit";
}

function correlationBg(r, isActive) {
  if (!Number.isFinite(r)) return isActive ? "rgba(59,130,246,0.25)" : "transparent";
  if (isActive) return "rgba(59,130,246,0.25)";
  if (r >= 0.5) return "rgba(34,197,94,0.2)";
  if (r <= -0.5) return "rgba(239,68,68,0.2)";
  return "transparent";
}

export default function SweepChart2D({ sweep, metricSpec }) {
  const [viewMode, setViewMode] = useState("absolute");
  const [activeSeries, setActiveSeries] = useState(null);
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

  // High-contrast palette (multi-hue) for clear separation
  const colors = [
    "#2563eb", // blue
    "#ef4444", // red
    "#f97316", // orange
    "#22c55e", // green
    "#7c3aed", // purple
    "#14b8a6", // teal
    "#ec4899", // pink/magenta
    "#84cc16", // lime
    "#f59e0b", // amber
    "#0ea5e9", // cyan
  ];

  const correlations = useMemo(() => {
    const rows = [];
    if (!results || !seriesKeys.length) return rows;

    for (const series of seriesKeys) {
      const xs = [];
      const ys = [];
      for (const row of results) {
        if (String(row.series) !== String(series)) continue;
        const y = computeY(row.stats, metricSpec);
        if (!Number.isFinite(y) || !Number.isFinite(row.x)) continue;
        xs.push(Number(row.x));
        ys.push(y);
      }
      const r = pearson(xs, ys);
      if (r == null) continue;
      rows.push({ series, r, n: xs.length });
    }

    rows.sort((a, b) => {
      const diff = b.r - a.r;
      if (diff !== 0) return diff;
      const absDiff = Math.abs(b.r) - Math.abs(a.r);
      if (absDiff !== 0) return absDiff;
      return String(a.series).localeCompare(String(b.series));
    });
    return rows;
  }, [results, seriesKeys, metricSpec]);

  // Variation explained: how much variance is due to series vs x (simple variance decomposition)
  const varianceSummary = useMemo(() => {
    if (!results?.length) return null;

    const seriesMap = new Map();
    const xMap = new Map();
    const all = [];

    for (const row of results) {
      const y = computeY(row.stats, metricSpec);
      if (!Number.isFinite(y)) continue;
      all.push(y);

      const sKey = String(row.series);
      const xKey = String(row.x);
      if (!seriesMap.has(sKey)) seriesMap.set(sKey, []);
      if (!xMap.has(xKey)) xMap.set(xKey, []);
      seriesMap.get(sKey).push(y);
      xMap.get(xKey).push(y);
    }

    const n = all.length;
    if (n < 2) return null;

    const overallMean = mean(all);
    const totalVar = all.reduce((acc, y) => acc + (y - overallMean) ** 2, 0) / n;

    const betweenSeries =
      Array.from(seriesMap.values()).reduce((acc, arr) => {
        const m = mean(arr);
        return acc + (arr.length * (m - overallMean) ** 2);
      }, 0) / n;

    const betweenX =
      Array.from(xMap.values()).reduce((acc, arr) => {
        const m = mean(arr);
        return acc + (arr.length * (m - overallMean) ** 2);
      }, 0) / n;

    const pctSeries = totalVar > 0 ? betweenSeries / totalVar : 0;
    const pctX = totalVar > 0 ? betweenX / totalVar : 0;

    return {
      n,
      totalVar,
      betweenSeries,
      betweenX,
      pctSeries,
      pctX,
    };
  }, [results, metricSpec]);

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
        <LineChart
          width={820}
          height={380}
          data={transformed}
          margin={{ top: 20, right: 20, bottom: 30, left: 80 }}
        >
          <CartesianGrid />
          <XAxis
            dataKey="x"
            type={isNumericX ? "number" : "category"}
            label={{ value: xParam, position: "insideBottom", dy: 10 }}
          />
          <YAxis
            tickFormatter={yTickFormatter}
            domain={yDomain}
            width={90}
            label={{
              value:
                viewMode === "absolute"
                  ? label
                  : viewMode === "delta"
                  ? `${label} (Δ vs avg at X)`
                  : `${label} (% vs avg at X)`,
              angle: -90,
              position: "left",
              offset: 10,
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
          {seriesKeys.map((key, idx) => {
            const color = colors[idx % colors.length];
            const faded = activeSeries && activeSeries !== key;
            const opacity = faded ? 0.35 : 1;
            return (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                dot={{ r: 3, stroke: color, fill: color, fillOpacity: opacity, strokeOpacity: opacity }}
                stroke={color}
                strokeOpacity={opacity}
                strokeWidth={2.2}
                connectNulls={false}
              />
            );
          })}
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
            {seriesKeys.map((key, idx) => {
              const color = colors[idx % colors.length];
              const faded = activeSeries && activeSeries !== key;
              const opacity = faded ? 0.45 : 1;
              return (
                <div
                  key={key}
                  onClick={() => setActiveSeries((prev) => (prev === key ? null : key))}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    cursor: "pointer",
                    opacity,
                    padding: "3px 6px",
                    borderRadius: 6,
                    border: activeSeries === key ? "1px solid rgba(59,130,246,0.6)" : "1px solid transparent",
                  }}
                >
                  <span
                    style={{
                      width: 16,
                      height: 3,
                      backgroundColor: color,
                      marginRight: 6,
                    }}
                  />
                  <span>{key}</span>
                </div>
              );
            })}
          </div>
        </div>

        {varianceSummary && (
          <div className="mt-3 overflow-hidden border border-slate-200 rounded-md dark:border-slate-700">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-slate-100 dark:bg-slate-800">
                <tr>
                  <th className="text-left px-3 py-2 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                    Factor
                  </th>
                  <th className="text-right px-3 py-2 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                    Variance explained
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                    {seriesParam} (series)
                  </td>
                  <td className="px-3 py-2 text-right border-b border-slate-100 dark:border-slate-800">
                    {(varianceSummary.pctSeries * 100).toFixed(1)}%
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                    {xParam} (x-axis)
                  </td>
                  <td className="px-3 py-2 text-right border-b border-slate-100 dark:border-slate-800">
                    {(varianceSummary.pctX * 100).toFixed(1)}%
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-slate-500 dark:text-slate-300">
                    Samples (n)
                  </td>
                  <td className="px-3 py-2 text-right text-slate-500 dark:text-slate-300">
                    {varianceSummary.n}
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="text-xs text-slate-600 dark:text-slate-300 px-3 py-2">
              Shares of total metric variance (between-series vs between-x means); higher % means that factor drives more spread.
            </div>
          </div>
        )}

        {correlations.length > 0 && (
          <div className="mt-3 overflow-hidden border border-slate-200 rounded-md dark:border-slate-700">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-slate-100 dark:bg-slate-800">
                <tr>
                  <th className="text-left px-3 py-2 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                    Series
                  </th>
                  <th className="text-right px-3 py-2 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                    r (x vs {label})
                  </th>
                  <th className="text-right px-3 py-2 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                    n
                  </th>
                </tr>
              </thead>
              <tbody>
                {correlations.map((row) => {
                  const isActive = activeSeries === row.series;
                  const bg = correlationBg(row.r, isActive);
                  const color = correlationColor(row.r);
                  return (
                    <tr
                      key={row.series}
                      className="cursor-pointer"
                      style={{ background: bg }}
                      onClick={() =>
                        setActiveSeries((prev) => (prev === row.series ? null : row.series))
                      }
                    >
                      <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                        {row.series}
                      </td>
                      <td
                        className="px-3 py-2 text-right border-b border-slate-100 dark:border-slate-800"
                        style={{ color, fontWeight: Math.abs(row.r) >= 0.5 ? 700 : 500 }}
                      >
                        {formatNumber(row.r)}
                      </td>
                      <td className="px-3 py-2 text-right border-b border-slate-100 dark:border-slate-800">
                        {row.n}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
