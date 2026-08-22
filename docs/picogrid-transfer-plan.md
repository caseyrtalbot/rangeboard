# PicoGrid to RangeBoard transfer plan

Implementation plan for agent teams. This plan transfers combat-simulation
functionality from the PicoGrid drone-swarm simulation into RangeBoard.

- Source repo: `/Users/caseytalbot/legion-simulations` (Go). Read only. Do not modify.
- Target repo: `/Users/caseytalbot/Projects/rangeboard` (TypeScript, React 19, Konva, zustand).
- All new code goes into the target repo.

## Ground rules for every workstream

Read `/Users/caseytalbot/Projects/rangeboard/CLAUDE.md` first. These invariants are
not negotiable:

1. **Derived state only.** Playback and analysis are pure functions of
   `(scenario, simTimeS)`. Never write positions, detections, kills, or ammo
   counts back into the scenario. All new engagement math must be deterministic.
   Use expected-value math, not random rolls. If randomness is ever required,
   derive it from a seed stored in the scenario so replay is stable.
2. **World frame.** Meters. +x east, +y south. Heading 0 = north, clockwise degrees.
3. **Single mutation path.** Every scenario change goes through `mutate()` in
   `src/state/store.ts`. Camera, selection, UI, and playback are not undoable.
4. **Schema versioning.** The scenario persists to localStorage key
   `rangeboard.scenario.v1` via `src/io/persist.ts`. Every new scenario field must
   be optional or defaulted so old saves still load. Do not bump the key unless a
   field is impossible to default.
5. **Konva conventions.** `strokeScaleEnabled={false}` for constant-px strokes,
   `scale={1/camera.scale}` groups for constant-size glyphs, `listening={false}`
   on large fills.
6. **Verification.** Before finishing, run in the target repo:
   `npm run lint`, `npm run test`, `npm run build`. All three must pass.
7. **Tests.** Every new pure function in `src/geometry/`, `src/analysis/`, or
   `src/playback/` gets a vitest unit test next to it, matching the existing
   `*.test.ts` pattern.

## Source reference map (PicoGrid, read only)

The richest source logic sits in a dormant code path that the live Go simulation
never calls. Use it as the specification, not the live path.

| Concept | Source file |
|---|---|
| Pk math, modifiers, EW immunity | `cmd/drone-swarm/core/engagement_calculator.go` |
| Ammo, reload, cooldown, system stats | `cmd/drone-swarm/simulation/entities.go` (NewCounterUASSystem) |
| Live hit probability formula | `cmd/drone-swarm/simulation/simulation.go` (engageTarget, ~line 1248) |
| Target priority weights, roles | `cmd/drone-swarm/controllers/system_controller.go` (GetHighestPriorityTarget) |
| Swarm behaviors, evasion, jam response | `cmd/drone-swarm/core/swarm_behavior.go` |
| Waves, leader/scout/follower assignment | `cmd/drone-swarm/controllers/simulation_controller.go` (~line 508) |
| Classification ladder | `cmd/drone-swarm/simulation/entities.go` (~line 38) and `simulation.go` executeDetection (~line 832) |
| Config surface and defaults | `cmd/drone-swarm/config.yaml` and `cmd/drone-swarm/config/config.go` |
| Termination conditions, AAR shapes | `cmd/drone-swarm/reporting/aar_generator.go`, `config.yaml` termination section |

Key numeric baselines from the source, to seed defaults:

- Kinetic Pk range 0.70 to 0.90. EW Pk range 0.50 to 0.70.
- Distance falloff: `1 - 0.3 * (distance / maxRange)`.
- Evasion penalty: multiply Pk by 0.7 when the target evades.
- Size penalty: Group 1 = 0.7, Group 2 = 0.8, Group 3 = 0.9, Group 4+ = 1.0.
- Kinetic magazine: 20 to 40 rounds, reload 30 to 60 s. EW: unlimited, 5 s cooldown.
- Target priority: 0.5 distance + 0.3 speed + 0.2 role, role multipliers
  leader 1.5, scout 1.2, follower 1.0.

## Target touch map (RangeBoard)

| Area | File |
|---|---|
| Domain types | `src/model/types.ts` |
| Seed library (effector stats live here) | `src/model/seedLibrary.ts` |
| Store and actions | `src/state/store.ts` |
| Detection, kill chain, windows | `src/playback/sim.ts` |
| Environment derates, jammability | `src/analysis/sensorEnv.ts` |
| Scoring | `src/analysis/mcda.ts` |
| Threat table UI | `src/panels/AnalysisPanel.tsx` |
| Entity editing UI | `src/panels/Inspector.tsx` |
| Persistence and defaults | `src/io/persist.ts`, `src/model/seed.ts` |

