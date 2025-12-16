import { useState, useMemo, useEffect } from "react";
import baseConfig from "./config/baseConfig.json";
import { useSimulation } from "./hooks/useSimulation";
import SweepChart1D from "./components/SweepChart1D";
import SweepChart2D from "./components/SweepChart2D";
import { presetGroups, applyPresetGroups } from "./presets";

import ModeToggle from "./components/ModeToggle";
import PresetGroupsSelect from "./components/PresetGroupsSelect";
import ConfigPanel from "./components/ConfigPanel";
import Sweep1DControls from "./components/Sweep1DControls";
import Sweep2DControls from "./components/Sweep2DControls";

export default function App() {
  const [configText, setConfigText] = useState(
    JSON.stringify(baseConfig, null, 2)
  );

  const [mode, setMode] = useState("single"); // "single" | "sweep1D" | "sweep2D"

  // 1D sweep controls
  const [sweepParamName, setSweepParamName] = useState("askProb");
  const [sweepValuesText, setSweepValuesText] = useState(
    "0,0.1,0.2,0.3,0.5,0.7,0.9"
  );

  // 2D sweep controls
  const [xParam, setXParam] = useState("askProb");
  const [xValuesText, setXValuesText] = useState(
    "0,0.1,0.2,0.3,0.5,0.7,0.9"
  );
  const [seriesParam, setSeriesParam] = useState("numTaskTypes");
  const [seriesValuesText, setSeriesValuesText] = useState("3,5,8");

  // ✅ metric selection (single or ratio) — display only
  const [metricMode, setMetricMode] = useState("single"); // "single" | "ratio"
  const [metricKey, setMetricKey] = useState(
    "averageCumulativeValuePerCyclePerWorker"
  );
  const [ratioNumeratorKey, setRatioNumeratorKey] = useState(
    "averageCumulativeValuePerCyclePerWorker"
  );
  const [ratioDenominatorKey, setRatioDenominatorKey] = useState("numWorkers");

  const {
    result,
    sweep1DResult,
    sweep2DResult,
    error,
    running,
    runSingle,
    runSweep1D,
    runSweep2D,
  } = useSimulation();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showConfigPanel, setShowConfigPanel] = useState(false);

  // preset selections: { [groupId]: presetId }
  const [presetSelections, setPresetSelections] = useState(() => {
    const obj = {};
    for (const g of presetGroups) {
      obj[g.id] = g.presets[0]?.id || null;
    }
    return obj;
  });

  const updatePresetSelection = (groupId, presetId) => {
    setPresetSelections((prev) => ({ ...prev, [groupId]: presetId }));

    const group = presetGroups.find((g) => g.id === groupId);
    const preset = group?.presets.find((p) => p.id === presetId);
    if (!preset || !preset.patch || Object.keys(preset.patch).length === 0) {
      return;
    }

    let current;
    try {
      current = JSON.parse(configText);
    } catch {
      current = baseConfig;
    }

    const merged = { ...current, ...preset.patch };
    setConfigText(JSON.stringify(merged, null, 2));
  };

  const parseBaseConfig = () => {
    try {
      const raw = JSON.parse(configText);
      return applyPresetGroups(raw, presetSelections);
    } catch (err) {
      console.error(err);
      alert("❌ Invalid JSON in base config");
      return null;
    }
  };

  // Available sweep param names = config keys + preset:<group>
  const availableParams = useMemo(() => {
    try {
      const parsed = JSON.parse(configText);
      const configKeys = Object.keys(parsed || {});
      const presetKeys = presetGroups.map((g) => `preset:${g.id}`);
      return Array.from(new Set([...configKeys, ...presetKeys])).sort();
    } catch {
      return presetGroups.map((g) => `preset:${g.id}`).sort();
    }
  }, [configText]);

  const expandPresetValues = (paramName, rawValuesText) => {
    const parts = rawValuesText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (
      parts.length === 1 &&
      parts[0] === "*" &&
      paramName.startsWith("preset:")
    ) {
      const groupId = paramName.slice("preset:".length);
      const group = presetGroups.find((g) => g.id === groupId);
      if (!group) return [];
      return group.presets
        .filter((p) => p.patch && Object.keys(p.patch).length > 0)
        .map((p) => p.id);
    }

    return parts;
  };

  // ✅ Metric options: scan *all* sweep points; numeric-only
  const availableMetricKeys = useMemo(() => {
    const statsList =
      mode === "sweep1D"
        ? (sweep1DResult?.results || []).map((r) => r.stats).filter(Boolean)
        : mode === "sweep2D"
        ? (sweep2DResult?.results || []).map((r) => r.stats).filter(Boolean)
        : [];

    if (statsList.length === 0) return [];

    const keys = new Set();
    for (const s of statsList) {
      for (const k of Object.keys(s)) {
        const v = s[k];
        if (typeof v === "number" && Number.isFinite(v)) keys.add(k);
      }
    }
    return Array.from(keys).sort();
  }, [mode, sweep1DResult, sweep2DResult]);

  // keep selections valid once metrics are known
  useEffect(() => {
    if (availableMetricKeys.length === 0) return;

    if (!availableMetricKeys.includes(metricKey)) {
      setMetricKey(availableMetricKeys[0]);
    }
    if (!availableMetricKeys.includes(ratioNumeratorKey)) {
      setRatioNumeratorKey(availableMetricKeys[0]);
    }
    if (!availableMetricKeys.includes(ratioDenominatorKey)) {
      // pick something different if possible
      const alt =
        availableMetricKeys.find((k) => k !== ratioNumeratorKey) ||
        availableMetricKeys[0];
      setRatioDenominatorKey(alt);
    }
  }, [
    availableMetricKeys,
    metricKey,
    ratioNumeratorKey,
    ratioDenominatorKey,
  ]);

  const derivedMetricSpec = useMemo(() => {
    if (metricMode === "single") {
      return { mode: "single", key: metricKey };
    }
    return {
      mode: "ratio",
      numeratorKey: ratioNumeratorKey,
      denominatorKey: ratioDenominatorKey,
    };
  }, [metricMode, metricKey, ratioNumeratorKey, ratioDenominatorKey]);

  const handleRunSingle = () => {
    let cfg;
    try {
      cfg = JSON.parse(configText);
    } catch {
      alert("❌ Invalid JSON in base config");
      return;
    }
    runSingle(cfg, presetSelections);
  };

  const handleRunSweep1D = () => {
    const cfg = parseBaseConfig();
    if (!cfg) return;

    const values = expandPresetValues(sweepParamName, sweepValuesText);
    if (!sweepParamName || values.length === 0) {
      alert("Provide a parameter name and at least one value.");
      return;
    }

    runSweep1D({
      baseConfig: cfg,
      presetSelections,
      paramName: sweepParamName,
      values,
    });
  };

  const handleRunSweep2D = () => {
    const cfg = parseBaseConfig();
    if (!cfg) return;

    const xValues = expandPresetValues(xParam, xValuesText);
    const seriesValues = expandPresetValues(seriesParam, seriesValuesText);

    if (!xParam || xValues.length === 0) {
      alert("Provide x param and at least one x value.");
      return;
    }
    if (!seriesParam || seriesValues.length === 0) {
      alert("Provide series param and at least one series value.");
      return;
    }

    runSweep2D({
      baseConfig: cfg,
      presetSelections,
      xParam,
      xValues,
      seriesParam,
      seriesValues,
    });
  };

  return (
    <div
      style={{
        fontFamily: "system-ui",
        height: "100vh",
        display: "flex",
        overflow: "hidden",
      }}
    >
      {/* Sidebar / drawer */}
      <div
        style={{
          width: sidebarOpen ? 380 : 40,
          transition: "width 0.2s ease",
          borderRight: "1px solid #ddd",
          background: "#fafafa",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "6px 8px",
            borderBottom: "1px solid #ddd",
            display: "flex",
            alignItems: "center",
            justifyContent: sidebarOpen ? "space-between" : "center",
          }}
        >
          {sidebarOpen && <strong>Controls</strong>}
          <button
            onClick={() => setSidebarOpen((open) => !open)}
            style={{ fontSize: 12, padding: "2px 6px" }}
          >
            {sidebarOpen ? "⟨" : "⟩"}
          </button>
        </div>

        {sidebarOpen && (
          <div style={{ padding: 10, overflowY: "auto", flex: 1 }}>
            <ModeToggle mode={mode} onChange={setMode} />

            <PresetGroupsSelect
              presetGroups={presetGroups}
              presetSelections={presetSelections}
              onChange={updatePresetSelection}
            />

            {mode === "single" && (
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
                <button onClick={handleRunSingle} disabled={running}>
                  {running ? "Running…" : "Run Simulation"}
                </button>
              </div>
            )}

            {mode === "sweep1D" && (
              <Sweep1DControls
                sweepParamName={sweepParamName}
                sweepValuesText={sweepValuesText}
                running={running}
                onParamNameChange={setSweepParamName}
                onValuesTextChange={setSweepValuesText}
                onRun={handleRunSweep1D}
                availableParams={availableParams}
                availableMetricKeys={availableMetricKeys}
                metricMode={metricMode}
                onMetricModeChange={setMetricMode}
                metricKey={metricKey}
                onMetricKeyChange={setMetricKey}
                ratioNumeratorKey={ratioNumeratorKey}
                onRatioNumeratorKeyChange={setRatioNumeratorKey}
                ratioDenominatorKey={ratioDenominatorKey}
                onRatioDenominatorKeyChange={setRatioDenominatorKey}
              />
            )}

            {mode === "sweep2D" && (
              <Sweep2DControls
                xParam={xParam}
                xValuesText={xValuesText}
                seriesParam={seriesParam}
                seriesValuesText={seriesValuesText}
                running={running}
                onXParamChange={setXParam}
                onXValuesTextChange={setXValuesText}
                onSeriesParamChange={setSeriesParam}
                onSeriesValuesTextChange={setSeriesValuesText}
                onRun={handleRunSweep2D}
                availableParams={availableParams}
                availableMetricKeys={availableMetricKeys}
                metricMode={metricMode}
                onMetricModeChange={setMetricMode}
                metricKey={metricKey}
                onMetricKeyChange={setMetricKey}
                ratioNumeratorKey={ratioNumeratorKey}
                onRatioNumeratorKeyChange={setRatioNumeratorKey}
                ratioDenominatorKey={ratioDenominatorKey}
                onRatioDenominatorKeyChange={setRatioDenominatorKey}
              />
            )}

            <hr style={{ margin: "12px 0" }} />

            <button
              onClick={() => setShowConfigPanel((v) => !v)}
              style={{ fontSize: 12, padding: "4px 6px", marginBottom: 6 }}
            >
              {showConfigPanel ? "Hide config ▲" : "Show config ▼"}
            </button>

            {showConfigPanel && (
              <ConfigPanel
                configText={configText}
                onConfigTextChange={setConfigText}
              />
            )}
          </div>
        )}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, padding: 16, overflowY: "auto" }}>
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
            <SweepChart1D sweep={sweep1DResult} metricSpec={derivedMetricSpec} />
          </div>
        )}

        {mode === "sweep2D" && sweep2DResult && (
          <div style={{ marginTop: 16 }}>
            <SweepChart2D sweep={sweep2DResult} metricSpec={derivedMetricSpec} />
          </div>
        )}
      </div>
    </div>
  );
}
