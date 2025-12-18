// simulation.js
import { Worker } from './worker.js';
import { Task } from './task.js';
import { Backlog } from './backlog.js';
import { ProductOwner } from './po.js';
import { samplePoisson } from './utils.js';

/**
 * Compute finalTeamAvgExpertise as:
 * average over all (worker, topic) knowledge values, where missing topics count as 0.
 * Range: 0..1
 */
function computeFinalTeamAvgExpertise(workers, numTaskTypes) {
  if (!workers?.length || !numTaskTypes) return 0;

  let sum = 0;
  for (const w of workers) {
    for (let topic = 0; topic < numTaskTypes; topic++) {
      sum += w.getKnowledge ? w.getKnowledge(topic) : (w.knowledge?.[topic] ?? 0);
    }
  }
  return sum / (workers.length * numTaskTypes);
}

/**
 * Compute finalTeamAvgMaxExpertisePerTopic as:
 * for each topic, take max expertise across workers; then average those maxima.
 * Range: 0..1
 */
function computeFinalTeamAvgMaxExpertisePerTopic(workers, numTaskTypes) {
  if (!workers?.length || !numTaskTypes) return 0;

  let sumMax = 0;
  for (let topic = 0; topic < numTaskTypes; topic++) {
    let best = 0;
    for (const w of workers) {
      const k = w.getKnowledge ? w.getKnowledge(topic) : (w.knowledge?.[topic] ?? 0);
      if (k > best) best = k;
    }
    sumMax += best;
  }
  return sumMax / numTaskTypes;
}

function mean(arr) {
  if (!arr.length) return 0;
  let s = 0;
  for (const x of arr) s += x;
  return s / arr.length;
}

function stddev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  let v = 0;
  for (const x of arr) v += (x - m) * (x - m);
  v /= (arr.length - 1); // sample stddev
  return Math.sqrt(v);
}

/**
 * One independent run.
 * NOTE: This is intentionally "pure" relative to cfg (we don't mutate cfg).
 */
