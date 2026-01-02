// src/components/SidebarControls.jsx
import ModeToggle from "./ModeToggle";
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

  const cfgExtras = [
    "behavior.askMinimumGain",
    "behavior.askProbability",
    "behavior.completionLearningRate",
    "behavior.conversationLearningRate",
    "turnover.hireMode",
    "turnover.probability",
    "turnover.hireAvgFactor",
    "turnover.specialistBoost",
    "simulation.numCycles",
    "simulation.burnInCycles",
    "productOwner.errorProbability",
    "productOwner.windowSize",
    "productOwner.actionsPerCycle",
    "backlog.maxSize",
    "backlog.initialSize",
  ];

  const statsOptions = (availableMetricKeys || []).map((k) => ({
    value: `stats:${k}`,
    label: k,
  }));

  const unitOptions = unitKeys.map((k) => ({
    value: `unit:${k}`,
    label: k,
  }));

  const cfgOptions = Array.from(new Set([...cfgTargets, ...cfgExtras])).map((k) => ({
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

    // Deep-merge the currently selected presets onto the current config text
    const current = parseConfigText(app.configText, {});
    const merged = applyPresetGroups(current, { ...app.presetSelections, [groupId]: presetId });
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

      {app.mode === "single" && (
        <div className="form-panel">
          <h4 className="panel-title">Single run</h4>
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
        <div className="form-panel">
          <h4 className="panel-title">Scatter (unit-random)</h4>

          <div className="space-y-1 text-sm">
            <label>Points (n)</label>
            <input
              type="number"
              value={app.scatterN}
              min={1}
              step={1}
              onChange={(e) => app.setScatterN(Number(e.target.value))}
              className="input-field"
            />
          </div>

          <div className="space-y-1 text-sm">
            <label>X axis</label>
            <select
              value={app.scatterXAxisKey}
              onChange={(e) => app.setScatterXAxisKey(e.target.value)}
              className="select-field"
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
          </div>

          <div className="space-y-1 text-sm">
            <label>Y axis</label>
            <select
              value={app.scatterYAxisKey}
              onChange={(e) => app.setScatterYAxisKey(e.target.value)}
              className="select-field"
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
          </div>

          <div className="space-y-1 text-sm">
            <label>Color by</label>
            <select
              value={app.scatterColorKey}
              onChange={(e) => app.setScatterColorKey(e.target.value)}
              className="select-field"
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
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={app.scatterColorQuantize}
              onChange={(e) => app.setScatterColorQuantize(e.target.checked)}
            />
            Quantize color (5 buckets)
          </label>

          <div className="nested-panel">
            <div className="flex items-center justify-between">
              <strong className="text-xs text-slate-700 dark:text-slate-200">
                Vary unit variables
              </strong>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-xs px-2 py-1"
                  onClick={() => app.setScatterUnitKeys(unitKeys)}
                >
                  All
                </button>
                <button
                  type="button"
                  className="text-xs px-2 py-1"
                  onClick={() => app.setScatterUnitKeys([])}
                >
                  None (fix mid)
                </button>
              </div>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 m-0">
              Only checked unit vars are randomized; unchecked stay at the base/preset config values.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {unitKeys.map((k) => {
                const checked =
                  !Array.isArray(app.scatterUnitKeys) ||
                  app.scatterUnitKeys.length === 0 ||
                  app.scatterUnitKeys.includes(k);
                return (
                  <label key={k} className="text-xs flex items-center gap-2 text-slate-700 dark:text-slate-200">
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

          <p className="text-xs text-slate-600 dark:text-slate-300 m-0">
            Tip: after you run once, you can change X/Y without re-running.
          </p>
        </div>
      )}      <hr style={{ margin: "12px 0" }} />

      <ConfigPanel
        configText={app.configText}
        onConfigTextChange={app.setConfigText}
        presetGroups={app.presetGroups}
        presetSelections={app.presetSelections}
        onPresetChange={updatePresetSelection}
      />
    </>
  );
}
