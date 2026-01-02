// Worker.js
import { clamp01 } from "./utils.js";

export class Worker {
  constructor(id, cfg) {
    this.id = id;
    this.cfg = cfg;
    this.learningScale = 1;
    this.workScale = 1;
    this.implLearningScale = this.learningScale;
    this.conversationLearningScale = this.learningScale;
    this.forgetfulnessScale = this.learningScale;

    this.currentTask = null;
    this.phase = null; // "info" | "impl" | null

    this.remainingInfo = 0;
    this.remainingImpl = 0;

    this.isAbsent = false;
    this.markedForRemoval = false; // set when turnover fires
    this.busy = false; // used within a cycle when assisting/interviewing
    this.currentInterview = null; // {candidate, roundsRemaining, bar, noise, turnover, numTopics, hireId}

    // topicId -> expertise (0..1)
    this.knowledge = {};

    // topicId -> { workerId -> belief (0..1) }
    this.beliefsByTopic = {};

    // topic this worker "touched" this cycle (info/impl/convo)
    this.touchedTopicThisCycle = null;
  }

  toJSON() {
    return {
      id: this.id,
      phase: this.phase,
      remainingInfo: this.remainingInfo,
      remainingImpl: this.remainingImpl,
      isAbsent: this.isAbsent,
      workScale: this.workScale,
      knowledge: this.knowledge,
      beliefsByTopic: this.beliefsByTopic,
      touchedTopicThisCycle: this.touchedTopicThisCycle,
      markedForRemoval: this.markedForRemoval
    };
  }

  // -----------------------------
  // Knowledge helpers
  // -----------------------------

  getKnowledge(topic) {
    return this.knowledge[topic] ?? 0;
  }

  setKnowledge(topic, value) {
    const clamped = Math.max(0, Math.min(1, value));
    this.knowledge[topic] = clamped;
  }

  purgeBeliefsForIds(ids) {
    if (!ids || !ids.length) return;
    for (const topic of Object.keys(this.beliefsByTopic)) {
      const map = this.beliefsByTopic[topic];
      for (const id of ids) {
        if (map && map[id] != null) delete map[id];
      }
      if (map && Object.keys(map).length === 0) {
        delete this.beliefsByTopic[topic];
      }
    }
  }

  // Conversation learning:
  // U = 1 - (1-A)(1-B)
  // A' = A + c(U - A); B' = B + c(U - B)
  converseWith(helper, topic) {
    const cBase = this.cfg.behavior?.conversationLearningRate ?? 0.6;
    const c = Math.min(1, Math.max(0, cBase * this.conversationLearningScale));

    const A = this.getKnowledge(topic);
    const B = helper.getKnowledge(topic);

    const union = 1 - (1 - A) * (1 - B);

    const newA = A + c * (union - A);
    const newB = B + c * (union - B);

    this.setKnowledge(topic, newA);
    helper.setKnowledge(topic, newB);

    return {
      deltaSelf: newA - A,
      deltaHelper: newB - B
    };
  }

  // Decay only on topics NOT touched this cycle
  applyDecay() {
    const decayBase = this.cfg.behavior?.forgetfulness ?? 0;
    const decay = Math.min(1, decayBase * this.forgetfulnessScale);
    if (decay <= 0) {
      this.touchedTopicThisCycle = null;
      return;
    }

    const touched = this.touchedTopicThisCycle;

    for (const [topic, value] of Object.entries(this.knowledge)) {
      if (String(topic) === String(touched)) {
        continue;
      }
      const decayed = value * (1 - decay);
      this.setKnowledge(topic, decayed);
    }

    this.touchedTopicThisCycle = null;
  }

  // -----------------------------
  // Beliefs (who is the expert?)
  // -----------------------------

  initBeliefsForTopics(numTopics, workers) {
    const initMax = this.cfg.belief?.initMax ?? 0.1;

    for (let topic = 0; topic < numTopics; topic++) {
      if (!this.beliefsByTopic[topic]) this.beliefsByTopic[topic] = {};

      for (const w of workers) {
        if (w.id === this.id) {
          continue; // never store self belief
        }
        if (this.beliefsByTopic[topic][w.id] == null) {
          this.beliefsByTopic[topic][w.id] = Math.random() * initMax; // small random
        }
      }

      // extra defense: if anything snuck in, delete it
      if (this.beliefsByTopic[topic][this.id] != null) {
        delete this.beliefsByTopic[topic][this.id];
      }
    }
  }

