// src/backlogManager.js

import { createRandomTask } from "./taskFactory.js";
import { ProductOwner } from "./productOwner.js";
import { samplePoisson } from "./utils.js";

export class BacklogManager {
  constructor(cfg) {
    this.cfg = cfg;
    this.po = new ProductOwner(cfg);
    this.backlog = [];

    const initialBacklogSize = cfg.backlogSize || 50;

    // Initial random backlog
    for (let i = 0; i < initialBacklogSize; i++) {
      this.backlog.push(createRandomTask(cfg));
    }
  }

  /**
   * Called once per simulation cycle.
   * Handles:
   * - Task arrivals from the environment (fixed stream, Poisson)
   * - PO reordering (if present)
   * - Eviction (if backlog > maxBacklogSize)
   */
  tick(stats) {
    const {
      envTaskRate,
      maxBacklogSize = null,
      poAbsenceProb = 0,
      poActionsPerCycle = 1
    } = this.cfg;

    // ---- Task arrivals from the environment (Poisson) ----
    const lambda =
      typeof envTaskRate === "number" && envTaskRate > 0
        ? envTaskRate
        : 0;

    const arrivals = lambda > 0 ? samplePoisson(lambda) : 0;

    if (arrivals > 0) {
      for (let i = 0; i < arrivals; i++) {
        this.backlog.push(createRandomTask(this.cfg));
      }
      if (stats) {
        stats.totalTasksArrived =
          (stats.totalTasksArrived || 0) + arrivals;
      }
    }

    // ---- PO might be absent ----
    const poAbsent = Math.random() < poAbsenceProb;
    if (poAbsent) return;

    // ---- PO reorders in small windows ----
    for (let i = 0; i < poActionsPerCycle; i++) {
      this.po.workOnBacklog(this.backlog);
    }

    // ---- PO evicts worst tasks if backlog too big ----
    if (maxBacklogSize !== null) {
      this.evictExtra(maxBacklogSize, stats);
    }
  }

  /**
   * Workers call this to get the next task (front of backlog).
   */
  takeNextTask() {
    if (this.backlog.length === 0) return null;
    return this.backlog.shift();
  }

  /**
   * Evict tasks until backlog length <= maxBacklogSize,
   * using PO's eviction policy (and error).
   */
  evictExtra(maxBacklogSize, stats) {
    while (this.backlog.length > maxBacklogSize) {
      if (this.backlog.length === 0) return;

      const idx = this.po.pickEvictionIndex(this.backlog);
      if (idx < 0 || idx >= this.backlog.length) return;

      const [evicted] = this.backlog.splice(idx, 1);
      if (stats) {
        stats.evictedTasks = (stats.evictedTasks || 0) + 1;
        stats.evictedValue = (stats.evictedValue || 0) + evicted.value;
      }
    }
  }

  get size() {
    return this.backlog.length;
  }
}
