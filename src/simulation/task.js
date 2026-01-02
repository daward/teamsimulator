// src/simulation/task.js
// Task helpers and factory; tasks are plain objects with stable fields.
import { clamp01, samplePositiveInt, sampleUniform, randInt } from "./utils.js";

/**
 * Effort model:
 * - direct means: avgInfoTime + avgImplTime (if both provided)
 * - totalEffort: fixed expected total cycles per task
 * - taskComplexity: share of effort spent in info (0..1)
 * A little jitter is added so tasks vary around the target complexity.
 */
function sampleInfoImpl(cfg) {
  const env = cfg.environment || {};
  const avgInfoTime = Number(env.avgInfoTime);
  const avgImplTime = Number(env.avgImplTime);
  const useDirect =
    Number.isFinite(avgInfoTime) &&
    avgInfoTime > 0 &&
    Number.isFinite(avgImplTime) &&
    avgImplTime > 0;

  if (useDirect) {
    return {
      infoTime: samplePositiveInt(avgInfoTime),
      implTime: samplePositiveInt(avgImplTime),
    };
  }

  const totalEffort = Math.max(1, env.totalEffort ?? 100); // fixed expected effort per task
  const baseComplexity = clamp01(env.taskComplexity ?? 0.5);
  const jitter = clamp01(env.complexityJitter ?? 0.1);

  const jittered = clamp01(baseComplexity + sampleUniform(-jitter, jitter));

  const infoMean = Math.max(1, totalEffort * jittered);
  const implMean = Math.max(1, totalEffort * (1 - jittered));

  return {
    infoTime: samplePositiveInt(infoMean),
    implTime: samplePositiveInt(implMean)
  };
}

export function createRandomTask(cfg) {
  // 1) pick a random topic uniformly
  const numTopics = Math.max(1, Math.floor(cfg.team?.numTaskTypes ?? 1));
  const type = randInt(0, numTopics - 1);

  // 2) effort times
  const { infoTime, implTime } = sampleInfoImpl(cfg);

  // 3) value
  const avgValue = cfg.environment?.avgTaskValue ?? 10;
  // keep it positive-ish with some spread
  const value = Math.max(1, samplePositiveInt(avgValue));

  // 4) retention
  const rMin = cfg.environment?.retentionMin ?? 0.3;
  const rMax = cfg.environment?.retentionMax ?? 0.7;
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
