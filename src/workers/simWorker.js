// src/workers/simWorker.js
import { runSimulation } from "../simulation/simulation.js"; // adjust if your path differs
import { presetGroups, applyPresetGroups } from "../presets.js";

// If your simulation import path is different, change the line above.
// This assumes you have something like /simulation/simulation.js exporting runSimulation.

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function applySinglePresetValue(baseConfig, selections, presetParam, presetId) {
  // presetParam like "preset:businessEnv"
  const groupId = presetParam.slice("preset:".length);
  const group = presetGroups.find((g) => g.id === groupId);
  if (!group) return applyPresetGroups(baseConfig, selections);

  const preset = group.presets.find((p) => p.id === presetId);
  if (!preset) return applyPresetGroups(baseConfig, selections);

  // Apply: all currently selected presets, but override this group with presetId
  const nextSelections = { ...(selections || {}), [groupId]: presetId };

  return applyPresetGroups(baseConfig, nextSelections);
}

function makeConfigForPoint({ baseConfig, presetSelections, paramName, value }) {
  // paramName can be real cfg key OR preset:groupId
  if (paramName.startsWith("preset:")) {
    // value is preset id string
    return applySinglePresetValue(baseConfig, presetSelections, paramName, String(value));
  }

  // normal key
  const out = { ...baseConfig };
  // parse numbers when possible
  const num = Number(value);
  out[paramName] = Number.isFinite(num) && String(value).trim() !== "" ? num : value;
  return out;
}

self.onmessage = async (evt) => {
  const { type, payload } = evt.data || {};

  try {
    if (type === "runSingle") {
      const { config, presetSelections } = payload;

      // Apply currently selected presets (single run should reflect them)
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
        // store full stats, not a single metric
        results.push({
          x: cfg[paramName] ?? v, // for normal keys, show the actual value; for preset, v is presetId
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
          // Apply series param first, then x param (order only matters if both are preset groups)
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
