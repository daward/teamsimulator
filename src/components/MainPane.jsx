// src/components/MainPane.jsx
import SweepChart1D from "./SweepChart1D";
import SweepChart2D from "./SweepChart2D";
import ScatterPlot from "./ScatterPlot";

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
  onSetScatterXAxisKey,
  scatterColorKey,
  onSetScatterColorKey,
  scatterColorQuantize,
  onSetScatterColorQuantize,
  scatterUnitKeys,
  onSetScatterUnitKeys,
}) {
  const total = scatterProgress?.total ?? null;
  const done = scatterProgress?.done ?? 0;
  const pct = total ? Math.max(0, Math.min(100, Math.round((done / total) * 100))) : null;

  const showProgress = running || scatterProgress;
  const hasDeterminate = scatterProgress && pct != null;

  return (
    <div className="space-y-4">
      {showProgress && (
        <div className="chart-card">
          <div className="flex items-center justify-between text-sm text-slate-700">
            <span>Running simulations…</span>
            {hasDeterminate && (
              <span>
                {total ? `${done} / ${total}` : done} {pct != null ? `(${pct}%)` : ""}
              </span>
            )}
          </div>
          <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden">
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
        <div className="chart-card">
          <h2>Single Run Result</h2>
          <pre className="bg-slate-50 border border-slate-200 rounded p-3 max-h-[500px] overflow-auto text-sm">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}

      {mode === "sweep1D" && sweep1DResult && (
        <div className="chart-card">
          <SweepChart1D sweep={sweep1DResult} metricSpec={metricSpec} />
        </div>
      )}

      {mode === "sweep2D" && sweep2DResult && (
        <div className="chart-card">
          <SweepChart2D sweep={sweep2DResult} metricSpec={metricSpec} />
        </div>
      )}

      {mode === "scatter" && scatterResult && (
        <div className="chart-card">
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
        </div>
      )}
    </div>
  );
}
