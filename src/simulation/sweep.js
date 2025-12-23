// src/sweep.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { applyUnitConfig, randomUnitVars } from "./unitConfig.js";

// Support either default export or named export
import * as simModule from "./simulation.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const baseConfigPath = path.join(__dirname, "..", "config.json");
const sweepConfigPath = path.join(__dirname, "..", "sweep-config.json");

function getRunSimulation() {
  if (typeof simModule.runSimulation === "function") return simModule.runSimulation;
  if (typeof simModule.default === "function") return simModule.default;
  throw new Error(
    "Could not find runSimulation export. Expected named export runSimulation or default export from ./simulation.js"
  );
}

function loadJsonIfExists(p) {
  if (!fs.existsSync(p)) return null;
  const raw = fs.readFileSync(p, "utf8");
  return JSON.parse(raw);
}

function loadBaseConfig() {
  const cfg = loadJsonIfExists(baseConfigPath) ?? {};

  const defaults = {
    numWorkers: 8,
    numTaskTypes: 20,
    avgInfoTime: 4,
    avgImplTime: 6,
    avgValue: 5,

    askProb: 0.3,
    askMinGain: 0.0,
    absenceProb: 0.05,
    numCycles: 10000,
    burnInCycles: 0,
    logEvery: 0,

    backlogSize: 50,
    maxBacklogSize: 200,
    poWindowSize: 5,
    poActionsPerCycle: 1,
    poAbsenceProb: 0.0,
    poErrorProb: 0.3,

    taskRetentionMin: 0.1,
    taskRetentionMax: 0.7,

    envTaskRate: 1,

    knowledgeDecayRate: 0.05,
    completionLearningRate: 0.15,
    conversationLearningRate: 0.1,

    beliefUpdateRate: 0.2,
    beliefInitMax: 0.1,

    replicates: 20
  };

  return { ...defaults, ...cfg };
}

function loadSweepConfig() {
  const cfg = loadJsonIfExists(sweepConfigPath);

  // If missing, default to a single legacy “no-op sweep” (just runs once)
  if (!cfg) {
    return {
      outputFile: "sweep-results.csv",
      sweep: { _dummy: { values: [0] } }, // makes the code run one combo
      unitRandom: null,
      unitMappings: {}
    };
  }

  return {
    outputFile: cfg.outputFile || "sweep-results.csv",
    sweep: cfg.sweep || {},
    unitRandom: cfg.unitRandom || null,
    unitMappings: cfg.unitMappings || {}
  };
}

// ---------- legacy helpers: build combinations ----------

function getValues(def) {
  if (def == null) return [];
  if (Array.isArray(def)) return def;
  if (Array.isArray(def.values)) return def.values;
  throw new Error("Invalid sweep var definition; expected { values: [...] } or array");
}

function buildCombinations(sweepDef) {
  const varNames = Object.keys(sweepDef);
  if (varNames.length === 0) {
    return { varNames, combos: [Object.create(null)] };
  }

  const valueLists = varNames.map((name) => getValues(sweepDef[name]));

  const combos = [];
  function recurse(index, current) {
    if (index === varNames.length) {
      combos.push({ ...current });
      return;
    }
    const name = varNames[index];
    const values = valueLists[index];
    for (const v of values) {
      current[name] = v;
      recurse(index + 1, current);
    }
  }

  recurse(0, {});
  return { varNames, combos };
}

// ---------- unit-space helpers ----------

function buildUnitRandomPoints(unitRandom, unitMappings) {
  const n = Math.max(1, Math.floor(unitRandom?.n ?? 0));
  const unitVarNames = Object.keys(unitMappings ?? {});
  if (!n) return { unitVarNames, points: [] };
  if (unitVarNames.length === 0) {
    throw new Error("unitRandom is set but unitMappings is empty. Add unitMappings in sweep-config.json.");
  }

  const points = [];
  for (let i = 0; i < n; i++) {
    points.push(randomUnitVars(unitMappings));
  }
  return { unitVarNames, points };
}

function numOrZero(v) {
  return Number.isFinite(v) ? v : 0;
}

