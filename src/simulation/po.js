export class ProductOwner {
  constructor(cfg) {
    this.cfg = cfg;
    this.cursor = 0; // rolling window start
  }

  // Value per unit effort
  taskScore(task) {
    const effort = (task.infoTime || 0) + (task.implTime || 0);
    const safeEffort = effort > 0 ? effort : 1;
    return task.value / safeEffort;
  }

  /**
   * PO action: scan a small window, pick best by score (value/effort),
   * with error probability to pick randomly. Moves chosen task to the
   * front of the window to bias near-term selection.
   */
  work(cycle, backlog, cfg) {
    if (!backlog || backlog.size() === 0) return;

    const windowSize = cfg.productOwner?.windowSize || 5;
    const actions = cfg.productOwner?.actionsPerCycle || 0;
    const errorProb = cfg.productOwner?.errorProbability || 0;

    for (let a = 0; a < actions; a++) {
      if (backlog.size() <= 1) break;

      // ensure cursor within range
      if (this.cursor >= backlog.tasks.length) this.cursor = 0;

      const start = this.cursor;
      const end = Math.min(start + windowSize, backlog.tasks.length);
      if (start >= end) {
        this.cursor = 0;
        continue;
      }

      // find best in window
      let bestIndex = start;
      let bestScore = this.taskScore(backlog.tasks[start]);
      for (let i = start + 1; i < end; i++) {
        const s = this.taskScore(backlog.tasks[i]);
        if (s > bestScore) {
          bestScore = s;
          bestIndex = i;
        }
      }

      // maybe misjudge
      let chosenIndex = bestIndex;
      if (Math.random() < errorProb) {
        chosenIndex = Math.floor(Math.random() * (end - start)) + start;
      }

      // move chosen to front of window
      if (chosenIndex !== start) {
        const chosenTask = backlog.tasks[chosenIndex];
        backlog.tasks.splice(chosenIndex, 1);
        backlog.tasks.splice(start, 0, chosenTask);
      }

      // advance cursor
      this.cursor += windowSize;
      if (this.cursor >= backlog.tasks.length) this.cursor = 0;
    }
  }

  /**
   * Pick an index to evict (worst score), with error probability.
   */
  pickEvictionIndex(backlog) {
    if (!backlog || backlog.length === 0) return -1;

    const errorProb = this.cfg.productOwner?.errorProbability || 0;

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
    if (Math.random() < errorProb) {
      chosenIndex = Math.floor(Math.random() * backlog.length);
    }
    return chosenIndex;
  }
}
