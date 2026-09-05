# Data engine: implementation plan

Status: **complete.** Slices 0 to 9 are built (commits `3b264e3` to `e6edbb4`, 2026-09-04).
This file is frozen history: it says what was planned, and the code and `CLAUDE.md` say what
was built. Where they differ, `outstanding.md` records the discrepancy. The mockup files and
`HANDOFF.md` named below are not in git.
Decisions were settled with the user on 2026-09-03, and the mockup was approved the same day.
Agent teams start from `docs/data-engine/HANDOFF.md`, which assigns files and phases per slice. Read the repository `CLAUDE.md`
first. Its "Core invariants" section outranks anything here, with one exception this
plan retires on purpose: the plan-view rule (section 4, F6).

| | |
| --- | --- |
| Baseline commit | `a87c116` "Default to the doctrinal kill chain, add the TARGET step and launch-point policies" |
| Branch | `analysis-hardening`, clean tree, 12 commits ahead of `main` |
| Baseline tests | 803 passing in 43 files (`npm run test`) |
| Baseline lint | 56 warnings, 0 errors. All are `react(only-export-components)` or `react(set-state-in-effect)` in `src/App.tsx`, `src/canvas/layers/UnderlayLayer.tsx`, `src/panels/Glyph.tsx`, and `src/te/ui/*`. A slice adds none. |
| Baseline build | `npm run build` clean; one chunk-size warning above 500 kB |
| Mockup | `docs/data-engine/mockup.html` (open in a browser; regenerate with `python3 build_mockup.py`) |
| Published mockup | https://claude.ai/code/artifact/0f6fb168-9bc3-4a1b-aea3-4b714e0a24a9 |

The mockup is the visual acceptance target for slices 4, 6 and 7. When this document
and the mockup disagree, the mockup wins on appearance and this document wins on behavior.

---

## 1. What the user asked for

Two issues, applied universally, not per scenario.

1. The radar model must be the best fit that open sources allow. The board showed a
   Mohajer-6 tracked outside the Giraffe 1X range ring. That was consistent with the
   engine (the ring is the 0.01 m2 placard, the Mohajer-6 is 1 m2 and detects at 3.16 x
   that range), but the model has no probability of detection, no altitude, no slant
   range, no elevation limit, no radar horizon, and no update-rate-based track initiation.
2. The Analysis panel must become a dynamic, chart-capable, selection-aware,
   professional instrument with lenses and user-composed widgets, and it must gain
   Monte Carlo replicates so the app becomes a data engine for test and evaluation.

The purpose is baseline hypothesis construction for real-world T&E. Fidelity and
provenance outrank convenience.

## 2. Decisions

Every decision below was put to the user and answered. Do not reopen one. Where a
decision names a default, the default is a planning factor (PF), tagged as such in the
UI and editable per model.

| # | Decision | Answer |
| --- | --- | --- |
| D1 | Detection model | Pd(R) from the radar range equation, calibrated at the placard. Engine stays deterministic. |
| D2 | Third dimension | Slant range, elevation gate, max altitude gate, 4/3 earth radar horizon. No terrain. Sensors and effectors in the same slice. |
| D3 | Placard provenance | Per-field provenance list on `SpecModel`: field, source, URL, date, basis (datasheet, reference, PF). PF tag derives from it. |
| D4 | Ring symbology | Seven ring keys with per-entity overrides. Defaults on: sensor placard, effector max range. Sensor rings in entity color. Effector rings red. Doctrinal effector rings and Pd contours draw on threat selection. |
| D5 | Track initiation | Per-radar update rate, M-of-N (3 of 5) initiation, coast on a miss, drop after 5 consecutive misses. Coast counts as held. Role table stays as fallback. |
| D6 | Analysis shape | Lenses as presets over a widget set. Five built-in lenses: Run summary, Sensors, Effectors, System of systems, Threat. User presets allowed. |
| D7 | Selection | One selected entity replaces the lens body with a detail pane. The on-canvas readout stays as the short card. |
| D8 | Chart stack | Recharts (exact pin) plus an in-repo chart kit on the CSS tokens. bklit-ui chart configs are MIT reference material only. No shadcn, no Tailwind. |
| D9 | Monte Carlo | Run mode. 100 replicates, seed on the Scenario, Web Worker, mean with 80 and 95 percent bands. Deterministic expected value stays the default mode. |
| D10 | Data backfill | Every radar in the library gets a verified placard, in the last slice. Unverified values stay PF. |
| D11 | Pd calibration defaults | Placard Pd 0.5 when not stated, Pfa 1e-6, Swerling case by airframe: quad, VTOL, one-way attack and FPV Swerling 1; fixed wing Swerling 3. |
| D12 | Detection thresholds | DETECT at single-scan Pd 0.5, TRACK at M-of-N cumulative 0.9. Both live in `RequirementThresholds`. |
| D13 | Altitude source | One constant altitude per placed threat, seeded from the threat profile. Mount height per sensor and effector, 4 m PF. Waypoint altitude is a later slice. |
| D14 | Effector rings at rest | Max range only. Every other ring is a toggle, globally and per entity. |
| D15 | Per-entity ring overrides | View state, keyed by entity id, own storage key. Never in the Scenario. |
| D16 | Track drop | 3 of 5 to initiate, drop after 5 misses, coast counts as held. Per-radar fields. |
| D17 | Layout persistence | Layout is view state under a new key. The Scenario records only the preset id a run was observed under. |
| D18 | Random draws | Detection per scan (Pd), kill per salvo (Pk), jam effect per dwell. Paths, timing and doctrine stay fixed. |
| D19 | Detail pane content | Sensor, effector, threat and system-of-systems sets as listed in slice 7. |
| D20 | Plan artifact | This file and `mockup.html`. Slice 0 deletes the two dead files. |
| D21 | Effector 3D | Effector windows use slant range and the altitude ceiling in the altitude slice. |
| D22 | Pd in deterministic mode | Threshold gate. Pd never multiplies kill mass. Monte Carlo carries the probability. |
| D23 | Git | One commit per slice on `analysis-hardening`, after tests and build pass, on the user's word. |

Routine judgments this plan makes without a further question: widget catalog contents,
default widgets per lens, the Recharts pin, the verification source hierarchy, and Monte
Carlo results kept in memory keyed by run id and summarized in the export.

