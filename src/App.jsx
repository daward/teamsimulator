// src/App.jsx
import baseConfig from "./config/baseConfig.json";

import { useSimulation } from "./hooks/useSimulation";
import { useAppState } from "./hooks/useAppState";
import { useAvailableKeys } from "./hooks/useAvailableKeys";
import { useUrlSyncAndAutoRun } from "./hooks/useUrlSyncAndAutoRun";

import AppShell from "./components/AppShell";
import SidebarControls from "./components/SidebarControls";
import MainPane from "./components/MainPane";
import { useEffect, useMemo, useState } from "react";
import { expandSweepValues } from "./controllers/buildRunRequests";

export default function App() {
  const [darkMode, setDarkMode] = useState(() =>
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : false
  );
  const app = useAppState(baseConfig);
  const sim = useSimulation();

  const keys = useAvailableKeys({
    configText: app.configText,
    presetGroups: app.presetGroups,

    result: sim.result,
    sweep1DResult: sim.sweep1DResult,
    sweep2DResult: sim.sweep2DResult,
    scatterResult: sim.scatterResult,

    metricMode: app.metricMode,
    metricKey: app.metricKey,
    ratioNumeratorKey: app.ratioNumeratorKey,
    ratioDenominatorKey: app.ratioDenominatorKey,

    setMetricKey: app.setMetricKey,
    setRatioNumeratorKey: app.setRatioNumeratorKey,
    setRatioDenominatorKey: app.setRatioDenominatorKey,
  });

  const urlState = {
    mode: app.mode,
    configText: app.configText,
    presetSelections: app.presetSelections,

    // 1D sweep
    sweepParamName: app.sweepParamName,
    sweepValuesText: app.sweepValuesText,

    // 2D sweep
    xParam: app.xParam,
    xValuesText: app.xValuesText,
    seriesParam: app.seriesParam,
    seriesValuesText: app.seriesValuesText,

    // metrics for sweep charts
    metricMode: app.metricMode,
    metricKey: app.metricKey,
    ratioNumeratorKey: app.ratioNumeratorKey,
    ratioDenominatorKey: app.ratioDenominatorKey,

    // scatter
    scatterN: app.scatterN,
    scatterXAxisKey: app.scatterXAxisKey,
    scatterYAxisKey: app.scatterYAxisKey,
    scatterColorKey: app.scatterColorKey,
    scatterColorQuantize: app.scatterColorQuantize,
    scatterUnitKeys: app.scatterUnitKeys,

    // layout
    sidebarOpen: app.sidebarOpen,
    showConfigPanel: app.showConfigPanel,
  };

  const plannedSweep2DRuns = useMemo(() => {
    const xs = expandSweepValues(app.xParam, app.xValuesText, app.presetGroups);
    const series = expandSweepValues(
      app.seriesParam,
      app.seriesValuesText,
      app.presetGroups
    );
    if (!xs.length || !series.length) return 0;
    return xs.length * series.length;
  }, [app.xParam, app.xValuesText, app.seriesParam, app.seriesValuesText, app.presetGroups]);

  useUrlSyncAndAutoRun({
    urlState,
    applyUrlState: app.applyUrlState,

    baseConfig,
    presetGroups: app.presetGroups,

    mode: app.mode,
    configText: app.configText,
    presetSelections: app.presetSelections,

    sweepParamName: app.sweepParamName,
    sweepValuesText: app.sweepValuesText,

    xParam: app.xParam,
    xValuesText: app.xValuesText,
    seriesParam: app.seriesParam,
    seriesValuesText: app.seriesValuesText,

    running: sim.running,
    runSingle: sim.runSingle,
    runSweep1D: sim.runSweep1D,
    runSweep2D: sim.runSweep2D,
    runScatter: sim.runScatter,

    scatterN: app.scatterN,
    scatterUnitKeys: app.scatterUnitKeys,
    stopRunning: sim.stopRunning,
  });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [darkMode]);

  return (
    <div className={darkMode ? "dark" : ""}>
      <AppShell
        sidebarOpen={app.sidebarOpen}
        onToggleSidebar={() => app.setSidebarOpen((v) => !v)}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((v) => !v)}
        sidebar={
          <SidebarControls
            app={app}
            sim={sim}
            availableParams={keys.availableParams}
            availableMetricKeys={keys.availableMetricKeys}
          />
        }
        main={
          <MainPane
            mode={app.mode}
            running={sim.running}
            error={sim.error}
            result={sim.result}
            sweep1DResult={sim.sweep1DResult}
            sweep2DResult={sim.sweep2DResult}
            scatterResult={sim.scatterResult}
            scatterProgress={sim.scatterProgress}
            sweep2DProgress={sim.sweep2DProgress}
            plannedSweep2DRuns={plannedSweep2DRuns}
            metricSpec={keys.metricSpec}
            scatterXAxisKey={app.scatterXAxisKey}
            scatterYAxisKey={app.scatterYAxisKey}
            onSetScatterXAxisKey={app.setScatterXAxisKey}
            scatterColorKey={app.scatterColorKey}
            onSetScatterColorKey={app.setScatterColorKey}
            scatterColorQuantize={app.scatterColorQuantize}
            onSetScatterColorQuantize={app.setScatterColorQuantize}
            scatterUnitKeys={app.scatterUnitKeys}
            onSetScatterUnitKeys={app.setScatterUnitKeys}
            onStop={sim.stopRunning}
          />
        }
      />
    </div>
  );
}
