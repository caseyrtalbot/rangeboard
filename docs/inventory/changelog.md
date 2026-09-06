# Inventory change log, August 2026

> Dated source document, August 2026. Source and tests decide current behaviour.

Every change to the selectable inventory, with its justification. Read
`provenance.md` for the per-field evidence and `gaps.md` for what was excluded.

Counts: library models 49 to 90. Integration profiles 32 to 73. System presets
4 to 13.

## ADD, models (41)

All 41 carry an `IntegrationProfile`, which `integration.test.ts` requires of
every sensor, effector and C2 model.

**Radar (8)** `lib-sentinela4` `lib-gator` `lib-giraffe1x` `lib-spexer2000`
`lib-echoguard` `lib-spyglass` `lib-a422` `lib-gm200mmc`

No large multi-mission radar (Sentinel A4, G/ATOR, GM200 MM/C) publishes a
detection range conditioned on a UAS class. Their public numbers are
instrumented or counterfire ranges, which are not substitutable. All three ship
with a role-default representative ring and say so on the card.

**Passive RF (5)** `lib-corian` `lib-wingman` `lib-rfpatrol` `lib-ardronis`
`lib-titan`

`classifyRangeM` was set to `null` on `lib-corian`, `lib-wingman`,
`lib-ardronis` and `lib-titan`. The researcher had inferred it equal to the
detection range. That is load-bearing: `sim.ts:85` makes a track `classified`
from this field, and a `classification` or `fire-control` role then promotes it
up the hostile ladder. An inferred number must not drive an engagement gate.

**EO/IR and acoustic (5)** `lib-wisp` `lib-mxgcs` `lib-spynel` `lib-zvook`
`lib-zvooknw0`

`lib-zvooknw0` ships the low end (150 m) of its declared 150-450 m band, the
same band-collapse rule applied to `lib-wisp`. Shipping the top of a band
changes a picket-spacing answer.

**C2 (6)** `lib-ibcs` `lib-adsi` `lib-tak` `lib-dronesentryc2`
`lib-dedronetracker` `lib-cac2s`

Open-standard protocol slugs were stripped from `lib-adsi` (to `['link-16']`)
and `lib-tak` (to `[]`), and `cot-tak` from `lib-dronesentryc2`. Because those
slugs sit in `OPEN_STANDARDS`, `evaluateIntegration`'s fallback would have
emitted `probable` engage-order links from a track-forwarding gateway to every
FAAD C2 effector, and from a TAK node the record itself describes as carrying no
engagement authority. The real interface facts are carried as explicit pairs
instead, which is where they belong.

**Electronic attack (4)** `lib-cuaews` `lib-ninja` `lib-pulsar` `lib-pitbull`

`lib-cuaews` is the electronic-warfare layer of the LIDS family and the only
system in its domain with a government-cleared effect range (8 km, inside a
stated layered sequence). The app modelled the LIDS radar, interceptor and gun
but not the EW belt between them.

**Kinetic (4)** `lib-stinger` `lib-eagls` `lib-skyranger30` `lib-dronehunter`

`lib-skyranger30.magazineSize` ships as 12, not the researched 300 ready rounds.
`attrition.ts:780` spends `magazineSize` once per salvo, so the field counts
engagements. 300 would have given the system about twenty-five times its real
endurance. Every shipped gun already followed the salvo reading.

`lib-dronehunter` omits `magazineSize` so the 180 s sortie turnaround binds
instead. A one-shot magazine plus a cooldown is self-cancelling: the effector
would fire once and the reusability that defines the system would never appear.

`lib-eagls` lost its proposed `lib-rps42` pair. EAGLS carries an RPS-40, which
is not in the library, and pairing it with a different radar asserts a fit that
does not exist.

**Directed energy (3)** `lib-amphel` `lib-helios` `lib-ironbeam`

No US laser or high-power microwave C-UAS system publishes an engagement range.
`lib-amphel` and `lib-helios` are pinned to the shipped `lib-phel` ring (3,000 m)
rather than to a sensor-role default, because AMP-HEL runs the same 20 kW LOCUST
laser as P-HEL and an invented differential between them would be manufactured
precision. `lib-ironbeam` ships the conservative bound of an unresolved 7-10 km
reporting conflict, with the spread stated on the card.

**System components (6)** `lib-kumrfs-m` `lib-xbaeu` `lib-cuaews-df`
`lib-cm262` `lib-drs-s3` `lib-sentry-lr-fc`

Added so the new presets could be built from real components instead of
substitutes. `lib-kumrfs-m` matters most: the fixed KuMRFS-T is published
"beyond 15 Km" and the mobile KuMRFS-M "beyond 7 Km", so the mobile presets were
drawing a radar ring twice too large.

