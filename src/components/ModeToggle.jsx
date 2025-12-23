// src/components/ModeToggle.jsx
export default function ModeToggle({ mode, onChange }) {
  const modes = [
    { id: "single", label: "Single" },
    { id: "sweep1D", label: "Sweep 1D" },
    { id: "sweep2D", label: "Sweep 2D" },
    { id: "scatter", label: "Scatter" },
  ];

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        flexWrap: "wrap",
        marginBottom: 10,
      }}
    >
      {modes.map((m) => {
        const active = mode === m.id;
        return (
          <button
            key={m.id}
            onClick={() => onChange(m.id)}
            type="button"
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid #ccc",
              background: active ? "#111" : "#fff",
              color: active ? "#fff" : "#111",
              fontWeight: active ? 700 : 500,
              cursor: "pointer",
              lineHeight: 1.2,
            }}
            aria-pressed={active}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
