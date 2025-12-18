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
    mode: app.mode,
    configText: app.configText,
    presetGroups: app.presetGroups,
    sweep1DResult: sim.sweep1DResult,
    sweep2DResult: sim.sweep2DResult,
    metricMode: app.metricMode,
    metricKey: app.metricKey,
    ratioNumeratorKey: app.ratioNumeratorKey,
    ratioDenominatorKey: app.ratioDenominatorKey,
    setMetricKey: app.setMetricKey,
    setRatioNumeratorKey: app.setRatioNumeratorKey,
    setRatioDenominatorKey: app.setRatioDenominatorKey,
  });

  // This is the exact state we want in the URL
  const urlState = {
    mode: app.mode,
    configText: app.configText,
    presetSelections: app.presetSelections,

    sweepParamName: app.sweepParamName,
    sweepValuesText: app.sweepValuesText,

    xParam: app.xParam,
    xValuesText: app.xValuesText,
    seriesParam: app.seriesParam,
    seriesValuesText: app.seriesValuesText,

    metricMode: app.metricMode,
    metricKey: app.metricKey,
    ratioNumeratorKey: app.ratioNumeratorKey,
    ratioDenominatorKey: app.ratioDenominatorKey,

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
          metricSpec={keys.metricSpec}
        />
      }
    />
  );
}
