// src/hooks/useAvailableKeys.js
import { useEffect, useMemo } from "react";

/**
 * Computes:
 * - availableParams (config keys + preset groups)
 * - availableMetricKeys (numeric keys across sweep stats)
 * - metricSpec (single/ratio)
 * Also keeps chosen metric keys valid when sweep results change.
 */
export function useAvailableKeys({
  mode,
  configText,
  presetGroups,
  sweep1DResult,
  sweep2DResult,

  metricMode,
  metricKey,
  ratioNumeratorKey,
  ratioDenominatorKey,
  setMetricKey,
  setRatioNumeratorKey,
  setRatioDenominatorKey,
}) {
  const availableParams = useMemo(() => {
    try {
      const parsed = JSON.parse(configText);
      const configKeys = Object.keys(parsed || {});
      const presetKeys = presetGroups.map((g) => `preset:${g.id}`);
      return Array.from(new Set([...configKeys, ...presetKeys])).sort();
    } catch {
      return presetGroups.map((g) => `preset:${g.id}`).sort();
    }
  }, [configText, presetGroups]);

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

  // Keep chosen keys valid as soon as metrics are known
  useEffect(() => {
    if (availableMetricKeys.length === 0) return;

    if (!availableMetricKeys.includes(metricKey)) {
      setMetricKey(availableMetricKeys[0]);
    }
    if (!availableMetricKeys.includes(ratioNumeratorKey)) {
      setRatioNumeratorKey(availableMetricKeys[0]);
    }
    if (!availableMetricKeys.includes(ratioDenominatorKey)) {
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
    setMetricKey,
    setRatioNumeratorKey,
    setRatioDenominatorKey,
  ]);

  const metricSpec = useMemo(() => {
    if (metricMode === "single") return { mode: "single", key: metricKey };
    return {
      mode: "ratio",
      numeratorKey: ratioNumeratorKey,
      denominatorKey: ratioDenominatorKey,
    };
  }, [metricMode, metricKey, ratioNumeratorKey, ratioDenominatorKey]);

  return { availableParams, availableMetricKeys, metricSpec };
}
