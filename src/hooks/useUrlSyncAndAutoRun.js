// src/hooks/useUrlSyncAndAutoRun.js
import { useEffect, useMemo, useRef } from "react";
import { readStateFromUrl, writeStateToUrl } from "../utils/urlstate";
import {
  buildSweep1DRequest,
  buildSweep2DRequest,
  parseConfigText,
} from "../controllers/buildRunRequests";

// Prevent double autoruns in StrictMode remounts, but still allow new page loads.
let lastAutoRunKey = null;

/**
 * Fixes:
 * - auto-run firing before hydrated state is applied (applyUrlState is async)
 * - auto-run double firing on refresh in React 18 StrictMode (mount/remount)
 * - URL sync feedback weirdness
 */
export function useUrlSyncAndAutoRun({
  // URL state
  urlState,
  applyUrlState,

  // autorun inputs
  baseConfig,
  presetGroups,

  mode,
  configText,
  presetSelections,
  sweepParamName,
  sweepValuesText,
  xParam,
  xValuesText,
  seriesParam,
  seriesValuesText,
  scatterN,
  scatterUnitKeys,

  // sim controls
  running,
  runSingle,
  runSweep1D,
  runSweep2D,
  runScatter,
}) {
  const didHydrateRef = useRef(false);
  const skipNextUrlWriteRef = useRef(false);

  const loadedFromUrlRef = useRef(false);
  const savedUrlStateRef = useRef(null);

  const autoRunKey = useMemo(() => window.location.search || "__no_search__", []);

  // 1) Hydrate once
  useEffect(() => {
    const saved = readStateFromUrl();
    if (!saved) {
      didHydrateRef.current = true;
      return;
    }

    loadedFromUrlRef.current = true;
    savedUrlStateRef.current = saved;

    // prevent immediate write-back loop
    skipNextUrlWriteRef.current = true;

    // Apply state from URL (async state updates)
    applyUrlState(saved);

    // Mark "hydration initiated"
    didHydrateRef.current = true;
  }, [applyUrlState]);

  // 2) Keep URL in sync
  // Use a stable string so this effect doesn't run because object identity changes.
  const urlStateKey = useMemo(() => JSON.stringify(urlState), [urlState]);

  useEffect(() => {
    if (!didHydrateRef.current) return;

    if (skipNextUrlWriteRef.current) {
      skipNextUrlWriteRef.current = false;
      return;
    }

    writeStateToUrl(urlState);
  }, [urlStateKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Helper: decide if current React state has "caught up" to saved URL state.
  // We only check the fields that affect what run we start.
  const hydratedMatchesSaved = () => {
    const saved = savedUrlStateRef.current;
    if (!saved) return true;

    if (typeof saved.mode === "string" && saved.mode !== mode) return false;
    if (typeof saved.configText === "string" && saved.configText !== configText)
      return false;

    // presets
    if (saved.presetSelections && typeof saved.presetSelections === "object") {
      // cheap compare: stringify (small object)
      const a = JSON.stringify(saved.presetSelections);
      const b = JSON.stringify(presetSelections);
      if (a !== b) return false;
    }

    // sweep inputs depending on mode
    if (saved.mode === "sweep1D") {
      if (
        typeof saved.sweepParamName === "string" &&
        saved.sweepParamName !== sweepParamName
      )
        return false;
      if (
        typeof saved.sweepValuesText === "string" &&
        saved.sweepValuesText !== sweepValuesText
      )
        return false;
    }

    if (saved.mode === "sweep2D") {
      if (typeof saved.xParam === "string" && saved.xParam !== xParam)
        return false;
      if (
        typeof saved.xValuesText === "string" &&
        saved.xValuesText !== xValuesText
      )
        return false;
      if (
        typeof saved.seriesParam === "string" &&
        saved.seriesParam !== seriesParam
      )
        return false;
      if (
        typeof saved.seriesValuesText === "string" &&
        saved.seriesValuesText !== seriesValuesText
      )
        return false;
    }

    if (saved.mode === "scatter") {
      if (typeof saved.scatterN === "number" && saved.scatterN !== scatterN) return false;
      if (saved.scatterUnitKeys) {
        const a = JSON.stringify(saved.scatterUnitKeys);
        const b = JSON.stringify(scatterUnitKeys);
        if (a !== b) return false;
      }
    }

    return true;
  };

  // 3) Auto-run once after hydration if loaded from URL
  useEffect(() => {
    if (!didHydrateRef.current) return;
    if (!loadedFromUrlRef.current) return;

    // Don’t autorun while a run is in flight.
    if (running) return;

    // Wait until React state actually reflects the saved URL state.
    // This fixes the “autorun runs with defaults then never reruns” bug.
    if (!hydratedMatchesSaved()) return;

    // StrictMode guard: avoid running twice on remount with same URL
    if (lastAutoRunKey === autoRunKey) return;
    lastAutoRunKey = autoRunKey;

    const rawCfg = parseConfigText(configText, baseConfig);

    if (mode === "single") {
      runSingle(rawCfg, presetSelections);
      return;
    }

    if (mode === "sweep1D") {
      const req = buildSweep1DRequest({
        rawCfg,
        presetSelections,
        presetGroups,
        sweepParamName,
        sweepValuesText,
      });
      if (!req.paramName || !req.values?.length) return;
      runSweep1D(req);
      return;
    }

    if (mode === "sweep2D") {
      const req = buildSweep2DRequest({
        rawCfg,
        presetSelections,
        presetGroups,
        xParam,
        xValuesText,
        seriesParam,
        seriesValuesText,
      });
      if (!req.xParam || !req.xValues?.length) return;
      if (!req.seriesParam || !req.seriesValues?.length) return;
      runSweep2D(req);
      return;
    }

    if (mode === "scatter") {
      const n = Number(scatterN);
      if (!Number.isFinite(n) || n <= 0) return;
      runScatter({
        baseConfig: rawCfg,
        presetSelections,
        nOverride: n,
        unitKeys: scatterUnitKeys,
      });
    }
  }, [
    // dependencies that must be “settled” before we autorun
    running,
    mode,
    configText,
    presetSelections,
    sweepParamName,
    sweepValuesText,
    xParam,
    xValuesText,
    seriesParam,
    seriesValuesText,

    // stable inputs
    baseConfig,
    presetGroups,
    runSingle,
    runSweep1D,
    runSweep2D,
    runScatter,
    scatterN,
    scatterUnitKeys,
    autoRunKey,
  ]);
}
