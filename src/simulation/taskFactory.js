// src/taskFactory.js

import { samplePoisson, randInt, randFloat } from "./utils";

/**
 * Create a random task with:
 * - type: integer in [0, numTaskTypes)
 * - infoTime, implTime: Poisson around config means
 * - value: Poisson around avgValue (at least 1)
 * - valueRetention: per-task decay factor in [taskRetentionMin, taskRetentionMax]
 */
export function createRandomTask(cfg) {
  const type = randInt(0, cfg.numTaskTypes - 1);

  const infoRaw = samplePoisson(cfg.avgInfoTime);
  const implRaw = samplePoisson(cfg.avgImplTime);
  const valueRaw = samplePoisson(cfg.avgValue);

  const infoTime = Math.max(0, infoRaw);
  const implTime = Math.max(0, implRaw);
  const value = Math.max(1, valueRaw);

  // Per-task decay parameters
  const retentionMin =
    typeof cfg.taskRetentionMin === "number" ? cfg.taskRetentionMin : 0.95;
  const retentionMax =
    typeof cfg.taskRetentionMax === "number" ? cfg.taskRetentionMax : 0.999;

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
