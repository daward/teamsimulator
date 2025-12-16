// src/components/PresetGroupsSelect.jsx
export default function PresetGroupsSelect({
  presetGroups,
  presetSelections,
  onChange,
}) {
  return (
    <>
      {presetGroups.map((group) => (
        <div key={group.id} style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 12, fontWeight: "bold" }}>
            {group.label}:
            <br />
            <select
              value={presetSelections[group.id]}
              onChange={(e) => onChange(group.id, e.target.value)}
              style={{ width: "100%", marginTop: 4 }}
            >
              {group.presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      ))}
    </>
  );
}
