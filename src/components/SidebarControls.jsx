// src/components/SidebarControls.jsx
import ModeToggle from "./ModeToggle";
import PresetGroupsSelect from "./PresetGroupsSelect";
import ConfigPanel from "./ConfigPanel";
import Sweep1DControls from "./Sweep1DControls";
import Sweep2DControls from "./Sweep2DControls";

import { applyPresetGroups } from "../presets";
import { expandSweepValues, parseConfigText } from "../controllers/buildRunRequests";

import sweepConfig from "../config/sweep-config.json";

function buildScatterAxisOptions(availableMetricKeys) {
  const unitMappings = sweepConfig?.unitMappings || {};
  const unitKeys = Object.keys(unitMappings);

  const cfgTargets = Array.from(
    new Set(Object.values(unitMappings).map((d) => d?.target).filter(Boolean))
  );

  const statsOptions = (availableMetricKeys || []).map((k) => ({
    value: `stats:${k}`,
    label: k,
  }));

  const unitOptions = unitKeys.map((k) => ({
    value: `unit:${k}`,
    label: k,
  }));

  const cfgOptions = cfgTargets.map((k) => ({
    value: `cfg:${k}`,
    label: k,
  }));

  return { statsOptions, unitOptions, cfgOptions };
}

export default function SidebarControls({
  app,
  sim,
  availableParams,
  availableMetricKeys,
}) {
  const { statsOptions, unitOptions, cfgOptions } =
    buildScatterAxisOptions(availableMetricKeys);
  const unitMappings = sweepConfig?.unitMappings || {};
  const unitKeys = Object.keys(unitMappings);

  const updatePresetSelection = (groupId, presetId) => {
    app.setPresetSelections((prev) => ({ ...prev, [groupId]: presetId }));

    const group = app.presetGroups.find((g) => g.id === groupId);
    const preset = group?.presets.find((p) => p.id === presetId);
    if (!preset || !preset.patch || Object.keys(preset.patch).length === 0) return;

    const current = parseConfigText(app.configText, {});
    const merged = { ...current, ...preset.patch };
    app.setConfigText(JSON.stringify(merged, null, 2));
  };

  const handleRunSingle = () => {
    const rawCfg = parseConfigText(app.configText, {});
    sim.runSingle(rawCfg, app.presetSelections);
  };

  const handleRunSweep1D = () => {
    const rawCfg = parseConfigText(app.configText, {});
    const baseCfg = applyPresetGroups(rawCfg, app.presetSelections);

    const values = expandSweepValues(
      app.sweepParamName,
      app.sweepValuesText,
      app.presetGroups
    );

    if (!app.sweepParamName || values.length === 0) {
      alert("Provide a parameter name and at least one value.");
      return;
    }

    sim.runSweep1D({
      baseConfig: baseCfg,
      presetSelections: app.presetSelections,
      paramName: app.sweepParamName,
      values,
    });
  };

  const handleRunSweep2D = () => {
    const rawCfg = parseConfigText(app.configText, {});
    const baseCfg = applyPresetGroups(rawCfg, app.presetSelections);

    const xValues = expandSweepValues(app.xParam, app.xValuesText, app.presetGroups);
    const seriesValues = expandSweepValues(
      app.seriesParam,
      app.seriesValuesText,
      app.presetGroups
    );

    if (!app.xParam || xValues.length === 0) {
      alert("Provide x param and at least one x value.");
      return;
    }
    if (!app.seriesParam || seriesValues.length === 0) {
      alert("Provide series param and at least one series value.");
      return;
    }

    sim.runSweep2D({
      baseConfig: baseCfg,
      presetSelections: app.presetSelections,
      xParam: app.xParam,
      xValues,
      seriesParam: app.seriesParam,
      seriesValues,
    });
  };

  const handleRunScatter = () => {
    const rawCfg = parseConfigText(app.configText, {});
    const baseCfg = applyPresetGroups(rawCfg, app.presetSelections);

    sim.runScatter({
      baseConfig: baseCfg,
      presetSelections: app.presetSelections,
      nOverride: app.scatterN,
      unitKeys: app.scatterUnitKeys,
    });
  };

  return (
    <>
      <ModeToggle mode={app.mode} onChange={app.setMode} />

      <PresetGroupsSelect
        presetGroups={app.presetGroups}
        presetSelections={app.presetSelections}
        onChange={updatePresetSelection}
      />

      {app.mode === "single" && (
        <div
          style={{
            border: "1px solid #ddd",
            padding: 8,
            borderRadius: 4,
            marginTop: 10,
            background: "#fff",
          }}
        >
          <h4 style={{ marginTop: 0 }}>Single run</h4>
          <button onClick={handleRunSingle} disabled={sim.running}>
            {sim.running ? "Running…" : "Run Simulation"}
          </button>
        </div>
      )}

      {app.mode === "sweep1D" && (
        <Sweep1DControls
          sweepParamName={app.sweepParamName}
          sweepValuesText={app.sweepValuesText}
          running={sim.running}
          onParamNameChange={app.setSweepParamName}
          onValuesTextChange={app.setSweepValuesText}
          onRun={handleRunSweep1D}
          availableParams={availableParams}
          availableMetricKeys={availableMetricKeys}
          metricMode={app.metricMode}
          onMetricModeChange={app.setMetricMode}
          metricKey={app.metricKey}
          onMetricKeyChange={app.setMetricKey}
          ratioNumeratorKey={app.ratioNumeratorKey}
          onRatioNumeratorKeyChange={app.setRatioNumeratorKey}
          ratioDenominatorKey={app.ratioDenominatorKey}
          onRatioDenominatorKeyChange={app.setRatioDenominatorKey}
        />
      )}

      {app.mode === "sweep2D" && (
        <Sweep2DControls
          xParam={app.xParam}
          xValuesText={app.xValuesText}
          seriesParam={app.seriesParam}
          seriesValuesText={app.seriesValuesText}
          running={sim.running}
          onXParamChange={app.setXParam}
          onXValuesTextChange={app.setXValuesText}
          onSeriesParamChange={app.setSeriesParam}
          onSeriesValuesTextChange={app.setSeriesValuesText}
          onRun={handleRunSweep2D}
          availableParams={availableParams}
          availableMetricKeys={availableMetricKeys}
          metricMode={app.metricMode}
          onMetricModeChange={app.setMetricMode}
          metricKey={app.metricKey}
          onMetricKeyChange={app.setMetricKey}
          ratioNumeratorKey={app.ratioNumeratorKey}
          onRatioNumeratorKeyChange={app.setRatioNumeratorKey}
          ratioDenominatorKey={app.ratioDenominatorKey}
          onRatioDenominatorKeyChange={app.setRatioDenominatorKey}
        />
      )}

      {app.mode === "scatter" && (
        <div
          style={{
            border: "1px solid #ddd",
            padding: 8,
            borderRadius: 4,
            marginTop: 10,
            background: "#fff",
          }}
        >
          <h4 style={{ marginTop: 0 }}>Scatter (unit-random)</h4>

          <label style={{ display: "block", marginBottom: 6 }}>
            Points (n)
            <input
              type="number"
              value={app.scatterN}
              min={1}
              step={1}
              onChange={(e) => app.setScatterN(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </label>

          <label style={{ display: "block", marginBottom: 6 }}>
            X axis
            <select
              value={app.scatterXAxisKey}
              onChange={(e) => app.setScatterXAxisKey(e.target.value)}
              style={{ width: "100%" }}
            >
              <optgroup label="Stats (outputs)">
                {statsOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </optgroup>

              <optgroup label="Unit vars (0..1)">
                {unitOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </optgroup>

              <optgroup label="Config targets (mapped)">
                {cfgOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>

          <label style={{ display: "block", marginBottom: 6 }}>
            Y axis
            <select
              value={app.scatterYAxisKey}
              onChange={(e) => app.setScatterYAxisKey(e.target.value)}
              style={{ width: "100%" }}
            >
              <optgroup label="Stats (outputs)">
                {statsOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </optgroup>

              <optgroup label="Unit vars (0..1)">
                {unitOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </optgroup>

              <optgroup label="Config targets (mapped)">
                {cfgOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>

          <label style={{ display: "block", marginBottom: 6 }}>
            Color by
            <select
              value={app.scatterColorKey}
              onChange={(e) => app.setScatterColorKey(e.target.value)}
              style={{ width: "100%" }}
            >
              <option value="">None</option>

              <optgroup label="Stats (outputs)">
                {statsOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </optgroup>

              <optgroup label="Unit vars (0..1)">
                {unitOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </optgroup>

              <optgroup label="Config targets (mapped)">
                {cfgOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>

          <label style={{ display: "block", marginBottom: 6, fontSize: 12 }}>
            <input
              type="checkbox"
              checked={app.scatterColorQuantize}
              onChange={(e) => app.setScatterColorQuantize(e.target.checked)}
              style={{ marginRight: 6 }}
            />
            Quantize color (5 buckets)
          </label>

          <div
            style={{
              marginTop: 8,
              padding: 8,
              border: "1px solid #eee",
              borderRadius: 4,
              background: "#fafafa",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: 12 }}>Vary unit variables</strong>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  style={{ fontSize: 11, padding: "2px 6px" }}
                  onClick={() => app.setScatterUnitKeys(unitKeys)}
                >
                  All
                </button>
                <button
                  type="button"
                  style={{ fontSize: 11, padding: "2px 6px" }}
                  onClick={() => app.setScatterUnitKeys([])}
                >
                  None (fix mid)
                </button>
              </div>
            </div>
            <p style={{ margin: "4px 0 6px", fontSize: 11, color: "#555" }}>
              Only checked unit vars are randomized; unchecked stay at the base/preset config values.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 6 }}>
              {unitKeys.map((k) => {
                const checked =
                  !Array.isArray(app.scatterUnitKeys) ||
                  app.scatterUnitKeys.length === 0 ||
                  app.scatterUnitKeys.includes(k);
                return (
                  <label key={k} style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = new Set(app.scatterUnitKeys || unitKeys);
                        if (e.target.checked) {
                          next.add(k);
                        } else {
                          next.delete(k);
                        }
                        app.setScatterUnitKeys(Array.from(next));
                      }}
                    />
                    {k}
                  </label>
                );
              })}
            </div>
          </div>

          <button onClick={handleRunScatter} disabled={sim.running}>
            {sim.running ? "Running…" : "Run Scatter"}
          </button>

          <p style={{ fontSize: 12, marginTop: 8, opacity: 0.8 }}>
            Tip: after you run once, you can change X/Y without re-running.
          </p>
        </div>
      )}

      <hr style={{ margin: "12px 0" }} />

      <button
        onClick={() => app.setShowConfigPanel((v) => !v)}
        style={{ fontSize: 12, padding: "4px 6px", marginBottom: 6 }}
      >
        {app.showConfigPanel ? "Hide config ▲" : "Show config ▼"}
      </button>

      {app.showConfigPanel && (
        <ConfigPanel configText={app.configText} onConfigTextChange={app.setConfigText} />
      )}
    </>
  );
}