  resetKnowledgeAndBeliefs() {
    this.knowledge = {};
    this.beliefsByTopic = {};
    this.touchedTopicThisCycle = null;
    this.currentTask = null;
    this.phase = null;
    this.remainingInfo = 0;
    this.remainingImpl = 0;
    this.markedForRemoval = false;
    this.busy = false;
  }

  onboardFromTemplate(avgKnowledgeByTopic, cfg, numTopics) {
    this.resetKnowledgeAndBeliefs();

    const topics = Math.max(1, numTopics ?? 1);
    const mode = cfg.turnover?.hireMode || "average";
    const avgFactor = Math.max(0, Math.min(1, cfg.turnover?.hireAvgFactor ?? 0.8));
    const specialistBoost = Math.max(0, cfg.turnover?.specialistBoost ?? 0.25);

    const specialistPenalty = mode === "specialist" ? 0.5 : 1;

    // Default: mirror team average but scaled down (e.g., college hire)
    for (let t = 0; t < topics; t++) {
      const avg = avgKnowledgeByTopic?.[t] ?? 0;
      this.setKnowledge(t, avg * avgFactor * specialistPenalty);
    }

    // Specialist mode: pick strongest topic (team avg) and boost it; others stay lower
    if (mode === "specialist") {
      let strongest = 0;
      let strongestVal = avgKnowledgeByTopic?.[0] ?? 0;
      for (let t = 1; t < topics; t++) {
        const v = avgKnowledgeByTopic?.[t] ?? 0;
        if (v > strongestVal) {
          strongestVal = v;
          strongest = t;
        }
      }
      const baseStrong =
        (avgKnowledgeByTopic?.[strongest] ?? 0) * avgFactor * specialistPenalty;
      const boosted = Math.min(
        1,
        Math.max(baseStrong, (avgKnowledgeByTopic?.[strongest] ?? 0) * avgFactor + specialistBoost)
      );
      this.setKnowledge(strongest, boosted);
    }
  }

  getBelief(topic, workerId) {
    if (workerId === this.id) return 0; // never believe "me"
    return this.beliefsByTopic?.[topic]?.[workerId] ?? 0;
  }

  // EMA update toward observed helper knowledge
  updateBelief(topic, helperId, observedKnowledge) {
    if (helperId === this.id) return; // hard block self-belief

    if (!this.beliefsByTopic[topic]) this.beliefsByTopic[topic] = {};

    // Trust the latest observation strongly (no configurable slow EMA).
    const alpha = 1;
    const prev = this.getBelief(topic, helperId);
    const next = prev * (1 - alpha) + observedKnowledge * alpha;

    // clamp 0..1
    this.beliefsByTopic[topic][helperId] = Math.max(0, Math.min(1, next));
  }

  /**
   * Choose the best helper for this topic based on beliefs.
   * Returns { helper, bestGap } where bestGap = believedHelperKnowledge - myKnowledge.
   */
  chooseHelperForTopic(topic, workers) {
    const myK = this.getKnowledge(topic);

    let best = null;
    let bestGap = -Infinity;

    const beliefs = this.beliefsByTopic[topic] ?? {};

    for (const w of workers) {
      if (w.id === this.id) {
        continue; // hard block self
      }
      if (w.isAbsent) {
        continue;
      }

      const belief = beliefs[w.id] ?? 0;
      const gap = belief - myK;

      if (gap > bestGap) {
        bestGap = gap;
        best = w;
      }
    }

    if (!best) return { helper: null, bestGap: -Infinity };
    return { helper: best, bestGap };
  }

  /**
   * Should we ask for help?
   * Gate by:
   * 1) random chattiness: Math.random() < askProb
   * 2) expected gain: bestGap >= askMinGain
   */
  shouldAskForHelp(topic, workers) {
    const askProb = this.cfg.behavior?.askProbability ?? 0;
    const mustAskThreshold = this.cfg.behavior?.askMustThreshold ?? 0.1;
    const myK = this.getKnowledge(topic);

    const { helper, bestGap } = this.chooseHelperForTopic(topic, workers);

    const askMinGain = this.cfg.behavior?.askMinimumGain ?? 0;

    // If my own expertise is very low, always attempt to ask someone before starting.
    if (myK < mustAskThreshold) {
      return { shouldAsk: true, helper, bestGap, reason: "mustAskLowSkill" };
    }

    if (Math.random() >= askProb) {
      return { shouldAsk: false, helper: null, bestGap: 0, reason: "random" };
    }

    // If we "want to ask" but no helper exists, let sim count it as a failed attempt
    if (!helper) return { shouldAsk: true, helper: null, bestGap, reason: "noHelper" };

    if (bestGap < askMinGain) {
      return { shouldAsk: false, helper: null, bestGap, reason: "noBetter" };
    }

    return { shouldAsk: true, helper, bestGap, reason: "betterHelper" };
  }

