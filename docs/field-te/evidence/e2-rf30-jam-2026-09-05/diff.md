# E2 R-F-30 before-and-after capture, 2026-09-05

Source change: `assessJam` (`src/analysis/ewPhysics.ts`) evaluates range, min range and the power falloff on the slant range from a new `dAltM` argument; `src/playback/attrition.ts` passes `ts.altM - es.mountM`, the same difference its envelope gate uses. No other equation, table, draw site, DT, CRN pairing, raid partition or persistence changed.

Probe: the body of `r1-leaf-2026-09-05/parity-probe.ts.txt` (assessments, deterministic report, aleatory MC, total MC, sensitivity; `replicates: 4`), run as a scratch vitest file `src/playback/e2.capture.test.ts`, deleted after. Each after file was produced twice and compared with `cmp`; both are byte-stable.

## Firing fixture (`onboarding-2026-09-04/firing-scenario.json`)

`numerical-before.json` is a copy of `r1-leaf-2026-09-05/numerical-baseline.json`. `numerical-after.json` is byte-identical to it (`cmp` exit 0). The fixture places one Coyote interceptor and no jammer, so `assessJam` never runs on it. `numerical-after.json` is the parity baseline for later refactors.

## Layered fixture (`src/playback/__fixtures__/layered-acoustic-merops.json`, through `fillScenario`)

One Modi II jammer (`lib-modi`, 2000 m, 360 deg, mount 4 m) against three FPV7 (80 ft, 24.4 m) and six Mavic 3 (300 ft, 91.4 m, mixed nav, continue jam). Files: `numerical-before-layered-acoustic-merops.json`, `numerical-after-layered-acoustic-merops.json`.

Top-level keys that differ: `report` only. `assessments`, `aleatory`, `total` and `sensitivity` are identical: with 4 replicates no 0/1 kill or jam draw crossed its threshold under the shifted Pk. Inside `report`: 50 threat leaves, 6 totals leaves and 64 event leaves differ; `effectors` is identical (24 kinetic shots, 39 jam salvos, same expenditure). Event count, times, shooters and targets are the same; only the per-event Pk values moved.

| Statistic | Before | After |
| --- | --- | --- |
| totals.expectedKills | 6.89912679647518 | 6.899305862202753 |
| totals.expectedHardKills | 6.002413379448741 | 6.002603286007924 |
| totals.expectedSoftKills | 0.8967134170264394 | 0.8967025761948292 |
| totals.expectedLateKills | 0.3340333692803923 | 0.33401826224776265 |
| totals.expectedLeakers | 2.100873203524819 | 2.1006941377972472 |
| FPV threat 0 expectedSoftKills | 0.3419141931404498 | 0.34191006091209325 |
| Mavic threat 3 continueJamProb | 0.9740392366166024 | 0.9738656678758804 |
| Mavic threat 8 continueJamProb | 0.9597139727577504 | 0.9596075317346277 |
| Mavic threat 3 expectedHardKills | 0.6998748880851632 | 0.6999132989639253 |

All nine threats moved; every Mavic `continueJamProb` fell by 0.0001 to 0.0002 and every Mavic `expectedHardKills` rose by up to 0.00004.

Explanation. The slant range to a Mavic at 91.4 m from a 4 m mount exceeds the horizontal range by about `dh^2 / (2 d)`: 1.9 m at 2000 m, 3.8 m at 1000 m. The jam factor `1 - 0.3 r / R_eff` therefore falls by `0.3 (slant - horizontal) / 2000`, about 0.0003 to 0.0006 per dwell, so the per-dwell jam Pk and the accumulated `continueJamProb` fall. A slightly less jammed track takes a slightly smaller jam degrade on the kinetic shots that follow, so hard kills rise and leakers fall by a comparable amount; soft kills on the FPV threats (GPS nav, kill channel) fall with the jam Pk. The direction is the physical one: the horizontal convention overstated jam power at altitude. Magnitudes are small on this fixture because the altitude difference is 4.5 percent of the jam reach; the study table in the E2 report gives up to 0.061 at the envelope edge for a 1 km jammer against a 2000 ft threat.