---

## Workstream 1: Engagement outcomes and attrition

**Goal.** Turn the current binary result (`engageable` or not) into a quantitative
outcome: expected kills, expected leakers, and magazine depletion over the raid.

**Depends on:** nothing. This is the foundation. Do it first.

### Data model (`src/model/types.ts`)

Extend `EffectorSpec` with optional fields:

```ts
pk?: number            // single-shot probability of kill, 0..1
magazineSize?: number  // rounds or interceptors; undefined = unlimited (EW, DE)
salvoCooldownS?: number // seconds between shots at the same or next target
```

Populate all 14 effectors in `src/model/seedLibrary.ts` with researched or
source-baseline values. Interceptors and guns get finite magazines. Jammers,
DE, and HPM get `magazineSize: undefined` and short cooldowns.

### Logic (`src/playback/sim.ts` plus a new `src/playback/attrition.ts`)

Add a pure function:

```ts
resolveEngagements(scenario): AttritionReport
```

- Sweep the timeline with the existing `DT = 0.5` step.
- For each threat with status `engageable`, walk its engagement windows in time
  order across all connected effectors.
- Model each shot opportunity as one salvo per `salvoCooldownS` inside the window.
- Compute per-shot Pk: `basePk * distanceFalloff * sizePenalty * evasionPenalty`.
  Reuse the source formulas above. Get size from `UasSpec.group`.
- Expected-value accounting: track `survivalProbability` per threat ship
  (formations expand via the existing `memberPositions`). Each shot multiplies
  survival by `(1 - pk)`. Expected magazine use is the shot count; decrement a
  per-effector expected-rounds ledger and stop shooting when it is empty.
- Output `AttritionReport`: per threat `{ expectedKills, leakProbability,
  firstShotS, shotsFired, killedByEffectorId }`, per effector `{ shotsFired,
  expectedRoundsRemaining }`, and totals.
- Keep `resolveEngagements` free of store imports so it is trivially testable.

### UI

- `AnalysisPanel.tsx`: add columns for leak probability and shots fired to the
  threat table. Add an effectors summary row (magazine use).
- Feed a new MCDA part from leak probability in `src/analysis/mcda.ts` so the
  configuration score reflects attrition.

### Acceptance

- Unit tests: single threat single effector window math; magazine exhaustion
  mid-raid; formation of N ships splits shots; out-of-window threats take zero shots.
- A saved scenario from before this change loads without errors (defaulting works).
- `npm run lint && npm run test && npm run build` pass.

---

## Workstream 2: EW effect asymmetry

**Goal.** A jam is not a kill. Jam outcomes degrade the threat instead of
removing it.

**Depends on:** Workstream 1 (needs the outcome model).

### Data model

Extend `UasSpec` with optional `jamBehavior?: 'drift' | 'return-home' | 'continue'`
(default `drift` for `gps`, `continue` for `mixed`). Keep the existing
`jammable()` gate in `src/analysis/sensorEnv.ts`; navigation-mode immunity
(fiber, inertial, optical) already models the source's autonomy immunity better
than the source does. Do not port the autonomy scalar.

### Logic

- In `resolveEngagements`, split effector outcomes into two channels:
  `hardKillProbability` (interceptor, gun, net, de, hpm) and
  `softKillProbability` (jammer).
- A soft kill applies the `jamBehavior`: `return-home` and `drift` end the
  threat's approach (counts as a mission kill, flagged `soft: true`);
  `continue` reduces subsequent detection quality but the threat still arrives.
- Report hard kills, soft kills, and leakers separately in `AttritionReport`
  and in the AnalysisPanel table.

### Acceptance

- Unit tests: jammer vs fiber threat takes zero shots; jammer soft-kills a GPS
  threat; `continue` behavior still leaks.
- Visual check: threat rows distinguish hard kill, soft kill, leaker.

---

## Workstream 3: Waves and raid scheduling

**Goal.** Schedule a raid as N waves with per-wave delay and formation, matching
the source's main red-tactic knob.

**Depends on:** none for the data model. Report integration depends on Workstream 1.

### Data model

Add to `Scenario` an optional `raid?: RaidPlan`:

```ts
interface RaidWave { startDelayS: number; entityIds: string[] }
interface RaidPlan { waves: RaidWave[] }
```