  // -----------------------------
  // Task handling
  // -----------------------------

  assignTask(task) {
    this.currentTask = task;
    this.phase = "info";
    this.remainingInfo = task.infoTime;
    this.remainingImpl = task.implTime;
  }

  clearTask() {
    this.currentTask = null;
    this.phase = null;
    this.remainingInfo = 0;
    this.remainingImpl = 0;
  }

  startInterview({ turnover, hireId, numTopics }) {
    const minSkill = clamp01(turnover?.candidateSkillMin ?? 0.05);
    const maxSkill = clamp01(turnover?.candidateSkillMax ?? 0.95);
    const lo = Math.min(minSkill, maxSkill);
    const hi = Math.max(minSkill, maxSkill);
    const candidate = { trueSkill: lo + Math.random() * (hi - lo) };
    const noise = clamp01(turnover?.assessmentNoise ?? 0.1);
    const bar = clamp01(turnover?.minHireBar ?? 0.5);
    const rounds = Math.max(1, Math.floor(turnover?.interviewRounds ?? 1));

    this.currentInterview = {
      candidate,
      turnover,
      roundsRemaining: rounds,
      bar,
      noise,
      hireId,
      numTopics,
    };
    this.busy = true;
  }

  startDay() {
    this.busy = false;
    this.isAbsent = Math.random() < (this.cfg.behavior?.absenceProbability ?? 0);
  }

  // -----------------------------
  // Work cycles
  // -----------------------------

  isAvailable() {
    if (this.isAbsent) return false;
    if (this.markedForRemoval) return false;
    if (this.currentInterview) return false;
    if (this.busy) return false;
    return true;
  }

  /**
   * Count this worker as active for the cycle (present, not marked for removal).
   * Returns true if counted.
   */
  recordActive(stats) {
    if (this.isAbsent || this.markedForRemoval) return false;
    stats.workerActiveCycles[this.id] = (stats.workerActiveCycles[this.id] || 0) + 1;
    return true;
  }

  /**
   * Execute one cycle of work for this worker (interview or task).
   * Returns { hire } if an interview completes with a hire.
   */
  workCycle({ workers, stats, cfg, cycle, burnInCycles }) {
    if (this.markedForRemoval) return {};

    // Interviews preempt all work
    if (this.currentInterview) {
      const { turnover = {}, roundsRemaining, bar, noise, candidate, hireId, numTopics } =
        this.currentInterview;

      const costPerCycle = Math.max(0, turnover.interviewCostPerCycle ?? 0.5);
      stats.interviewCyclesSpent = (stats.interviewCyclesSpent || 0) + costPerCycle;

      this.currentInterview.roundsRemaining -= 1;
      if (this.currentInterview.roundsRemaining <= 0) {
        const perceived = candidate.trueSkill + (Math.random() * 2 - 1) * (noise ?? 0);
        const perceivedClamped = Math.max(0, Math.min(1, perceived));
        const hire = perceivedClamped >= (bar ?? 0.5);
        let worker = null;
        if (hire && hireId != null) {
          worker = createHiredWorker({
            id: hireId,
            cfg,
            numTopics,
            turnover,
            seedSkill: candidate.trueSkill,
          });
        }
        if (stats) {
          if (hire) {
            stats.hireCount = (stats.hireCount || 0) + 1;
            if (Number.isFinite(candidate?.trueSkill)) {
              stats.totalHireSkill = (stats.totalHireSkill || 0) + candidate.trueSkill;
            }
          } else {
            stats.rejectCount = (stats.rejectCount || 0) + 1;
          }
        }
        this.currentInterview = null;
        this.applyDecay();
        return { hire: worker };
      }
      // interview ongoing; consume cycle
      this.applyDecay();
      this.busy = true;
      return {};
    }
  }

