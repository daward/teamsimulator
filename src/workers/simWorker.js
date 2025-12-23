// src/workers/simWorker.js
import { runSimulation } from "../simulation/simulation.js";
import { presetGroups, applyPresetGroups } from "../presets.js";

import sweepConfig from "../config/sweep-config.json";
import { applyUnitConfig, randomUnitVars } from "../simulation/unitConfig.js";

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function applySinglePresetValue(baseConfig, selections, presetParam, presetId) {
  const groupId = presetParam.slice("preset:".length);
  const group = presetGroups.find((g) => g.id === groupId);
  if (!group) return applyPresetGroups(baseConfig, selections);

  const preset = group.presets.find((p) => p.id === presetId);
  if (!preset) return applyPresetGroups(baseConfig, selections);

  const nextSelections = { ...(selections || {}), [groupId]: presetId };
  return applyPresetGroups(baseConfig, nextSelections);
}

function makeConfigForPoint({ baseConfig, presetSelections, paramName, value }) {
  if (paramName.startsWith("preset:")) {
    return applySinglePresetValue(baseConfig, presetSelections, paramName, String(value));
  }

  const out = { ...baseConfig };
  const num = Number(value);
  out[paramName] = Number.isFinite(num) && String(value).trim() !== "" ? num : value;
  return out;
}

// ---- scatter helpers ----

function isFiniteNumber(v) {
  return typeof v === "number" && Number.isFinite(v);
}

function buildCfgSnapshot(cfg, unitMappings) {
  // include all mapping targets (so cfg:* axes work)
  const targets = Array.from(
    new Set(
      Object.values(unitMappings || {})
        .map((d) => d?.target)
        .filter(Boolean)
    )
  );

  const snap = {};
  for (const t of targets) {
    const v = cfg?.[t];
    if (isFiniteNumber(v)) snap[t] = v;
  }

  // also include some common numeric cfg knobs you may want on axes
  // (harmless if missing)
  const extras = [
    "numCycles",
    "burnInCycles",
    "poErrorProb",
    "poWindowSize",
    "poActionsPerCycle",
    "maxBacklogSize",
    "backlogSize",
  ];
  for (const k of extras) {
    const v = cfg?.[k];
    if (isFiniteNumber(v)) snap[k] = v;
  }

  return snap;
}

self.onmessage = async (evt) => {
  const { type, payload } = evt.data || {};

  try {
    if (type === "runSingle") {
      const { config, presetSelections } = payload;
      const cfg = applyPresetGroups(config, presetSelections);
      const result = runSimulation(cfg);
      self.postMessage({ type: "singleResult", payload: result });
      return;
    }

    if (type === "runSweep1D") {
      const { baseConfig, presetSelections, paramName, values } = payload;

      const results = [];
      for (const v of values) {
        const cfg = makeConfigForPoint({
          baseConfig,
          presetSelections,
          paramName,
          value: v,
        });

        const sim = runSimulation(cfg);
        results.push({
          x: cfg[paramName] ?? v,
          stats: deepClone(sim.stats ?? {}),
        });
      }

      self.postMessage({
        type: "sweep1DResult",
        payload: { paramName, results },
      });
      return;
    }

    if (type === "runSweep2D") {
      const {
        baseConfig,
        presetSelections,
        xParam,
        xValues,
        seriesParam,
        seriesValues,
      } = payload;

      const results = [];

      for (const s of seriesValues) {
        for (const x of xValues) {
          const cfgAfterSeries = makeConfigForPoint({
            baseConfig,
            presetSelections,
            paramName: seriesParam,
            value: s,
          });

          const cfg = makeConfigForPoint({
            baseConfig: cfgAfterSeries,
            presetSelections,
            paramName: xParam,
            value: x,
          });

          const sim = runSimulation(cfg);

          results.push({
            x: cfg[xParam] ?? x,
            series: cfg[seriesParam] ?? s,
            stats: deepClone(sim.stats ?? {}),
          });
        }
      }

      self.postMessage({
        type: "sweep2DResult",
        payload: { xParam, seriesParam, results },
      });
      return;
    }

    // NEW/UPDATED: scatter (unit-random)
    if (type === "runScatter") {
      const { baseConfig, presetSelections, nOverride, unitKeys } = payload || {};

      const unitRandom = sweepConfig?.unitRandom || { n: 0 };
      const unitMappings = sweepConfig?.unitMappings || {};
      const unitVarNames = Object.keys(unitMappings || {});

      if (!unitVarNames.length) {
        self.postMessage({
          type: "error",
          payload: "sweep-config.json: unitMappings is empty; cannot run scatter.",
        });
        return;
      }

      const n = Math.max(1, Math.floor(Number(nOverride ?? unitRandom.n ?? 0)));

      // Apply presets first to the base config (so scatter respects presets)
      const baseCfgWithPresets = applyPresetGroups(baseConfig, presetSelections);

      const points = [];
      const progressEvery = Math.max(1, Math.floor(n / 20)); // ~20 updates

      self.postMessage({
        type: "scatterProgress",
        payload: { done: 0, total: n },
      });

      const varySet =
        Array.isArray(unitKeys) && unitKeys.length > 0
          ? new Set(unitKeys)
          : null; // null => all

      for (let i = 0; i < n; i++) {
        const unitVars = {};
        for (const key of unitVarNames) {
          if (varySet && !varySet.has(key)) continue;
          unitVars[key] = Math.random();
        }

        const cfg = applyUnitConfig(baseCfgWithPresets, unitVars, unitMappings, varySet);

        const sim = runSimulation(cfg);
        const stats = sim?.stats ?? {};

        points.push({
          unitVars: deepClone(unitVars),
          cfg: deepClone(buildCfgSnapshot(cfg, unitMappings)),
          stats: deepClone(stats),
        });

        if ((i + 1) % progressEvery === 0 || i === n - 1) {
          self.postMessage({
            type: "scatterProgress",
            payload: { done: i + 1, total: n },
          });
        }
      }

      self.postMessage({
        type: "scatterResult",
        payload: {
          n,
          unitVarNames,
          cfgTargets: Array.from(
            new Set(Object.values(unitMappings).map((d) => d?.target).filter(Boolean))
          ),
          points,
        },
      });
      return;
    }

    self.postMessage({
      type: "error",
      payload: `Unknown worker message type: ${type}`,
    });
  } catch (err) {
    self.postMessage({
      type: "error",
      payload: err?.stack || err?.message || String(err),
    });
  }
};
