export default function Sweep1DControls({
  sweepParamName,
  sweepValuesText,
  running,
  onParamNameChange,
  onValuesTextChange,
  onRun,
  availableParams = [],
  availableMetricKeys = [],

  metricMode,
  onMetricModeChange,
  metricKey,
  onMetricKeyChange,
  ratioNumeratorKey,
  onRatioNumeratorKeyChange,
  ratioDenominatorKey,
  onRatioDenominatorKeyChange,
}) {
  return (
    <div className="border border-slate-200 rounded-md bg-white p-3 space-y-3 shadow-sm">
      <h4 className="text-base font-semibold text-slate-900">Single-variable Sweep</h4>

      <div className="space-y-1 text-sm">
        <label className="font-medium text-slate-700">Parameter name</label>
        <input
          list="sweep1d-param-options"
          value={sweepParamName}
          onChange={(e) => onParamNameChange(e.target.value)}
          className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        <datalist id="sweep1d-param-options">
          {availableParams.map((key) => (
            <option key={key} value={key} />
          ))}
        </datalist>
      </div>

      <div className="space-y-1 text-sm">
        <label className="font-medium text-slate-700">Values (comma-separated)</label>
        <input
          value={sweepValuesText}
          onChange={(e) => onValuesTextChange(e.target.value)}
          className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      <div className="space-y-1 text-sm">
        <label className="font-medium text-slate-700">Y mode</label>
        <select
          value={metricMode}
          onChange={(e) => onMetricModeChange(e.target.value)}
          disabled={availableMetricKeys.length === 0}
          className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100"
        >
          <option value="single">Single metric</option>
          <option value="ratio">Ratio (A / B)</option>
        </select>
      </div>

      {metricMode === "single" ? (
        <div className="space-y-1 text-sm">
          <label className="font-medium text-slate-700">Metric (from stats)</label>
          <select
            value={metricKey}
            onChange={(e) => onMetricKeyChange(e.target.value)}
            disabled={availableMetricKeys.length === 0}
            className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100"
          >
            {availableMetricKeys.length === 0 ? (
              <option value={metricKey}>(run sweep to load metrics)</option>
            ) : (
              availableMetricKeys.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))
            )}
          </select>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1 text-sm">
            <label className="font-medium text-slate-700">Numerator (A)</label>
            <select
              value={ratioNumeratorKey}
              onChange={(e) => onRatioNumeratorKeyChange(e.target.value)}
              disabled={availableMetricKeys.length === 0}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100"
            >
              {availableMetricKeys.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1 text-sm">
            <label className="font-medium text-slate-700">Denominator (B)</label>
            <select
              value={ratioDenominatorKey}
              onChange={(e) => onRatioDenominatorKeyChange(e.target.value)}
              disabled={availableMetricKeys.length === 0}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100"
            >
              {availableMetricKeys.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <button onClick={onRun} disabled={running} className="w-full">
        {running ? "Running…" : "Run Sweep"}
      </button>
    </div>
  );
}