  workInfoSolo() {
    if (!this.currentTask) return;

    const topic = this.currentTask.type;
    this.touchedTopicThisCycle = topic;

    const expertise = this.getKnowledge(topic);
    const remaining = this.remainingInfo;

    const speedScale = Number.isFinite(this.workScale) ? this.workScale : 1;
    let reduction = Math.max(1, Math.round(expertise * remaining * speedScale));
    reduction = Math.min(reduction, remaining);

    this.remainingInfo = remaining - reduction;

    if (this.remainingInfo <= 0) {
      this.remainingInfo = 0;
      this.phase = this.remainingImpl > 0 ? "impl" : null;
    }
  }

  workInfoWithHelper(helper) {
    if (!this.currentTask) return;
    if (!helper) return this.workInfoSolo();
    if (helper.id === this.id) return this.workInfoSolo(); // hard block self-helper

    const topic = this.currentTask.type;
    this.touchedTopicThisCycle = topic;
    helper.touchedTopicThisCycle = topic;

    // Conversation learning updates both workers now.
    const convo = this.converseWith(helper, topic);

    // Update beliefs both ways (never allows self due to guard in updateBelief)
    this.updateBelief(topic, helper.id, helper.getKnowledge(topic));
    helper.updateBelief(topic, this.id, this.getKnowledge(topic));

    const remaining = this.remainingInfo;

    const expertise = this.getKnowledge(topic);

    const speedScale = Number.isFinite(this.workScale) ? this.workScale : 1;
    let reduction = Math.max(1, Math.round(expertise * remaining * speedScale));
    reduction = Math.min(reduction, remaining);

    this.remainingInfo = remaining - reduction;

    if (this.remainingInfo <= 0) {
      this.remainingInfo = 0;
      this.phase = this.remainingImpl > 0 ? "impl" : null;
    }

    return (convo?.deltaSelf ?? 0) + (convo?.deltaHelper ?? 0);
  }

  // Ask for help in info phase; returns { success, lostCycle }
  askForHelp(helper, bestGap = 0, stats = null, cfg = null) {
    // If helper is invalid, treat as failure
    if (!helper || helper.id === this.id) return { success: false, lostCycle: false };

    // Apply joint info work + learning
    const gain = this.workInfoWithHelper(helper);

    if (stats && Number.isFinite(gain)) {
      stats.conversationExperienceGain = (stats.conversationExperienceGain || 0) + gain;
    }

    // Helper loses this cycle when they assist
    return { success: true, lostCycle: true };
  }

  workImpl() {
    if (!this.currentTask) return;

    const topic = this.currentTask.type;
    this.touchedTopicThisCycle = topic;

    this.remainingImpl -= 1;
    if (this.remainingImpl <= 0) this.remainingImpl = 0;
  }

  learnOnTaskCompletion(task) {
    if (!task) return 0;
    const topic = task.type;

    const infoUnits = task.initialInfoTime ?? task.infoTime ?? 0;
    const implUnits = task.initialImplTime ?? task.implTime ?? 0;
    const effort = Math.max(1, infoUnits + implUnits);

    const decay = this.cfg.behavior?.forgetfulness ?? 0;
    const fallbackRate = Math.max(0.15, 4 * decay);
    const baseRate = this.cfg.behavior?.completionLearningRate ?? fallbackRate;

    // Scale by effort with a stronger boost; still sublinear and capped.
    const effectiveRate = Math.min(
      0.95,
      baseRate * this.implLearningScale * (1 + 2 * Math.log1p(effort))
    );

    if (effectiveRate <= 0) return 0;

    const current = this.getKnowledge(topic);
    const delta = effectiveRate * (1 - current);
    this.setKnowledge(topic, current + delta);
    return delta;
  }

