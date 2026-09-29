# Row G kill types browser check, 2026-09-28

Captured on branch `engine/g` at `70512e0` (the one dead rule, the kill types, milestones
bounded at the hard kill, engine revision `rangeboard-trial-r4-v3`). The Vite dev server
ran the source on port 5461. Playwright used headless Chromium at a 1265 by 900 viewport,
dark theme unless a row says daylight. The fixture is the layered acoustic MEROPS laydown,
[layered-acoustic-merops.json](../../../../src/playback/__fixtures__/layered-acoustic-merops.json),
loaded through `parseAutosave` and `loadScenario`. Its physics switches stay as saved and
its ROE is free. The run is 1,321 s long.

The fire doctrine is on. The fixture has no doctrine record, so `parseAutosave` fills the
default, which is enabled. The brief asked for doctrine off. With doctrine off, the same
script ran 80 sampled trials and found 0 mission kills (0 `softShot` events with
`killDelta` 1) and 14 late kills, so no trial held all three kinds. With the default
doctrine, the third trial held all three.

The script is preserved as `engine-g-capture.mjs.txt`. It is evidence of a dated run, not
a test. It starts sampled trials in Execute until one trial holds a pre-arrival hard kill,
a pre-arrival mission kill and a late kill, each on a threat with a unique name. Two
threats in this laydown share the name `THR-G1-FPV-01 1`, and the tables are read by
name. It then completes the run, reads the app state and the screens, and takes the
shots. `findings.json` holds every reading.

## The trial

Run id `simrun-mum3ques-6`, seed 4821, replicate index 952296419, sweep step 0.5 s. The
ledger holds 33 events: 9 with `killDelta` 1, 2 of them `softShot`, 1 of them
`lateEffect`. No event carries `flightCapped`. Every threat is one ship, so no trial can
show a mixed defeat or a partly killed formation.

| Threat | Death (deadTimeOf) | Type | Planned arrival |
| --- | --- | --- | --- |
| THR-G1-Q-01 1 | T+1:39.39 | hard | T+4:01 |
| THR-G1-Q-01 3 | T+1:58 | hard | T+4:02.5 |
| THR-G1-Q-01 5 | T+2:07.10 | hard | T+4:05.5 |
| THR-G1-Q-01 6 | T+2:28 | hard | T+4:11 |
| THR-G1-Q-01 4 (hard subject) | T+3:47 | hard | T+4:05.5 |
| THR-G1-Q-01 2 (late subject) | T+4:36.5 | hard, late | T+4:02.5 |
| THR-G1-FPV-01 1 (`ent-mt5bqja3-2v`) | T+11:42.5 | mission | T+13:00.5 |
| THR-G1-FPV-01 1 (`ent-mt5bofdd-2q`) | T+16:35.14 | hard | T+19:40.5 |
| THR-G1-FPV-01 2 (mission subject) | T+21:10.5 | mission | T+21:40.5 |

## Shots

| File | State |
| --- | --- |
| `now-dark.png` | Rerun after the LiveStrip fix, same trial: Execute, complete run at T+22:01, the Run monitor card (`Defeated 8/9 members`) and the kill chain table |
| `board-hard-before-dark.png` | Execute, THR-G1-Q-01 4 selected, cursor T+3:42 (5 s before its hard kill): pill `ENGAGED`, track drawn |
| `board-hard-kill-dark.png` | Execute, THR-G1-Q-01 4 selected, cursor T+4:17 (30 s after): pill `HARD KILL`, no track on the board; the LSTAR sub-lane and the track row end at the kill; the threat row carries the ghost span to the planned arrival |
| `board-hard-kill-daylight.png` | The same state in the daylight theme |
| `board-mission-kill-dark.png` | Execute, THR-G1-FPV-01 2 selected, cursor T+21:40.5 (30 s after its mission kill): pill `MISSION KILL`; the track row and the sensor rows run on; no ghost span |
| `board-mission-kill-glyph-dark.png` | The same cursor, nothing selected, framed 800 m wide: the cyan `MISSION KILL` member glyphs of both mission-killed threats |
| `board-late-kill-dark.png` | Execute, THR-G1-Q-01 2 selected, cursor T+4:41.5 (5 s after its late kill): pill `LEAKED` |
| `outcome-tiles-dark.png` | Analyze, Outcome: the tiles and the per-threat table |
| `outcome-table-dark.png` | Analyze, Outcome: the per-threat table at the top of the panel |
| `debrief-threat-record-dark.png` | Analyze: the Debrief trial threat record (`ThreatPicture`, debrief mode) mounted by the script at the right edge, around the late kill card |
| `detail-survival-hard-dark.png` | Analyze, THR-G1-Q-01 4 selected, threat detail: the survival chart with `FX` and `ARR` |
| `detail-survival-late-dark.png` | Analyze, THR-G1-Q-01 2 selected, threat detail: the survival chart with `ARR` and no `FX` |

The strip in the board shots shows only the subject's rows. The script hides the other
rows and opens one sensor row on its sub-lanes: the sensor whose hold of the subject ends
last (the first on a tie). For all three subjects it is the LSTAR row. This is view state
only.

## Findings