## UPDATE, existing models

| Model | Change | Why |
| --- | --- | --- |
| `lib-teleidoscope` | Description rewritten, role `fire-control` to `classification` | `seedLibrary.ts` claimed FS-LIDS and M-LIDS while `integrationData.ts` denied the KuRFS pairing saying open sources do not confirm it. The two files contradicted each other. The fielded program is the NCR-IADS camera modernization. |
| `lib-lstar` | Renamed to AN/TPQ-50, `maxAltitudeFt` and `resolutionM` to `null`, description rewritten | SRC publishes >35 km instrumented in air surveillance and >15 km counterfire, neither conditioned on a UAS class. The 10 km ring is a planning figure and now says so. |
| `lib-tpq53` | `resolutionM` to `null`, description rewritten | Lockheed publishes no range against a UAS class. |
| `lib-rps42` | Description rewritten | The 3.5 km nano-UAS figure is published; the 8 km mini-UAS figure has no locatable source. |
| `lib-rps62` | Description rewritten; FAAD C2 pair raised to `documented` | Both rings are unsourced. The designation is real: Northrop's FAAD C2 sheet names MHR/RPS-42/62/82. |
| `lib-iris` | Description rewritten | 5 km is the instrumented range, not a detection range against a stated target. |
| `lib-rf360` | Description rewritten | Records the 2 km normal-conditions condition so the 5 km ideal-conditions figure is not swapped in. |
| `lib-rfone` | Description rewritten | DroneShield publishes no detection range for RfOne Mk2. The 5 km ring was presented as a manufacturer figure and is not one. |
| `lib-discovair` | `elevationDeg` to `null` | Direction-finding accuracy is not elevation coverage. |
| `lib-acoustic-picket` | Renamed to "(representative)", description rewritten | The name attached unsourced numbers to Sky Fortress, a named real system that publishes no per-node range. |
| `lib-coyote` | Description rewritten | The RF seeker is Block 1B, not Block 2. |
| `lib-anvil` | `engageTimeS` 90 to 60 | 90 s at the reported 89 m/s implies 8,010 m of flight against a 4,000 m ring. |
| `lib-roadrunner` | Description rewritten | Anduril publishes no range, speed, altitude or endurance figure. |
| `lib-merops` | `minRangeM` 5000 to 1000 | The source's "five to 20 kilometres" is a reach spread across configurations, not a minimum. The 5 km dead zone also swallowed the launch rails in `sys-merops`. |
| `lib-modi` | `maxAltitudeFt` to `null`, GNSS-denial claim removed | 3,500 ft has no traceable source. Public sources describe control-link disruption, not GNSS denial. |
| `lib-dronebuster`, `lib-enforceair` | `maxAltitudeFt` 1200 to `null` | 1,200 ft is the DoD Group 1 threat-class ceiling, not an effector ceiling. |
| `lib-phel` | Renamed to AV LOCUST, `pk` removed, description rewritten | BlueHalo was acquired by AeroVironment. `pk: 0.85` was invented; removing it falls back to the labelled `DEFAULT_PK.de` baseline. |
| `lib-demshorad` | `pk` removed, description and status rewritten | GAO found the prototype not mature enough to transition; production slipped to FY2027. |
| `lib-thor` | Description rewritten | AFRL has never published an engagement range or dwell time. |
| `lib-medusa` | Description rewritten | "Government-owned, open-standards" is unsupported on both counts. MEDUSA was developed by Kongsberg Geospatial. |

## UPDATE, existing presets

`sys-fslids` was rebuilt. It placed four RPS-42 faces and a Modi II jammer.
CRS R48477 and the SRC LIDS brochure give the configuration as KuRFS radar,
EO/IR cameras, an electronic-warfare system, FAAD C2 and 4-pack Coyote
launchers, and neither names an RPS-42 or a Modi. The preset now places one
360 degree KuMRFS-T, an optional AN/TPQ-50 search layer, CUAEWS direction
finding and defeat, an EO/IR stand-in and two Coyote launchers.

`sys-merops`, `sys-acoustic-iads` and `sys-mesh` gained an explicit
"REPRESENTATIVE LAYDOWN - NOT A VERIFIED FIELD CONFIGURATION" prefix in the
description a user reads. The caveat previously lived only in a code comment,
which is invisible to anyone who drops the preset and screenshots it into a
test product. `sys-acoustic-iads` also states that its 3,000 m picket spacing
assumes an engine-noise target and gives no Group 1 coverage.

