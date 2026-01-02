// src/components/ScatterPlot.jsx
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import { pearson } from "../simulation/utils";

function getValueByAxisKey(point, axisKey) {
  if (!axisKey || typeof axisKey !== "string") return NaN;

  const [ns, key] = axisKey.split(":", 2);
  const hasNs = key != null;
  const k = hasNs ? key : axisKey;

  const readFrom = (p, bucket, kk) => {
    const v = p?.[bucket]?.[kk];
    return typeof v === "number" && Number.isFinite(v) ? v : NaN;
  };

  if (hasNs) {
    if (ns === "stats") return readFrom(point, "stats", key);
    if (ns === "unit") return readFrom(point, "unitVars", key);
    if (ns === "cfg") return readFrom(point, "cfg", key);
  }

  // Fallback: try stats, cfg, then unitVars with the raw key (helps if the prefix is missing).
  const s = readFrom(point, "stats", k);
  if (Number.isFinite(s)) return s;
  const c = readFrom(point, "cfg", k);
  if (Number.isFinite(c)) return c;
  const u = readFrom(point, "unitVars", k);
  if (Number.isFinite(u)) return u;

  return NaN;
}

function prettyAxisLabel(axisKey) {
  if (!axisKey) return "";
  const [ns, key] = axisKey.split(":", 2);
  if (!key) return axisKey;

  if (ns === "stats") return key;
  if (ns === "unit") return `unit ${key}`;
  if (ns === "cfg") return key;

  return axisKey;
}

function formatNumber(x) {
  if (!Number.isFinite(x)) return "n/a";
  return x.toFixed(3);
}

function correlationColor(r) {
  if (!Number.isFinite(r)) return "inherit";
  if (r >= 0.5) return "#16a34a"; // stronger green
  if (r <= -0.5) return "#ef4444"; // stronger red
  return "inherit";
}

function correlationBg(r, isActive) {
  if (!Number.isFinite(r)) return isActive ? "#dbeafe" : "transparent";

  const basePos = "rgba(34, 197, 94, 0.45)"; // deeper green tint
  const baseNeg = "rgba(239, 68, 68, 0.45)"; // deeper red tint
  const activeOverlay = "rgba(59, 130, 246, 0.45)"; // highlight for current X

  let bg = "transparent";
  if (r >= 0.5) bg = basePos;
  else if (r <= -0.5) bg = baseNeg;

  if (isActive) return activeOverlay;
  return bg;
}