## 3. Rules that bind every slice

- Work in `/Users/caseytalbot/Projects/rangeboard` on `analysis-hardening`. Do not
  create a branch. Commit only when the user says so, one commit per slice.
- One slice at a time. A slice is done when section 6 passes and the user accepts it.
- Copy the surrounding code style: no trailing semicolons, 2-space indent, single
  quotes, named exports, `interface` for object shapes, JSDoc on exported symbols, short
  "why" comments above non-obvious blocks. No narration comments.
- One new npm dependency in the whole plan: `recharts`, exact pin, added in slice 5.
- Typecheck with `npx tsc --noEmit -p tsconfig.app.json`. Test with `npx vitest run`.
  Lint with `npm run lint`. Build with `npm run build` at the end of each slice.
- User-facing copy is ASD-STE100 Simplified Technical English. No em-dashes.
- Every new number that is not sourced is a planning factor. It carries a provenance
  row with basis `pf` and the UI shows the PF tag.
- Do not create documentation, plan, or status files beyond this one and the mockup.
- Update `CLAUDE.md` in the same slice that changes a contract it describes.
- Keep engine logic in pure TypeScript with colocated `*.test.ts`. Size tests like the
  neighboring files.

## 4. Engine facts every slice must respect

- F1. Deterministic expected value. No random rolls outside the Monte Carlo worker.
  `attrition.ts` header: "Deterministic expected-value attrition over the raid."
- F2. Sweep cadence `DT = 0.5` in `src/playback/sim.ts:383` and `src/playback/attrition.ts:111`.
  The panel quantizes the cursor to the same grid.
- F3. Raid partition: `expectedKills + expectedLeakers + expectedNoArrival === raidSize`.
  `expectedLateKills` is a sub-measure of the leaker mass. Display `reportedLeakers`.
- F4. Expenditure counts at `tS`, kill and jam mass at `tEffectS`.
- F5. Derived state never enters the `Scenario`. View state has its own storage key.
  Storage keys live in `src/io/storageKeys.ts` and are never renamed.
- F6. **Retired in slice 1:** "Plan view only: the engine holds no altitude and no
  slant range." After slice 1 the engine holds one altitude per threat and one mount
  height per sensor and effector, and reads them.
- F7. Symbology contract: one definition per fact. `PHASE_STYLE` in `trackState.ts`,
  `FRAME_FOR` in `Glyph.tsx`, ring styles in `footprintStyle.ts`.
- F8. Requirement thresholds are test-defined, never engine constants.
- F9. The one physics entry point per technology is `sensorEnv.ts`. The one hold gate
  is `sensorHoldGate`. The one sweep is `sweepSensorHits`. New gates join them; no
  second copy.
- F10. Playback re-renders every rAF frame. Any chart playhead derives from
  `playback.simTimeS`. Never a timer.

## 5. Slices

Order is fixed. Each slice lists goal, files, contract, acceptance, and what stays out.

### Slice 0. Dead code

Goal: remove the two files with zero importers.

Files: delete `src/panels/analysis/AarSection.tsx` (398 lines) and
`src/panels/analysis/ThreatList.tsx` (590 lines). Remove CSS rules in `src/index.css`
that only those two files used. Confirm each rule by grep before removal.

Acceptance: `tsc`, `vitest`, `lint`, `build` pass. No visual change. Test count stays 803.

Stays out: any other cleanup.

### Slice 1. Altitude and slant range

Goal: the engine holds altitude and reads it for sensors and effectors.

Files: `src/model/types.ts`, `src/model/seed.ts`, `src/geometry/slant.ts` (new),
`src/geometry/slant.test.ts` (new), `src/analysis/sensorEnv.ts`, `src/playback/sim.ts`,
`src/playback/attrition.ts`, `src/canvas/layers/FootprintLayer.tsx`,
`src/panels/Inspector.tsx`, `src/panels/LibraryEditor.tsx`, `src/canvas/TrackFileReadout.tsx`,
`src/state/store.ts` (placement seeds altitude), `CLAUDE.md`.

Contract:

```ts
// types.ts
/** One provenance row. `field` is the SensorSpec / UasSpec / EffectorSpec key it covers. */
export interface Provenance {
  field: string
  value: string
  source: string
  url?: string | null
  /** ISO date the source was read. */
  date: string
  basis: 'datasheet' | 'reference' | 'pf'
}
export interface SpecModel { /* existing */ provenance?: Provenance[] }

/** Basis for one field: the provenance row, else 'pf'. */
export function basisFor(model: SpecModel, field: string): Provenance['basis']

export interface Entity { /* existing */
  /** UAS only: flight altitude, feet AGL, constant along the path. Absent: seeded on placement. */
  altitudeFt?: number | null
}
export interface SensorSpec { /* existing */
  /** Antenna phase-center height above ground, meters. Absent: MOUNT_HEIGHT_M (PF). */
  mountHeightM?: number | null
}
export interface EffectorSpec { /* existing */
  /** Launcher or emitter height above ground, meters. Absent: MOUNT_HEIGHT_M (PF). */
  mountHeightM?: number | null
}
export const MOUNT_HEIGHT_M = 4

// geometry/slant.ts (pure)
export function slantRangeM(groundM: number, dAltM: number): number
export function groundRangeM(slantM: number, dAltM: number): number   // sqrt(max(0, s^2 - h^2))
export function elevationDeg(groundM: number, dAltM: number): number
/** 4/3 earth radio horizon between two heights, meters: 4120 * (sqrt(h1) + sqrt(h2)). */
export function radioHorizonM(h1M: number, h2M: number): number

// analysis/sensorEnv.ts
export type GeometryGate = 'ok' | 'below-horizon' | 'elevation' | 'ceiling'
/**
 * Vertical geometry gate. Horizon applies to radar, rf and eo-ir (line of sight),
 * never to acoustic. Elevation applies only when spec.elevationDeg is recorded.
 * Ceiling applies only when spec.maxAltitudeFt is recorded.
 */
export function sensorGeometryGate(
  spec: SensorSpec, sensorHeightM: number, targetAltM: number, groundM: number,
): GeometryGate
export function effectorGeometryGate(spec: EffectorSpec, targetAltM: number): 'ok' | 'ceiling'

// playback/sim.ts
/** Threat altitude, feet AGL: Entity.altitudeFt, else threatProfile.altitudeFt, else the altBandFt midpoint. */
export function threatAltitudeFt(scenario: Scenario, uas: Entity): number
```

