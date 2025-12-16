// src/components/ConfigPanel.jsx
import React from "react";

function NumberField({
  label,
  field,
  value,
  onChange,
  min,
  max,
  step,
  help,
}) {
  const handleChange = (e) => {
    const raw = e.target.value;
    if (raw === "") return;
    const num = Number(raw);
    if (Number.isNaN(num)) return;
    onChange(field, num);
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

function TextField({ label, field, value, onChange, help }) {
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
          onChange={(e) => onChange(field, e.target.value)}
          style={{ width: "100%", fontSize: 12 }}
        />
      </label>
    </div>
  );
}

export default function ConfigPanel({ configText, onConfigTextChange }) {
  let cfg = null;
  let parseError = null;
  try {
    cfg = JSON.parse(configText);
  } catch (e) {
    parseError = e.message;
  }

  const updateField = (field, value) => {
    if (!cfg) return;
    const next = { ...cfg, [field]: value };
    onConfigTextChange(JSON.stringify(next, null, 2));
  };

  return (
    <div>
      <h3 style={{ marginTop: 8 }}>Base Simulation Config</h3>
      <p style={{ fontSize: 12, marginTop: 0 }}>
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
        <>
          {/* BUSINESS ENVIRONMENT */}
          <fieldset
            style={{
              border: "1px solid #ddd",
              padding: 8,
              borderRadius: 4,
              marginBottom: 8,
            }}
          >
            <legend style={{ fontSize: 12, fontWeight: "bold" }}>
              Business environment (demand &amp; value)
            </legend>

            <NumberField
              label="Rate of new tasks"
              field="envTaskRate"
              value={cfg.envTaskRate}
              onChange={updateField}
              min={0}
              step={0.1}
              help="Average incoming work per cycle."
            />
            <NumberField
              label="Initial backlog size"
              field="backlogSize"
              value={cfg.backlogSize}
              onChange={updateField}
              min={0}
              step={1}
              help="Tasks created at start of simulation."
            />
            <NumberField
              label="Max backlog size"
              field="maxBacklogSize"
              value={cfg.maxBacklogSize}
              onChange={updateField}
              min={0}
              step={1}
              help="Beyond this, PO evicts tasks."
            />
            <NumberField
              label="Avg task value"
              field="avgValue"
              value={cfg.avgValue}
              onChange={updateField}
              min={0}
              step={1}
              help="Poisson mean for base task value."
            />
            <NumberField
              label="Retention min"
              field="taskRetentionMin"
              value={cfg.taskRetentionMin}
              onChange={updateField}
              min={0}
              max={1}
              step={0.01}
              help="Lower bound on per-cycle value decay."
            />
            <NumberField
              label="Retention max"
              field="taskRetentionMax"
              value={cfg.taskRetentionMax}
              onChange={updateField}
              min={0}
              max={1}
              step={0.01}
              help="Upper bound on per-cycle value decay."
            />
          </fieldset>

          {/* DEVELOPERS / TEAM */}
          <fieldset
            style={{
              border: "1px solid #ddd",
              padding: 8,
              borderRadius: 4,
              marginBottom: 8,
            }}
          >
            <legend style={{ fontSize: 12, fontWeight: "bold" }}>
              Developers / team behavior
            </legend>

            <NumberField
              label="Number of workers"
              field="numWorkers"
              value={cfg.numWorkers}
              onChange={updateField}
              min={1}
              step={1}
              help="Team size."
            />
            <NumberField
              label="Number of task types"
              field="numTaskTypes"
              value={cfg.numTaskTypes}
              onChange={updateField}
              min={1}
              step={1}
              help="Domain breadth."
            />
            <NumberField
              label="Avg info time"
              field="avgInfoTime"
              value={cfg.avgInfoTime}
              onChange={updateField}
              min={0}
              step={1}
              help="Poisson mean for information cycles."
            />
            <NumberField
              label="Avg implementation time"
              field="avgImplTime"
              value={cfg.avgImplTime}
              onChange={updateField}
              min={0}
              step={1}
              help="Poisson mean for implementation cycles."
            />
            <NumberField
              label="Ask probability"
              field="askProb"
              value={cfg.askProb}
              onChange={updateField}
              min={0}
              max={1}
              step={0.05}
              help="Chance a worker asks for help in info phase."
            />
            <NumberField
              label="Absence probability"
              field="absenceProb"
              value={cfg.absenceProb}
              onChange={updateField}
              min={0}
              max={1}
              step={0.01}
              help="Chance a worker is missing in a cycle."
            />
            <NumberField
              label="Knowledge decay rate"
              field="knowledgeDecayRate"
              value={cfg.knowledgeDecayRate}
              onChange={updateField}
              min={0}
              max={1}
              step={0.01}
              help="How fast unused knowledge weakens per cycle."
            />
            <NumberField
              label="Research learning rate"
              field="researchLearningRate"
              value={cfg.researchLearningRate}
              onChange={updateField}
              min={0}
              max={1}
              step={0.01}
              help="How much info work improves knowledge."
            />
            <NumberField
              label="Implementation learning rate"
              field="implLearningRate"
              value={cfg.implLearningRate}
              onChange={updateField}
              min={0}
              max={1}
              step={0.01}
              help="How much implementation work improves knowledge."
            />
            <NumberField
              label="Conversation learning rate"
              field="conversationLearningRate"
              value={cfg.conversationLearningRate}
              onChange={updateField}
              min={0}
              max={1}
              step={0.01}
              help="How much implementation work improves knowledge."
            />
            <TextField
              label="Help strategy"
              field="helpStrategy"
              value={cfg.helpStrategy}
              onChange={updateField}
              help='Strategy identifier (e.g. "expert").'
            />
          </fieldset>

          {/* PRODUCT OWNER */}
          <fieldset
            style={{
              border: "1px solid #ddd",
              padding: 8,
              borderRadius: 4,
              marginBottom: 8,
            }}
          >
            <legend style={{ fontSize: 12, fontWeight: "bold" }}>
              Product Owner &amp; backlog policy
            </legend>

            <NumberField
              label="PO window size"
              field="poWindowSize"
              value={cfg.poWindowSize}
              onChange={updateField}
              min={1}
              step={1}
              help="How many tasks PO scans at a time."
            />
            <NumberField
              label="PO actions per cycle"
              field="poActionsPerCycle"
              value={cfg.poActionsPerCycle}
              onChange={updateField}
              min={0}
              step={1}
              help="How many reorder actions per cycle."
            />
            <NumberField
              label="PO absence probability"
              field="poAbsenceProb"
              value={cfg.poAbsenceProb}
              onChange={updateField}
              min={0}
              max={1}
              step={0.01}
              help="Chance PO skips a cycle."
            />
            <NumberField
              label="PO error probability"
              field="poErrorProb"
              value={cfg.poErrorProb}
              onChange={updateField}
              min={0}
              max={1}
              step={0.05}
              help="Chance PO picks at random instead of best."
            />
          </fieldset>

          {/* SIMULATION ENGINE */}
          <fieldset
            style={{
              border: "1px solid #ddd",
              padding: 8,
              borderRadius: 4,
              marginBottom: 8,
            }}
          >
            <legend style={{ fontSize: 12, fontWeight: "bold" }}>
              Simulation engine
            </legend>

            <NumberField
              label="Number of cycles"
              field="numCycles"
              value={cfg.numCycles}
              onChange={updateField}
              min={1}
              step={100}
              help="Simulation length."
            />
            <NumberField
              label="Burn-in cycles"
              field="burnInCycles"
              value={cfg.burnInCycles}
              onChange={updateField}
              min={0}
              step={100}
              help="Cycles ignored when computing averages."
            />
            <NumberField
              label="Log every"
              field="logEvery"
              value={cfg.logEvery}
              onChange={updateField}
              min={1}
              step={1000}
              help="Logging cadence for Node version."
            />
          </fieldset>
        </>
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