export default function ScatterPlot({
  scatter,
  xAxisKey,
  yAxisKey,
  onSelectXAxis,
  colorKey,
  onSelectColorKey,
  colorQuantize,
  onToggleColorQuantize,
  scatterUnitKeys,
  onSetScatterUnitKeys,
}) {
  // Use the Y axis if it is a stats key, otherwise default to productivity
  const targetKey =
    typeof yAxisKey === "string" && yAxisKey.startsWith("stats:")
      ? yAxisKey
      : "stats:productivity.worker";

  const targetLabel = prettyAxisLabel(targetKey);

  const points = useMemo(() => {
    const raw = scatter?.points || [];

    let colorMin = Infinity;
    let colorMax = -Infinity;
    const colorValues = [];

    const mapped = raw
      .map((p) => {
        const x = getValueByAxisKey(p, xAxisKey);
        const y = getValueByAxisKey(p, yAxisKey);
        const c =
          colorKey && typeof colorKey === "string"
            ? getValueByAxisKey(p, colorKey)
            : NaN;

        if (Number.isFinite(c)) {
          colorMin = Math.min(colorMin, c);
          colorMax = Math.max(colorMax, c);
          colorValues.push(c);
        }

        return { x, y, colorValue: c, _raw: p };
      })
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));

    return { mapped, colorMin, colorMax, colorValues };
  }, [scatter, xAxisKey, yAxisKey, colorKey]);

  const colorScale = useMemo(() => {
    const { colorMin, colorMax, colorValues } = points;
    if (!Number.isFinite(colorMin) || !Number.isFinite(colorMax) || colorMin === colorMax) {
      return { assign: () => ({ color: "#888", bin: null }), legend: null };
    }

    // Single-hue scale (vary lightness/saturation)
    const baseHue = 220; // blue
    if (!colorQuantize) {
      const assign = (v) => {
        if (!Number.isFinite(v)) return { color: "#888", bin: null };
        const t = Math.max(0, Math.min(1, (v - colorMin) / (colorMax - colorMin)));
        const lightness = 80 - t * 40; // from light to darker
        const sat = 70 + t * 10; // slightly increase saturation
        return { color: `hsl(${baseHue}, ${sat}%, ${lightness}%)`, bin: null };
      };
      return { assign, legend: null };
    }

    // Quantized into 5 buckets using quantiles (single-hue palette)
    const sorted = [...colorValues].sort((a, b) => a - b);
    const q = (p) => {
      if (!sorted.length) return NaN;
      const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
      return sorted[idx];
    };

    const thresholds = [q(0), q(0.2), q(0.4), q(0.6), q(0.8), q(1)];
    const palette = ["#e0ecff", "#b7d0ff", "#8bb3ff", "#5a8bff", "#2f66e0"];

    const assign = (v) => {
      if (!Number.isFinite(v)) return { color: "#888", bin: null };
      for (let i = 0; i < 5; i++) {
        if (v <= thresholds[i + 1]) return { color: palette[i], bin: i };
      }
      return { color: palette[palette.length - 1], bin: 4 };
    };

    const legend = thresholds
      .map((t, i) => ({
        min: thresholds[i],
        max: thresholds[i + 1],
        color: palette[i] || palette[palette.length - 1],
        bin: i,
      }))
      .slice(0, 5);

    return { assign, legend };
  }, [points, colorQuantize]);

  const mappedPoints = useMemo(() => {
    const { mapped } = points;
    const { assign } = colorScale;
    return mapped.map((p) => {
      const { color, bin } = assign(p.colorValue);
      return {
        ...p,
        fill: color,
        bin,
      };
    });
  }, [points, colorScale]);

  const correlations = useMemo(() => {
    const raw = scatter?.points || [];
    const rows = [];
    const candidateKeys = new Set();

    for (const p of raw) {
      const target = getValueByAxisKey(p, targetKey);
      if (!Number.isFinite(target)) continue;

      const featureMap = {};

      // Stats
      for (const [k, v] of Object.entries(p?.stats || {})) {
        if (typeof v === "number" && Number.isFinite(v)) {
          const key = `stats:${k}`;
          featureMap[key] = v;
          candidateKeys.add(key);
        }
      }

      // Config snapshot
      for (const [k, v] of Object.entries(p?.cfg || {})) {
        if (typeof v === "number" && Number.isFinite(v)) {
          const key = `cfg:${k}`;
          featureMap[key] = v;
          candidateKeys.add(key);
        }
      }

      // Unit vars
      for (const [k, v] of Object.entries(p?.unitVars || {})) {
        if (typeof v === "number" && Number.isFinite(v)) {
          const key = `unit:${k}`;
          featureMap[key] = v;
          candidateKeys.add(key);
        }
      }

      rows.push({ target, featureMap });
    }

    const results = [];

    for (const key of candidateKeys) {
      if (key === targetKey) continue; // skip self

      const xs = [];
      const ys = [];

      for (const row of rows) {
        const v = row.featureMap[key];
        if (!Number.isFinite(v)) continue;
        xs.push(v);
        ys.push(row.target);
      }

      const r = pearson(xs, ys);
      if (r == null) continue;

      results.push({
        key,
        label: prettyAxisLabel(key),
        r,
        n: xs.length,
      });
    }

    results.sort((a, b) => {
      // Primary: raw r descending
      const diff = b.r - a.r;
      if (diff !== 0) return diff;

      // Secondary: absolute r (keeps stable ordering for ties)
      const absDiff = Math.abs(b.r) - Math.abs(a.r);
      if (absDiff !== 0) return absDiff;

      return a.key.localeCompare(b.key);
    });
    return results;
  }, [scatter, targetKey]);

  const xLabel = prettyAxisLabel(xAxisKey);
  const yLabel = prettyAxisLabel(yAxisKey);
  const colorLabel = prettyAxisLabel(colorKey);
  const colorMin = points.colorMin;
  const colorMax = points.colorMax;
  const colorLegend = colorScale.legend;

  const [activeBin, setActiveBin] = useState(null);

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm p-0 dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-3 w-full rounded-t-lg bg-slate-100 px-4 py-2 text-center text-lg font-semibold text-slate-900 border-b border-slate-200 dark:bg-slate-700/80 dark:text-white dark:border-slate-600">
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1 text-center">
            <span>Scatter</span>
            <span className="ml-2 text-sm font-normal text-slate-600 dark:text-slate-300">
              ({mappedPoints.length} points)
            </span>
          </div>
        </div>
      </div>

      <div className="mb-2 px-4 text-sm text-slate-700 dark:text-slate-300">
        <div className="px-4 pb-4 space-y-4">
          <div className="h-[520px] w-full">
            <ResponsiveContainer>
              <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 50 }}>
                <CartesianGrid />
                <XAxis
                  type="number"
                  dataKey="x"
                  tick={{ fontSize: 12 }}
                  label={{ value: xLabel, position: "bottom", offset: 12 }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  tick={{ fontSize: 12 }}
                  label={{ value: yLabel, angle: -90, position: "left" }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0]?.payload;
                    if (!p) return null;

                    const isDark =
                      typeof document !== "undefined" &&
                      document.documentElement.classList.contains("dark");
                    const tooltipStyle = {
                      background: isDark ? "rgba(15,23,42,0.94)" : "#fff",
                      color: isDark ? "#e5e7eb" : "#0f172a",
                      border: isDark ? "1px solid #334155" : "1px solid #ccc",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
                      padding: 8,
                      borderRadius: 6,
                      fontSize: 12,
                      lineHeight: 1.4,
                    };

                    return (
                      <div style={tooltipStyle}>
                        <div style={{ marginBottom: 2 }}>
                          <b>{xLabel}:</b> {p.x}
                        </div>
                        <div style={{ marginBottom: 2 }}>
                          <b>{yLabel}:</b> {p.y}
                        </div>
                        {colorKey ? (
                          <div>
                            <b>{colorLabel}:</b>{" "}
                            {Number.isFinite(p.colorValue) ? formatNumber(p.colorValue) : "n/a"}
                          </div>
                        ) : null}
                      </div>
                    );
                  }}
                />
                <Scatter
                  data={mappedPoints}
                  shape={(props) => {
                    const { cx, cy, payload } = props;
                    const faded =
                      activeBin != null && payload?.bin != null && payload.bin !== activeBin;
                    const fill = payload?.fill || "#888";
                    let opacity = 0.62;
                    if (activeBin != null) {
                      opacity = faded ? 0.22 : 1;
                    }
                    const radius = 7;
                    return (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={radius}
                        fill={fill}
                        fillOpacity={opacity}
                        stroke="none"
                      />
                    );
                  }}
                  isAnimationActive={false}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {colorKey ? (
          <div className="mt-2 p-3 border border-slate-200 rounded-md bg-slate-100 dark:bg-slate-600 dark:border-slate-900">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: 13 }}>Color by: {colorLabel}</strong>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {onToggleColorQuantize && (
                  <label style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                    <input
                      type="checkbox"
                      checked={!!colorQuantize}
                      onChange={(e) => {
                        setActiveBin(null);
                        onToggleColorQuantize(e.target.checked);
                      }}
                    />
                    Quantize
                  </label>
                )}
                {onSelectColorKey && (
                  <button
                    style={{ fontSize: 11, padding: "3px 6px" }}
                    onClick={() => {
                      setActiveBin(null);
                      onSelectColorKey("");
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            {Number.isFinite(colorMin) && Number.isFinite(colorMax) ? (
              <div className="mt-2">
                {colorLegend ? (
                  <div className="flex flex-wrap gap-2">
                    {colorLegend.map((bin, idx) => {
                      const isActive = activeBin === bin.bin;
                      return (
                        <button
                          key={idx}
                          onClick={() => setActiveBin(isActive ? null : bin.bin)}
                          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-sm transition ${isActive
                              ? "border-indigo-400 bg-indigo-500/20 text-slate-900 dark:text-slate-100"
                              : "border-slate-300 bg-white text-slate-800 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
                            }`}
                        >
                          <span
                            className="inline-block w-4 h-3 rounded border border-slate-200"
                            style={{ background: bin.color }}
                          />
                          <span>
                            {formatNumber(bin.min)} - {formatNumber(bin.max)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <>
                    <div className="h-2 rounded bg-gradient-to-r from-[hsl(220,80%,80%)] to-[hsl(220,80%,40%)]" />
                    <div className="flex justify-between text-xs mt-1 text-slate-700 dark:text-slate-200">
                      <span>{formatNumber(colorMin)}</span>
                      <span>{formatNumber(colorMax)}</span>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div style={{ marginTop: 6, fontSize: 12, color: "#666" }}>
                No numeric values for this color key.
              </div>
            )}
          </div>
        ) : null}

        <div style={{ marginTop: 16 }}>
          {correlations.length === 0 ? (
            <div style={{ fontSize: 13, color: "#666" }}>
              No correlation data (need numeric target present in scatter points).
            </div>
          ) : (
            <div className="overflow-hidden border border-slate-200 rounded-md dark:border-slate-700">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-slate-100 dark:bg-slate-700">
                  <tr>
                    <th className="text-left px-3 py-2 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                      Feature
                    </th>
                    <th className="text-right px-3 py-2 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                      Correlation value
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {correlations.map((row) => {
                    const isActive = xAxisKey === row.key;
                    const rowBg = correlationBg(row.r, isActive);
                    return (
                      <tr
                        key={row.key}
                        className="cursor-pointer"
                        style={{ background: rowBg }}
                        onClick={() => {
                          if (onSelectXAxis) onSelectXAxis(row.key);
                        }}
                      >
                        <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                          {row.label}
                        </td>
                        <td
                          className="px-3 py-2 text-right border-b border-slate-100 dark:border-slate-800"
                          style={{
                            color: correlationColor(row.r),
                            fontWeight: Math.abs(row.r) >= 0.5 ? 700 : 500,
                          }}
                        >
                          {formatNumber(row.r)}
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
    </div>
  );
}
