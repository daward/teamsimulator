// src/hooks/useAvailableKeys.js
import { useEffect, useMemo } from "react";

/**
 * Produces:
 * - availableParams: config keys + preset:* group ids (for sweeps)
 * - availableMetricKeys: union of numeric keys found in stats across results
 * - metricSpec: the current metric selection spec used by charts
 *
 * IMPORTANT:
 * We do NOT require a rerun to change metric. We just pick a different key
 * from the already-returned stats objects.
 */

function safeJsonParse(text) {
  try {
    const obj = JSON.parse(text);
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

function addStatKeysFromStatsObject(outSet, stats) {
  if (!stats || typeof stats !== "object") return;
  for (const [k, v] of Object.entries(stats)) {
    // only show numeric fields (including 0)
    if (typeof v === "number" && Number.isFinite(v)) outSet.add(k);
  }
}

function addStatKeysFromSweep1D(outSet, sweep1DResult) {
  const rows = sweep1DResult?.results;
  if (!Array.isArray(rows)) return;
  for (const r of rows) addStatKeysFromStatsObject(outSet, r?.stats);
}

function addStatKeysFromSweep2D(outSet, sweep2DResult) {
  const rows = sweep2DResult?.results;
  if (!Array.isArray(rows)) return;
  for (const r of rows) addStatKeysFromStatsObject(outSet, r?.stats);
}

function addStatKeysFromScatter(outSet, scatterResult) {
  const pts = scatterResult?.points;
  if (!Array.isArray(pts)) return;
  for (const p of pts) addStatKeysFromStatsObject(outSet, p?.stats);
}

export function useAvailableKeys({
  // state/context
  configText,
  presetGroups,

  // results (any/all may be null)
  result,
  sweep1DResult,
  sweep2DResult,
  scatterResult,

  // metric selection state for sweeps (shared)
  metricMode,
  metricKey,
  ratioNumeratorKey,
  ratioDenominatorKey,

  // setters so we can keep selection valid
  setMetricKey,
  setRatioNumeratorKey,
  setRatioDenominatorKey,
}) {
  const cfgObj = useMemo(() => safeJsonParse(configText), [configText]);

  const availableParams = useMemo(() => {
    const keys = new Set(Object.keys(cfgObj || {}));

    // ensure some common params are present even if missing in cfg text
    const paramExtras = ["turnoverProb"];
    paramExtras.forEach((k) => keys.add(k));

    // Allow sweeping presets: preset:<groupId>
    for (const g of presetGroups || []) {
      if (g?.id) keys.add(`preset:${g.id}`);
    }

    return Array.from(keys).sort();
  }, [cfgObj, presetGroups]);

  const availableMetricKeys = useMemo(() => {
    const keys = new Set();

    // Single-run stats
    addStatKeysFromStatsObject(keys, result?.stats);

    // Sweep stats
    addStatKeysFromSweep1D(keys, sweep1DResult);
    addStatKeysFromSweep2D(keys, sweep2DResult);

    // Scatter stats
    addStatKeysFromScatter(keys, scatterResult);

    // Provide a couple of common fallbacks if nothing yet
    if (keys.size === 0) {
      keys.add("totalValue");
      keys.add("totalTasksCompleted");
    }

    return Array.from(keys).sort();
  }, [result, sweep1DResult, sweep2DResult, scatterResult]);

  // Keep current selection valid when the key list changes
  useEffect(() => {
    if (!availableMetricKeys.length) return;

    if (metricMode === "single") {
      if (!availableMetricKeys.includes(metricKey)) {
        setMetricKey(availableMetricKeys[0]);
      }
      return;
    }

    // ratio
    if (!availableMetricKeys.includes(ratioNumeratorKey)) {
      setRatioNumeratorKey(availableMetricKeys[0]);
    }
    // denominator can be from stats too; keep it valid as well
    if (!availableMetricKeys.includes(ratioDenominatorKey)) {
      // pick something non-zero-ish if possible
      const candidate =
        availableMetricKeys.find((k) => k !== ratioNumeratorKey) ||
        availableMetricKeys[0];
      setRatioDenominatorKey(candidate);
    }
  }, [
    availableMetricKeys,
    metricMode,
    metricKey,
    ratioNumeratorKey,
    ratioDenominatorKey,
    setMetricKey,
    setRatioNumeratorKey,
    setRatioDenominatorKey,
  ]);

  const metricSpec = useMemo(() => {
    if (metricMode === "ratio") {
      return {
        mode: "ratio",
        numeratorKey: ratioNumeratorKey,
        denominatorKey: ratioDenominatorKey,
      };
    }
    return { mode: "single", key: metricKey };
  }, [metricMode, metricKey, ratioNumeratorKey, ratioDenominatorKey]);

  return {
    availableParams,
    availableMetricKeys,
    metricSpec,
  };
}
