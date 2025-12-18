// src/hooks/useUrlSyncAndAutoRun.js
import { useEffect, useMemo, useRef } from "react";
import { readStateFromUrl, writeStateToUrl } from "../utils/urlstate";
import {
  buildSweep1DRequest,
  buildSweep2DRequest,
  parseConfigText,
} from "../controllers/buildRunRequests";

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

  // sim controls
  running,
  runSingle,
  runSweep1D,
  runSweep2D,
}) {
  const didHydrateRef = useRef(false);
  const skipNextUrlWriteRef = useRef(false);

  const loadedFromUrlRef = useRef(false);
  const savedUrlStateRef = useRef(null);

  // A stable key that survives StrictMode remounts for the *same* URL load.
  // Using the raw query string keeps this simple and deterministic.
  const autoRunSessionKey = useMemo(() => {
    return `simui:autorun:${window.location.search || ""}`;
  }, []);

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

    // StrictMode refresh guard:
    // - on dev refresh, React mounts/remounts; refs reset
    // - sessionStorage survives; use it to ensure autorun happens once per URL load
    if (sessionStorage.getItem(autoRunSessionKey) === "1") return;

    // Mark BEFORE starting, so even if something throws we don’t loop.
    sessionStorage.setItem(autoRunSessionKey, "1");

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

    // stable key
    autoRunSessionKey,
  ]);
}