Behavior:

- `sensorHit` compares the slant range from the sensor phase center to the target to
  the effective detect range. The azimuth wedge stays a ground-plane test. The geometry
  gate runs after the hold gate and before the range test. A gated hit returns null.
- `DetectionHit` gains `slantM: number`. `SensorObservation` gains `minSlantM`.
- Effector in-envelope tests (`sim.ts:761` and the two in `attrition.ts` at `:838` and
  `:980`) use slant range against `minRangeM` and `maxRangeM`, and return false when
  the ceiling gate fails. `distanceFalloff` receives slant range.
- Jammer geometry is unchanged in this slice apart from slant range in the in-cone test.
- The board ring for a selected threat draws at `groundRangeM(scaledM, dAlt)`. With no
  selection the placard ring stays at the placard ground radius.
- Placement of a UAS entity seeds `altitudeFt` from the threat profile. Old saves with
  no field resolve through `threatAltitudeFt` at read time; nothing migrates.
- Inspector: threat altitude field (ft AGL, aviation units respected), sensor and
  effector mount height fields. The "Recorded, not modeled" block for elevation and
  max altitude is removed; those fields now show as modeled.
- `CLAUDE.md`: replace the "Plan view only" paragraph with the altitude contract.

Acceptance:

- `slant.test.ts`: horizon 4 m to 91 m (300 ft) is 35.4 km within 1 percent; ground
  projection of a 12,649 m slant at 4,267 m altitude is 11,907 m.
- `sim.test.ts`: a Mohajer-6 at 14,000 ft against a radar with `maxAltitudeFt: 10000`
  is never detected; the same radar with `maxAltitudeFt: null` detects it; a target
  beyond the radio horizon at 2 m altitude is not detected by a radar at 4 m; an
  acoustic sensor ignores the horizon; an effector with `maxAltitudeFt: 3000` has no
  window against a 14,000 ft threat.
- Regression: every existing test passes with default altitudes. Seed threat profile
  altitudes (300, 1,500, 600, 10,000, 14,000 ft for the five in the screenshot) change
  detection ranges by the slant correction only, and the existing fixture expectations
  are updated with the new values and a one-line reason each.
- Browser check: the autosave from before the slice loads, the Mohajer-6 shows 14,000 ft
  in the Inspector, the Giraffe 1X ring for the selected Mohajer-6 draws at 11.9 km.

Stays out: waypoint altitude, terrain, refraction beyond the 4/3 factor.

### Slice 2. Pd model

Goal: radar detection becomes a probability of detection at range, calibrated at the
placard, thresholded in the deterministic run, and carried as telemetry.

Files: `src/model/types.ts`, `src/model/seed.ts`, `src/model/rcsFactors.ts`,
`src/analysis/radarPd.ts` (new), `src/analysis/radarPd.test.ts` (new),
`src/analysis/sensorEnv.ts`, `src/analysis/sensorEnv.test.ts`, `src/playback/sim.ts`,
`src/playback/sim.test.ts`, `src/io/persist.ts`, `src/panels/Inspector.tsx`,
`src/panels/LibraryEditor.tsx`, `src/panels/AnalysisPanel.tsx` (threshold fields),
`CLAUDE.md`.

Contract:

```ts
// types.ts
export type SwerlingCase = 0 | 1 | 3
export interface SensorSpec { /* existing */
  /** Radar only: Pd at which detectRangeM is quoted against refRcsM2. Absent: PLACARD_PD (PF). */
  placardPd?: number | null
  /** Radar only: false-alarm probability the placard assumes. Absent: PLACARD_PFA (PF). */
  pfa?: number | null
}
export interface UasSpec { /* existing */
  /** Fluctuation model. Absent: SWERLING_BY_AIRFRAME[airframe] (PF). */
  swerling?: SwerlingCase | null
}
export interface RequirementThresholds { /* existing */
  /** Single-scan Pd at which a radar contact counts as DETECT. */
  pdDetect: number
  /** M-of-N cumulative probability at which a radar contact counts as TRACK. */
  pdTrackCumulative: number
}
export const DEFAULT_REQUIREMENT_THRESHOLDS = { /* existing */ pdDetect: 0.5, pdTrackCumulative: 0.9 }
export const PLACARD_PD = 0.5
export const PLACARD_PFA = 1e-6
export const SWERLING_BY_AIRFRAME: Record<UasSpec['airframe'], SwerlingCase> =
  { quad: 1, vtol: 1, 'one-way-attack': 1, fpv: 1, 'fixed-wing': 3 }

// analysis/radarPd.ts (pure)
/** Single-scan Pd for a given SNR (linear), Pfa and Swerling case. */
export function pdFromSnr(snr: number, pfa: number, swerling: SwerlingCase): number
/** SNR (linear) that yields `pd` at `pfa` for the case. Monotone inverse of pdFromSnr. */
export function snrForPd(pd: number, pfa: number, swerling: SwerlingCase): number
/**
 * Calibrated SNR at range R: snr0 * (rcs / rcs0) * (r0 / R)^4 * envRangeFactor^4,
 * where snr0 = snrForPd(placardPd, pfa, swerling) and r0 is the placard slant range.
 */
export function snrAtRange(cal: RadarCalibration, rcsM2: number, rangeM: number, envRangeFactor: number): number
export function pdAtRange(cal: RadarCalibration, rcsM2: number, rangeM: number, envRangeFactor: number, swerling: SwerlingCase): number
/** Largest range at which pdAtRange >= pd. Closed form from the fourth-root law. */
export function rangeForPd(cal: RadarCalibration, rcsM2: number, pd: number, envRangeFactor: number, swerling: SwerlingCase): number
export interface RadarCalibration { r0M: number; rcs0M2: number; pd0: number; pfa: number; swerling0: SwerlingCase }
/** Probability that at least m of n independent scans with Pd `p` detect. */
export function mOfN(p: number, m: number, n: number): number

// analysis/sensorEnv.ts
/** Radar: rangeForPd at thresholds.pdDetect. Other technologies: unchanged law. */
export function effectiveDetectRangeM(spec, env, target?, pd?: number): number
export function pdContoursM(spec, env, target, pds: number[]): number[]

// playback/sim.ts
export interface DetectionHit { /* existing */ slantM: number; pd: number | null }
export interface SensorObservation { /* existing */
  /** Radar only: single-scan Pd at each DT step from firstDetectS, index 0 = firstDetectS. */
  pdSeries?: number[]
}
```

