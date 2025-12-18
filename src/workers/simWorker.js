// src/workers/simWorker.js
import { runSimulation } from "../simulation/simulation.js";
import { presetGroups, applyPresetGroups } from "../presets.js";

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
    return applySinglePresetValue(
      baseConfig,
      presetSelections,
      paramName,
      String(value)
    );
  }

  const out = { ...baseConfig };
  const num = Number(value);
  out[paramName] = Number.isFinite(num) && String(value).trim() !== "" ? num : value;
  return out;
}

self.onmessage = async (evt) => {
  const { type, payload, runId } = evt.data || {};

  // Helper to always echo runId back (so UI can ignore stale responses)
  const reply = (msg) => self.postMessage({ runId, ...msg });

  try {
    if (type === "runSingle") {
      const { config, presetSelections } = payload;

      const cfg = applyPresetGroups(config, presetSelections);
      const result = runSimulation(cfg);

      reply({ type: "singleResult", payload: result });
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

      reply({
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

      reply({
        type: "sweep2DResult",
        payload: { xParam, seriesParam, results },
      });
      return;
    }

    reply({
      type: "error",
      payload: `Unknown worker message type: ${type}`,
    });
  } catch (err) {
    reply({
      type: "error",
      payload: err?.stack || err?.message || String(err),
    });
  }
};