  /**
   * Internal task-progress step (info/impl/help).
   */
  workTask({ workers, stats, cfg, burnInCycles, cycle }) {
    if (!this.currentTask) return;

    const topic = this.currentTask.type;
    if (stats.workerValue[this.id] == null) stats.workerValue[this.id] = 0;

    // Info phase
    if (this.phase === "info") {
      stats.totalInfoCycles++;

      let decision = { shouldAsk: false, helper: null, bestGap: 0 };
      if (typeof this.shouldAskForHelp === "function") {
        decision = this.shouldAskForHelp(topic, workers);
      }

      if (decision.shouldAsk) {
        stats.totalAskAttempts++;
        const helper = decision.helper;

        if (helper && !helper.isAbsent && !helper.busy && !helper.markedForRemoval) {
          const { success, lostCycle } = this.askForHelp(
            helper,
            decision.bestGap ?? 0,
            stats,
            cfg
          );

          if (lostCycle) {
            helper.busy = true;
          }

          if (success) {
            stats.successfulConversations++;
          } else {
            stats.failedConversations++;
          }
          stats.totalConversationCycles++;
          stats.askWithHelper++;
        } else {
          stats.noHelpFound = (stats.noHelpFound || 0) + 1;
          stats.failedConversations++;
        }
      } else {
        stats.didNotAsk = (stats.didNotAsk || 0) + 1;
        if ((decision.reason === "noBetter" || decision.bestGap <= 0) && decision.reason !== "random") {
          stats.didNotAskAmTheExpert = (stats.didNotAskAmTheExpert || 0) + 1;
        }
      }

      // progress info work
      const helper = decision.helper;
      const canUseHelper =
        decision.shouldAsk &&
        helper &&
        !helper.isAbsent &&
        !helper.busy &&
        !helper.markedForRemoval;

      let convoGain = 0;
      if (canUseHelper) {
        const delta = this.workInfoWithHelper(helper);
        if (Number.isFinite(delta)) convoGain += delta;
      } else {
        this.workInfoSolo();
      }

      if (Number.isFinite(convoGain)) {
        stats.conversationExperienceGain = (stats.conversationExperienceGain || 0) + convoGain;
      }

      if (this.remainingInfo <= 0) {
        this.phase = "impl";
      }

      return;
    }

    // Impl phase
    if (this.phase === "impl") {
      stats.totalImplCycles++;
      this.workImpl();

      if (this.remainingImpl <= 0) {
        const t = this.currentTask;

        stats.totalValue += t.value;
        stats.workerValue[this.id] = (stats.workerValue[this.id] || 0) + t.value;
        stats.totalTasksCompleted++;
        stats.currentCycleCompletedValue += t.value;

        const gain = this.learnOnTaskCompletion(t);
        if (Number.isFinite(gain)) stats.completionExperienceGain += gain;

        if (cycle >= burnInCycles) {
          const recurring = t.value * t.valueRetention;
          stats.cumulativeRecurringValue += recurring;
        }

        stats.completedTasksThisCycle.push(t);

        // Turnover at task completion
        const turnoverProb = cfg.turnover?.probability ?? 0;
        if (turnoverProb > 0 && Math.random() < turnoverProb) {
          this.markedForRemoval = true;
          stats.turnovers++;
        }

        this.clearTask();
      }
    }
  }

  /**
   * Wrapper to run a full work cycle (interview or task + decay).
   */
  tick({ workers, stats, cfg, cycle, burnInCycles }) {
    if (this.isAbsent || this.markedForRemoval) return {};

    // Interviews preempt tasks
    if (this.currentInterview) {
      return this.workCycle({ workers, stats, cfg, cycle, burnInCycles });
    }

    if (this.currentTask) {
      this.workTask({ workers, stats, cfg, burnInCycles, cycle });
    }

    this.applyDecay();
    return {};
  }
}

// Factory helper for hires from a candidate profile
export function createHiredWorker({
  id,
  cfg,
  numTopics,
  turnover,
  seedSkill,
}) {
  const w = new Worker(id, cfg);
  const mode = turnover?.hireMode || "average";
  const avgFactor = Math.max(0, Math.min(1, turnover?.hireAvgFactor ?? 0.8));
  const specialistBoost = Math.max(0, turnover?.specialistBoost ?? 0.25);
  const skill = clamp01(seedSkill ?? 0);
  const exponent = Math.max(0.1, turnover?.hireSkillExponent ?? 1.5);
  const skillCurve = Math.pow(skill, exponent);
  const base = Math.max(0, skillCurve * Math.max(0.2, avgFactor * 0.5));
  // Scale learning down sharply for weak hires; stronger hires learn much faster.
  const learningScale = Math.max(0.05, Math.min(1, skillCurve * 1.3));
  const workScale = Math.max(0.2, Math.min(1, skillCurve * 1.1));
  w.learningScale = learningScale;
  w.workScale = workScale;
  w.implLearningScale = learningScale;
  w.conversationLearningScale = learningScale;
  // Weaker hires also forget faster.
  const forgetScale = Math.min(3, 1 + Math.max(0, 0.7 - skillCurve) * 2);
  w.forgetfulnessScale = forgetScale;
  for (let t = 0; t < numTopics; t++) {
    w.setKnowledge?.(t, base);
  }
  if (mode === "specialist" && numTopics > 0) {
    const strongest = Math.floor(Math.random() * numTopics);
    const boosted = Math.min(1, base + specialistBoost);
    w.setKnowledge?.(strongest, boosted);
  }
  return w;
}