Alternative considered and rejected: per-entity wave numbers. A single plan
object keeps undo and persistence simple.

### Logic and UI

- Store actions: `assignToWave(entityId, waveIndex)`, `setWaveDelay(waveIndex, s)`.
- Effective path delay for a UAS = `path.startDelayS + wave.startDelayS`.
  Implement in one helper used by `posAtTime` call sites in `sim.ts` and
  `liveTracks`, so playback and analysis agree.
- Inspector: wave assignment dropdown on UAS entities. AnalysisPanel or
  TimelineBar: compact wave list with delays.
- Port the six `SEED_FORMATIONS` raid presets into one-click raid builders that
  create the wave structure (for example, Shahed stream raid = 1 ship per wave,
  fixed spacing in seconds).

### Acceptance

- Unit tests: effective delay helper; wave with three ships launches together;
  removing an entity cleans its wave reference.
- Scrubbing the timeline shows staggered launches.

---

## Workstream 4: Engagement policy and classification ladder

**Goal.** Replace the binary `engageOn: 'detected' | 'confirmed'` with the
source's classification ladder and a small ROE set.

**Depends on:** Workstream 1.

### Data model

- New scenario field `roe?: 'hold' | 'tight' | 'free'` (default `tight`).
  Keep `engageOn` in the type for load compatibility; migrate it on load in
  `persist.ts` (`detected` -> `free`, `confirmed` -> `tight`).
- Classification ladder as a derived value per threat, not stored:
  `pending -> unknown -> suspected -> hostile`.

### Logic (`src/playback/sim.ts`)

Port the promotion rules from source `executeDetection`:

- First detection: `pending -> unknown`.
- `unknown -> suspected` when estimated speed > 50 kph or route intent is an
  attack profile (`SpecModel.threatProfile.routeIntent` contains an attack keyword),
  or when inside 1.5x of any connected effector's max range.
- `suspected -> hostile` when inside any connected effector's max range, or when
  classified (`DetectionHit.classified`) by a fire-control or classification sensor.
- ROE gates the engagement window start: `free` = first detection, `tight` =
  hostile, `hold` = no engagement (analysis-only posture).
- Surface `classificationAtS` timestamps in `ThreatAssessment`.

### Acceptance

- Unit tests for each promotion rule and each ROE gate.
- Old saves with `engageOn` load and map to the right ROE.
- AnalysisPanel shows the classification timeline per threat.

---

## Workstream 5: After-action report panel

**Goal.** A post-run summary comparable across configurations, replacing the
score-only snapshot.

**Depends on:** Workstreams 1, 2, and 4 (consumes their outputs). Do this last.

### Scope

- New panel section in `AnalysisPanel.tsx` (or a new right-panel tab): totals
  for raid size, hard kills, soft kills, leakers, leak probability, first
  detection, first shot, shots by effector, expected magazine remaining,
  per-threat timeline rows (detect, classify, engage, outcome).
- Extend `ScorecardSnap` pinning so a pinned snapshot stores the full AAR
  summary, not only the MCDA score. Keep the pinned object small: store the
  computed summary, never the scenario.
- Export: one JSON export of the AAR via the existing `src/io/persist.ts`
  download pattern.

### Acceptance

- Pin two configurations, change the laydown, compare AAR side by side.
- Export produces valid JSON with the summary shape.

---

## Sequencing and team assignment

```
WS1 (foundation)
 ├── WS2 (EW asymmetry)      after WS1 merges
 ├── WS4 (ROE + ladder)      after WS1 merges; independent of WS2
 └── WS3 (waves)             data model and UI can start in parallel with WS1;
                             report wiring waits for WS1
WS5 (AAR)                    after WS1, WS2, WS4
```

- One agent per workstream. WS1 must merge before WS2 and WS4 start their logic
  work, because both edit `resolveEngagements`.
- Merge conflicts concentrate in `src/model/types.ts`, `src/playback/sim.ts`,
  and `AnalysisPanel.tsx`. Keep new logic in new files (`attrition.ts`) where
  the plan says so, to reduce conflict surface.
- Do not port from the live Go path (`cmd/drone-swarm/simulation/simulation.go`)
  when it disagrees with the dormant path; the dormant `core/` and
  `controllers/` files are the specification, per the source survey.
- Out of scope for all workstreams: blue-system health/temperature/stress
  modeling, Legion API integration, per-tick mutating simulation, random-roll
  combat, and any change to the T&E module (`src/te/`).
