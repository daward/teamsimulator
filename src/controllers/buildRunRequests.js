// src/controllers/buildRunRequests.js
import { applyPresetGroups } from "../presets";

/**
 * Parse configText JSON safely, fallback to baseConfig (object)
 */
export function parseConfigText(configText, baseConfig) {
  try {
    const parsed = JSON.parse(configText);
    if (!parsed || typeof parsed !== "object") return baseConfig;
    return parsed;
  } catch {
    return baseConfig;
  }
}

/**
 * Expand "*" for preset group sweeps or known enums; otherwise return comma-split trimmed list.
 * Keeps values as strings; sweep runner can coerce where appropriate.
 */
export function expandSweepValues(paramName, valuesText, presetGroups) {
  const parts = (valuesText || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length === 1 && parts[0] === "*" && paramName?.startsWith("preset:")) {
    const groupId = paramName.slice("preset:".length);
    const group = presetGroups.find((g) => g.id === groupId);
    if (!group) return [];
    return group.presets
      .filter((p) => p.patch && Object.keys(p.patch).length > 0)
      .map((p) => p.id);
  }

  // Enumerated fields that should sweep all options with "*"
  if (parts.length === 1 && parts[0] === "*") {
    if (paramName === "turnoverHireMode" || paramName === "turnover.hireMode") {
      return ["average", "specialist"];
    }
  }

  return parts;
}

export function buildBaseCfg(rawCfg, presetSelections) {
  return applyPresetGroups(rawCfg, presetSelections);
}

export function buildSweep1DRequest({
  rawCfg,
  presetSelections,
  presetGroups,
  sweepParamName,
  sweepValuesText,
}) {
  const baseCfg = buildBaseCfg(rawCfg, presetSelections);
  const values = expandSweepValues(sweepParamName, sweepValuesText, presetGroups);

  return {
    baseConfig: baseCfg,
    presetSelections,
    paramName: sweepParamName,
    values,
  };
}

export function buildSweep2DRequest({
  rawCfg,
  presetSelections,
  presetGroups,
  xParam,
  xValuesText,
  seriesParam,
  seriesValuesText,
}) {
  const baseCfg = buildBaseCfg(rawCfg, presetSelections);
  const xValues = expandSweepValues(xParam, xValuesText, presetGroups);
  const seriesValues = expandSweepValues(
    seriesParam,
    seriesValuesText,
    presetGroups
  );

  return {
    baseConfig: baseCfg,
    presetSelections,
    xParam,
    xValues,
    seriesParam,
    seriesValues,
  };
}