Closed forms, with the source to cite in the JSDoc:

- Swerling 1, single pulse: `Pd = Pfa ^ (1 / (1 + SNR))`.
- Swerling 0 (non-fluctuating): Albersheim's approximation, valid for Pd 0.1 to 0.9
  and Pfa 1e-3 to 1e-7, single pulse.
- Swerling 3, single pulse: the closed form in Mahafza, *Radar Systems Analysis and
  Design Using MATLAB*, Swerling III section, single pulse. The test pins three points
  against the published curve at Pfa 1e-6 (Pd 0.5, 0.8, 0.9) within 0.5 dB.
- The placard calibration uses the placard's own reference target case. Seeds keep
  `swerling0 = 1` for every radar (PF) until slice 9 verifies otherwise.

Behavior:

- With defaults (`placardPd 0.5`, `pdDetect 0.5`) `effectiveDetectRangeM` for a radar
  returns exactly today's value. The fourth-root law is the special case where the
  threshold equals the placard Pd. `sensorEnv.test.ts` keeps every existing expectation.
- The environment range multiplier `m` enters the SNR as `m^4`. No new weather physics.
- The radar branch of `sensorHit` computes `pd = pdAtRange(...)` at the slant range and
  hits when `pd >= thresholds.pdDetect`. Non-radar sensors keep `pd = null` and their
  existing laws.
- The sweep appends `pd` to `pdSeries` on the observation for every step from first
  detection, including steps below threshold (so a chart shows the fade).
- `rangeBasis: 'planning'` radars skip the Pd model exactly as they skip RCS scaling.
- Board: `pdContoursM(spec, env, target, [0.5, 0.9])` feeds slice 4. Nothing draws yet.
- Analysis panel: the Fire doctrine section gains no field. The requirement thresholds
  editor gains `pdDetect` and `pdTrackCumulative` where `maxResidualPerTrack` is edited.
- Inspector and LibraryEditor: placard Pd, Pfa, Swerling fields with PF tags from
  `basisFor`.
- `fillScenario` already spreads `requirements`; the two new thresholds fill from defaults.

Acceptance:

- `radarPd.test.ts`: Swerling 1 at Pfa 1e-6 needs SNR 12.8 dB for Pd 0.5 and 21.1 dB for
  Pd 0.9 within 0.1 dB; `snrForPd` inverts `pdFromSnr` to 1e-6; `rangeForPd(cal, rcs0,
  pd0)` returns `r0M`; `mOfN(0.5, 3, 5) = 0.5`, `mOfN(0.73, 3, 5)` is between 0.89 and 0.91.
- `sim.test.ts`: `pdDetect 0.9` shrinks the Giraffe 1X detect range against the Mohajer-6
  from 12,649 m to `rangeForPd(cal, 1, 0.9)`; `pdSeries` length equals the number of
  steps from first detection to path end.
- Regression: all existing tests pass unchanged except fixtures updated in slice 1.

Stays out: multi-pulse integration, clutter, MTI, Doppler gating, Pd weighting of mass (D22).

### Slice 3. Track initiation

Goal: track initiation and drop follow the radar's scan rate and an M-of-N rule.

Files: `src/model/types.ts`, `src/analysis/doctrineFactors.ts`, `src/analysis/radarPd.ts`,
`src/playback/sim.ts`, `src/playback/sim.test.ts`, `src/playback/trackState.ts`,
`src/playback/trackState.test.ts`, `src/analysis/threatAggregation.ts`,
`src/panels/Inspector.tsx`, `src/panels/LibraryEditor.tsx`, `src/canvas/TrackFileReadout.tsx`,
`src/model/seedLibrary.ts` (Giraffe 1X `updateRateS: 1`), `CLAUDE.md`.

Contract:

```ts
export interface SensorSpec { /* existing */
  /** Scan or frame period, seconds. Absent: the TRACK_INIT_S role table governs initiation. */
  updateRateS?: number | null
  /** M-of-N track initiation. Absent: TRACK_INIT_M / TRACK_INIT_N (PF). */
  trackInitM?: number
  trackInitN?: number
  /** Consecutive missed scans before a coasting track drops. Absent: TRACK_DROP_MISSES (PF). */
  trackDropMisses?: number
}
export const TRACK_INIT_M = 3
export const TRACK_INIT_N = 5
export const TRACK_DROP_MISSES = 5

export interface SensorObservation { /* existing */
  /** First time the M-of-N rule (or the role table when updateRateS is absent) initiated a track. */
  trackInitAtS: number | null
  /** Coast intervals: held by extrapolation after a missed scan, before drop. */
  coastIntervals: Array<[number, number]>
}
export interface TrackFileState { /* existing */ coasting: boolean }
```

Behavior:

- Scans occur at multiples of `updateRateS` from the sensor's first opportunity,
  snapped to the DT grid. A rate faster than DT counts one scan per step; the JSDoc
  says so.
- A scan detects when `pd >= thresholds.pdDetect` (deterministic). TRACK initiates at
  the first scan where `mOfN(pdWindowMean, M, N) >= thresholds.pdTrackCumulative` over
  the last N scans, and at least M of those scans detected. `pdWindowMean` is the mean
  of the last N single-scan Pd values. Non-radar sensors keep the role table.
- After a missed scan the track coasts. Coast ends at the next detection or drops after
  `trackDropMisses` consecutive misses. Hold intervals include coast. Continuity counts
  coast as held (D16). `coastIntervals` records the coast spans separately.
- `stableTrackAtS` becomes the earliest `trackInitAtS` across fire-control-quality
  sensors, the same rule as today with the new initiator. When `updateRateS` is absent
  the role table result is written to `trackInitAtS` so consumers have one field.
- `TrackFileState.coasting` is true when every holding sensor is coasting at `t`. The
  on-canvas readout shows `COAST`. The ring color does not change (no new phase).
- Giraffe 1X gets `updateRateS: 1` with a provenance row (Saab press release, 2018,
  "full search volume updated every second", basis `reference`).

Acceptance:

- `sim.test.ts`: a radar with `updateRateS 1`, Pd 0.8 throughout, initiates at first
  detection plus 2 s (third detecting scan, cumulative 0.94); with Pd 0.6 it never
  reaches 0.9 and `trackInitAtS` stays null while `firstDetectS` is set; a 3 s gap with
  `trackDropMisses 5` keeps the hold, a 6 s gap splits it.
- `trackState.test.ts`: `coasting` true inside a coast interval, false at a detection.
- Regression: with `updateRateS` absent every existing doctrine test passes unchanged.

Stays out: track quality scoring, multi-sensor fusion, Kalman-style track files.

### Slice 4. Ring symbology

Goal: seven ring keys with per-entity overrides, effector rings in red, Pd contours on
selection. The mockup section "Board rings" is the target.

Files: `src/state/store.ts`, `src/state/store.test.ts`, `src/io/storageKeys.ts`,
`src/io/viewState.ts`, `src/canvas/layers/footprintStyle.ts` and test,
`src/canvas/layers/FootprintLayer.tsx`, `src/panels/ViewMenu.tsx`,
`src/canvas/ContextMenu.tsx`, `src/panels/Inspector.tsx`, `src/panels/CommandPalette.tsx`,
`src/index.css`, `CLAUDE.md`.

Contract:

```ts
// store.ts
export type RingKey =
  | 'sensorPlacard' | 'sensorEnvelope' | 'sensorPdContours' | 'classifyRings'
  | 'effectorMaxRange' | 'effectorMinRange' | 'effectorDoctrinal'
export interface LayerVisibility { /* existing keys minus sensorFootprints, effectorEnvelopes */
  sensorPlacard: boolean; sensorEnvelope: boolean; sensorPdContours: boolean; classifyRings: boolean
  effectorMaxRange: boolean; effectorMinRange: boolean; effectorDoctrinal: boolean
}
/** Per-entity ring overrides. An absent key falls through to ui.layers. */
export type RingOverrides = Record<string, Partial<Record<RingKey, boolean>>>
export interface UiState { /* existing */ ringOverrides: RingOverrides }
setRingOverride(entityId: string, key: RingKey, on: boolean | null): void  // null clears
/** Effective visibility for one entity. */
export function ringVisible(ui: UiState, entityId: string, key: RingKey): boolean

// storageKeys.ts
/** Per-entity ring overrides (`RingOverrides`). */
export const RINGS_KEY = 'rangeboard.rings.v1'
```

Behavior:

- Defaults on: `sensorPlacard`, `effectorMaxRange`. All others off. `LAYER_PRESETS`
  updated: `full` turns every ring key on, `planning` placard plus envelope plus
  effector max and min, `engagement` placard plus effector max plus doctrinal, `clean`
  none. `savedLayers()` migrates: `sensorFootprints` maps to `sensorPlacard`,
  `effectorEnvelopes` to `effectorMaxRange`, then the old keys are dropped.
- Overrides for entities that no longer exist are pruned on load and on entity delete.
- Sensor rings, all in the entity color:
  - placard: thin solid ring at the placard ground radius (today's ring, fill removed
    when the envelope band is on).
  - envelope: a band between the smallest and largest effective detect ground radius
    across the UAS entities on the board, low-alpha fill, no stroke. Empty when no
    threat is placed.
  - Pd contours: for the selected threat only, Pd 0.5 solid and Pd 0.9 dashed
    `[4, 6]`, ground projected. Replaces today's "scaled ring plus dotted placard
    behind" for radars. Non-radar sensors keep the scaled ring as the Pd 0.5 contour
    and draw no 0.9 contour.
  - classify: unchanged.
  - The `cued`, `inert`, `off` kinds keep their dashes and apply to the placard ring.
- Effector rings, all in `--danger` except jammers, which keep the EW cone:
  - max range: solid, at `maxRangeM` ground projected for the selected threat, else
    the placard.
  - min range: dotted `[2, 5]`.
  - doctrinal, selected threat only: release range per `doctrine.launchPolicy` dashed
    `[7, 4]`, commit-Pk range dash-dot `[6, 3, 1, 3]`. Labels `REL` and `Pk` in the
    entity label font.
- Controls: View menu Display group lists the seven keys under two headings, Sensor and
  Effector. Right-click on the canvas keeps the Display flyout. Right-click on an entity
  adds a Rings flyout with the keys for that kind and a tri-state (global, on, off).
  Inspector adds a Rings section with the same tri-state rows. Command palette gets one
  entry per key.
- `footprintStyle.ts` stays the single style source. New ring kinds are added there
  with tests, and `FootprintLayer` reads them.

Acceptance:

- `store.test.ts`: override precedence, clear to null, pruning on delete, persistence
  round trip through `RINGS_KEY`, layer migration from the two old keys.
- `footprintStyle.test.ts`: every ring key resolves to one style record; the envelope
  band is null with no UAS on the board.
- Browser check against the mockup: screenshot at rest (placard ring plus red max
  range only), and with the Mohajer-6 selected (Pd 0.5 at 11.9 km, Pd 0.9 dashed
  inside it, release and commit rings on the effector).

Stays out: 3D or elevation-sliced footprints, jammer ring changes.

### Slice 5. Chart kit

Goal: one chart kit on the CSS tokens, synchronized to sim time, fed by series builders.

Files: `package.json` (`recharts` exact pin, latest 3.x at build time; 3.10.1 as of
2026-09-03), `src/charts/ChartFrame.tsx`, `src/charts/TimeSeries.tsx`,
`src/charts/Ladder.tsx`, `src/charts/Sparkline.tsx`, `src/charts/tokens.ts`,
`src/charts/README` is not created; the JSDoc in `tokens.ts` documents the kit.
`src/analysis/series.ts` (new) and `series.test.ts`, `src/index.css`.

Contract:

```ts
// analysis/series.ts (pure)
export interface Series {
  id: string
  label: string
  unit: string | null
  /** Sampled at DT from t = 0. Index i is t = i * DT. NaN where undefined. */
  values: number[]
  /** Token name, e.g. 'accent', 'danger', 'ew', or an entity color hex. */
  color: string
  kind: 'line' | 'step'
  /** Monte Carlo bands, same length as values, when present. */
  band80?: [number[], number[]]
  band95?: [number[], number[]]
}
export function kpiSeries(scenario: Scenario): Series[]              // liveKpisAt sampled at DT
export function sensorSeries(scenario: Scenario, sensorId: string): Series[]   // pd and slant range per track, hold ladder
export function effectorSeries(scenario: Scenario, effectorId: string): Series[]  // pk per track, magazine, salvo marks
export function threatSeries(scenario: Scenario, uasId: string): Series[]      // pd per sensor, residual, phase ladder
export function systemSeries(scenario: Scenario): Series[]                     // first detect to first effect, per-hop latency

// charts/TimeSeries.tsx
interface TimeSeriesProps {
  series: Series[]
  /** Playhead position, seconds. Reads playback.simTimeS quantized to DT. */
  tS: number
  /** Called when the user clicks or drags on the plot. Sets playback.simTimeS. */
  onScrub?: (tS: number) => void
  height?: number
  /** Vertical marks: arrival, first shot, gate times. */
  marks?: Array<{ tS: number; label: string; color: string }>
}
```

Behavior:

- Colors come from CSS tokens resolved once per render through `tokens.ts`
  (`getComputedStyle` on the root), so theme changes and the token sheet stay the one
  source. Per-track series do NOT use entity colors: every hostile entity is a warm red
  by the symbology contract, so entity colors cannot separate five lines. `tokens.ts`
  holds a fixed categorical order of five chart hues, assigned to tracks by first
  detection and never re-assigned when a filter hides a track:
  `--chart-1 #3987e5`, `--chart-2 #d95926`, `--chart-3 #199e70`, `--chart-4 #c98500`,
  `--chart-5 #d55181`. Validated on 2026-09-03 against the panel surface `#171a1d`
  (chroma, lightness band, CVD separation, normal-vision floor, 3:1 contrast all pass).
  A sixth track folds into "Other". The legend shows the chart hue swatch beside the
  track designator. Status colors (`--good`, `--warn`, `--danger`) never carry a series.
- The playhead is a Recharts `ReferenceLine` at `tS`. Scrubbing calls `onScrub`.
  No timers (F10).
- Bands render as stacked `Area` between the low and high arrays at 0.12 and 0.06 alpha.
- Axes: time in `m:ss` at the existing `tickStepS` rule from `EngagementStrip.tsx`;
  units on the axis title only. Tooltip shows all series at the cursor time.
- Type floor 10 px. Axis labels mono, series labels sans.

Acceptance:

- `series.test.ts`: `kpiSeries` length equals `ceil(duration / DT) + 1`; expected kills
  at the last index equals `totals.expectedKills`; `threatSeries` residual starts at
  `shipCount` and ends at `expectedResidual`.
- A DOM test renders `TimeSeries` with two series and asserts the playhead line exists.
- Bundle: `npm run build` reports the recharts chunk; the plan accepts up to 150 kB
  gzipped for the kit.

Stays out: any panel change. Charts are not mounted until slice 6.

### Slice 6. Lenses and widgets

Goal: the Analysis panel becomes a lens bar over a widget stack, persisted as view
state, with the run header decluttered. Mockup section "Analysis lenses" is the target.

Files: `src/state/analysisLayout.ts` (new, pure reducer and presets) and test,
`src/state/store.ts`, `src/io/storageKeys.ts`, `src/io/viewState.ts`,
`src/model/types.ts` (`Scenario.observedPresetId`), `src/model/seed.ts`,
`src/playback/runSession.ts`, `src/panels/AnalysisPanel.tsx` and test,
`src/panels/analysis/*` (widget wrappers), `src/panels/analysis/widgets/` (new),
`src/analysis/aar.ts` (export carries preset id), `src/index.css`, `CLAUDE.md`.

Contract:

```ts
// state/analysisLayout.ts
export type WidgetType =
  | 'kpi-tiles' | 'time-series' | 'system-status' | 'threat-picture'
  | 'requirement-gates' | 'event-ledger' | 'environment' | 'fire-doctrine'
  | 'projection' | 'run-validity' | 'engagement-lanes'
export interface WidgetInstance { id: string; type: WidgetType; params: Record<string, unknown>; collapsed: boolean }
export interface AnalysisLayout { presetId: string; widgets: WidgetInstance[] }
export interface LensPreset { id: string; label: string; builtin: boolean; widgets: WidgetInstance[] }
export const BUILTIN_LENSES: LensPreset[]   // run-summary, sensors, effectors, iads, threat
export interface AnalysisViewState { layout: AnalysisLayout; userPresets: LensPreset[] }
export function applyPreset(state, presetId): AnalysisViewState
export function addWidget(state, type, params?): AnalysisViewState
export function removeWidget(state, id): AnalysisViewState
export function moveWidget(state, id, toIndex): AnalysisViewState
export function saveAsPreset(state, label): AnalysisViewState
export function deletePreset(state, id): AnalysisViewState

// storageKeys.ts
export const ANALYSIS_KEY = 'rangeboard.analysis.v1'

// types.ts
export interface Scenario { /* existing */
  /** Lens preset id active when the current run was reset or started. Null before any run. */
  observedPresetId?: string | null
}
```

Built-in lens contents:

| Lens | Widgets in order |
| --- | --- |
| Run summary | kpi-tiles (detect, track, id, engaged, kill E[K], leak E[N]), time-series (kills, leakers, detected), threat-picture, projection, run-validity |
| Sensors | kpi-tiles (detect, track, first detect, min warning), time-series (tracks held, mean Pd of held tracks), system-status (sensors only), requirement-gates (detect, track, identify) |
| Effectors | kpi-tiles (engaged, salvos, kill E[K], late E[K]), time-series (expected kills, salvos in flight), system-status (effectors only), fire-doctrine, event-ledger |
| System of systems | kpi-tiles (first detect, first effect, detect-to-effect, min warning), engagement-lanes, system-status (all), fire-doctrine, requirement-gates (all) |
| Threat | threat-picture (expanded), time-series (residual per group), projection, environment |

Behavior:

- The run header stays at the top: run id, T+, phase, mode chip (DET, or MC with
  replicate count after slice 8), Clean reset. ROE segmented control moves into the
  fire-doctrine widget header. The nine-cell grid becomes the kpi-tiles widget with
  its six-tile default; every KPI is selectable in the widget's params.