Four preset links that the app's own integration data contradicts were removed:
`sys-acoustic-iads` Picogrid to Modi, and `sys-mesh` Discovair to Picogrid twice
and R8SS to Picogrid. `sys-mesh` also routes its interceptor through the Lattice
gateway rather than the edge nodes.

## ADD, presets (9)

`sys-mlids-section` `sys-mlids-stryker` `sys-madis` `sys-lmadis` `sys-sgtstout`
`sys-demshorad` `sys-doctrine-point-defense` `sys-doctrine-base-defense`
`sys-doctrine-maneuver-protection`

The last three are doctrinal constructs, not real sites, and say so in their
descriptions. They carry no doctrinal distances: the only laydown distance found
in the doctrine corpus comes from an ATP edition superseded twice, so all
geometry is labelled representative.

`sys-madis` is also labelled representative. CRS states only that the Mk2 carries
"radar and kinetic and nonkinetic counter-UAS capabilities"; the specific radar,
jammer and C2 shown are library equivalents, not sourced attributions.

## ADD, test

`seedSystems.test.ts` now asserts every preset link is one `evaluateIntegration`
supports. `addSystemFromPreset` writes preset links straight into `Connection`
records without consulting the integration model, so a preset could otherwise
draw a kill chain that `integrationData.ts` denies. Six shipped links were doing
exactly that before this change.

## CUT

| Candidate | Why |
| --- | --- |
| `lib-anvilm` | Every board-drawable field is copied from the shipped `lib-anvil`, and the only differential (`pk` 0.85 against 0.75) is invented. Two indistinguishable rings under two names. |
| `lib-ifpc2` | `maxRangeM` 15000 is a self-declared placeholder, and it is identical to the shipped Coyote and Roadrunner rings, so the medium-range entry draws the existing short-range tier. |
| `lib-ehel` | Pre-award: no vendor, no published power class, no published range. Its only "documented" integration is a requirement in an RFI, not an interface that exists. |
| `lib-corian` as an effector | Proposed twice in one delivery for the same CACI system. The sensor record is better sourced and has a stated basis for its number. The defeat function is noted in the sensor's description. |
| `lib-sentry-xr` | The sensor head contents are undisclosed, so the one `sensorType` a `SpecModel` carries cannot be chosen on evidence, and every published range is against ground objects for border counter-intrusion. |
| `lib-truviewr30` | Researcher exclusion, review concurred. |
| `sys-anduril-site` | Shipped as one C2 and four effectors with no sensor, from an export component list the record itself flags as conflicting with the domestic configuration. |

## Proposed corrections REFUTED during review, not applied

Both were labelled high-priority by the researcher who found them. Both would
have written wrong data into shipped entries.

**`lib-rps62` is not a fake designation.** The claim was that no public source
names an "RPS-62" and the entry should be renamed to an evidenced product.
Northrop's FAAD C2 infographic NG23-0503-0384 (2023) reads "MHR/RPS-42/62/82" in
its sensors column. The finding rested on three negative searches that did not
reach the document. Renaming would have moved unsourced numbers onto a different
real product. Only the second half of the finding was applied: the ranges are
unsourced and now say so.

**`lib-kurfs` at 15 km is sourced.** The claim was that no source supports 15 km
against the smallest UAS class. The SRC LIDS brochure, approved for public
release, states "UAS Group 1 - 3 capability beyond 15 Km" for KuMRFS-T. The
search was run against RTX's KuRFS page; the figure lives under SRC's KuMRFS
branding. The real defect was different: one entry conflated the 15 km fixed
variant with the 7 km mobile variant, which `lib-kumrfs-m` now separates.

## Considered and deliberately not changed

**`lib-lattice.protocols` keeps `cot-tak`.** A researcher found no citation for
the slug and noted that, because `cot-tak` is in `OPEN_STANDARDS`, the
shared-protocol fallback manufactures a `probable` link. The mechanism is real.
The slug is not an oversight: `integration.test.ts:163` and two store tests pin
the RfOne to Lattice fallback as their fixture. Removing it changes tested
behaviour on the strength of a citation not being found, which is the same
reasoning that produced the false RPS-62 finding. Left for a deliberate decision.

**The FAAD C2 denial of `lib-modi` stands.** The proposal was to delete it and
replace it with a `documented` engage-order pair, on the strength of Modi
appearing in a column of Northrop's FAAD C2 sheet. Review established the column
is headed "Supported Technology" and also contains whole weapon systems
("FS-LIDS", "Iron Dome"), a turret ("RIwP") and a bare company name ("Anduril").
Column membership cannot carry a link role, and `documented` is the tier that
drives auto-connect.
