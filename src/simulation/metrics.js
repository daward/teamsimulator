// src/simulation/metrics.js

export function computeFinalTeamAvgExpertise(workers, numTaskTypes) {
  if (!workers?.length || !numTaskTypes) return 0;

  let sum = 0;
  for (const w of workers) {
    for (let topic = 0; topic < numTaskTypes; topic++) {
      sum += w.getKnowledge ? w.getKnowledge(topic) : (w.knowledge?.[topic] ?? 0);
    }
  }
  return sum / (workers.length * numTaskTypes);
}

export function computeFinalTeamAvgMaxExpertisePerTopic(workers, numTaskTypes) {
  if (!workers?.length || !numTaskTypes) return 0;

  let sumMax = 0;
  for (let topic = 0; topic < numTaskTypes; topic++) {
    let m = 0;
    for (const w of workers) {
      const k = w.getKnowledge ? w.getKnowledge(topic) : (w.knowledge?.[topic] ?? 0);
      if (k > m) m = k;
    }
    sumMax += m;
  }
  return sumMax / numTaskTypes;
}
