// src/simulation.js
import { Worker } from "./worker.js";
import { createRandomTask } from "./task.js";
import { Backlog } from "./backlog.js";
import { ProductOwner } from "./po.js";
import { samplePoisson, shuffleInPlace, mean } from "./utils.js";
import {
  computeFinalTeamAvgExpertise,
  computeFinalTeamAvgMaxExpertisePerTopic
} from "./metrics.js";


/**
 * One independent run.
 * NOTE: Intentionally "pure" relative to cfg (we don't mutate cfg).
 */
function makeInitialStats() {
  return {
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

    teamProductivity: 0,
    workerProductivity: 0,
    activeWorkerCycles: 0,

    // final expertise scalars (0..1)
    finalTeamAvgExpertise: 0,
    finalTeamAvgMaxExpertisePerTopic: 0,

    // Knowledge gain tracking
    conversationExperienceGain: 0,
    completionExperienceGain: 0,

    turnovers: 0
  };
}

function flattenConfig(cfg) {
  if (!cfg || typeof cfg !== "object") return {};
  const out = { ...cfg };

  const pick = (path) =>
    path.reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), cfg);

  const map = [
    [["environment", "newTaskRate"], "envTaskRate"],
    [["environment", "avgTaskValue"], "avgValue"],
    [["environment", "retentionMin"], "taskRetentionMin"],
    [["environment", "retentionMax"], "taskRetentionMax"],
    [["backlog", "initialSize"], "backlogSize"],
    [["backlog", "maxSize"], "maxBacklogSize"],
    [["team", "size"], "numWorkers"],
    [["team", "numTaskTypes"], "numTaskTypes"],
    [["tasks", "avgInfoTime"], "avgInfoTime"],
    [["tasks", "avgImplTime"], "avgImplTime"],
    [["behavior", "askProbability"], "askProb"],
    [["behavior", "askMinimumGain"], "askMinGain"],
    [["behavior", "absenceProbability"], "absenceProb"],
    [["behavior", "knowledgeDecayRate"], "knowledgeDecayRate"],
    [["behavior", "completionLearningRate"], "completionLearningRate"],
    [["behavior", "conversationLearningRate"], "conversationLearningRate"],
    [["productOwner", "windowSize"], "poWindowSize"],
    [["productOwner", "actionsPerCycle"], "poActionsPerCycle"],
    [["productOwner", "absenceProbability"], "poAbsenceProb"],
    [["productOwner", "errorProbability"], "poErrorProb"],
    [["turnover", "probability"], "turnoverProb"],
    [["turnover", "hireLag"], "turnoverHireLag"],
    [["turnover", "hireAvgFactor"], "turnoverHireAvgFactor"],
    [["turnover", "hireMode"], "turnoverHireMode"],
    [["turnover", "specialistBoost"], "turnoverSpecialistBoost"],
    [["belief", "updateRate"], "beliefUpdateRate"],
    [["belief", "initMax"], "beliefInitMax"],
    [["simulation", "numCycles"], "numCycles"],
    [["simulation", "burnInCycles"], "burnInCycles"],
    [["simulation", "logEvery"], "logEvery"],
    [["simulation", "replicates"], "replicates"],
  ];

  for (const [path, target] of map) {
    const v = pick(path);
    if (v !== undefined) out[target] = v;
  }

  return out;
}

function finalizeStats(stats, workers, cfg) {
  stats.teamProductivity = stats.cumulativeRecurringValue / cfg.numCycles;
  const avgActiveWorkers = stats.activeWorkerCycles / cfg.numCycles;
  stats.workerProductivity =
    avgActiveWorkers > 0 ? stats.teamProductivity / avgActiveWorkers : 0;
  // Hierarchical/stat aliases for clarity
  stats["productivity:team"] = stats.teamProductivity;
  stats["productivity:worker"] = stats.workerProductivity;
  stats.productivity = {
    team: stats.teamProductivity,
    worker: stats.workerProductivity,
  };

  stats.finalTeamAvgExpertise = computeFinalTeamAvgExpertise(workers, cfg.numTaskTypes);
  stats.finalTeamAvgMaxExpertisePerTopic = computeFinalTeamAvgMaxExpertisePerTopic(
    workers,
    cfg.numTaskTypes
  );

   const totalGain =
     (stats.conversationExperienceGain ?? 0) + (stats.completionExperienceGain ?? 0);
   stats.conversationExperienceShare =
     totalGain > 0 ? stats.conversationExperienceGain / totalGain : 0;
}

