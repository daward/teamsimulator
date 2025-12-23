// src/App.jsx
import baseConfig from "./config/baseConfig.json";

import { useSimulation } from "./hooks/useSimulation";
import { useAppState } from "./hooks/useAppState";
import { useAvailableKeys } from "./hooks/useAvailableKeys";
import { useUrlSyncAndAutoRun } from "./hooks/useUrlSyncAndAutoRun";

import AppShell from "./components/AppShell";
import SidebarControls from "./components/SidebarControls";
import MainPane from "./components/MainPane";

export default function App() {
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
  });

  return (
    <AppShell
      sidebarOpen={app.sidebarOpen}
      onToggleSidebar={() => app.setSidebarOpen((v) => !v)}
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
        />
      }
    />
  );
}
