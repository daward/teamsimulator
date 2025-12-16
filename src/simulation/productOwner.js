// src/productOwner.js

import { randInt } from "./utils";

export class ProductOwner {
  constructor(cfg) {
    this.cfg = cfg;
    this.cursor = 0; // where in the backlog we are currently looking
  }

  // Higher score = better to do first (value per unit effort)
  taskScore(task) {
    const effort = (task.infoTime || 0) + (task.implTime || 0);
    const safeEffort = effort > 0 ? effort : 1;
    return task.value / safeEffort;
  }

  /**
   * One "PO action":
   * - Look at a small window of the backlog starting at cursor,
   * - Find the best task in that window by score,
   * - BUT with probability poErrorProb, pick a random task from the window instead.
   * Over many cycles, this approximates prioritizing the backlog,
   * with configurable mistakes.
   */
  workOnBacklog(backlog) {
    if (backlog.length === 0) return;

    const windowSize = this.cfg.poWindowSize || 5;
    const errorProb = this.cfg.poErrorProb || 0;

    // Ensure cursor is in range
    if (this.cursor >= backlog.length) {
      this.cursor = 0;
    }

    const start = this.cursor;
    const end = Math.min(start + windowSize, backlog.length);

    if (start >= end) {
      this.cursor = 0;
      return;
    }

    // Find best task in [start, end)
    let bestIndex = start;
    let bestScore = this.taskScore(backlog[start]);

    for (let i = start + 1; i < end; i++) {
      const s = this.taskScore(backlog[i]);
      if (s > bestScore) {
        bestScore = s;
        bestIndex = i;
      }
    }

    // Decide which task to move to the front of the window
    let chosenIndex = bestIndex;

    // With some probability, PO misjudges and picks a random item
    if (Math.random() < errorProb) {
      chosenIndex = randInt(start, end - 1);
    }

    // Move chosen task to the "front" of this window (position `start`)
    if (chosenIndex !== start) {
      const chosenTask = backlog[chosenIndex];
      backlog.splice(chosenIndex, 1);
      backlog.splice(start, 0, chosenTask);
    }

    // Advance cursor to next window
    this.cursor += windowSize;
    if (this.cursor >= backlog.length) {
      this.cursor = 0;
    }
  }

  /**
   * Choose an index in the backlog to evict:
   * - Normally: the worst (lowest score) task
   * - With probability poErrorProb: a random task instead
   */
  pickEvictionIndex(backlog) {
    if (backlog.length === 0) return -1;

    const errorProb = this.cfg.poErrorProb || 0;

    // Find worst (lowest score) task by true score
    let worstIndex = 0;
    let worstScore = this.taskScore(backlog[0]);

    for (let i = 1; i < backlog.length; i++) {
      const s = this.taskScore(backlog[i]);
      if (s < worstScore) {
        worstScore = s;
        worstIndex = i;
      }
    }

    let chosenIndex = worstIndex;

    // With some probability, PO misjudges and evicts a random task
    if (Math.random() < errorProb) {
      chosenIndex = randInt(0, backlog.length - 1);
    }

    return chosenIndex;
  }
}