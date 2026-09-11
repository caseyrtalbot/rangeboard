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

## 2026-09-10, Phase 2 accuracy fields

Every sensor file gains `rangeAccuracyM`, `azimuthAccuracyDeg` and
`elevationAccuracyDeg` (1 sigma). Every radar also gains
`falseAlarmRatePerScan` (expected false alarms per scan over the whole
coverage). Eight C2 files gain `spec: 'c2'` with `decisionLatencyS`,
`decisionLatencySigmaDb` and `operatorTrackCapacity`. No existing value
changed; every edited file has its `version` bumped.

Priority of evidence, in order: (1) the OEM sheet or product page, quoted with
its condition, L1 MANUFACTURER_CLAIM, or REPORTED where the figure reached us
through a mirror or the search index and the sheet itself was not opened;
(2) an independent open reference, L1; (3) the class median of the sourced
systems with the same `sensorType` and `role`, L2 INFERRED with a
`comparisonSet`; (4) a planning factor with a stated textbook basis where the
class has no sourced member. A field the record does not give and no class can
estimate is L3 (`value: null`). Vendor bounds ("<1°", "±3 m") are recorded as
the 1 sigma value and the condition says so. Every L1 field carries a 2 dB
lognormal spread and every L2 field a 4 dB one.

Method notes:

- Radar class medians are role-restricted. Surveillance radars draw on the
  Ranger R8SS-3D alone and target-acquisition radars on the RPS-42 alone, so
  the SPEXER 2000 and Sentinel A4 carry the RPS-42's 50 m range accuracy. A
  one-member median is thin; it is recorded as such so a later source replaces
  it cleanly.
- Early-warning and fire-control radars have no sourced member, so they carry
  planning factors: a tenth of the beamwidth in angle (Skolnik), 30 m or 10 m
  in range.
- `falseAlarmRatePerScan` is a planning factor on every radar: PLACARD_PFA
  (1e-6) times about 1e6 cells per scan gives about 1 per scan for a 360 deg
  volume and 0.5 for a sector panel. No vendor publishes one.
- `lib-rfone` breaks the role rule on purpose: the role-restricted set holds
  only the body-worn Wingman (±30 deg, signal strength), so the median is
  taken over every sourced RF sensor instead (5 deg). `lib-rfpatrol`, also
  body-worn, keeps the Wingman figure.
- RF direction finders carry no range (L3) and, except Titan's 3D claim, no
  elevation (L3). Passive imagers with no rangefinder carry no range (L3).
  Single-node acoustic sensors carry no range and no elevation (L3);
  omnidirectional single-microphone nodes (`lib-zvooknw0`,
  `lib-acoustic-picket`) carry no bearing either.
- The Fortem TrueView +/-2 deg figure in `provenance.md` belongs to the
  DroneHunter seeker, which is not a library sensor; it was not used.
- C2 decision latency is a planning factor on every engagement C2:
  `DEFAULT_FIRE_DOCTRINE.declareHostileS` 10 s as the median, 3 dB sigma,
  cross-checked against trade reporting of 2 to 5 s under pre-authorised ROE
  plus 10 to 30 s for a commander release. Operator capacity is 6 tracks from
  the Fundamentals of Naval Weapons Systems track-while-scan chapter. No
  vendor publishes either figure, and none was invented.
- `lib-adsi` stays `spec: null`: it is a data-link gateway that bridges
  pictures and takes no engagement decision. `lib-tak` stays `spec: null`:
  its own record says it carries no engagement authority, so it is not
  modelled as the operator console.
- `data/priors/sensor__radar__any__any.json` and
  `src/analysis/classPriors.generated.ts` gain radar priors for the three
  accuracy fields (five L1 members); the priors build writes both.

Per-field record (value, layer, source or comparison set):

