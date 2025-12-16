// src/sweep.js
import fs from "fs";
import path from "path";
import runSimulation from "./simulation";

const baseConfigPath = path.join(__dirname, "..", "config.json");
const sweepConfigPath = path.join(__dirname, "..", "sweep-config.json");

function loadBaseConfig() {
  const raw = fs.readFileSync(baseConfigPath, "utf8");
  const cfg = JSON.parse(raw);

  const defaults = {
    numWorkers: 8,
    numTaskTypes: 20,
    avgInfoTime: 4,
    avgImplTime: 6,
    avgValue: 5,
    memoryDepth: 5,
    askProb: 0.3,
    absenceProb: 0.05,
    numCycles: 10000,
    helpStrategy: "expert",
    logEvery: 0,

    // Backlog / PO defaults
    backlogSize: 50,
    poWindowSize: 5,
    poActionsPerCycle: 1,
    poAbsenceProb: 0.0
  };

  const merged = { ...defaults, ...cfg };
  merged.helpStrategy = String(merged.helpStrategy || "expert").toLowerCase();
  return merged;
}

function loadSweepConfig() {
  const raw = fs.readFileSync(sweepConfigPath, "utf8");
  const cfg = JSON.parse(raw);
  const outputFile = cfg.outputFile || "sweep-results.csv";
  const sweep = cfg.sweep || {};
  return { outputFile, sweep };
}

// ---------- helpers: build combinations ----------

function getValues(def) {
  if (def == null) return [];
  if (Array.isArray(def)) return def;
  if (Array.isArray(def.values)) return def.values;
  throw new Error(
    "Invalid sweep var definition; expected { values: [...] } or array"
  );
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

// ---------- main sweep ----------

function main() {
  const baseCfg = loadBaseConfig();
  const { outputFile, sweep } = loadSweepConfig();

  const { varNames, combos } = buildCombinations(sweep);

  if (combos.length === 0) {
    console.log("No sweep vars configured; nothing to do.");
    return;
  }

  console.log(
    `Sweeping over ${combos.length} combinations for vars: ${varNames.join(
      ", "
    )}`
  );

  const rows = [];

  rows.push(
    [
      ...varNames,
      "totalValue",
      "totalTasksCompleted",
      "numCycles",
      "valuePerCycle",
      "valuePerTask",
      "conversationCycles",
      "successfulConversations",
      "failedConversations",
      "totalAskAttempts",
      "askWithHelper",
      "askWithoutHelper"
    ].join(",")
  );

  combos.forEach((combo, idx) => {
    const cfg = {
      ...baseCfg,
      ...combo
    };

    console.log(
      `\n[${idx + 1}/${combos.length}] Running sim with: ` +
        varNames.map((n) => `${n}=${cfg[n]}`).join(", ")
    );

    const { stats } = runSimulation(cfg);

    const valuePerCycle = stats.totalValue / cfg.numCycles;
    const valuePerTask =
      stats.totalValue / (stats.totalTasksCompleted || 1);

    const row = [
      ...varNames.map((name) => cfg[name]),
      stats.totalValue,
      stats.totalTasksCompleted,
      cfg.numCycles,
      valuePerCycle.toFixed(6),
      valuePerTask.toFixed(6),
      stats.totalConversationCycles,
      stats.successfulConversations,
      stats.failedConversations,
      stats.totalAskAttempts,
      stats.askWithHelper,
      stats.askWithoutHelper
    ].join(",");

    rows.push(row);
  });

  const outPath = path.join(__dirname, "..", outputFile);
  fs.writeFileSync(outPath, rows.join("\n"), "utf8");
  console.log(`\nWrote sweep results to ${outPath}`);
}

main();
