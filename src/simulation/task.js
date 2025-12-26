// src/simulation/task.js
// Task helpers and factory; tasks are plain objects with stable fields.
import { clamp01, samplePositiveInt, sampleUniform, randInt } from "./utils";

/**
 * Supports two ways of specifying effort:
 *  A) traditional: cfg.avgInfoTime + cfg.avgImplTime
 *  B) ratio model: cfg.avgTotalEffort + cfg.avgInfoShare (0..1)
 */
function sampleInfoImpl(cfg) {
  const avgInfoTime = cfg.avgInfoTime;
  const avgImplTime = cfg.avgImplTime;

  // Ratio model (optional)
  const avgTotalEffort = cfg.avgTotalEffort;
  const avgInfoShare = cfg.avgInfoShare;

  if (
    (avgInfoTime == null || avgImplTime == null) &&
    avgTotalEffort != null &&
    avgInfoShare != null
  ) {
    const share = clamp01(avgInfoShare);
    const total = Math.max(1, avgTotalEffort);

    const infoMean = Math.max(1, total * share);
    const implMean = Math.max(1, total * (1 - share));

    return {
      infoTime: samplePositiveInt(infoMean),
      implTime: samplePositiveInt(implMean)
    };
  }

  // Default model
  return {
    infoTime: samplePositiveInt(avgInfoTime ?? 10),
    implTime: samplePositiveInt(avgImplTime ?? 2)
  };
}

export function createRandomTask(cfg) {
  // 1) pick a random topic uniformly
  const numTopics = Math.max(1, Math.floor(cfg.numTaskTypes ?? 1));
  const type = randInt(0, numTopics - 1);

  // 2) effort times
  const { infoTime, implTime } = sampleInfoImpl(cfg);

  // 3) value
  const avgValue = cfg.avgValue ?? 10;
  // keep it positive-ish with some spread
  const value = Math.max(1, samplePositiveInt(avgValue));

  // 4) retention
  const rMin = cfg.taskRetentionMin ?? 0.3;
  const rMax = cfg.taskRetentionMax ?? 0.7;
  const valueRetention = sampleUniform(rMin, rMax);

  return {
    type,
    infoTime,
    implTime,
    value,
    valueRetention,
    initialInfoTime: infoTime,
    initialImplTime: implTime
  };
}
