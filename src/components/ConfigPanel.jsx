// src/components/ConfigPanel.jsx
import React from "react";

function NumberField({ label, path, value, onChange, min, max, step, help }) {
  const handleChange = (e) => {
    const raw = e.target.value;
    if (raw === "") return;
    const num = Number(raw);
    if (Number.isNaN(num)) return;
    onChange(path, num);
  };

  return (
    <div style={{ marginBottom: 6 }}>
      <label style={{ fontSize: 12 }}>
        <span style={{ fontWeight: "bold" }}>{label}</span>
        {help && (
          <span style={{ color: "#666", marginLeft: 4 }}>– {help}</span>
        )}
        <br />
        <input
          type="number"
          value={value ?? ""}
          onChange={handleChange}
          style={{ width: "100%", fontSize: 12 }}
          min={min}
          max={max}
          step={step}
        />
      </label>
    </div>
  );
}

function TextField({ label, path, value, onChange, help }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <label style={{ fontSize: 12 }}>
        <span style={{ fontWeight: "bold" }}>{label}</span>
        {help && (
          <span style={{ color: "#666", marginLeft: 4 }}>– {help}</span>
        )}
        <br />
        <input
          type="text"
          value={value ?? ""}
          onChange={(e) => onChange(path, e.target.value)}
          style={{ width: "100%", fontSize: 12 }}
        />
      </label>
    </div>
  );
}

const defaultFallbacks = {
  turnover: {
    probability: 0.02,
    hireAvgFactor: 0.8,
    hireMode: "average",
    specialistBoost: 0.25,
    candidateSkillMin: 0.05,
    candidateSkillMax: 0.95,
    hireSkillExponent: 1.5,
  },
};