function computeAvgKnowledgeByTopic(workers, numTopics) {
  const topics = Math.max(1, numTopics ?? 1);
  const sums = new Array(topics).fill(0);
  const counts = new Array(topics).fill(0);

  for (const w of workers) {
    for (let t = 0; t < topics; t++) {
      const v = w.knowledge?.[t];
      if (typeof v === "number" && Number.isFinite(v)) {
        sums[t] += v;
        counts[t] += 1;
      }
    }
  }

  const avg = new Array(topics).fill(0);
  for (let t = 0; t < topics; t++) {
    avg[t] = counts[t] > 0 ? sums[t] / counts[t] : 0;
  }
  return avg;
}

function runSingleSimulation(cfg) {
  // ------------------------------------------------------------
  // INITIALIZATION
  // ------------------------------------------------------------

  const backlog = new Backlog(cfg.backlogSize);

  // Pre-fill backlog
  for (let i = 0; i < cfg.backlogSize; i++) {
    backlog.addTask(createRandomTask(cfg));
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

  const stats = makeInitialStats();

  const burnInCycles = cfg.burnInCycles ?? 0;

  // ------------------------------------------------------------
  // SIMULATION LOOP
  // ------------------------------------------------------------

  for (let cycle = 0; cycle < cfg.numCycles; cycle++) {
    // Handle vacancies: onboard new hires whose lag has expired
    for (const w of workers) {
      if (w.vacantUntil != null && cycle >= w.vacantUntil) {
        const avgKnowledgeByTopic = computeAvgKnowledgeByTopic(
          workers.filter((p) => p !== w),
          cfg.numTaskTypes
        );
        w.onboardFromTemplate(avgKnowledgeByTopic, cfg, cfg.numTaskTypes);
        if (typeof w.initBeliefsForTopics === "function") {
          w.initBeliefsForTopics(cfg.numTaskTypes, workers);
        }
      }
    }

    // --------------------------------------------------------
    // 1. ENVIRONMENTAL TASK ARRIVAL (Poisson)
    // --------------------------------------------------------
    const arrivals = samplePoisson(cfg.envTaskRate ?? 0);
    for (let i = 0; i < arrivals; i++) {
      backlog.addTask(createRandomTask(cfg));
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
      if (w.vacantUntil != null && w.vacantUntil > cycle) {
        w.isAbsent = true;
        continue;
      }
      w.isAbsent = Math.random() < (cfg.absenceProb ?? 0);
    }

    // Track active (present and non-vacant) workers for per-worker productivity
    let activeThisCycle = 0;
    for (const w of workers) {
      const isVacant = w.vacantUntil != null && w.vacantUntil > cycle;
      if (!w.isAbsent && !isVacant) activeThisCycle += 1;
    }
    stats.activeWorkerCycles += activeThisCycle;

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
    // 5. WORKER ACTIONS (with conversation cost!)
    // --------------------------------------------------------
    stats.currentCycleCompletedValue = 0;
    stats.completedTasksThisCycle = [];

    // NEW: randomize order each cycle so "helper loses cycle" isn't biased
    const order = workers.slice();
    shuffleInPlace(order);

    // NEW: track who has already acted or is "busy helping" this cycle
    const actedThisCycle = new Set();
    const busyThisCycle = new Set(); // includes helpers that must skip their own action

    for (const w of order) {
      if (w.isAbsent) continue;
      if (!w.currentTask) continue;

      // If this worker is marked busy (they helped someone), they lose their cycle.
      if (busyThisCycle.has(w.id)) {
        actedThisCycle.add(w.id);
        continue;
      }

      // Also guard against double-processing
      if (actedThisCycle.has(w.id)) continue;

      const topic = w.currentTask.type;

      // --------------------------------------------
      // INFO PHASE
      // --------------------------------------------
      if (w.phase === "info") {
        stats.totalInfoCycles++;

        // Decide whether to ask and who to ask
        let decision = { shouldAsk: false, helper: null, bestGap: 0 };

        if (typeof w.shouldAskForHelp === "function") {
          decision = w.shouldAskForHelp(topic, workers);
        } else {
          decision.shouldAsk = Math.random() < (cfg.askProb ?? 0);
          decision.helper =
            typeof w.chooseExpertForTopic === "function"
              ? w.chooseExpertForTopic(topic, workers)
              : null;
        }

        if (decision.shouldAsk) {
          stats.totalAskAttempts++;

          const helper = decision.helper;

          // Helper must be:
          // - present
          // - has a task
          // - not already acted this cycle
          // - not already busy helping someone else
          const helperOk =
            helper &&
            !helper.isAbsent &&
            helper.currentTask &&
            !actedThisCycle.has(helper.id) &&
            !busyThisCycle.has(helper.id);

          if (helperOk) {
            // successful conversation
            stats.successfulConversations++;
            stats.totalConversationCycles++;
            stats.askWithHelper++;

            // Conversation happens: asker acts, helper becomes busy and loses their cycle.
            const gain = w.workInfoWithHelper(helper);
            if (Number.isFinite(gain)) {
              stats.conversationExperienceGain += gain;
            }

            // COST: helper loses their cycle this round
            busyThisCycle.add(helper.id);
          } else {
            // attempted but no helper
            stats.failedConversations++;
            stats.askWithoutHelper++;

            // Ask attempt doesn't cost a cycle beyond the asker's normal action;
            // the cost model you asked for is "both workers lose a cycle when convo occurs".
            w.workInfoSolo();
          }
        } else {
          // no ask attempt
          w.workInfoSolo();
        }

        actedThisCycle.add(w.id);
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

          // Apply consolidated learning at task completion.
          const gain = w.learnOnTaskCompletion(t);
          if (Number.isFinite(gain)) {
            stats.completionExperienceGain += gain;
          }

          if (cycle >= burnInCycles) {
            const recurring = t.value * t.valueRetention;
            stats.cumulativeRecurringValue += recurring;
          }

          stats.completedTasksThisCycle.push(t);

          // Turnover check happens at task completion
          const turnoverProb = cfg.turnoverProb ?? 0;
          if (turnoverProb > 0 && Math.random() < turnoverProb) {
            w.resetKnowledgeAndBeliefs();
            const lag = Math.max(0, Math.floor(cfg.turnoverHireLag ?? 0));
            w.vacantUntil = cycle + lag;
            stats.turnovers++;
          }

          w.clearTask();
        }

        actedThisCycle.add(w.id);
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
  finalizeStats(stats, workers, cfg);

  return { stats, workers };
}

/**
 * Public entrypoint.
 * If cfg.replicates > 1, returns aggregate stats (mean only) and one sample run.
 */
export function runSimulation(cfg) {
  cfg = flattenConfig(cfg);
  const reps = Math.max(1, Math.floor(cfg.replicates ?? 20));

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

  // Aggregate numeric fields (mean only)
  const numericKeys = Object.keys(perRepStats[0]).filter((k) => {
    const v = perRepStats[0][k];
    return typeof v === "number" && Number.isFinite(v);
  });

  const aggregate = {};
  for (const k of numericKeys) {
    const values = perRepStats.map((s) => s[k]);
    aggregate[k] = mean(values);
  }

  aggregate.replicates = reps;

  return {
    stats: aggregate,
    sample,
    cfg
  };
}

export default runSimulation;