- `lib-a422` `rangeAccuracyM` 3 m, L2, INFERRED class-median of lib-r8ss
- `lib-a422` `azimuthAccuracyDeg` 0.8 deg, L2, INFERRED class-median of lib-r8ss
- `lib-a422` `elevationAccuracyDeg` 3 deg, L2, INFERRED class-median of lib-r8ss
- `lib-a422` `falseAlarmRatePerScan` 1 count, L2, INFERRED planning-factor; basis in the field note
- `lib-acoustic-picket` `rangeAccuracyM` null, L3, UNKNOWN; A single acoustic node measures bearing at best, not range; not established by the public record.
- `lib-acoustic-picket` `azimuthAccuracyDeg` null, L3, UNKNOWN; Representative omnidirectional microphone node: presence-and-alarm only, no bearing; localisation comes from crossing nodes.
- `lib-acoustic-picket` `elevationAccuracyDeg` null, L3, UNKNOWN; No elevation measurement is published for this acoustic node; not established by the public record.
- `lib-ardronis` `rangeAccuracyM` null, L3, UNKNOWN; A single-site RF direction finder measures bearing, not range; not established by the public record.
- `lib-ardronis` `azimuthAccuracyDeg` 3 deg, L2, INFERRED class-median of lib-titan, lib-rf360
- `lib-ardronis` `elevationAccuracyDeg` null, L3, UNKNOWN; Two-dimensional RF direction finding gives no elevation; not established by the public record.
- `lib-cm262` `rangeAccuracyM` 5 m, L2, INFERRED planning-factor; basis in the field note
- `lib-cm262` `azimuthAccuracyDeg` 0.0046 deg, L1, MANUFACTURER_CLAIM, CACI CM262 datasheet 3-2-0, gimbal position accuracy 0.0046° (80 µrad), quoted from the search index; the PDF was blocked on read
- `lib-cm262` `elevationAccuracyDeg` 0.0046 deg, L1, MANUFACTURER_CLAIM, CACI CM262 datasheet 3-2-0, gimbal position accuracy 0.0046° (80 µrad), quoted from the search index; the PDF was blocked on read
- `lib-corian` `rangeAccuracyM` null, L3, UNKNOWN; A single-site RF direction finder measures bearing, not range; not established by the public record.
- `lib-corian` `azimuthAccuracyDeg` 3 deg, L2, INFERRED class-median of lib-titan, lib-rf360
- `lib-corian` `elevationAccuracyDeg` null, L3, UNKNOWN; Two-dimensional RF direction finding gives no elevation; not established by the public record.
- `lib-cuaews-df` `rangeAccuracyM` null, L3, UNKNOWN; A single-site RF direction finder measures bearing, not range; not established by the public record.
- `lib-cuaews-df` `azimuthAccuracyDeg` 3 deg, L2, INFERRED class-median of lib-titan, lib-rf360
- `lib-cuaews-df` `elevationAccuracyDeg` null, L3, UNKNOWN; Two-dimensional RF direction finding gives no elevation; not established by the public record.
- `lib-discovair` `rangeAccuracyM` null, L3, UNKNOWN; A single acoustic node measures bearing at best, not range; not established by the public record.
- `lib-discovair` `azimuthAccuracyDeg` 10 deg, L1, REPORTED, Squarehead Discovair G2 product sheet v1.3 (cuashub mirror): direction accuracy '<10°' azimuth/elevation, quoted from the search index; the PDF was blocked on read
- `lib-discovair` `elevationAccuracyDeg` 10 deg, L1, REPORTED, Squarehead Discovair G2 product sheet v1.3 (cuashub mirror): direction accuracy '<10°' azimuth/elevation, quoted from the search index; the PDF was blocked on read
- `lib-drs-s3` `rangeAccuracyM` null, L3, UNKNOWN; Passive imager with no rangefinder documented: bearing only; not established by the public record.
- `lib-drs-s3` `azimuthAccuracyDeg` 0.03 deg, L2, INFERRED planning-factor; basis in the field note
- `lib-drs-s3` `elevationAccuracyDeg` 0.03 deg, L2, INFERRED planning-factor; basis in the field note
- `lib-echoguard` `rangeAccuracyM` 3.25 m, L1, MANUFACTURER_CLAIM, Echodyne EchoGuard product page and spec sheet (25JA1)
- `lib-echoguard` `azimuthAccuracyDeg` 1 deg, L1, MANUFACTURER_CLAIM, Echodyne EchoGuard product page and spec sheet (25JA1)
- `lib-echoguard` `elevationAccuracyDeg` 1.5 deg, L1, MANUFACTURER_CLAIM, Echodyne EchoGuard product page and spec sheet (25JA1)
- `lib-echoguard` `falseAlarmRatePerScan` 0.5 count, L2, INFERRED planning-factor; basis in the field note
- `lib-echoshield` `rangeAccuracyM` 3 m, L1, MANUFACTURER_CLAIM, Echodyne EchoShield product page and spec sheet (22m1a)
- `lib-echoshield` `azimuthAccuracyDeg` 0.5 deg, L1, MANUFACTURER_CLAIM, Echodyne EchoShield product page and spec sheet (22m1a)
- `lib-echoshield` `elevationAccuracyDeg` 0.5 deg, L1, MANUFACTURER_CLAIM, Echodyne EchoShield product page and spec sheet (22m1a)
- `lib-echoshield` `falseAlarmRatePerScan` 0.5 count, L2, INFERRED planning-factor; basis in the field note
- `lib-gator` `rangeAccuracyM` 30 m, L2, INFERRED planning-factor; basis in the field note
- `lib-gator` `azimuthAccuracyDeg` 0.3 deg, L2, INFERRED planning-factor; basis in the field note
- `lib-gator` `elevationAccuracyDeg` 0.5 deg, L2, INFERRED planning-factor; basis in the field note
- `lib-gator` `falseAlarmRatePerScan` 1 count, L2, INFERRED planning-factor; basis in the field note
- `lib-giraffe1x` `rangeAccuracyM` 3 m, L2, INFERRED class-median of lib-r8ss
- `lib-giraffe1x` `azimuthAccuracyDeg` 0.8 deg, L2, INFERRED class-median of lib-r8ss
- `lib-giraffe1x` `elevationAccuracyDeg` 3 deg, L2, INFERRED class-median of lib-r8ss
- `lib-giraffe1x` `falseAlarmRatePerScan` 1 count, L2, INFERRED planning-factor; basis in the field note
- `lib-gm200mmc` `rangeAccuracyM` 30 m, L2, INFERRED planning-factor; basis in the field note
- `lib-gm200mmc` `azimuthAccuracyDeg` 0.3 deg, L2, INFERRED planning-factor; basis in the field note
- `lib-gm200mmc` `elevationAccuracyDeg` 0.5 deg, L2, INFERRED planning-factor; basis in the field note
- `lib-gm200mmc` `falseAlarmRatePerScan` 1 count, L2, INFERRED planning-factor; basis in the field note
- `lib-hdcmr` `rangeAccuracyM` 5 m, L2, INFERRED planning-factor; basis in the field note
- `lib-hdcmr` `azimuthAccuracyDeg` 0.029 deg, L1, MANUFACTURER_CLAIM, Teledyne FLIR Ranger HDC MR datasheet (mirror at atline.pl), pan and tilt unit accuracy ±0.5 mrad
- `lib-hdcmr` `elevationAccuracyDeg` 0.029 deg, L1, MANUFACTURER_CLAIM, Teledyne FLIR Ranger HDC MR datasheet (mirror at atline.pl), pan and tilt unit accuracy ±0.5 mrad
- `lib-iris` `rangeAccuracyM` 0.6 m, L1, REPORTED, Robin Radar IRIS datasheet as quoted by xsonomy.com and radartutorial.eu (the robinradar.com product page shows no accuracy line)
- `lib-iris` `azimuthAccuracyDeg` 0.75 deg, L1, REPORTED, Robin Radar IRIS datasheet as quoted by xsonomy.com and radartutorial.eu (the robinradar.com product page shows no accuracy line)
- `lib-iris` `elevationAccuracyDeg` 1 deg, L1, REPORTED, Robin Radar IRIS datasheet as quoted by xsonomy.com and radartutorial.eu (the robinradar.com product page shows no accuracy line)
- `lib-iris` `falseAlarmRatePerScan` 1 count, L2, INFERRED planning-factor; basis in the field note
- `lib-kumrfs-m` `rangeAccuracyM` 10 m, L2, INFERRED planning-factor; basis in the field note
- `lib-kumrfs-m` `azimuthAccuracyDeg` 0.2 deg, L2, INFERRED planning-factor; basis in the field note
- `lib-kumrfs-m` `elevationAccuracyDeg` 0.2 deg, L2, INFERRED planning-factor; basis in the field note
- `lib-kumrfs-m` `falseAlarmRatePerScan` 1 count, L2, INFERRED planning-factor; basis in the field note
- `lib-kurfs` `rangeAccuracyM` 10 m, L2, INFERRED planning-factor; basis in the field note
- `lib-kurfs` `azimuthAccuracyDeg` 0.2 deg, L2, INFERRED planning-factor; basis in the field note
- `lib-kurfs` `elevationAccuracyDeg` 0.2 deg, L2, INFERRED planning-factor; basis in the field note
- `lib-kurfs` `falseAlarmRatePerScan` 1 count, L2, INFERRED planning-factor; basis in the field note
- `lib-lstar` `rangeAccuracyM` 30 m, L2, INFERRED planning-factor; basis in the field note
- `lib-lstar` `azimuthAccuracyDeg` 0.3 deg, L2, INFERRED planning-factor; basis in the field note
- `lib-lstar` `elevationAccuracyDeg` 0.5 deg, L2, INFERRED planning-factor; basis in the field note
- `lib-lstar` `falseAlarmRatePerScan` 1 count, L2, INFERRED planning-factor; basis in the field note
- `lib-mxgcs` `rangeAccuracyM` 5 m, L2, INFERRED planning-factor; basis in the field note
- `lib-mxgcs` `azimuthAccuracyDeg` 0.03 deg, L2, INFERRED planning-factor; basis in the field note
- `lib-mxgcs` `elevationAccuracyDeg` 0.03 deg, L2, INFERRED planning-factor; basis in the field note
- `lib-r8ss` `rangeAccuracyM` 3 m, L1, MANUFACTURER_CLAIM, Teledyne FLIR Ranger R8SS-3D datasheet (mirror at cctv-systems.se; the flir.com URL returned 404 on 2026-09-10)
- `lib-r8ss` `azimuthAccuracyDeg` 0.8 deg, L1, MANUFACTURER_CLAIM, Teledyne FLIR Ranger R8SS-3D datasheet (mirror at cctv-systems.se; the flir.com URL returned 404 on 2026-09-10)
- `lib-r8ss` `elevationAccuracyDeg` 3 deg, L1, MANUFACTURER_CLAIM, Teledyne FLIR Ranger R8SS-3D datasheet (mirror at cctv-systems.se; the flir.com URL returned 404 on 2026-09-10)
- `lib-r8ss` `falseAlarmRatePerScan` 0.5 count, L2, INFERRED planning-factor; basis in the field note
- `lib-rf360` `rangeAccuracyM` null, L3, UNKNOWN; A single-site RF direction finder measures bearing, not range; not established by the public record.
- `lib-rf360` `azimuthAccuracyDeg` 5 deg, L1, REPORTED, Dedrone RF-360 installation manual (IM-Inst-RF360en, FCC filing 2AO3N-TH87P6EROZ): '±5° (mean error)', quoted from the search index; the v2.0 datasheet carries no accuracy line
- `lib-rf360` `elevationAccuracyDeg` null, L3, UNKNOWN; Two-dimensional RF direction finding gives no elevation; not established by the public record.
- `lib-rfone` `rangeAccuracyM` null, L3, UNKNOWN; A single-site RF direction finder measures bearing, not range; not established by the public record.
- `lib-rfone` `azimuthAccuracyDeg` 5 deg, L2, INFERRED class-median of lib-titan, lib-rf360, lib-wingman
- `lib-rfone` `elevationAccuracyDeg` null, L3, UNKNOWN; Two-dimensional RF direction finding gives no elevation; not established by the public record.
- `lib-rfpatrol` `rangeAccuracyM` null, L3, UNKNOWN; A single-site RF direction finder measures bearing, not range; not established by the public record.
- `lib-rfpatrol` `azimuthAccuracyDeg` 30 deg, L2, INFERRED class-median of lib-wingman
- `lib-rfpatrol` `elevationAccuracyDeg` null, L3, UNKNOWN; Two-dimensional RF direction finding gives no elevation; not established by the public record.
- `lib-rps42` `rangeAccuracyM` 50 m, L1, REPORTED, RADA RPS-42 brochure as quoted by the radartutorial.eu card and document mirrors; the brochure itself was not opened
- `lib-rps42` `azimuthAccuracyDeg` 0.5 deg, L1, REPORTED, RADA RPS-42 brochure as quoted by the radartutorial.eu card and document mirrors; the brochure itself was not opened
- `lib-rps42` `elevationAccuracyDeg` 0.5 deg, L1, REPORTED, RADA RPS-42 brochure as quoted by the radartutorial.eu card and document mirrors; the brochure itself was not opened
- `lib-rps42` `falseAlarmRatePerScan` 0.5 count, L2, INFERRED planning-factor; basis in the field note
- `lib-rps62` `rangeAccuracyM` 3 m, L2, INFERRED class-median of lib-r8ss
- `lib-rps62` `azimuthAccuracyDeg` 0.8 deg, L2, INFERRED class-median of lib-r8ss
- `lib-rps62` `elevationAccuracyDeg` 3 deg, L2, INFERRED class-median of lib-r8ss
- `lib-rps62` `falseAlarmRatePerScan` 0.5 count, L2, INFERRED planning-factor; basis in the field note
- `lib-sentinela4` `rangeAccuracyM` 50 m, L2, INFERRED class-median of lib-rps42
- `lib-sentinela4` `azimuthAccuracyDeg` 0.5 deg, L2, INFERRED class-median of lib-rps42
- `lib-sentinela4` `elevationAccuracyDeg` 0.5 deg, L2, INFERRED class-median of lib-rps42
- `lib-sentinela4` `falseAlarmRatePerScan` 1 count, L2, INFERRED planning-factor; basis in the field note
- `lib-sentry-lr-fc` `rangeAccuracyM` 10 m, L2, INFERRED planning-factor; basis in the field note
- `lib-sentry-lr-fc` `azimuthAccuracyDeg` 0.2 deg, L2, INFERRED planning-factor; basis in the field note
- `lib-sentry-lr-fc` `elevationAccuracyDeg` 0.2 deg, L2, INFERRED planning-factor; basis in the field note
- `lib-sentry-lr-fc` `falseAlarmRatePerScan` 1 count, L2, INFERRED planning-factor; basis in the field note
- `lib-spexer2000` `rangeAccuracyM` 50 m, L2, INFERRED class-median of lib-rps42
- `lib-spexer2000` `azimuthAccuracyDeg` 0.5 deg, L2, INFERRED class-median of lib-rps42
- `lib-spexer2000` `elevationAccuracyDeg` 0.5 deg, L2, INFERRED class-median of lib-rps42
- `lib-spexer2000` `falseAlarmRatePerScan` 0.5 count, L2, INFERRED planning-factor; basis in the field note
- `lib-spyglass` `rangeAccuracyM` 3 m, L2, INFERRED class-median of lib-r8ss
- `lib-spyglass` `azimuthAccuracyDeg` 0.8 deg, L2, INFERRED class-median of lib-r8ss
- `lib-spyglass` `elevationAccuracyDeg` 3 deg, L2, INFERRED class-median of lib-r8ss
- `lib-spyglass` `falseAlarmRatePerScan` 0.5 count, L2, INFERRED planning-factor; basis in the field note
- `lib-spynel` `rangeAccuracyM` null, L3, UNKNOWN; Passive imager with no rangefinder documented: bearing only; not established by the public record.
- `lib-spynel` `azimuthAccuracyDeg` 0.02 deg, L2, INFERRED planning-factor; basis in the field note
- `lib-spynel` `elevationAccuracyDeg` 0.02 deg, L2, INFERRED planning-factor; basis in the field note
- `lib-teleidoscope` `rangeAccuracyM` null, L3, UNKNOWN; Passive imager with no rangefinder documented: bearing only; not established by the public record.
- `lib-teleidoscope` `azimuthAccuracyDeg` 0.017 deg, L2, INFERRED class-median of lib-hdcmr, lib-cm262
- `lib-teleidoscope` `elevationAccuracyDeg` 0.017 deg, L2, INFERRED class-median of lib-hdcmr, lib-cm262
- `lib-titan` `rangeAccuracyM` null, L3, UNKNOWN; A single-site RF direction finder measures bearing, not range; not established by the public record.
- `lib-titan` `azimuthAccuracyDeg` 1 deg, L1, REPORTED, BlueHalo C-UAS RF product page (Titan SV LOB): '1° Azimuth and Elevation tracking of non-precision sUAS platforms', quoted from the search index; the page now redirects to avinc.com
- `lib-titan` `elevationAccuracyDeg` 1 deg, L1, REPORTED, BlueHalo C-UAS RF product page (Titan SV LOB): '1° Azimuth and Elevation tracking of non-precision sUAS platforms', quoted from the search index; the page now redirects to avinc.com
- `lib-tpq53` `rangeAccuracyM` 30 m, L2, INFERRED planning-factor; basis in the field note
- `lib-tpq53` `azimuthAccuracyDeg` 0.3 deg, L2, INFERRED planning-factor; basis in the field note
- `lib-tpq53` `elevationAccuracyDeg` 0.5 deg, L2, INFERRED planning-factor; basis in the field note
- `lib-tpq53` `falseAlarmRatePerScan` 1 count, L2, INFERRED planning-factor; basis in the field note
- `lib-wingman` `rangeAccuracyM` null, L3, UNKNOWN; A single-site RF direction finder measures bearing, not range; not established by the public record.
- `lib-wingman` `azimuthAccuracyDeg` 30 deg, L1, MANUFACTURER_CLAIM, MyDefence Wingman product page and Wingman 103/105 datasheet: 'direction finding with ±30° accuracy'
- `lib-wingman` `elevationAccuracyDeg` null, L3, UNKNOWN; Two-dimensional RF direction finding gives no elevation; not established by the public record.
- `lib-wisp` `rangeAccuracyM` null, L3, UNKNOWN; Passive imager with no rangefinder documented: bearing only; not established by the public record.
- `lib-wisp` `azimuthAccuracyDeg` 0.1 deg, L2, INFERRED planning-factor; basis in the field note
- `lib-wisp` `elevationAccuracyDeg` 0.1 deg, L2, INFERRED planning-factor; basis in the field note
- `lib-xbaeu` `rangeAccuracyM` 10 m, L2, INFERRED planning-factor; basis in the field note
- `lib-xbaeu` `azimuthAccuracyDeg` 0.2 deg, L2, INFERRED planning-factor; basis in the field note
- `lib-xbaeu` `elevationAccuracyDeg` 0.2 deg, L2, INFERRED planning-factor; basis in the field note
- `lib-xbaeu` `falseAlarmRatePerScan` 1 count, L2, INFERRED planning-factor; basis in the field note
- `lib-zvook` `rangeAccuracyM` null, L3, UNKNOWN; A single acoustic node measures bearing at best, not range; not established by the public record.
- `lib-zvook` `azimuthAccuracyDeg` 15 deg, L2, INFERRED planning-factor; basis in the field note
- `lib-zvook` `elevationAccuracyDeg` null, L3, UNKNOWN; No elevation measurement is published for this acoustic node; not established by the public record.
- `lib-zvooknw0` `rangeAccuracyM` null, L3, UNKNOWN; A single acoustic node measures bearing at best, not range; not established by the public record.
- `lib-zvooknw0` `azimuthAccuracyDeg` null, L3, UNKNOWN; Omnidirectional single-node sensor best read as presence-and-alarm; no bearing is published and none can be estimated for a single microphone.
- `lib-zvooknw0` `elevationAccuracyDeg` null, L3, UNKNOWN; No elevation measurement is published for this acoustic node; not established by the public record.

