// src/components/MainPane.jsx
import SweepChart1D from "./SweepChart1D";
import SweepChart2D from "./SweepChart2D";

export default function MainPane({
  mode,
  running,
  error,
  result,
  sweep1DResult,
  sweep2DResult,
  metricSpec,
}) {
  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Simulation UI</h1>

      {running && <p style={{ marginTop: 0 }}>Simulation running…</p>}

      {error && (
        <div style={{ marginTop: 8, color: "red" }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {mode === "single" && result && (
        <div style={{ marginTop: 16 }}>
          <h2>Single Run Result</h2>
          <pre
            style={{
              background: "#f5f5f5",
              padding: 10,
              borderRadius: 4,
              maxHeight: 500,
              overflow: "auto",
            }}
          >
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}

      {mode === "sweep1D" && sweep1DResult && (
        <div style={{ marginTop: 16 }}>
          <SweepChart1D sweep={sweep1DResult} metricSpec={metricSpec} />
        </div>
      )}

      {mode === "sweep2D" && sweep2DResult && (
        <div style={{ marginTop: 16 }}>
          <SweepChart2D sweep={sweep2DResult} metricSpec={metricSpec} />
        </div>
      )}
    </div>
  );
}
