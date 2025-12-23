# TeamSim model

TeamSim is a lightweight agent-based model for a software team working through an ordered backlog. It focuses on how information sharing, expertise growth/decay, and product-owner quality influence delivered value over time.

## Why this model exists
- Explore trade-offs between collaboration and throughput: conversations accelerate learning but consume cycles for both asker and helper.
- See how product-owner quality (prioritization window, absence, error) shapes value delivered when workers blindly pull the top of the queue.
- Study team learning dynamics: how research, implementation, and conversations push expertise up while decay pulls it down; how beliefs about expertise guide help-seeking.
- Stress-test environments: varying demand (`envTaskRate`), backlog pressure/eviction, and task value retention to see when teams thrive or stall.
- Support sweeps and random sampling to map how parameter regimes affect outputs like cumulative value, throughput, and expertise distribution.

## Core loop
- Backlog seeding: a `Backlog` is prefilled with random `Task`s (topic, value, info time, impl time, retention).
- Each cycle:
  1) New work arrives from the environment via a Poisson process (`envTaskRate`), with optional eviction when above `maxBacklogSize`.
  2) Product Owner (`PO`) optionally sorts the top `poWindowSize` tasks `poActionsPerCycle` times, with absence/error knobs.
  3) Workers may be absent (`absenceProb`); present workers without a task pull the front-of-queue task (whatever the PO left at the top, ideally the highest value).
  4) Info phase: workers research their task topic, may ask for help based on beliefs about who is expert (`askProb`, `askMinGain`). A successful conversation lets both parties learn but costs both their action for the cycle.
  5) Impl phase: workers burn `implTime` down while also learning.
  6) Knowledge decay applies to untended topics.
- Burn-in cycles (`burnInCycles`) exclude early output from recurring value accounting.

## Agents and learning
- Workers carry per-topic expertise (0..1) and per-topic beliefs about teammate expertise.
- Learning modes:
  - Conversations: `conversationLearningRate` moves both participants toward the union of their expertise during info help.
  - Completion: `completionLearningRate` applies once when a task finishes, scaled by task effort.
  - Decay: `knowledgeDecayRate` applies to topics not touched in a cycle.
- Beliefs update by EMA toward observed helper knowledge (`beliefUpdateRate`) and never credit self.

## Tasks and value
- `Task.random` samples:
  - Topic: uniform across `numTaskTypes`.
  - Effort: info/impl times from either direct means (`avgInfoTime`, `avgImplTime`) or a ratio model (`avgTotalEffort`, `avgInfoShare`).
  - Value: positive integer around `avgValue`.
  - Retention: uniform between `taskRetentionMin`/`taskRetentionMax`; recurring value accrues after burn-in.

## Outputs
- `runSimulation(cfg)` returns per-run `stats` and final `workers`. With `replicates > 1`, numeric fields are aggregated with mean/stddev and one sample run is retained.
- Key stats include: `totalValue`, `totalTasksCompleted`, `cumulativeRecurringValue`, `teamProductivity`, conversation counters, evictions, arrivals, and final expertise scalars (`finalTeamAvgExpertise`, `finalTeamAvgMaxExpertisePerTopic`).

## Experiment helpers
- `src/workers/simWorker.js` runs simulations in a web worker and supports:
  - Single runs with presets (`src/presets.js` groups for business environment, team maturity, PO maturity).
  - 1D/2D sweeps varying a single config field.
  - Scatter/unit-random sampling driven by `src/config/sweep-config.json` and `unitConfig.js` mappings (log/linear/int/ratio transforms).

## Default configuration
- See `src/config/baseConfig.json` for starting knobs (e.g., `numWorkers`, `numTaskTypes`, `askProb`, `po` settings, learning/decay rates, backlog sizes, `envTaskRate`, `replicates`).

## Running the UI
- Install deps: `npm install`
- Start dev server: `npm run dev`
- The UI lets you tweak config, pick presets, run sweeps/scatter, and view scatter plots and time-series stats.
