// src/components/ModeToggle.jsx
export default function ModeToggle({ mode, onChange }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <button onClick={() => onChange("single")} disabled={mode === "single"}>
        Single Run
      </button>
      <button
        onClick={() => onChange("sweep1D")}
        disabled={mode === "sweep1D"}
        style={{ marginLeft: 8 }}
      >
        Sweep (1D)
      </button>
      <button
        onClick={() => onChange("sweep2D")}
        disabled={mode === "sweep2D"}
        style={{ marginLeft: 8 }}
      >
        Sweep (2D)
      </button>
    </div>
  );
}