- Lens bar under the header: five built-in lenses, then user presets, then a
  Customize toggle. In customize mode each widget shows remove and drag handles and an
  Add widget row lists the catalog. Save as preset names the current stack.
- Threat picture declutter: one chip ladder per group at 10 px in two rows (D TRK ID
  on the first, TGT ENG FX on the second). Member rows collapsed by default and show
  the ladder only when expanded. The 7.5 px exception in `index.css` is retired.
- Naming: the outcome tile reads "Leakers" with the ship count; per-track and
  per-group rows read "Survives" with a percent; the effect gate reads "Survival limit".
  `CLAUDE.md` records the three names.
- `observedPresetId` is written by `resetAnalysisRun` and by the first play of a ready
  run. The debrief export carries it.
- `AnalysisViewState` persists to `ANALYSIS_KEY` eagerly on every reducer call.

Acceptance:

- `analysisLayout.test.ts`: every reducer, preset round trip through JSON, builtin
  presets cannot be deleted, unknown widget types are dropped on load.
- `AnalysisPanel.test.tsx`: lens switch changes the widget stack; the six default
  tiles render; the ROE control lives in the fire-doctrine widget.
- Browser check against the mockup: Run summary and Sensors lenses screenshot; the
  panel at 320 px wide shows no horizontal scroll and no text below 10 px.

Stays out: selection detail (slice 7), Monte Carlo bands (slice 8).

### Slice 7. Selection detail

Goal: one selected entity replaces the widget stack with a detail pane.

Files: `src/panels/analysis/detail/` (new: `SensorDetail.tsx`, `EffectorDetail.tsx`,
`ThreatDetail.tsx`, `SystemDetail.tsx`), `src/panels/AnalysisPanel.tsx` and test,
`src/analysis/series.ts`, `src/canvas/TrackFileReadout.tsx` (unchanged content, plus a
"Details in Analysis" affordance), `src/index.css`.

Behavior:

- `AnalysisPanel` reads `selection.entityIds`. Exactly one entity selected and the
  right tab is Analysis: the detail pane renders. Header: entity glyph, name, model,
  phase pill, a Back control that clears selection. Esc clears selection (existing).
- Sensor detail: time-series (Pd per track, slant range per track), track ladder
  (search, coast, track, drop per track), scan load (tracks held per scan), hold clock
  (union and integrated seconds), gates table (hold gate and geometry gate per threat).
- Effector detail: time-series (Pk per track, magazine), release and effect timeline
  (salvo marks with `tS` and `tEffectS`), doctrine table (gate, ready, release policy,
  commit Pk per threat), capacity.
- Threat detail: track file (the readout fields), phase ladder, time-series (Pd per
  sensor, residual), arrival, CPA, warning, first detect sensor.
- System of systems detail (a C2 entity or a system group selected): kill-chain hop
  table (route, medium, latency), first detect to first effect per threat, route
  coverage (threats with no route).
- Multi-select shows the lens stack unchanged with a one-line note.

Acceptance:

- `AnalysisPanel.test.tsx`: selecting a sensor renders `SensorDetail`; clearing returns
  the lens stack; the preset id is unchanged by selection.
- `series.test.ts`: `sensorSeries` returns one Pd series per detected track with
  entity colors.
- Browser check against the mockup: Giraffe 1X selected, Mohajer-6 selected.

Stays out: editing from the detail pane (Inspector owns edits).

### Slice 8. Monte Carlo

Goal: a replicate run mode with seed, worker, and bands.

Files: `src/geometry/prng.ts` (new; `mulberry32` moved from `src/te/calc/stats.ts`,
which imports it), `src/model/types.ts`, `src/model/seed.ts`, `src/io/persist.ts`,
`src/playback/policy.ts` (new), `src/playback/sim.ts`, `src/playback/attrition.ts`,
`src/playback/mcRun.ts` (new) and test, `src/playback/mc.worker.ts` (new),
`src/state/store.ts` (`mc` slice), `src/panels/analysis/LiveStrip.tsx`,
`src/analysis/series.ts`, `src/panels/analysis/widgets/*`, `src/analysis/aar.ts`,
`vite.config.ts` if the worker needs it, `CLAUDE.md`.

Contract:

```ts
// types.ts
export type RunMode = 'deterministic' | 'monte-carlo'
export interface Scenario { /* existing */
  runMode?: RunMode          // default 'deterministic'
  seed?: number              // default: set once on emptyScenario, editable
  replicates?: number        // default 100
}

// playback/policy.ts
export interface DrawPolicy {
  /** Radar scan outcome. Deterministic: pd >= pdDetect. MC: rng() < pd. */
  detect(pd: number, sensorId: string, uasId: string, tS: number): boolean
  /** Salvo outcome. Deterministic: returns pk as mass. MC: 0 or 1. */
  kill(pk: number, effectorId: string, uasId: string, shipIdx: number, tS: number): number
  /** Jam dwell outcome, same shape. */
  jam(p: number, effectorId: string, uasId: string, tS: number): number
}
export function deterministicPolicy(thresholds: RequirementThresholds): DrawPolicy
export function monteCarloPolicy(rng: () => number, thresholds: RequirementThresholds): DrawPolicy

// playback/mcRun.ts (pure, runs in the worker)
export interface McSummary {
  seed: number; replicates: number; durationS: number
  /** Per DT step. Each stat array has one entry per step. */
  kills: BandSeries; leakers: BandSeries; detected: BandSeries; tracked: BandSeries; engaged: BandSeries
  perThreat: Record<string, { killed: Stat; leaked: Stat; firstDetectS: Stat; arrivalS: number | null }>
  perEffector: Record<string, { salvos: Stat; kills: Stat }>
  /** Wall time in the worker, ms. */
  elapsedMs: number
}
export interface Stat { mean: number; p10: number; p90: number; p025: number; p975: number; n: number }
export interface BandSeries { mean: number[]; p10: number[]; p90: number[]; p025: number[]; p975: number[] }
export function runReplicates(scenario: Scenario, onProgress?: (done: number) => void): McSummary
```

Behavior:

- `assessThreat` and `resolveEngagements` take a `DrawPolicy`. Every existing caller
  passes `deterministicPolicy(scenario.requirements)`; the engine output is unchanged
  by construction, and a test proves it.
- A replicate: seed the PRNG with `seed + replicateIndex`, run the sweep and attrition
  with `monteCarloPolicy`, record the per-step counts and per-threat outcomes. Ships
  are discrete in MC: a kill draw removes one ship.