function runSingleSimulation(cfg) {
  // ------------------------------------------------------------
  // INITIALIZATION
  // ------------------------------------------------------------

  const backlog = new Backlog(cfg.backlogSize);

  // Pre-fill backlog
  for (let i = 0; i < cfg.backlogSize; i++) {
    backlog.addTask(Task.random(cfg));
  }

  // Workers
  const workers = [];
  for (let i = 0; i < cfg.numWorkers; i++) {
    workers.push(new Worker(i, cfg));
  }

  // Initialize beliefs model (0..1) for "who is the expert?"
  for (const w of workers) {
    if (typeof w.initBeliefsForTopics === "function") {
      w.initBeliefsForTopics(cfg.numTaskTypes, workers);
    }
  }

  // Product Owner
  const po = new ProductOwner(cfg);

  const stats = {
    totalValue: 0,
    totalTasksCompleted: 0,

    totalInfoCycles: 0,
    totalImplCycles: 0,
    totalConversationCycles: 0,

    totalAskAttempts: 0,
    askWithHelper: 0,
    askWithoutHelper: 0,
    successfulConversations: 0,
    failedConversations: 0,

    evictedTasks: 0,
    evictedValue: 0,
    totalTasksArrived: 0,

    cumulativeRecurringValue: 0,
    currentCycleCompletedValue: 0,
    completedTasksThisCycle: [],

    averageCumulativeValuePerCycle: 0,
    averageCumulativeValuePerCyclePerWorker: 0,

    // Expertise summary scalars (0..1)
    finalTeamAvgExpertise: 0,
    finalTeamAvgMaxExpertisePerTopic: 0
  };

  const burnInCycles = cfg.burnInCycles ?? 0;

  // ------------------------------------------------------------
  // SIMULATION LOOP
  // ------------------------------------------------------------

  for (let cycle = 0; cycle < cfg.numCycles; cycle++) {
    // --------------------------------------------------------
    // 1. ENVIRONMENTAL TASK ARRIVAL (Poisson)
    // --------------------------------------------------------
    const lambda = cfg.envTaskRate ?? 0;
    const taskArrivalCount = samplePoisson(lambda);

    for (let i = 0; i < taskArrivalCount; i++) {
      backlog.addTask(Task.random(cfg));
      stats.totalTasksArrived++;
    }

    // Eviction if backlog too large
    while (backlog.size() > cfg.maxBacklogSize) {
      const evicted = backlog.evictLowestValue();
      if (evicted) {
        stats.evictedTasks++;
        stats.evictedValue += evicted.value;
      }
    }

    // --------------------------------------------------------
    // 2. PRODUCT OWNER SORTING
    // --------------------------------------------------------
    const poAbsent = Math.random() < (cfg.poAbsenceProb ?? 0);
    if (!poAbsent) {
      po.work(cycle, backlog, cfg);
    }

    // --------------------------------------------------------
    // 3. WORKER ABSENCES
    // --------------------------------------------------------
    for (const w of workers) {
      w.isAbsent = Math.random() < (cfg.absenceProb ?? 0);
    }

    // --------------------------------------------------------
    // 4. WORKER TASK ASSIGNMENT
    // --------------------------------------------------------
    for (const w of workers) {
      if (w.isAbsent) continue;

      if (!w.currentTask) {
        const t = backlog.takeTask();
        if (t) w.assignTask(t);
      }
    }

    // --------------------------------------------------------
    // 5. WORKER ACTIONS
    // --------------------------------------------------------
    stats.currentCycleCompletedValue = 0;
    stats.completedTasksThisCycle = [];

    for (const w of workers) {
      if (w.isAbsent) continue;
      if (!w.currentTask) continue;

      const topic = w.currentTask.type;

      // --------------------------------------------
      // INFO PHASE
      // --------------------------------------------
      if (w.phase === "info") {
        stats.totalInfoCycles++;

        // Worker decides whether to ask AND who to ask based on beliefs + askProb + askMinGain.
        // shouldAskForHelp returns: { shouldAsk, helper, bestGap }
        let decision = { shouldAsk: false, helper: null, bestGap: 0 };

        if (typeof w.shouldAskForHelp === "function") {
          decision = w.shouldAskForHelp(topic, workers);
        } else {
          // Fallback: old behavior
          decision.shouldAsk = Math.random() < (cfg.askProb ?? 0);
          decision.helper =
            typeof w.chooseExpertForTopic === "function"
              ? w.chooseExpertForTopic(topic, workers)
              : null;
        }

        if (decision.shouldAsk) {
          stats.totalAskAttempts++;

          const helper = decision.helper;

          // helper must be present AND currently has a task
          if (helper && !helper.isAbsent && helper.currentTask) {
            stats.successfulConversations++;
            stats.totalConversationCycles++;
            stats.askWithHelper++;

            w.workInfoWithHelper(helper);
          } else {
            stats.failedConversations++;
            stats.askWithoutHelper++;

            w.workInfoSolo();
          }
        } else {
          w.workInfoSolo();
        }

        continue;
      }

      // --------------------------------------------
      // IMPL PHASE
      // --------------------------------------------
      if (w.phase === "impl") {
        stats.totalImplCycles++;
        w.workImpl();

        if (w.remainingImpl <= 0) {
          const t = w.currentTask;

          stats.totalValue += t.value;
          stats.totalTasksCompleted++;
          stats.currentCycleCompletedValue += t.value;

          if (cycle >= burnInCycles) {
            const recurring = t.value * t.valueRetention;
            stats.cumulativeRecurringValue += recurring;
          }

          stats.completedTasksThisCycle.push(t);

          w.clearTask();
        }

        continue;
      }
    }

    // --------------------------------------------------------
    // 6. APPLY PER-WORKER DECAY
    // --------------------------------------------------------
    for (const w of workers) {
      if (!w.isAbsent) w.applyDecay();
    }

    // --------------------------------------------------------
    // 7. RECURRING VALUE (no-op placeholder)
    // --------------------------------------------------------
    if (cycle >= burnInCycles) {
      stats.cumulativeRecurringValue *= 1;
    }
  }

  // ------------------------------------------------------------
  // FINAL CALCULATIONS
  // ------------------------------------------------------------
  stats.averageCumulativeValuePerCycle =
    stats.cumulativeRecurringValue / cfg.numCycles;

  stats.averageCumulativeValuePerCyclePerWorker =
    stats.averageCumulativeValuePerCycle / cfg.numWorkers;

  stats.finalTeamAvgExpertise = computeFinalTeamAvgExpertise(workers, cfg.numTaskTypes);
  stats.finalTeamAvgMaxExpertisePerTopic = computeFinalTeamAvgMaxExpertisePerTopic(workers, cfg.numTaskTypes);

  return { stats, workers };
}

/**
 * Public entrypoint.
 * If cfg.replicates > 1, returns aggregate stats (mean + stddev) and one sample run.
 */
export function runSimulation(cfg) {
  const reps = Math.max(1, Math.floor(cfg.replicates ?? 1));

  if (reps === 1) {
    const { stats, workers } = runSingleSimulation(cfg);
    return { stats, workers, cfg };
  }

  const perRepStats = [];
  let sample = null;

  for (let r = 0; r < reps; r++) {
    const run = runSingleSimulation(cfg);
    perRepStats.push(run.stats);

    if (r === reps - 1) {
      // keep only one sample run (last) to avoid huge payloads
      sample = { stats: run.stats, workers: run.workers };
    }
  }

  // Aggregate numeric fields (mean + stddev)
  const numericKeys = Object.keys(perRepStats[0]).filter((k) => {
    const v = perRepStats[0][k];
    return typeof v === "number" && Number.isFinite(v);
  });

  const aggregate = {};
  for (const k of numericKeys) {
    const values = perRepStats.map((s) => s[k]);
    aggregate[k] = mean(values);
    aggregate[`${k}StdDev`] = stddev(values);
  }

  // Helpful meta
  aggregate.replicates = reps;

  return {
    stats: aggregate,
    // keep one representative run so UI/debug can still see worker state
    sample,
    cfg
  };
}
