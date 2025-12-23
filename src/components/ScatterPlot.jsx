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

function pearson(xs, ys) {
  const n = xs.length;
  if (n < 2) return null;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (let i = 0; i < n; i++) {
    const x = xs[i];
    const y = ys[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
    sumY2 += y * y;
  }

  const numerator = n * sumXY - sumX * sumY;
  const denomLeft = n * sumX2 - sumX * sumX;
  const denomRight = n * sumY2 - sumY * sumY;
  const denom = Math.sqrt(Math.max(denomLeft, 0) * Math.max(denomRight, 0));

  if (!Number.isFinite(denom) || denom === 0) return null;
  return numerator / denom;
}

function formatNumber(x) {
  if (!Number.isFinite(x)) return "—";
  return x.toFixed(3);
}

function correlationColor(r) {
  if (!Number.isFinite(r)) return "inherit";
  if (r >= 0.5) return "#1a7f37"; // green for strong positive
  if (r <= -0.5) return "#c62828"; // red for strong negative
  return "inherit";
}

function correlationBg(r, isActive) {
  if (!Number.isFinite(r)) return isActive ? "#eef5ff" : "transparent";

  const basePos = "rgba(26, 127, 55, 0.14)";
  const baseNeg = "rgba(198, 40, 40, 0.14)";
  const activeOverlay = "rgba(74, 144, 226, 0.18)"; // highlight for current X

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
      : "stats:workerProductivity";

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

    if (!colorQuantize) {
      const hueStart = 210; // blue
      const hueEnd = 10; // red
      const assign = (v) => {
        if (!Number.isFinite(v)) return { color: "#888", bin: null };
        const t = Math.max(0, Math.min(1, (v - colorMin) / (colorMax - colorMin)));
        const hue = hueStart + (hueEnd - hueStart) * t;
        return { color: `hsl(${hue}, 70%, 55%)`, bin: null };
      };
      return { assign, legend: null };
    }

    // Quantized into 5 buckets using quantiles
    const sorted = [...colorValues].sort((a, b) => a - b);
    const q = (p) => {
      if (!sorted.length) return NaN;
      const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
      return sorted[idx];
    };

    const thresholds = [q(0), q(0.2), q(0.4), q(0.6), q(0.8), q(1)];
    const palette = ["#1f77b4", "#5aa5b8", "#8bc18f", "#f1c04d", "#d45a3f"];

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
    <div>
      <h2 style={{ marginBottom: 8 }}>
        Scatter ({mappedPoints.length} points)
      </h2>

      <div style={{ width: "100%", height: 520 }}>
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

                return (
                  <div style={{ background: "#fff", border: "1px solid #ccc", padding: 8 }}>
                    <div>
                      <b>{xLabel}:</b> {p.x}
                    </div>
                    <div>
                      <b>{yLabel}:</b> {p.y}
                    </div>
                    {colorKey ? (
                      <div>
                        <b>{colorLabel}:</b>{" "}
                        {Number.isFinite(p.colorValue) ? formatNumber(p.colorValue) : "—"}
                      </div>
                    ) : null}
                  </div>
                );
              }}
            />
            <Scatter data={mappedPoints}>
              {mappedPoints.map((entry, idx) => {
                const faded =
                  activeBin != null && entry.bin != null && entry.bin !== activeBin;
                const fillOpacity = faded ? 0.18 : 1;
                return <Cell key={`cell-${idx}`} fill={entry.fill} fillOpacity={fillOpacity} />;
              })}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {colorKey ? (
        <div
          style={{
            marginTop: 8,
            padding: 8,
            border: "1px solid #eee",
            borderRadius: 4,
            background: "#fafafa",
          }}
        >
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
            <div style={{ marginTop: 6 }}>
              {colorLegend ? (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {colorLegend.map((bin, idx) => {
                    const isActive = activeBin === bin.bin;
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          setActiveBin(isActive ? null : bin.bin);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "4px 6px",
                          background: isActive ? "rgba(74,144,226,0.18)" : "#fff",
                          border: "1px solid #ddd",
                          borderRadius: 4,
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        <div
                          style={{
                            width: 18,
                            height: 10,
                            background: bin.color,
                            borderRadius: 3,
                            border: "1px solid #ccc",
                          }}
                        />
                        <span>
                          {formatNumber(bin.min)} – {formatNumber(bin.max)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <>
                  <div
                    style={{
                      height: 10,
                      borderRadius: 6,
                      background:
                        "linear-gradient(90deg, hsl(210,70%,55%) 0%, hsl(10,70%,55%) 100%)",
                    }}
                  />
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 12,
                      marginTop: 4,
                    }}
                  >
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
        <h3 style={{ marginBottom: 6 }}>
          Correlations (target: {targetLabel})
        </h3>
        {correlations.length === 0 ? (
          <div style={{ fontSize: 13, color: "#666" }}>
            No correlation data (need numeric target present in scatter points).
          </div>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
            }}
          >
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "4px 6px", borderBottom: "1px solid #ddd" }}>
                  Feature
                </th>
                <th style={{ textAlign: "right", padding: "4px 6px", borderBottom: "1px solid #ddd" }}>
                  r
                </th>
                <th style={{ textAlign: "right", padding: "4px 6px", borderBottom: "1px solid #ddd" }}>
                  n
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
                    style={{
                      cursor: onSelectXAxis ? "pointer" : "default",
                      background: rowBg,
                    }}
                    onClick={() => {
                      if (onSelectXAxis) onSelectXAxis(row.key);
                    }}
                  >
                    <td style={{ padding: "4px 6px", borderBottom: "1px solid #f0f0f0" }}>
                      {row.label}
                    </td>
                    <td
                      style={{
                        padding: "4px 6px",
                        textAlign: "right",
                        borderBottom: "1px solid #f0f0f0",
                        color: correlationColor(row.r),
                        fontWeight: Math.abs(row.r) >= 0.5 ? 600 : 400,
                      }}
                    >
                      {formatNumber(row.r)}
                    </td>
                    <td style={{ padding: "4px 6px", textAlign: "right", borderBottom: "1px solid #f0f0f0" }}>
                      {row.n}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