C2 files:

- `lib-cac2s` `spec: 'c2'`; `decisionLatencyS` 10 s, `decisionLatencySigmaDb` 3 dB, `operatorTrackCapacity` 6 count, all L2 INFERRED planning-factor (basis in the field notes)
- `lib-dedronetracker` `spec: 'c2'`; `decisionLatencyS` 10 s, `decisionLatencySigmaDb` 3 dB, `operatorTrackCapacity` 6 count, all L2 INFERRED planning-factor (basis in the field notes)
- `lib-dronesentryc2` `spec: 'c2'`; `decisionLatencyS` 10 s, `decisionLatencySigmaDb` 3 dB, `operatorTrackCapacity` 6 count, all L2 INFERRED planning-factor (basis in the field notes)
- `lib-faadc2` `spec: 'c2'`; `decisionLatencyS` 10 s, `decisionLatencySigmaDb` 3 dB, `operatorTrackCapacity` 6 count, all L2 INFERRED planning-factor (basis in the field notes)
- `lib-ibcs` `spec: 'c2'`; `decisionLatencyS` 10 s, `decisionLatencySigmaDb` 3 dB, `operatorTrackCapacity` 6 count, all L2 INFERRED planning-factor (basis in the field notes)
- `lib-lattice` `spec: 'c2'`; `decisionLatencyS` 10 s, `decisionLatencySigmaDb` 3 dB, `operatorTrackCapacity` 6 count, all L2 INFERRED planning-factor (basis in the field notes)
- `lib-medusa` `spec: 'c2'`; `decisionLatencyS` 10 s, `decisionLatencySigmaDb` 3 dB, `operatorTrackCapacity` 6 count, all L2 INFERRED planning-factor (basis in the field notes)
- `lib-picogrid` `spec: 'c2'`; `decisionLatencyS` 10 s, `decisionLatencySigmaDb` 3 dB, `operatorTrackCapacity` 6 count, all L2 INFERRED planning-factor (basis in the field notes)
- `lib-adsi` `spec: null` kept: data-link gateway, no engagement decision
- `lib-tak` `spec: null` kept: the record says it carries no engagement authority
