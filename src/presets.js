// src/presets.js

export const presetGroups = [
  {
    id: "businessEnv",
    label: "Business environment",
    presets: [
      {
        id: "custom",
        label: "Custom",
        patch: {},
      },
      {
        id: "richGrowing",
        label: "Rich & growing",
        patch: {
          envTaskRate: 3,
          avgValue: 14,
          taskRetentionMin: 0.5,
          taskRetentionMax: 0.9,
        },
      },
      {
        id: "steady",
        label: "Steady demand",
        patch: {
          envTaskRate: 2,
          avgValue: 10,
          taskRetentionMin: 0.3,
          taskRetentionMax: 0.7,
        },
      },
      {
        id: "shrinking",
        label: "Shrinking / low demand",
        patch: {
          envTaskRate: 0.5,
          avgValue: 6,
          taskRetentionMin: 0.1,
          taskRetentionMax: 0.5,
        },
      },
    ],
  },

  {
    id: "teamMaturity",
    label: "Team maturity",
    presets: [
      {
        id: "custom",
        label: "Custom",
        patch: {},
      },
      {
        id: "novice",
        label: "New team",
        patch: {
          askProb: 0.8,
          absenceProb: 0.08,
          knowledgeDecayRate: 0.12,
          completionLearningRate: 0.25,
        },
      },
      {
        id: "mixed",
        label: "Mixed / growing",
        patch: {
          askProb: 0.5,
          absenceProb: 0.05,
          knowledgeDecayRate: 0.05,
          completionLearningRate: 0.18,
        },
      },
      {
        id: "expert",
        label: "Experienced team",
        patch: {
          askProb: 0.3,
          absenceProb: 0.03,
          knowledgeDecayRate: 0.02,
          completionLearningRate: 0.16,
        },
      },
    ],
  },

  {
    id: "poMaturity",
    label: "PO maturity",
    presets: [
      {
        id: "custom",
        label: "Custom",
        patch: {},
      },
      {
        id: "chaotic",
        label: "Chaotic / absent",
        patch: {
          poWindowSize: 5,
          poActionsPerCycle: 0,
          poAbsenceProb: 0.6,
          poErrorProb: 0.9,
        },
      },
      {
        id: "ok",
        label: "OK PO",
        patch: {
          poWindowSize: 10,
          poActionsPerCycle: 1,
          poAbsenceProb: 0.2,
          poErrorProb: 0.4,
        },
      },
      {
        id: "experienced",
        label: "Experienced PO",
        patch: {
          poWindowSize: 15,
          poActionsPerCycle: 2,
          poAbsenceProb: 0.05,
          poErrorProb: 0.15,
        },
      },
    ],
  },
];

// Apply all selected presets on top of a base config.
// `selections` is { [groupId]: presetId }
export function applyPresetGroups(baseConfig, selections) {
  let cfg = { ...baseConfig };

  for (const group of presetGroups) {
    const selectedId = selections?.[group.id];
    if (!selectedId) continue;

    const preset = group.presets.find((p) => p.id === selectedId);
    if (!preset || !preset.patch) continue;

    // Empty patch means "Custom" / no-op
    if (Object.keys(preset.patch).length === 0) continue;

    cfg = { ...cfg, ...preset.patch };
  }

  return cfg;
}
