// src/simulation/simulation.js
import { Worker } from "./worker.js";
import { createRandomTask } from "./task.js";
import { Backlog } from "./backlog.js";
import { ProductOwner } from "./po.js";
import { samplePoisson, shuffleInPlace, mean } from "./utils.js";
import {
  computeFinalTeamAvgExpertise,
  computeFinalTeamAvgMaxExpertisePerTopic,
} from "./metrics.js";

function makeInitialStats() {
  return {
    totalValue: 0,
    totalTasksCompleted: 0,

    totalInfoCycles: 0,
    totalImplCycles: 0,
    totalConversationCycles: 0,

    totalAskAttempts: 0,
    askWithHelper: 0,
    didNotAsk: 0,
    didNotAskAmTheExpert: 0,
    noHelpFound: 0,
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

    finalTeamAvgExpertise: 0,
    finalTeamAvgMaxExpertisePerTopic: 0,

    conversationExperienceGain: 0,
    completionExperienceGain: 0,

    turnovers: 0,
    candidateCount: 0,
    hireCount: 0,
    rejectCount: 0,
    totalCandidateSkill: 0,
    totalHireSkill: 0,
    avgCandidateSkill: 0,
    avgHireSkill: 0,
    hireRate: 0,
    vacancyCycles: 0,
    vacancyRate: 0,
    interviewCyclesSpent: 0,
    totalHireDelay: 0,
    hiresFilled: 0,
    cyclesToHireAvg: 0,
    hireLearningScaleAvg: 0,

    // per-worker tracking
    workerValue: {},
    workerActiveCycles: {},
  };
}

function finalizeStats(stats, workers, cfg, formerWorkers = []) {
  const numCycles = cfg?.simulation?.numCycles ?? 1;
  const targetHeadcount = cfg?.team?.size ?? 0;

  // ensure live workers have entries
  for (const w of workers) {
    if (stats.workerValue[w.id] == null) stats.workerValue[w.id] = 0;
    if (stats.workerActiveCycles[w.id] == null) stats.workerActiveCycles[w.id] = 0;
  }
  // former workers already contributed to workerValue/workerActiveCycles before removal
  for (const fw of formerWorkers) {
    if (fw.id == null) {
      continue;
    }
    stats.workerValue[fw.id] = (stats.workerValue[fw.id] || 0) + (fw.value || 0);
    stats.workerActiveCycles[fw.id] =
      (stats.workerActiveCycles[fw.id] || 0) + (fw.activeCycles || 0);
  }

  stats.teamProductivity = stats.cumulativeRecurringValue / numCycles;
  const totalActiveSum = Object.values(stats.workerActiveCycles).reduce((a, b) => a + b, 0);
  // Per-worker productivity: total recurring value produced per active worker-cycle.
  stats.workerProductivity =
    totalActiveSum > 0 ? stats.cumulativeRecurringValue / totalActiveSum : 0;
  stats.cyclesToHireAvg =
    stats.hiresFilled > 0 ? stats.totalHireDelay / stats.hiresFilled : 0;
  stats.hireRate = stats.candidateCount > 0 ? stats.hireCount / stats.candidateCount : 0;
  stats.avgCandidateSkill =
    stats.candidateCount > 0 ? stats.totalCandidateSkill / stats.candidateCount : 0;
  stats.avgHireSkill = stats.hireCount > 0 ? stats.totalHireSkill / stats.hireCount : 0;
  const totalSeatCycles = numCycles * targetHeadcount;
  stats.vacancyRate = totalSeatCycles > 0 ? stats.vacancyCycles / totalSeatCycles : 0;

  // Average hire learning scale across all current and former workers
  const allWorkers = [...workers, ...formerWorkers];
  const scales = allWorkers
    .map((w) => (w.learningScale ?? 1))
    .filter((v) => Number.isFinite(v) && v > 0);
  stats.hireLearningScaleAvg =
    scales.length > 0 ? scales.reduce((a, b) => a + b, 0) / scales.length : 0;

  const numTopics = cfg?.team?.numTaskTypes ?? 1;
  stats.finalTeamAvgExpertise = computeFinalTeamAvgExpertise(workers, numTopics);
  stats.finalTeamAvgMaxExpertisePerTopic = computeFinalTeamAvgMaxExpertisePerTopic(
    workers,
    numTopics
  );

  const totalGain =
    (stats.conversationExperienceGain ?? 0) + (stats.completionExperienceGain ?? 0);
  stats.conversationExperienceShare =
    totalGain > 0 ? stats.conversationExperienceGain / totalGain : 0;
}

