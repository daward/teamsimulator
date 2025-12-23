// src/hooks/useAppState.js
import { useCallback, useMemo, useState } from "react";
import { presetGroups as presetGroupsImport } from "../presets";

export function useAppState(baseConfig) {
  const presetGroups = presetGroupsImport;

  const [configText, setConfigText] = useState(JSON.stringify(baseConfig, null, 2));

  const [mode, setMode] = useState("single"); // "single" | "sweep1D" | "sweep2D" | "scatter"

  // 1D sweep
  const [sweepParamName, setSweepParamName] = useState("askProb");
  const [sweepValuesText, setSweepValuesText] = useState("0,0.1,0.2,0.3,0.5,0.7,0.9");

  // 2D sweep
  const [xParam, setXParam] = useState("askProb");
  const [xValuesText, setXValuesText] = useState("0,0.1,0.2,0.3,0.5,0.7,0.9");
  const [seriesParam, setSeriesParam] = useState("numTaskTypes");
  const [seriesValuesText, setSeriesValuesText] = useState("3,5,8");

  // Metric selection (for sweep charts)
  const [metricMode, setMetricMode] = useState("single"); // "single" | "ratio"
  const [metricKey, setMetricKey] = useState("workerProductivity");
  const [ratioNumeratorKey, setRatioNumeratorKey] = useState("workerProductivity");
  const [ratioDenominatorKey, setRatioDenominatorKey] = useState("numWorkers");

  // Scatter controls
  const [scatterN, setScatterN] = useState(300);
  // axis keys: "stats:...", "unit:...", "cfg:..."
  const [scatterXAxisKey, setScatterXAxisKey] = useState("stats:totalValue");
  const [scatterYAxisKey, setScatterYAxisKey] = useState("stats:totalTasksCompleted");
  const [scatterColorKey, setScatterColorKey] = useState("cfg:conversationLearningRate");
  const [scatterColorQuantize, setScatterColorQuantize] = useState(true);
  const [scatterUnitKeys, setScatterUnitKeys] = useState(null); // null/empty => all

  // Layout
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showConfigPanel, setShowConfigPanel] = useState(false);

  // Presets
  const defaultPresetSelections = useMemo(() => {
    const obj = {};
    for (const g of presetGroups) obj[g.id] = g.presets[0]?.id || null;
    return obj;
  }, [presetGroups]);

  const [presetSelections, setPresetSelections] = useState(defaultPresetSelections);

  const applyUrlState = useCallback((saved) => {
    if (!saved || typeof saved !== "object") return;

    if (typeof saved.mode === "string") setMode(saved.mode);
    if (typeof saved.configText === "string") setConfigText(saved.configText);

    if (saved.presetSelections && typeof saved.presetSelections === "object") {
      setPresetSelections(saved.presetSelections);
    }

    if (typeof saved.sweepParamName === "string") setSweepParamName(saved.sweepParamName);
    if (typeof saved.sweepValuesText === "string") setSweepValuesText(saved.sweepValuesText);

    if (typeof saved.xParam === "string") setXParam(saved.xParam);
    if (typeof saved.xValuesText === "string") setXValuesText(saved.xValuesText);
    if (typeof saved.seriesParam === "string") setSeriesParam(saved.seriesParam);
    if (typeof saved.seriesValuesText === "string") setSeriesValuesText(saved.seriesValuesText);

    if (typeof saved.metricMode === "string") setMetricMode(saved.metricMode);
    if (typeof saved.metricKey === "string") setMetricKey(saved.metricKey);
    if (typeof saved.ratioNumeratorKey === "string") setRatioNumeratorKey(saved.ratioNumeratorKey);
    if (typeof saved.ratioDenominatorKey === "string")
      setRatioDenominatorKey(saved.ratioDenominatorKey);

    if (typeof saved.scatterN === "number") setScatterN(saved.scatterN);
    if (typeof saved.scatterXAxisKey === "string") setScatterXAxisKey(saved.scatterXAxisKey);
    if (typeof saved.scatterYAxisKey === "string") setScatterYAxisKey(saved.scatterYAxisKey);
    if (typeof saved.scatterColorKey === "string") setScatterColorKey(saved.scatterColorKey);
    if (typeof saved.scatterColorQuantize === "boolean")
      setScatterColorQuantize(saved.scatterColorQuantize);
    if (Array.isArray(saved.scatterUnitKeys)) setScatterUnitKeys(saved.scatterUnitKeys);
    if (typeof saved.scatterColorKey === "string") setScatterColorKey(saved.scatterColorKey);

    if (typeof saved.sidebarOpen === "boolean") setSidebarOpen(saved.sidebarOpen);
    if (typeof saved.showConfigPanel === "boolean") setShowConfigPanel(saved.showConfigPanel);
  }, []);

  return {
    presetGroups,

    configText,
    setConfigText,

    mode,
    setMode,

    sweepParamName,
    setSweepParamName,
    sweepValuesText,
    setSweepValuesText,

    xParam,
    setXParam,
    xValuesText,
    setXValuesText,
    seriesParam,
    setSeriesParam,
    seriesValuesText,
    setSeriesValuesText,

    metricMode,
    setMetricMode,
    metricKey,
    setMetricKey,
    ratioNumeratorKey,
    setRatioNumeratorKey,
    ratioDenominatorKey,
    setRatioDenominatorKey,

    scatterN,
    setScatterN,
    scatterXAxisKey,
    setScatterXAxisKey,
    scatterYAxisKey,
    setScatterYAxisKey,
    scatterColorKey,
    setScatterColorKey,
    scatterColorQuantize,
    setScatterColorQuantize,
    scatterUnitKeys,
    setScatterUnitKeys,
    scatterColorKey,
    setScatterColorKey,

    sidebarOpen,
    setSidebarOpen,
    showConfigPanel,
    setShowConfigPanel,

    presetSelections,
    setPresetSelections,

    applyUrlState,
  };
}
