export default function Sweep2DControls({
  xParam,
  xValuesText,
  seriesParam,
  seriesValuesText,
  running,
  onXParamChange,
  onXValuesTextChange,
  onSeriesParamChange,
  onSeriesValuesTextChange,
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
    <div
      style={{
        border: "1px solid #ddd",
        padding: 8,
        borderRadius: 4,
        marginTop: 10,
        background: "#fff",
      }}
    >
      <h4 style={{ marginTop: 0 }}>Two-variable Sweep</h4>

      <div style={{ marginBottom: 8 }}>
        <label>
          X param (x-axis):
          <br />
          <input
            list="sweep2d-xparam-options"
            value={xParam}
            onChange={(e) => onXParamChange(e.target.value)}
            style={{ width: "100%" }}
          />
          <datalist id="sweep2d-xparam-options">
            {availableParams.map((key) => (
              <option key={key} value={key} />
            ))}
          </datalist>
        </label>
      </div>

      <div style={{ marginBottom: 8 }}>
        <label>
          X values (comma-separated):
          <br />
          <input
            value={xValuesText}
            onChange={(e) => onXValuesTextChange(e.target.value)}
            style={{ width: "100%" }}
          />
        </label>
      </div>

      <div style={{ marginBottom: 8 }}>
        <label>
          Series param:
          <br />
          <input
            list="sweep2d-seriesparam-options"
            value={seriesParam}
            onChange={(e) => onSeriesParamChange(e.target.value)}
            style={{ width: "100%" }}
          />
          <datalist id="sweep2d-seriesparam-options">
            {availableParams.map((key) => (
              <option key={key} value={key} />
            ))}
          </datalist>
        </label>
      </div>

      <div style={{ marginBottom: 8 }}>
        <label>
          Series values (comma-separated):
          <br />
          <input
            value={seriesValuesText}
            onChange={(e) => onSeriesValuesTextChange(e.target.value)}
            style={{ width: "100%" }}
          />
        </label>
      </div>

      <div style={{ marginBottom: 8 }}>
        <label>
          Y mode:
          <br />
          <select
            value={metricMode}
            onChange={(e) => onMetricModeChange(e.target.value)}
            style={{ width: "100%" }}
            disabled={availableMetricKeys.length === 0}
          >
            <option value="single">Single metric</option>
            <option value="ratio">Ratio (A / B)</option>
          </select>
        </label>
      </div>

      {metricMode === "single" ? (
        <div style={{ marginBottom: 8 }}>
          <label>
            Metric (from stats):
            <br />
            <select
              value={metricKey}
              onChange={(e) => onMetricKeyChange(e.target.value)}
              style={{ width: "100%" }}
              disabled={availableMetricKeys.length === 0}
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
          </label>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 8 }}>
            <label>
              Numerator (A):
              <br />
              <select
                value={ratioNumeratorKey}
                onChange={(e) => onRatioNumeratorKeyChange(e.target.value)}
                style={{ width: "100%" }}
                disabled={availableMetricKeys.length === 0}
              >
                {availableMetricKeys.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ marginBottom: 8 }}>
            <label>
              Denominator (B):
              <br />
              <select
                value={ratioDenominatorKey}
                onChange={(e) => onRatioDenominatorKeyChange(e.target.value)}
                style={{ width: "100%" }}
                disabled={availableMetricKeys.length === 0}
              >
                {availableMetricKeys.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </>
      )}

      <button onClick={onRun} disabled={running}>
        {running ? "Running…" : "Run 2D Sweep"}
      </button>
    </div>
  );
}