function runSingleSimulation(cfg) {
  const numCycles = cfg?.simulation?.numCycles ?? 0;
  const burnInCycles = cfg?.simulation?.burnInCycles ?? 0;

  const env = cfg?.environment || {};
  const backlogCfg = cfg?.backlog || {};
  const team = cfg?.team || {};
  const behavior = cfg?.behavior || {};
  const productOwnerCfg = cfg?.productOwner || {};
  const turnover = cfg?.turnover || {};

  // Backlog and initial tasks
  const backlog = new Backlog(backlogCfg.initialSize ?? 0);
  const initialBacklogSize = backlogCfg.initialSize ?? 0;
  for (let i = 0; i < initialBacklogSize; i++) {
    backlog.addTask(createRandomTask(cfg));
  }

  // Workers
  const workerCount = team.size ?? 0;
  const workers = [];
  let nextWorkerId = workerCount;
  const formerWorkers = [];
  for (let i = 0; i < workerCount; i++) {
    workers.push(new Worker(i, cfg));
  }

  const numTaskTypes = team.numTaskTypes ?? 1;
  workers.forEach((w) => w.initBeliefsForTopics(numTaskTypes, workers));

  const po = new ProductOwner(cfg);
  const stats = makeInitialStats();
  const targetHeadcount = workerCount;
  for (const w of workers) {
    stats.workerValue[w.id] = 0;
    stats.workerActiveCycles[w.id] = 0;
  }

  // Simulation loop
  const openVacancies = [];

  for (let cycle = 0; cycle < numCycles; cycle++) {
    const hiresPending = [];

    // reset busy flags and set absences per worker
    workers.forEach((w) => w.startDay());

    // track open seats this cycle (seat-cycles)
    const vacancySeats = Math.max(0, targetHeadcount - workers.length);
    stats.vacancyCycles += vacancySeats;

    // 1) Interview: one per cycle if a seat is open
    const turnoverProb = turnover?.probability ?? 0;
    const missingSeats = Math.max(0, targetHeadcount - workers.length - hiresPending.length);
    if (missingSeats > 0 && turnoverProb > 0) {
      const arrivalProb = 1 / Math.max(1, turnover.candidateInterarrivalMean ?? 5);
      if (Math.random() < arrivalProb) {
        const interviewer = workers.find((w) => !w.isAbsent && w.currentInterview == null);
        if (interviewer) {
          interviewer.startInterview({
            turnover,
            hireId: nextWorkerId,
            numTopics: numTaskTypes,
          });
          const candidateSkill = interviewer.currentInterview?.candidate?.trueSkill;
          stats.candidateCount += 1;
          if (Number.isFinite(candidateSkill)) {
            stats.totalCandidateSkill += candidateSkill;
          }
        }
      }
    }

    // 1) Task arrivals
    const arrivals = samplePoisson(env.newTaskRate ?? 0);
    stats.totalTasksArrived += arrivals;
    for (let i = 0; i < arrivals; i++) {
      backlog.addTask(createRandomTask(cfg));
    }

    // 2) Product Owner sorting + eviction
    const poAbsent = Math.random() < (productOwnerCfg.absenceProbability ?? 0);
    if (!poAbsent) {
      po.work(cycle, backlog, cfg);
      backlog.evictExtra(backlogCfg.maxSize ?? Infinity, (tasks) => po.pickEvictionIndex(tasks), stats);
    }

    // 3) Worker task assignment
    for (const w of workers) {
      if (!w.isAvailable()) {
        continue;
      }
      if (!w.currentTask) {
        const t = backlog.takeTask();
        if (t) w.assignTask(t);
      }
    }

    // 4) Worker actions
    stats.currentCycleCompletedValue = 0;
    stats.completedTasksThisCycle = [];

    const order = workers.slice();
    shuffleInPlace(order);
    for (const w of order) {
      const result = w.tick({
        workers,
        stats,
        cfg,
        cycle,
        burnInCycles,
      });
      if (result?.hire) {
        hiresPending.push(result.hire);
      }
    }

    // Active counts (exclude absent, busy/interview/helper, or marked for removal)
    let activeThisCycle = 0;
    for (const w of workers) {
      if (w.recordActive(stats)) {
        activeThisCycle += 1;
      }
    }
    stats.activeWorkerCycles += activeThisCycle;

    const removedIds = [];
    // Remove workers marked for removal (turnover)
    for (let i = workers.length - 1; i >= 0; i--) {
      if (workers[i].markedForRemoval) {
        openVacancies.push(cycle);
        removedIds.push(workers[i].id);
        formerWorkers.push({
          id: workers[i].id,
          value: stats.workerValue[workers[i].id] || 0,
          activeCycles: stats.workerActiveCycles[workers[i].id] || 0,
        });
        workers.splice(i, 1);
      }
    }
    if (removedIds.length) {
      workers.forEach((w) => w.purgeBeliefsForIds(removedIds));
    }

    // add any queued hires (start next cycle)
    if (hiresPending.length) {
      for (const hire of hiresPending) {
        hire.id = nextWorkerId++;
        stats.workerValue[hire.id] = 0;
        stats.workerActiveCycles[hire.id] = 0;
        if (openVacancies.length) {
          const openedCycle = openVacancies.shift();
          const delay = Math.max(0, cycle - openedCycle + 1);
          stats.totalHireDelay += delay;
          stats.hiresFilled += 1;
        }
        workers.push(hire);
        hire.initBeliefsForTopics(numTaskTypes, workers);
      }
    }

    // 7) Recurring value (placeholder)
    if (cycle >= burnInCycles) {
      stats.cumulativeRecurringValue *= 1;
    }
  }

  finalizeStats(stats, workers, cfg, formerWorkers);
  return { stats, workers };
}

export function runSimulation(cfg) {
  const reps = Math.max(1, Math.floor(cfg.simulation?.replicates ?? 1));

  const perRepStats = [];
  let sample = null;

  for (let r = 0; r < reps; r++) {
    const run = runSingleSimulation(cfg);
    perRepStats.push(run.stats);
    if (r === reps - 1) sample = run;
  }

  const agg = {};
  if (perRepStats.length) {
    const keys = Object.keys(perRepStats[0]);
    for (const k of keys) {
      agg[k] = mean(perRepStats.map((s) => s[k]));
    }
  }

  return {
    stats: agg,
    sample,
    workers: sample?.workers,
    perRepStats,
    cfg,
  };
}
