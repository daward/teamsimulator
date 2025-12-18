// src/components/SidebarControls.jsx
import ModeToggle from "./ModeToggle";
import PresetGroupsSelect from "./PresetGroupsSelect";
import ConfigPanel from "./ConfigPanel";
import Sweep1DControls from "./Sweep1DControls";
import Sweep2DControls from "./Sweep2DControls";

import { applyPresetGroups } from "../presets";
import { expandSweepValues, parseConfigText } from "../controllers/buildRunRequests";

export default function SidebarControls({
  app,
  sim,
  availableParams,
  availableMetricKeys,
}) {
  const updatePresetSelection = (groupId, presetId) => {
    app.setPresetSelections((prev) => ({ ...prev, [groupId]: presetId }));

    const group = app.presetGroups.find((g) => g.id === groupId);
    const preset = group?.presets.find((p) => p.id === presetId);
    if (!preset || !preset.patch || Object.keys(preset.patch).length === 0) {
      return;
    }

    // Merge patch into configText (what you were doing before)
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

    const xValues = expandSweepValues(
      app.xParam,
      app.xValuesText,
      app.presetGroups
    );
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

      <hr style={{ margin: "12px 0" }} />

      <button
        onClick={() => app.setShowConfigPanel((v) => !v)}
        style={{ fontSize: 12, padding: "4px 6px", marginBottom: 6 }}
      >
        {app.showConfigPanel ? "Hide config ▲" : "Show config ▼"}
      </button>

      {app.showConfigPanel && (
        <ConfigPanel
          configText={app.configText}
          onConfigTextChange={app.setConfigText}
        />
      )}
    </>
  );
}
