// Worker.js
export class Worker {
  constructor(id, cfg) {
    this.id = id;
    this.cfg = cfg;

    this.currentTask = null;
    this.phase = null; // "info" | "impl" | null

    this.remainingInfo = 0;
    this.remainingImpl = 0;

    this.isAbsent = false;

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
      knowledge: this.knowledge,
      beliefsByTopic: this.beliefsByTopic,
      touchedTopicThisCycle: this.touchedTopicThisCycle
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

  // Solo research learning: E' = E + r * (1 - E)
  researchTopic(topic) {
    const rate = this.cfg.researchLearningRate ?? 0.05;
    if (rate <= 0) return;

    const current = this.getKnowledge(topic);
    const delta = rate * (1 - current);
    this.setKnowledge(topic, current + delta);
  }

  // Implementation learning: E' = E + r * (1 - E)
  implLearnTopic(topic) {
    const rate = this.cfg.implLearningRate ?? 0.02;
    if (rate <= 0) return;

    const current = this.getKnowledge(topic);
    const delta = rate * (1 - current);
    this.setKnowledge(topic, current + delta);
  }

  // Conversation learning:
  // U = 1 - (1-A)(1-B)
  // A' = A + c(U - A); B' = B + c(U - B)
  converseWith(helper, topic) {
    const c = this.cfg.conversationLearningRate ?? 0.6;

    const A = this.getKnowledge(topic);
    const B = helper.getKnowledge(topic);

    const union = 1 - (1 - A) * (1 - B);

    const newA = A + c * (union - A);
    const newB = B + c * (union - B);

    this.setKnowledge(topic, newA);
    helper.setKnowledge(topic, newB);
  }

  // Decay only on topics NOT touched this cycle
  applyDecay() {
    const decay = this.cfg.knowledgeDecayRate ?? 0;
    if (decay <= 0) {
      this.touchedTopicThisCycle = null;
      return;
    }

    const touched = this.touchedTopicThisCycle;

    for (const [topic, value] of Object.entries(this.knowledge)) {
      if (String(topic) === String(touched)) continue;
      const decayed = value * (1 - decay);
      this.setKnowledge(topic, decayed);
    }

    this.touchedTopicThisCycle = null;
  }

  // -----------------------------
  // Beliefs (who is the expert?)
  // -----------------------------

  initBeliefsForTopics(numTopics, workers) {
    const initMax = this.cfg.beliefInitMax ?? 0.1;

    for (let topic = 0; topic < numTopics; topic++) {
      if (!this.beliefsByTopic[topic]) this.beliefsByTopic[topic] = {};

      for (const w of workers) {
        if (w.id === this.id) continue; // never store self belief
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

  getBelief(topic, workerId) {
    if (workerId === this.id) return 0; // never believe "me"
    return this.beliefsByTopic?.[topic]?.[workerId] ?? 0;
  }

  // EMA update toward observed helper knowledge
  updateBelief(topic, helperId, observedKnowledge) {
    if (helperId === this.id) return; // hard block self-belief

    if (!this.beliefsByTopic[topic]) this.beliefsByTopic[topic] = {};

    const alpha = this.cfg.beliefUpdateRate ?? 0.2;
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
      if (w.id === this.id) continue; // hard block self
      if (w.isAbsent) continue;

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
    const askProb = this.cfg.askProb ?? 0;
    if (Math.random() >= askProb) {
      return { shouldAsk: false, helper: null, bestGap: 0 };
    }

    const { helper, bestGap } = this.chooseHelperForTopic(topic, workers);

    const askMinGain = this.cfg.askMinGain ?? 0;

    // If we "want to ask" but no helper exists, let sim count it as a failed attempt
    if (!helper) return { shouldAsk: true, helper: null, bestGap: 0 };

    if (bestGap < askMinGain) {
      return { shouldAsk: false, helper: null, bestGap };
    }

    return { shouldAsk: true, helper, bestGap };
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

  // -----------------------------
  // Work cycles
  // -----------------------------

  workInfoSolo() {
    if (!this.currentTask) return;

    const topic = this.currentTask.type;
    this.touchedTopicThisCycle = topic;

    this.researchTopic(topic);

    const expertise = this.getKnowledge(topic);
    const remaining = this.remainingInfo;

    let reduction = Math.max(1, Math.round(expertise * remaining));
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

    this.converseWith(helper, topic);

    // Update beliefs both ways (never allows self due to guard in updateBelief)
    this.updateBelief(topic, helper.id, helper.getKnowledge(topic));
    helper.updateBelief(topic, this.id, this.getKnowledge(topic));

    const expertise = this.getKnowledge(topic);
    const remaining = this.remainingInfo;

    let reduction = Math.max(1, Math.round(expertise * remaining));
    reduction = Math.min(reduction, remaining);

    this.remainingInfo = remaining - reduction;

    if (this.remainingInfo <= 0) {
      this.remainingInfo = 0;
      this.phase = this.remainingImpl > 0 ? "impl" : null;
    }
  }

  workImpl() {
    if (!this.currentTask) return;

    const topic = this.currentTask.type;
    this.touchedTopicThisCycle = topic;

    this.implLearnTopic(topic);

    this.remainingImpl -= 1;
    if (this.remainingImpl <= 0) this.remainingImpl = 0;
  }
}