function main() {
  const baseCfg = loadBaseConfig();
  const { outputFile, sweep, unitRandom, unitMappings } = loadSweepConfig();
  const runSimulation = getRunSimulation();

  const rows = [];

  const useUnitRandom = !!unitRandom;

  if (useUnitRandom) {
    const { unitVarNames, points } = buildUnitRandomPoints(unitRandom, unitMappings);

    console.log(
      `Unit-random sweep: ${points.length} points over unit vars: ${unitVarNames.join(", ")}`
    );

    rows.push(
      [
        ...unitVarNames,

        // include some mapped cfg fields for debugging/plotting
        "envTaskRate",
        "numWorkers",
        "numTaskTypes",
        "avgInfoTime",
        "avgImplTime",
        "avgValue",
        "askProb",
        "askMinGain",
        "absenceProb",
        "replicates",
        "numCycles",

        // outputs
        "totalValue",
        "totalTasksCompleted",
        "valuePerCycle",
        "valuePerTask",
        "conversationCycles",
        "successfulConversations",
        "failedConversations",
        "totalAskAttempts",
        "askWithHelper",
        "askWithoutHelper",
        "finalTeamAvgExpertise",
        "finalTeamAvgMaxExpertisePerTopic"
      ].join(",")
    );

    points.forEach((unitVars, idx) => {
      const cfg = applyUnitConfig(baseCfg, unitVars, unitMappings);

      console.log(`\n[${idx + 1}/${points.length}] Running unit point`);

      const result = runSimulation(cfg);
      const stats = result?.stats ?? {};

      const totalValue = numOrZero(stats.totalValue);
      const tasksCompleted = numOrZero(stats.totalTasksCompleted);

      const valuePerCycle = totalValue / (cfg.numCycles || 1);
      const valuePerTask = totalValue / (tasksCompleted || 1);

      const row = [
        ...unitVarNames.map((n) => unitVars[n]),

        cfg.envTaskRate,
        cfg.numWorkers,
        cfg.numTaskTypes,
        cfg.avgInfoTime,
        cfg.avgImplTime,
        cfg.avgValue,
        cfg.askProb,
        cfg.askMinGain ?? 0,
        cfg.absenceProb,
        cfg.replicates ?? 20,
        cfg.numCycles,

        totalValue,
        tasksCompleted,
        valuePerCycle.toFixed(6),
        valuePerTask.toFixed(6),
        numOrZero(stats.totalConversationCycles),
        numOrZero(stats.successfulConversations),
        numOrZero(stats.failedConversations),
        numOrZero(stats.totalAskAttempts),
        numOrZero(stats.askWithHelper),
        numOrZero(stats.askWithoutHelper),
        numOrZero(stats.finalTeamAvgExpertise),
        numOrZero(stats.finalTeamAvgMaxExpertisePerTopic)
      ].join(",");

      rows.push(row);
    });
  } else {
    // legacy explicit sweep
    const { varNames, combos } = buildCombinations(sweep);

    if (combos.length === 0) {
      console.log("No sweep vars configured; nothing to do.");
      return;
    }

    console.log(
      `Sweeping over ${combos.length} combinations for vars: ${varNames.join(", ")}`
    );

    rows.push(
      [
        ...varNames,
        "totalValue",
        "totalTasksCompleted",
        "numCycles",
        "replicates",
        "valuePerCycle",
        "valuePerTask",
        "conversationCycles",
        "successfulConversations",
        "failedConversations",
        "totalAskAttempts",
        "askWithHelper",
        "askWithoutHelper",
        "finalTeamAvgExpertise",
        "finalTeamAvgMaxExpertisePerTopic"
      ].join(",")
    );

    combos.forEach((combo, idx) => {
      const cfg = { ...baseCfg, ...combo };

      console.log(
        `\n[${idx + 1}/${combos.length}] Running sim with: ` +
          varNames.map((n) => `${n}=${cfg[n]}`).join(", ")
      );

      const result = runSimulation(cfg);
      const stats = result?.stats ?? {};

      const totalValue = numOrZero(stats.totalValue);
      const tasksCompleted = numOrZero(stats.totalTasksCompleted);

      const valuePerCycle = totalValue / (cfg.numCycles || 1);
      const valuePerTask = totalValue / (tasksCompleted || 1);

      const row = [
        ...varNames.map((name) => cfg[name]),
        totalValue,
        tasksCompleted,
        cfg.numCycles,
        cfg.replicates ?? 20,
        valuePerCycle.toFixed(6),
        valuePerTask.toFixed(6),
        numOrZero(stats.totalConversationCycles),
        numOrZero(stats.successfulConversations),
        numOrZero(stats.failedConversations),
        numOrZero(stats.totalAskAttempts),
        numOrZero(stats.askWithHelper),
        numOrZero(stats.askWithoutHelper),
        numOrZero(stats.finalTeamAvgExpertise),
        numOrZero(stats.finalTeamAvgMaxExpertisePerTopic)
      ].join(",");

      rows.push(row);
    });
  }

  const outPath = path.join(__dirname, "..", outputFile);
  fs.writeFileSync(outPath, rows.join("\n"), "utf8");
  console.log(`\nWrote sweep results to ${outPath}`);
}

main();