| Item | Result | Reading |
| --- | --- | --- |
| Outcome FX column | pass | Hard subject `3:47`, mission subject `21:10`, late subject `—` |
| Outcome result words | pass | `defeated (hard)`, `defeated (mission)`, `leaked late kill T+4:36` |
| Outcome First effect tile | pass | `T+1:39`, the earliest pre-arrival death (THR-G1-Q-01 1 at T+1:39.39) |
| Outcome tiles | pass | Defeated before arrival 8/9, arrived undefeated 1/9, late kills 1/9 |
| Debrief card, hard | pass | `DEFEATED`, `FX 3:47`, FX chip 1/1 |
| Debrief card, mission | pass | `DEFEATED`, `FX 21:10` |
| Debrief card, late | pass | `LEAKED`, `late kill T+4:36`, `FX —`, FX chip 0/1 |
| Now kill chain rows | pass | Hard and mission subjects `defeated`; late subject `leaked` with `late kill T+4:36` |
| Now Run monitor card | pass | `Defeated 8/9 members` after the LiveStrip fix, equal to the Outcome tile. See the first bullet below |
| Pill, hard | pass | `ENGAGED` 5 s before, `HARD KILL` 30 s after, dark and daylight |
| Pill, mission | pass | `MISSION KILL` |
| Pill, late | pass | `LEAKED` |
| Pill `DEFEATED (MIXED)` | not shown | No mixed defeat: every threat is one ship |
| Hard kill board | pass | Estimates drawn: 4 at T+3:42 and at the kill, 0 at T+4:17 and at the run end |
| Hard kill strip | pass | The four sub-lanes that held the threat at the kill and the track row end at T+3:47.5 (two earlier holds end at T+1:15 and T+1:50.5); the threat row carries the `hard-kill` mark at T+3:47 and the ghost span T+3:47 to T+4:05.5 |
| Hard kill phase | pass | Phase `ghost`, member `hard-kill` from the kill on |
| Mission kill board | pass | Estimates drawn: 4 at T+21:05.5, 4 at T+21:40.5, 4 at the run end |
| Mission kill strip | pass | Sub-lanes and track row run to the cursor (T+22:01 at the run end); the threat row runs to the planned arrival T+21:40.5 with the `mission-kill` mark at T+21:10.5 and no ghost span |
| Mission kill phase and glyph | pass | Phase `ghost` (the group dims), member `mission-kill`; the member glyph draws in cyan with `MISSION KILL` |
| Late kill strip | pass | The threat row holds `arrival` at T+4:02.5 and `hard-kill` at T+4:36.5, ends at the kill, and has no ghost span |
| Survival chart FX | pass | Hard subject `ARR` and `FX`; mission subject `ARR` and `FX`; late subject `ARR` only |
| Capped tooltip | not shown | No effect mark carries `capped`: 0 `flightCapped` events in this trial and in the other 2 attempts |
| `observedThroughS` on scrub | pass | 1,321 before and after each of 7 scrubs |
| Page errors | pass | 0 |

- Now Run monitor card. The first capture read `Defeated 9/10 members`: the card counted
  the late kill as a defeat, and its population included `ent-mt5bq0rc-2u`, a UAS with no
  path. The fix in `LiveStrip.tsx` (committed with this evidence, on top of `70512e0`) counts pre-arrival
  hard and mission kills over the modeled members, the sum of the attrition rows'
  `shipCount`. The rerun script, `engine-g-now-rerun.mjs.txt`, replayed the same trial by
  run id: the same replicate index and the same nine deaths. It read `Defeated 8/9
  members` at the run end, with the title "Members defeated before arrival; a late kill
  is a leaker". The Outcome tile reads `8/9 members`. `observedThroughS` was 1,321, and the
  rerun had 0 page errors. `findings.json` holds the first reading under `nowStrip` and the
  rerun under `nowRerun`.
- Debrief threat record. No screen mounts it. The only `DebriefRecord` mount is on
  Outcome, which passes `showTrialRecords={false}`. So the cards were read two ways: from
  `trialThreatPictureAt` at the run end, and from `ThreatPicture` in debrief mode, mounted
  by the script into its own root with the app's React module.
- Hard kill hold ends. The kill is at T+3:47.0, on the sweep grid. The last kept sample is
  at the kill and draws its one 0.5 s step, so each hold and the track row end at
  T+3:47.5. This matches the Row F rule.
- The late kill is a hard kill after arrival. From the kill on, its phase is `ghost` and
  its member reads `hard-kill`. Its board track is gone 5 s after the kill (0 estimates
  drawn), and its track row ends at T+4:37, the step after the kill sample.
- On the hard subject's survival chart, the `FX` label (T+3:47) and the `ARR` label
  (T+4:05.5) sit 18 s apart on a 22 min axis and overlap. The text read finds both.

## Rerun

Start a dev server with `npm run dev -- --port <port> --strictPort`. Copy the capture
script to a `.mjs` file in a folder whose parent chain reaches the repository
`node_modules` (or link `node_modules` beside it). Run
`node engine-g-capture.mjs http://localhost:<port> <out-dir> <repo-root>`. Add a fourth
argument `doctrine-off` to turn the fire doctrine off before the first trial. Run
`oxipng -o 4 --strip safe` on the PNGs before a commit. The trial is sampled, so the run
id, the subjects, the times and the counts can differ between runs. A run with no
qualifying trial in 80 attempts exits with status 1 and writes the attempts.

To replay one trial on the Now screen, run
`node engine-g-now-rerun.mjs http://localhost:<port> <out-dir> <repo-root> <run-id>`. The
replicate index is a hash of the run id, so the same run id and seed give the same draw.
