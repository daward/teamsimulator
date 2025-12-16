// src/components/BaseConfigEditor.jsx
export default function BaseConfigEditor({ configText, onChange }) {
  return (
    <>
      <h3 style={{ marginTop: 8 }}>Base Simulation Config</h3>
      <p style={{ fontSize: 12, marginTop: 0 }}>
        Used for all runs. Presets patch this config; sweeps override individual
        parameters on top.
      </p>

      <textarea
        value={configText}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          height: 200,
          fontFamily: "monospace",
          fontSize: 12,
        }}
      />
    </>
  );
}