export default function ConfigPanel({
  configText,
  onConfigTextChange,
  presetGroups = [],
  presetSelections = {},
  onPresetChange = () => {},
}) {
  let cfg = null;
  let parseError = null;
  try {
    cfg = JSON.parse(configText);
  } catch (e) {
    parseError = e.message;
  }

  const setNested = (obj, path, value) => {
    if (!Array.isArray(path)) return;
    let cur = obj;
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (!cur[key] || typeof cur[key] !== "object") cur[key] = {};
      cur = cur[key];
    }
    cur[path[path.length - 1]] = value;
  };

  const getNested = (obj, path, fallback) => {
    let cur = obj;
    for (const key of path) {
      if (cur && typeof cur === "object" && key in cur) cur = cur[key];
      else return fallback;
    }
    return cur;
  };

  const updateField = (path, value) => {
    if (!cfg) return;
    const next = JSON.parse(JSON.stringify(cfg));
    setNested(next, Array.isArray(path) ? path : [path], value);
    onConfigTextChange(JSON.stringify(next, null, 2));
  };

  const getVal = (path, fallback) => {
    const pArr = Array.isArray(path) ? path : [path];
    const v = getNested(cfg, pArr, undefined);
    if (v === undefined || v === null) {
      const df = getNested(defaultFallbacks, pArr, undefined);
      if (df !== undefined) return df;
      return fallback ?? "";
    }
    return v;
  };

  const renderPresetSelect = (groupId) => {
    const group = presetGroups.find((g) => g.id === groupId);
    if (!group) return null;
    const selected = presetSelections?.[groupId];
    const validIds = new Set((group.presets || []).map((p) => p.id));
    const current = validIds.has(selected) ? selected : group.presets?.[0]?.id ?? "";
    return (
      <select
        value={current}
        onChange={(e) => onPresetChange(groupId, e.target.value)}
        style={{ fontSize: 12, padding: "2px 6px" }}
      >
        {group.presets.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
    );
  };

  return (
    <div>
      <h3 style={{ marginTop: 8 }}>Base Simulation Config</h3>
      <p style={{ fontSize: 12, marginTop: 0, marginBottom: 8 }}>
        These parameters define the default world for all runs. Presets patch
        some of these; sweeps override individual fields on top.
      </p>

      {parseError && (
        <div
          style={{
            color: "red",
            fontSize: 12,
            marginBottom: 8,
            border: "1px solid #f99",
            padding: 4,
            borderRadius: 4,
          }}
        >
          JSON parse error – fix the raw config below to re-enable the form:
          <br />
          {parseError}
        </div>
      )}

      {cfg && (
    <div className="space-y-5 px-1">
      {/* BUSINESS ENVIRONMENT */}
      <fieldset className="form-panel mt-2">
        <legend
          style={{
            fontSize: 12,
            fontWeight: "bold",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <span>Business environment (demand &amp; value)</span>
          {renderPresetSelect("environment")}
        </legend>

            <NumberField
              label="Rate of new tasks"
              path={["environment", "newTaskRate"]}
              value={cfg.environment?.newTaskRate}
              onChange={updateField}
              min={0}
              step={0.1}
              help="Average incoming work per cycle."
            />
            <NumberField
              label="Initial backlog size"
              path={["backlog", "initialSize"]}
              value={cfg.backlog?.initialSize}
              onChange={updateField}
              min={0}
              step={1}
              help="Tasks created at start of simulation."
            />
            <NumberField
              label="Max backlog size"
              path={["backlog", "maxSize"]}
              value={cfg.backlog?.maxSize}
              onChange={updateField}
              min={0}
              step={1}
              help="Beyond this, PO evicts tasks."
            />
            <NumberField
              label="Avg task value"
              path={["environment", "avgTaskValue"]}
              value={cfg.environment?.avgTaskValue}
              onChange={updateField}
              min={0}
              step={1}
              help="Poisson mean for base task value."
            />
            <NumberField
              label="Avg info time"
              path={["environment", "avgInfoTime"]}
              value={cfg.environment?.avgInfoTime}
              onChange={updateField}
              min={1}
              step={1}
              help="Mean cycles spent in info/research per task."
            />
            <NumberField
              label="Avg impl time"
              path={["environment", "avgImplTime"]}
              value={cfg.environment?.avgImplTime}
              onChange={updateField}
              min={1}
              step={1}
              help="Mean cycles spent implementing per task."
            />

            <NumberField
              label="Retention min"
              path={["environment", "retentionMin"]}
              value={cfg.environment?.retentionMin}
              onChange={updateField}
              min={0}
              max={1}
              step={0.01}
              help="Lower bound on per-cycle value decay."
            />
            <NumberField
              label="Retention max"
              path={["environment", "retentionMax"]}
              value={cfg.environment?.retentionMax}
              onChange={updateField}
              min={0}
              max={1}
              step={0.01}
              help="Upper bound on per-cycle value decay."
            />
          </fieldset>

      {/* DEVELOPERS / TEAM */}
      <fieldset className="form-panel">
            <legend
              style={{
                fontSize: 12,
                fontWeight: "bold",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <span>Developers / team behavior</span>
              {renderPresetSelect("behavior")}
            </legend>

            <NumberField
              label="Number of workers"
              path={["team", "size"]}
              value={cfg.team?.size}
              onChange={updateField}
              min={1}
              step={1}
              help="Team size."
            />
            <NumberField
              label="Number of task types"
              path={["team", "numTaskTypes"]}
              value={cfg.team?.numTaskTypes}
              onChange={updateField}
              min={1}
              step={1}
              help="Domain breadth."
            />
            <NumberField
              label="Ask probability"
              path={["behavior", "askProbability"]}
              value={cfg.behavior?.askProbability}
              onChange={updateField}
              min={0}
              max={1}
              step={0.05}
              help="Chance a worker asks for help in info phase."
            />
            <NumberField
              label="Ask minimum gain"
              path={["behavior", "askMinimumGain"]}
              value={cfg.behavior?.askMinimumGain}
              onChange={updateField}
              min={0}
              max={0.5}
              step={0.01}
              help="Minimum believed knowledge gap required to ask."
            />
            <NumberField
              label="Must-ask if knowledge below"
              path={["behavior", "askMustThreshold"]}
              value={cfg.behavior?.askMustThreshold}
              onChange={updateField}
              min={0}
              max={1}
              step={0.01}
              help="If expertise on a topic is below this, worker will ask before starting."
            />
            <NumberField
              label="Absence probability"
              path={["behavior", "absenceProbability"]}
              value={cfg.behavior?.absenceProbability}
              onChange={updateField}
              min={0}
              max={1}
              step={0.01}
              help="Chance a worker is missing in a cycle."
            />
            <NumberField
              label="Forgetfulness"
              path={["behavior", "forgetfulness"]}
              value={cfg.behavior?.forgetfulness}
              onChange={updateField}
              min={0}
              max={1}
              step={0.01}
              help="How fast unused knowledge weakens per cycle."
            />
            <NumberField
              label="Completion learning rate"
              path={["behavior", "completionLearningRate"]}
              value={cfg.behavior?.completionLearningRate}
              onChange={updateField}
              min={0}
              max={1}
              step={0.01}
              help="How much knowledge improves when a task finishes."
            />
            <NumberField
              label="Conversation learning rate"
              path={["behavior", "conversationLearningRate"]}
              value={cfg.behavior?.conversationLearningRate}
              onChange={updateField}
              min={0}
              max={1}
              step={0.01}
              help="How much implementation work improves knowledge."
            />
          </fieldset>

      {/* TEAM MANAGEMENT / TURNOVER */}
      <fieldset className="form-panel">
            <legend
              style={{
                fontSize: 12,
                fontWeight: "bold",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <span>Team management &amp; turnover</span>
              {renderPresetSelect("turnover")}
            </legend>
            <NumberField
              label="Turnover probability"
              path={["turnover", "probability"]}
              value={getVal(["turnover", "probability"])}
              onChange={updateField}
              min={0}
              max={1}
              step={0.01}
              help="Chance a worker is replaced (knowledge resets)."
            />
            <NumberField
              label="Hire avg factor"
              path={["turnover", "hireAvgFactor"]}
              value={getVal(["turnover", "hireAvgFactor"])}
              onChange={updateField}
              min={0}
              max={1}
              step={0.05}
              help="New hire starts at this fraction of team avg."
            />
            <NumberField
              label="Specialist boost"
              path={["turnover", "specialistBoost"]}
              value={getVal(["turnover", "specialistBoost"])}
              onChange={updateField}
              min={0}
              max={1}
              step={0.05}
              help="If specialist mode, boost strongest topic by this (other topics start lower)."
            />
            <NumberField
              label="Candidate interarrival mean"
              path={["turnover", "candidateInterarrivalMean"]}
              value={getVal(["turnover", "candidateInterarrivalMean"])}
              onChange={updateField}
              min={1}
              step={1}
              help="Average cycles between candidate arrivals."
            />
            <NumberField
              label="Interview cost per cycle"
              path={["turnover", "interviewCostPerCycle"]}
              value={getVal(["turnover", "interviewCostPerCycle"])}
              onChange={updateField}
              min={0}
              step={0.1}
              help="Team cycles consumed per interview round."
            />
            <NumberField
              label="Assessment noise"
              path={["turnover", "assessmentNoise"]}
              value={getVal(["turnover", "assessmentNoise"])}
              onChange={updateField}
              min={0}
              max={1}
              step={0.01}
              help="Higher = less accurate candidate evaluation."
            />
            <NumberField
              label="Min hire bar"
              path={["turnover", "minHireBar"]}
              value={getVal(["turnover", "minHireBar"])}
              onChange={updateField}
              min={0}
              max={1}
              step={0.05}
              help="Minimum perceived skill needed to hire."
            />
            <NumberField
              label="Candidate skill min"
              path={["turnover", "candidateSkillMin"]}
              value={getVal(["turnover", "candidateSkillMin"])}
              onChange={updateField}
              min={0}
              max={1}
              step={0.05}
              help="Lower bound for true candidate skill."
            />
            <NumberField
              label="Candidate skill max"
              path={["turnover", "candidateSkillMax"]}
              value={getVal(["turnover", "candidateSkillMax"])}
              onChange={updateField}
              min={0}
              max={1}
              step={0.05}
              help="Upper bound for true candidate skill."
            />
            <NumberField
              label="Interview rounds"
              path={["turnover", "interviewRounds"]}
              value={getVal(["turnover", "interviewRounds"])}
              onChange={updateField}
              min={1}
              step={1}
              help="Rounds per candidate to reduce noise."
            />
            <NumberField
              label="Hire skill exponent"
              path={["turnover", "hireSkillExponent"]}
              value={getVal(["turnover", "hireSkillExponent"])}
              onChange={updateField}
              min={0.5}
              max={3}
              step={0.1}
              help="Higher makes weak hires learn slower and forget faster."
            />
            <TextField
              label="Hire mode"
              path={["turnover", "hireMode"]}
              value={getVal(["turnover", "hireMode"])}
              onChange={updateField}
              help='"average" or "specialist" for new hires.'
            />
          </fieldset>

      {/* PRODUCT OWNER */}
      <fieldset className="form-panel">
            <legend
              style={{
                fontSize: 12,
                fontWeight: "bold",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <span>Product Owner &amp; backlog policy</span>
              {renderPresetSelect("productOwner")}
            </legend>

            <NumberField
              label="PO window size"
              path={["productOwner", "windowSize"]}
              value={cfg.productOwner?.windowSize}
              onChange={updateField}
              min={1}
              step={1}
              help="How many tasks PO scans at a time."
            />
            <NumberField
              label="PO actions per cycle"
              path={["productOwner", "actionsPerCycle"]}
              value={cfg.productOwner?.actionsPerCycle}
              onChange={updateField}
              min={0}
              step={1}
              help="How many reorder actions per cycle."
            />
            <NumberField
              label="PO absence probability"
              path={["productOwner", "absenceProbability"]}
              value={cfg.productOwner?.absenceProbability}
              onChange={updateField}
              min={0}
              max={1}
              step={0.01}
              help="Chance PO skips a cycle."
            />
            <NumberField
              label="PO error probability"
              path={["productOwner", "errorProbability"]}
              value={cfg.productOwner?.errorProbability}
              onChange={updateField}
              min={0}
              max={1}
              step={0.05}
              help="Chance PO picks at random instead of best."
            />
          </fieldset>

      {/* SIMULATION ENGINE */}
      <fieldset className="form-panel">
        <legend
          style={{
            fontSize: 12,
            fontWeight: "bold",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <span>Simulation engine</span>
          {renderPresetSelect("simulation")}
        </legend>

            <NumberField
              label="Number of cycles"
              path={["simulation", "numCycles"]}
              value={cfg.simulation?.numCycles}
              onChange={updateField}
              min={1}
              step={100}
              help="Simulation length."
            />
            <NumberField
              label="Burn-in cycles"
              path={["simulation", "burnInCycles"]}
              value={cfg.simulation?.burnInCycles}
              onChange={updateField}
              min={0}
              step={100}
              help="Cycles ignored when computing averages."
            />
            <NumberField
              label="Log every"
              path={["simulation", "logEvery"]}
              value={cfg.simulation?.logEvery}
              onChange={updateField}
              min={1}
              step={1000}
              help="Logging cadence for Node version."
            />
          </fieldset>
        </div>
      )}

      {/* Raw JSON for power users / debugging */}
      <details style={{ marginTop: 4 }}>
        <summary style={{ cursor: "pointer", fontSize: 12 }}>
          Raw JSON config
        </summary>
        <textarea
          value={configText}
          onChange={(e) => onConfigTextChange(e.target.value)}
          style={{
            width: "100%",
            height: 180,
            fontFamily: "monospace",
            fontSize: 11,
            marginTop: 4,
          }}
        />
      </details>
    </div>
  );
}
