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
    <div
      style={{
        border: "1px solid #ddd",
        padding: 8,
        borderRadius: 4,
        marginTop: 10,
        background: "#fff",
      }}
    >
      <h4 style={{ marginTop: 0 }}>Single-variable Sweep</h4>

      <div style={{ marginBottom: 8 }}>
        <label>
          Parameter name:
          <br />
          <input
            list="sweep1d-param-options"
            value={sweepParamName}
            onChange={(e) => onParamNameChange(e.target.value)}
            style={{ width: "100%" }}
          />
          <datalist id="sweep1d-param-options">
            {availableParams.map((key) => (
              <option key={key} value={key} />
            ))}
          </datalist>
        </label>
      </div>

      <div style={{ marginBottom: 8 }}>
        <label>
          Values (comma-separated):
          <br />
          <input
            value={sweepValuesText}
            onChange={(e) => onValuesTextChange(e.target.value)}
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
        {running ? "Running…" : "Run Sweep"}
      </button>
    </div>
  );
}