- The worker receives the Scenario JSON and streams progress every 10 replicates. The
  `mc` store slice holds `{ runId, status: 'idle' | 'running' | 'done', progress, summary }`
  and is never persisted. A run reset clears it. A configuration change marks it stale.
- Run header mode chip: `MC 100 · seed 4821`. The mode, seed and replicate count are
  edited in the run header popover. Deterministic stays the default (D9).
- Charts read `band80` and `band95` from the summary when present. Tiles show
  `mean` with `p10 to p90` under it. Projection tiles show the same.
- The debrief export includes `mcSummary` when present, and the run record says
  `kind: 'monte-carlo'` with seed and replicate count.

Acceptance:

- `mcRun.test.ts`: same seed gives an identical summary; a scenario with Pd 1 and Pk 1
  gives zero variance and matches the deterministic totals; a scenario with Pk 0.5 and
  one salvo gives kills mean within 0.1 of 0.5 over 200 replicates.
- Deterministic regression: every existing test passes with the policy injected.
- Performance: the five-threat screenshot scenario at 8:08 runs 100 replicates in the
  worker under 2 s on the development machine; the number is recorded in the commit
  message.

Stays out: timing jitter, correlated draws, importance sampling.

### Slice 9. Placard verification

Goal: every radar in the library carries a verified placard with provenance.

Files: `src/model/seedLibrary.ts`, `src/model/seedLibrary.test.ts` (new, provenance
coverage), `src/panels/Inspector.tsx` (source row rendering), `src/panels/LibraryEditor.tsx`
(provenance editor).

Radars in scope (19): RPS-42, RPS-62, KuRFS, EchoShield, AN/TPQ-50 LSTAR, AN/TPQ-53,
IRIS, Ranger R8SS-3D, KuMRFS-M, Ku720-2, Long Range Sentry Tower, Sentinel A4,
AN/TPS-80, Giraffe 1X, SPEXER 2000, EchoGuard, Spyglass, Blighter A422, Ground Master 200.

Fields verified per radar: `detectRangeM` with `refRcsM2` and `placardPd`,
`instrumentedRangeM`, `updateRateS`, `elevationDeg`, `maxAltitudeFt`, `mountHeightM`,
`sectorDeg`.

Source hierarchy: manufacturer datasheet or press release (`datasheet`); a named
reference publication or a press article that quotes the manufacturer (`reference`);
otherwise the value stays and the row says `pf`. Every row records the URL and the
date read. A value with no source is not invented; the existing seed value stays with
basis `pf`.

Giraffe 1X, first and the template. Search on 2026-09-03 found: instrumented range
75 km (Saab press release, 2018), elevation coverage to about 70 degrees and a sector
mode to 8 Hz (press coverage, 2026), one-second full-volume update (seed description,
to be traced to the Saab page). No public source found for a range against a stated
RCS. The 4,000 m at 0.01 m2 placard stays PF unless the slice finds one. Each claim
above is confirmed against the page itself in the slice, not from the search summary.

Acceptance:

- `seedLibrary.test.ts`: every radar has a provenance row for `detectRangeM`; every
  row has a date and a basis; a URL is present for every non-PF row.
- The Inspector shows the source and date on hover of the PF or source tag.
- A table in the commit message lists each radar, the basis of its placard, and the
  value change if any.

Stays out: non-radar sensors, effectors, threat RCS values (a later pass).

## 6. Verification gate for every slice

1. `npx tsc --noEmit -p tsconfig.app.json` clean.
2. `npx vitest run` green. New tests colocated. Count reported in the commit message.
3. `npm run lint` with no new warnings beyond the baseline.
4. `npm run build` clean.
5. Load the pre-slice autosave (`rangeboard.scenario.v1`) in the browser. No recovery
   key is written. The five-threat screenshot scenario reproduces its run.
6. Playwright check through `window.__store` for the behaviors the slice names, with a
   screenshot saved to the scratchpad, never to the repo.
7. `CLAUDE.md` updated where the slice changed a contract.

## 7. CLAUDE.md edits by slice

| Slice | Edit |
| --- | --- |
| 1 | Replace the "Plan view only" paragraph with the altitude contract: `Entity.altitudeFt`, `mountHeightM`, `slant.ts`, the geometry gate, ground-projected rings. |
| 2 | Sensor physics paragraph: the Pd law, calibration, thresholds in `requirements`, `radarPd.ts`, provenance rows. |
| 3 | Fire doctrine paragraph: M-of-N initiation, coast and drop, `updateRateS`. |
| 4 | Layer visibility paragraph: seven ring keys, `RINGS_KEY`, per-entity overrides, effector red. |
| 5 | Architecture map: `src/charts/`, `series.ts`. Design system: chart tokens. |
| 6 | Architecture map: `analysisLayout.ts`, `ANALYSIS_KEY`, `observedPresetId`, the three survival names, the 7.5 px exception removed. |
| 7 | Panels: selection-driven detail. |
| 8 | Engine facts: `DrawPolicy`, `runMode`, `seed`, the `mc` slice, the worker. |
| 9 | Domain semantics: provenance basis and the PF rule. |

## 8. Mockup map

`docs/data-engine/mockup.html`, generated by `build_mockup.py`, has these sections:

1. Board rings at rest and with the Mohajer-6 selected (slice 4).
2. Analysis panel, Run summary lens, deterministic (slice 6).
3. Analysis panel, Sensors lens, Monte Carlo with bands (slices 6 and 8).
4. Selection detail, Giraffe 1X (slice 7).
5. Selection detail, Mohajer-6 (slice 7).
6. Widget catalog and customize mode (slice 6).

Numbers in the mockup come from the screenshot scenario and the slice 1 and 2 formulas
(Mohajer-6 at 14,000 ft, Giraffe 1X Pd 0.5 contour at 11.9 km ground range). They are
illustrative until the slices compute them.

## 9. Open items

- Swerling 3 single-pulse closed form: the slice 2 test pins it against a published
  curve. If the curve and the form disagree by more than 0.5 dB, use the numeric
  Marcum-Q integration and record that in the JSDoc.
- Giraffe 1X placard source: none found for a range-against-RCS pair. Slice 9 decides
  PF or sourced after reading the Saab product page directly.
