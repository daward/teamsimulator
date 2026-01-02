// src/taskFactory.js

import { samplePoisson, randInt, randFloat, clamp01 } from "./utils";

/**
 * Create a random task with:
 * - type: integer in [0, numTaskTypes)
 * - infoTime, implTime: derived from totalEffort * taskComplexity
 * - value: Poisson around avgValue (at least 1)
 * - valueRetention: per-task decay factor in [taskRetentionMin, taskRetentionMax]
 */
export function createRandomTask(cfg) {
  const type = randInt(0, (cfg.team?.numTaskTypes ?? 1) - 1);

  const totalEffort = Math.max(1, cfg.environment?.totalEffort ?? 100);
  const baseComplexity = clamp01(cfg.environment?.taskComplexity ?? 0.5);
  const jitter = clamp01(cfg.environment?.complexityJitter ?? 0.1);
  const complexity = clamp01(
    baseComplexity + randFloat(-jitter, jitter)
  );

  const infoMean = totalEffort * complexity;
  const implMean = totalEffort * (1 - complexity);

  const infoRaw = samplePoisson(infoMean);
  const implRaw = samplePoisson(implMean);
  const valueRaw = samplePoisson(cfg.environment?.avgTaskValue);

  const infoTime = Math.max(0, infoRaw);
  const implTime = Math.max(0, implRaw);
  const value = Math.max(1, valueRaw);

  // Per-task decay parameters
  const retentionMin =
    typeof cfg.environment?.retentionMin === "number" ? cfg.environment.retentionMin : 0.95;
  const retentionMax =
    typeof cfg.environment?.retentionMax === "number" ? cfg.environment.retentionMax : 0.999;

  const valueRetention = randFloat(retentionMin, retentionMax);

  return {
    type,
    // For info phase
    initialInfoTime: infoTime,
    infoTime,
    implTime,
    value,

    // NEW: per-task decay factor for recurring value
    valueRetention
  };
}
