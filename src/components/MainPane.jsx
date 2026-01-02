// src/components/MainPane.jsx
import SweepChart1D from "./SweepChart1D";
import SweepChart2D from "./SweepChart2D";
import ScatterPlot from "./ScatterPlot";

function flattenNumeric(obj, prefix = "", out = {}) {
  if (!obj || typeof obj !== "object") return out;
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "number" && Number.isFinite(v)) {
      out[key] = v;
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      flattenNumeric(v, key, out);
    }
  }
  return out;
}

function escapeCsv(value) {
  if (value == null) return "";
  const str = String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function rowsToCsv(rows) {
  return rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
}

function downloadText(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function sanitizeFilePart(value) {
  const safe = String(value || "data").replace(/[^a-z0-9]+/gi, "_");
  return safe.replace(/^_+|_+$/g, "");
}

function buildSweep1DCsv(sweep) {
  const results = sweep?.results || [];
  const paramName = sweep?.paramName || "param";
  const statKeys = new Set();
  const rows = results.map((r) => {
    const flat = flattenNumeric(r?.stats || {});
    for (const k of Object.keys(flat)) statKeys.add(k);
    return { x: r?.x, flat };
  });
  const orderedKeys = Array.from(statKeys).sort();
  const header = [paramName, ...orderedKeys];
  const dataRows = rows.map((row) => [row.x, ...orderedKeys.map((k) => row.flat[k])]);
  return rowsToCsv([header, ...dataRows]);
}

function buildSweep2DCsv(sweep) {
  const results = sweep?.results || [];
  const xParam = sweep?.xParam || "x";
  const seriesParam = sweep?.seriesParam || "series";
  const statKeys = new Set();
  const rows = results.map((r) => {
    const flat = flattenNumeric(r?.stats || {});
    for (const k of Object.keys(flat)) statKeys.add(k);
    return { x: r?.x, series: r?.series, flat };
  });
  const orderedKeys = Array.from(statKeys).sort();
  const header = [xParam, seriesParam, ...orderedKeys];
  const dataRows = rows.map((row) => [
    row.x,
    row.series,
    ...orderedKeys.map((k) => row.flat[k]),
  ]);
  return rowsToCsv([header, ...dataRows]);
}

function buildScatterCsv(scatter) {
  const points = scatter?.points || [];
  const rows = [];
  const keys = new Set();

  for (const p of points) {
    const flat = {};
    flattenNumeric(p?.unitVars || {}, "unit", flat);
    flattenNumeric(p?.cfg || {}, "cfg", flat);
    flattenNumeric(p?.stats || {}, "stats", flat);
    for (const k of Object.keys(flat)) keys.add(k);
    rows.push(flat);
  }

  const orderedKeys = Array.from(keys).sort();
  const header = orderedKeys;
  const dataRows = rows.map((row) => orderedKeys.map((k) => row[k]));
  return rowsToCsv([header, ...dataRows]);
}

export default function MainPane({
  mode,
  running,
  error,
  result,
  sweep1DResult,
  sweep2DResult,
  scatterResult,
  metricSpec,

  scatterXAxisKey,
  scatterYAxisKey,
  scatterProgress,
  sweep2DProgress,
  onSetScatterXAxisKey,
  scatterColorKey,
  onSetScatterColorKey,
  scatterColorQuantize,
  onSetScatterColorQuantize,
  scatterUnitKeys,
  onSetScatterUnitKeys,
  plannedSweep2DRuns,
  onStop,
}) {
  const progress = sweep2DProgress || scatterProgress;
  const total = progress?.total ?? null;
  const done = progress?.done ?? 0;
  const pct = total ? Math.max(0, Math.min(100, Math.round((done / total) * 100))) : null;

  const showProgress = running || progress;
  const hasDeterminate = progress && pct != null;
  const plannedLabel =
    plannedSweep2DRuns && mode === "sweep2D" && plannedSweep2DRuns > 0
      ? ` (${plannedSweep2DRuns} planned)`
      : "";

  const exportSingleJson = () => {
    if (!result) return;
    downloadText(
      "single-run.json",
      JSON.stringify(result, null, 2),
      "application/json"
    );
  };

  const exportSweep1DJson = () => {
    if (!sweep1DResult) return;
    downloadText(
      `sweep1d-${sanitizeFilePart(sweep1DResult.paramName)}.json`,
      JSON.stringify(sweep1DResult, null, 2),
      "application/json"
    );
  };

  const exportSweep1DCsv = () => {
    if (!sweep1DResult) return;
    downloadText(
      `sweep1d-${sanitizeFilePart(sweep1DResult.paramName)}.csv`,
      buildSweep1DCsv(sweep1DResult),
      "text/csv"
    );
  };

  const exportSweep2DJson = () => {
    if (!sweep2DResult) return;
    downloadText(
      `sweep2d-${sanitizeFilePart(sweep2DResult.xParam)}-by-${sanitizeFilePart(
        sweep2DResult.seriesParam
      )}.json`,
      JSON.stringify(sweep2DResult, null, 2),
      "application/json"
    );
  };

  const exportSweep2DCsv = () => {
    if (!sweep2DResult) return;
    downloadText(
      `sweep2d-${sanitizeFilePart(sweep2DResult.xParam)}-by-${sanitizeFilePart(
        sweep2DResult.seriesParam
      )}.csv`,
      buildSweep2DCsv(sweep2DResult),
      "text/csv"
    );
  };

  const exportScatterJson = () => {
    if (!scatterResult) return;
    downloadText(
      `scatter-${sanitizeFilePart(scatterResult.n)}.json`,
      JSON.stringify(scatterResult, null, 2),
      "application/json"
    );
  };

  const exportScatterCsv = () => {
    if (!scatterResult) return;
    downloadText(
      `scatter-${sanitizeFilePart(scatterResult.n)}.csv`,
      buildScatterCsv(scatterResult),
      "text/csv"
    );
  };

  return (
    <div className="space-y-4">
      {showProgress && (
        <div className="chart-card">
          <div className="flex items-center justify-between text-sm font-semibold text-slate-900 dark:text-slate-50">
            <span>Running simulations{plannedLabel}...</span>
            <div className="flex items-center gap-2">
              {hasDeterminate && (
                <span>
                  {total ? `${done} / ${total}` : done} {pct != null ? `(${pct}%)` : ""}
                </span>
              )}
              {onStop && (
                <button
                  className="text-xs px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 border border-slate-300 dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-slate-600"
                  onClick={onStop}
                  type="button"
                >
                  Stop
                </button>
              )}
            </div>
          </div>
          <div className="mt-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            {hasDeterminate ? (
              <div
                className="h-full bg-indigo-500 transition-[width] duration-150 ease-out"
                style={{ width: `${pct || 0}%` }}
              />
            ) : (
              <div className="h-full bg-indigo-400/60 progress-indeterminate" />
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="border border-red-200 bg-red-50 text-red-800 text-sm px-3 py-2 rounded-md">
          <strong>Error:</strong> {error}
        </div>
      )}

      {mode === "single" && result && (
        <>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={exportSingleJson}>
              Export JSON
            </button>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm p-4 dark:border-slate-700 dark:bg-slate-800">
            <h2>Single Run Result</h2>
            <pre className="max-h-[500px] overflow-auto text-sm">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        </>
      )}

      {mode === "sweep1D" && sweep1DResult && (
        <>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={exportSweep1DJson}>
              Export JSON
            </button>
            <button type="button" onClick={exportSweep1DCsv}>
              Export CSV
            </button>
          </div>
          <SweepChart1D sweep={sweep1DResult} metricSpec={metricSpec} />
        </>
      )}

      {mode === "sweep2D" && sweep2DResult && (
        <>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={exportSweep2DJson}>
              Export JSON
            </button>
            <button type="button" onClick={exportSweep2DCsv}>
              Export CSV
            </button>
          </div>
          <SweepChart2D sweep={sweep2DResult} metricSpec={metricSpec} />
        </>
      )}

      {mode === "scatter" && scatterResult && (
        <>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={exportScatterJson}>
              Export JSON
            </button>
            <button type="button" onClick={exportScatterCsv}>
              Export CSV
            </button>
          </div>
          <ScatterPlot
            scatter={scatterResult}
            xAxisKey={scatterXAxisKey}
            yAxisKey={scatterYAxisKey}
            onSelectXAxis={onSetScatterXAxisKey}
            colorKey={scatterColorKey}
            onSelectColorKey={onSetScatterColorKey}
            colorQuantize={scatterColorQuantize}
            onToggleColorQuantize={onSetScatterColorQuantize}
            scatterUnitKeys={scatterUnitKeys}
            onSetScatterUnitKeys={onSetScatterUnitKeys}
          />
        </>
      )}
    </div>
  );
}
