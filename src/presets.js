// src/presets.js

import baseConfig from "./config/baseConfig.json";

const clone = (obj) => JSON.parse(JSON.stringify(obj));

export const presetGroups = [
  {
    id: "environment",
    label: "Business environment",
    presets: [
      {
        id: "default",
        label: "Default",
        patch: { environment: clone(baseConfig.environment) },
      },
      {
        id: "richGrowing",
        label: "Rich & growing",
        patch: {
          environment: {
            newTaskRate: 3,
            avgTaskValue: 14,
            retentionMin: 0.5,
            retentionMax: 0.9,
          },
        },
      },
      {
        id: "steady",
        label: "Steady demand",
        patch: {
          environment: {
            newTaskRate: 2,
            avgTaskValue: 10,
            retentionMin: 0.3,
            retentionMax: 0.7,
          },
        },
      },
      {
        id: "shrinking",
        label: "Shrinking / low demand",
        patch: {
          environment: {
            newTaskRate: 0.5,
            avgTaskValue: 6,
            retentionMin: 0.1,
            retentionMax: 0.5,
          },
        },
      },
    ],
  },
  {
    id: "behavior",
    label: "Behavior / learning",
    presets: [
      {
        id: "default",
        label: "Default",
        patch: {},
      },
      {
        id: "novice",
        label: "New team",
        patch: {
          behavior: {
            askProbability: 0.8,
            absenceProbability: 0.08,
            forgetfulness: 0.12,
            completionLearningRate: 0.25,
            conversationLearningRate: 0.15,
          },
        },
      },
      {
        id: "mixed",
        label: "Mixed / growing",
        patch: {
          behavior: {
            askProbability: 0.5,
            absenceProbability: 0.05,
            forgetfulness: 0.05,
            completionLearningRate: 0.18,
            conversationLearningRate: 0.12,
          },
        },
      },
      {
        id: "expert",
        label: "Experienced team",
        patch: {
          behavior: {
            askProbability: 0.3,
            absenceProbability: 0.03,
            forgetfulness: 0.02,
            completionLearningRate: 0.16,
            conversationLearningRate: 0.1,
          },
        },
      },
    ],
  },
  {
    id: "productOwner",
    label: "Product Owner",
    presets: [
      { id: "default", label: "Default", patch: { productOwner: clone(baseConfig.productOwner) } },
      {
        id: "chaotic",
        label: "Chaotic / absent",
        patch: {
          productOwner: {
            windowSize: 5,
            actionsPerCycle: 0,
            absenceProbability: 0.6,
            errorProbability: 0.9,
          },
        },
      },
      {
        id: "ok",
        label: "OK PO",
        patch: {
          productOwner: {
            windowSize: 10,
            actionsPerCycle: 1,
            absenceProbability: 0.2,
            errorProbability: 0.4,
          },
        },
      },
      {
        id: "experienced",
        label: "Experienced PO",
        patch: {
          productOwner: {
            windowSize: 15,
            actionsPerCycle: 2,
            absenceProbability: 0.05,
            errorProbability: 0.15,
          },
        },
      },
    ],
  },
  {
    id: "turnover",
    label: "Turnover & hiring",
    presets: [
      { id: "default", label: "Default", patch: {} },
      {
        id: "stable",
        label: "Stable team",
        patch: {
          turnover: {
            probability: 0.0,
            hireAvgFactor: 0.85,
            specialistBoost: 0.2,
            candidateInterarrivalMean: 3,
            interviewCostPerCycle: 0.25,
            assessmentNoise: 0.08,
            minHireBar: 0.5,
            interviewRounds: 1,
          },
        },
      },
      {
        id: "churny",
        label: "High churn",
        patch: {
          turnover: {
            probability: 0.08,
            hireAvgFactor: 0.7,
            specialistBoost: 0.35,
            candidateInterarrivalMean: 2,
            interviewCostPerCycle: 0.6,
            assessmentNoise: 0.15,
            minHireBar: 0.4,
            interviewRounds: 2,
          },
        },
      },
    ],
  },
  {
    id: "simulation",
    label: "Simulation run",
    presets: [
      { id: "default", label: "Default", patch: { simulation: clone(baseConfig.simulation) } },
      {
        id: "short",
        label: "Short run",
        patch: { simulation: { numCycles: 2000, burnInCycles: 200, replicates: 5 } },
      },
      {
        id: "long",
        label: "Long run",
        patch: { simulation: { numCycles: 15000, burnInCycles: 3000, replicates: 20 } },
      },
    ],
  },
];

// Apply all selected presets on top of a base config.
// `selections` is { [groupId]: presetId }
export function applyPresetGroups(baseConfig, selections) {
  let cfg = JSON.parse(JSON.stringify(baseConfig));

  const deepMerge = (target, patch) => {
    for (const [k, v] of Object.entries(patch)) {
      if (v && typeof v === "object" && !Array.isArray(v)) {
        if (!target[k] || typeof target[k] !== "object") target[k] = {};
        deepMerge(target[k], v);
      } else {
        target[k] = v;
      }
    }
  };

  for (const group of presetGroups) {
    const selectedId = selections?.[group.id];
    if (!selectedId) continue;

    const preset = group.presets.find((p) => p.id === selectedId);
    if (!preset || !preset.patch) continue;

    // Empty patch means "Custom" / no-op
    if (Object.keys(preset.patch).length === 0) continue;

    deepMerge(cfg, preset.patch);
  }

  return cfg;
}
