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

## 2026-09-10, Phase 3 sensor and threat fields

Every radar gains `pulsesPerDwell` and `dwellTimeS`; every EO/IR sensor gains
`pixelPitchUm`, `focalLengthMm`, `detectorPixelsH`, `fovDeg` and `mrtdMk` (the
thermal channel is the band of record on every dual-band gimbal); every RF
sensor gains `receiverSensitivityDbm` and `geolocationMinNodes`; every acoustic
sensor gains `noiseFloorDb`. Every threat gains `maxTurnRateDegS`,
`climbRateMps`, `maxAccelMps2`, `radiatedPowerW` and the `linkProtocol`
attribute with its lineage in `attributeProvenance`. 53 files, 168 entries:
42 L1, 117 L2, 9 L3. No existing value changed; every edited file has its
`version` bumped. Every L1 field carries a 2 dB lognormal spread and every L2
field a 4 dB one, except exact counts (`detectorPixelsH`,
`geolocationMinNodes`) and the 0 W radiated power of link-less airframes,
which carry none.

Priority of evidence as in Phase 2: (1) OEM sheet or page with its condition,
L1 MANUFACTURER_CLAIM, or REPORTED where the figure reached us through a
mirror, reseller copy or the search index; (2) independent open reference, L1
REPORTED, CORROBORATED with two; (3) class median of the sourced systems with
the same `sensorType` and `role`, L2 with a `comparisonSet`; (4) planning
factor with its derivation in the field note; (5) L3 `null` with the reason.
Where the OEM publishes the inputs but not the quantity (focal length from
pitch, pixel count and field of view; acceleration from tilt angle; beam time
on target from beamwidth and scan rate) the result is recorded as L2
planning-factor with the arithmetic in the note, not as L1.

Method notes:

- Radar dwell: no vendor publishes a dwell, CPI, PRF or pulse count, and zero
  explicit statements were found across 19 radars (9 OEM PDFs opened). The
  electronically scanned C-UAS panels and AESAs (13 radars plus Sentinel A4 with
  its electronic back-scan and the non-rotating TPQ-50) carry the open
  literature CPI for X/Ku-band drone-detection AESAs, 20 ms at 5 kHz PRF, 100
  pulses (arXiv 2307.10326; MDPI Drones 7(5):316 gives 30 ms and 180). The
  TPQ-50 carries 50 pulses at a 2.5 kHz PRF for its 35 km range. The mechanical
  rotators use beam time on target = beamwidth / scan rate and a PRF bounded by
  the unambiguous range: IRIS from its own 6° beam and 30 rpm (33 ms; FMCW
  chirp count L3), Giraffe 1X 60 rpm and an assumed 2° beam (6 ms, 10 pulses
  at 2 kHz), G/ATOR 30 rpm (11 ms, 10 pulses at 1 kHz), GM200 MM/C 40 rpm
  (8 ms, 8 pulses at 1 kHz), TPQ-53 an assumed 30 rpm and 5 kHz for the 20 km
  360° mode (11 ms, 50 pulses).
- EO/IR: CM262 (FS576a), DRS S3 and MX-GCS (2016 PDS) publish focal length or
  field of view and pixel count; only the S3 publishes a pitch (6 µm). Missing
  pitches are the HD MWIR class figure (10 or 12 µm) or the 640 x 512 class
  figure (15 µm). MRTD is published by no vendor; the HexaBlu 1280-MW core's
  <30 mK NETD is carried on the S3 (pitch and format match; REPORTED) and the
  25 mK median of three cooled MWIR core NETDs (Lynred Daphnis-HD 20, FLIR
  Neutrino SX12 <25, DRS HexaBlu <30) is the planning MRTD elsewhere. Spynel-S
  6000 is a rotating line scanner: `detectorPixelsH` 512 and `fovDeg` 4.4° are
  the instantaneous horizontal field of the 640 x 512 array mounted with 640 px
  vertical, from HGH's 0.15 mrad IFOV; the 360° panorama stays in `sectorDeg`.
  Wisp publishes nothing at sensor level, so all five are L3. Teleidoscope
  publishes no hardware; it carries the classification-role class medians.
- RF: no passive RF detector publishes a sensitivity in dBm. R&S publishes the
  ADD557SR DF sensitivity as a field strength (10 to 20 µV/m, 1 kHz, 1 s),
  which needs an antenna factor and bandwidth scaling to reach dBm, so it is a
  cross-check only. Every RF sensor carries the same planning factor, -90 dBm
  channel-integrated at 2.4 GHz: kTB for a 10 MHz OcuSync-class channel
  (-104 dBm) plus a 12 dB receiver noise figure (Narda SignalShark C-UAS
  application note). Against a 2 W DJI link this falls at about 6 km free
  space, consistent with the RF-360's 2 km normal / 5 km ideal. The node count
  follows the documented method: 2 for the AOA systems (ARDRONIS, Whisper
  Hunter, RF-360, RfOne), 3 for TDOA (CORIAN); L3 for the signal-strength or
  bearing-only units (RfPatrol, Wingman, Titan base unit).
- Acoustic: no vendor publishes a threshold. `noiseFloorDb` is the threshold
  implied by each record's own `refAcousticDb` and `detectRangeM` under
  spherical spreading (21 to 32 dB re 20 µPa), so the range already carried
  is reproduced; the notes explain why it sits below the 30 to 35 dBA rural
  ambient (array gain, tonal processing). This is a modelling decision to
  revisit if the acoustic lane adds an ambient term.
- Threats: DJI publishes ascent speed, pitch angle and per-band EIRP, so those
  are L1 and the acceleration (g tan tilt) and path turn rate (g tan tilt / V
  at the record's cruise speed) are L2 from DJI inputs. Body yaw-rate caps are
  not used as turn limits. Fixed-wing turn rates use g tan(bank) / V with the
  ArduPlane 45° roll limit (30° for the two MALE airframes); climb 5 m/s is
  the ArduPlane TECS_CLMB_MAX and PX4 FW_T_CLMB_MAX default; acceleration 2 m/s²
  for propeller airframes and 3 m/s² for the Geran-4 turbojet from its
  reported 160 kgf thrust. Multirotor class airframes use PX4 tilt defaults
  (45° FPV, 35° loaded heavy). Radiated power on proprietary links is the
  SprintLink class from Mugin's OEM page (2 W small UAS, 10 W MALE). Link-less
  airframes (fibre FPV, Shahed-136 baseline, Geran-4, RF-silent Mugin-5) carry
  0 W and `linkProtocol: 'none'` or `'fiber'`; the Shahed and Gerbera notes
  record the cellular and mesh modems seen on current Geran airframes.

Comparison sets: `lib-teleidoscope` `detectorPixelsH` and `fovDeg` take the
class median of the sourced classification-role EO/IR gimbals, `lib-cm262`
(1280 px, 2.4°) and `lib-hdcmr` (1280 px, 3.0°); its `focalLengthMm` takes the
one-member median of `lib-cm262` (300 mm), recorded as thin. No other role
class had two sourced members for a new field, so every other estimate is a
planning factor with its basis in the note. Open items: the R8SS-3D OEM sheet
states X-band where the record says Ku (band is not a field in this lane); the
Blighter A422 180° scan time is not published (only the 90° 1.0 s); the 3.a
contract adds the six new units (`deg/s`, `mps2`, `um`, `mm`, `mK`, `dBm`)
before the library builds.

Per-field record (value, layer, source or comparison set):

- `lib-a422` `dwellTimeS` 0.02 s, L2, INFERRED planning-factor; basis in the field note
- `lib-a422` `pulsesPerDwell` 100 count, L2, INFERRED planning-factor; basis in the field note
- `lib-acoustic-picket` `noiseFloorDb` 23 dB, L2, INFERRED planning-factor; basis in the field note
- `lib-ardronis` `receiverSensitivityDbm` -90 dBm, L2, INFERRED planning-factor; basis in the field note
- `lib-ardronis` `geolocationMinNodes` 2 count, L1, MANUFACTURER_CLAIM, Rohde & Schwarz ARDRONIS brochure and datasheet page; ADD557SR brochure 3608-8534-12
- `lib-babayaga` `maxTurnRateDegS` 33 deg/s, L2, INFERRED planning-factor; basis in the field note
- `lib-babayaga` `climbRateMps` 3 mps, L2, INFERRED planning-factor; basis in the field note
- `lib-babayaga` `maxAccelMps2` 6.9 mps2, L2, INFERRED planning-factor; basis in the field note
- `lib-babayaga` `radiatedPowerW` 2 W, L2, INFERRED planning-factor; basis in the field note
- `lib-babayaga` `linkProtocol` 'proprietary', L1, CORROBORATED, Defence Express (radio control in the 700 to 900 MHz band through a marine-drone repeater) and Kyiv Post (mothership signal repeater, Starlink control on some); Custom UHF control links, not a named COTS protocol.
- `lib-cm262` `pixelPitchUm` 10 um, L2, INFERRED planning-factor; basis in the field note
- `lib-cm262` `focalLengthMm` 300 mm, L1, MANUFACTURER_CLAIM, CACI CM262 ground system datasheet (FS576a, 2026), Widen DAM PDF
- `lib-cm262` `detectorPixelsH` 1280 count, L1, MANUFACTURER_CLAIM, CACI CM262 ground system datasheet (FS576a, 2026), Widen DAM PDF
- `lib-cm262` `fovDeg` 2.4 deg, L1, MANUFACTURER_CLAIM, CACI CM262 ground system datasheet (FS576a, 2026), Widen DAM PDF
- `lib-cm262` `mrtdMk` 25 mK, L2, INFERRED planning-factor; basis in the field note
- `lib-corian` `receiverSensitivityDbm` -90 dBm, L2, INFERRED planning-factor; basis in the field note
- `lib-corian` `geolocationMinNodes` 3 count, L1, REPORTED, CACI CORIAN flyer (F424, 2023-03), 'signal time difference of arrival (TDOA) at multiple sensors', quoted from the search index; the PDF returned 404 on read
- `lib-cuaews-df` `receiverSensitivityDbm` -90 dBm, L2, INFERRED planning-factor; basis in the field note
- `lib-cuaews-df` `geolocationMinNodes` 2 count, L1, MANUFACTURER_CLAIM, SRC Whisper Hunter direction finder product sheet (PDF)
- `lib-cw15` `maxTurnRateDegS` 33 deg/s, L2, INFERRED planning-factor; basis in the field note
- `lib-cw15` `climbRateMps` 5 mps, L2, INFERRED planning-factor; basis in the field note
- `lib-cw15` `maxAccelMps2` 2 mps2, L2, INFERRED planning-factor; basis in the field note
- `lib-cw15` `radiatedPowerW` 2 W, L2, INFERRED planning-factor; basis in the field note
- `lib-cw15` `linkProtocol` 'proprietary', L1, MANUFACTURER_CLAIM, JOUAV long-range drone article: CW-15 1.4 GHz data link held at over 47 km
- `lib-discovair` `noiseFloorDb` 21 dB, L2, INFERRED planning-factor; basis in the field note
- `lib-drs-s3` `pixelPitchUm` 6 um, L1, MANUFACTURER_CLAIM, Leonardo DRS S3 datasheet (2022 PDF)
- `lib-drs-s3` `focalLengthMm` 275 mm, L2, INFERRED planning-factor; basis in the field note
- `lib-drs-s3` `detectorPixelsH` 1280 count, L1, MANUFACTURER_CLAIM, Leonardo DRS S3 datasheet (2022 PDF)
- `lib-drs-s3` `fovDeg` 1.6 deg, L1, MANUFACTURER_CLAIM, Leonardo DRS S3 datasheet (2022 PDF)
- `lib-drs-s3` `mrtdMk` 30 mK, L1, REPORTED, Leonardo DRS HexaBlu 1280-MW datasheet (PDF)
- `lib-echoguard` `dwellTimeS` 0.02 s, L2, INFERRED planning-factor; basis in the field note
- `lib-echoguard` `pulsesPerDwell` 100 count, L2, INFERRED planning-factor; basis in the field note
- `lib-echoshield` `dwellTimeS` 0.02 s, L2, INFERRED planning-factor; basis in the field note
- `lib-echoshield` `pulsesPerDwell` 100 count, L2, INFERRED planning-factor; basis in the field note
- `lib-fpv-fiber` `maxTurnRateDegS` 37 deg/s, L2, INFERRED planning-factor; basis in the field note
- `lib-fpv-fiber` `climbRateMps` 10 mps, L2, INFERRED planning-factor; basis in the field note
- `lib-fpv-fiber` `maxAccelMps2` 9.8 mps2, L2, INFERRED planning-factor; basis in the field note
- `lib-fpv-fiber` `radiatedPowerW` 0 W, L1, REPORTED, Militarnyi, Chinese drone maker introduces UAV controlled by fiber optics
- `lib-fpv-fiber` `linkProtocol` 'fiber', L1, CORROBORATED, Militarnyi (Skywalker fibre-optic FPV) and Wikipedia, Fiber optic drone
- `lib-fpv7` `maxTurnRateDegS` 22 deg/s, L2, INFERRED planning-factor; basis in the field note
- `lib-fpv7` `climbRateMps` 10 mps, L2, INFERRED planning-factor; basis in the field note
- `lib-fpv7` `maxAccelMps2` 9.8 mps2, L2, INFERRED planning-factor; basis in the field note
- `lib-fpv7` `radiatedPowerW` 1.6 W, L2, INFERRED planning-factor; basis in the field note
- `lib-fpv7` `linkProtocol` 'elrs', L1, CORROBORATED, Documented combat build (ELRS 915 MHz Nano receiver, RadioMaster Bandit ELRS 915 MHz, analog 5.8 GHz video; github.com/wvrld/fpv-combat-drone) and Blue Bird Zhakh 7 product page (ELRS 400 to 960 MHz control, analog 4.9 to 6.1 GHz video); Control link ELRS at 900 MHz; the video link is analog 5.8 GHz FPV.
- `lib-gator` `dwellTimeS` 0.011 s, L2, INFERRED planning-factor; basis in the field note
- `lib-gator` `pulsesPerDwell` 11 count, L2, INFERRED planning-factor; basis in the field note
- `lib-geran4` `maxTurnRateDegS` 6 deg/s, L2, INFERRED planning-factor; basis in the field note
- `lib-geran4` `climbRateMps` 20 mps, L2, INFERRED planning-factor; basis in the field note
- `lib-geran4` `maxAccelMps2` 3 mps2, L2, INFERRED planning-factor; basis in the field note
- `lib-geran4` `radiatedPowerW` 0 W, L1, REPORTED, CSIS Missile Threat, Shahed-238
- `lib-geran4` `linkProtocol` 'none', L1, REPORTED, CSIS Missile Threat, Shahed-238: autonomous INS/GPS guidance
- `lib-gerbera` `maxTurnRateDegS` 17 deg/s, L2, INFERRED planning-factor; basis in the field note
- `lib-gerbera` `climbRateMps` 5 mps, L2, INFERRED planning-factor; basis in the field note
- `lib-gerbera` `maxAccelMps2` 2 mps2, L2, INFERRED planning-factor; basis in the field note
- `lib-gerbera` `radiatedPowerW` 2 W, L2, INFERRED planning-factor; basis in the field note
- `lib-gerbera` `linkProtocol` 'proprietary', L1, CORROBORATED, Wikipedia, Gerbera (drone): XK-F358 mesh modem relays operator signals; CSIS, Shahed/Geran: mesh radio XK-F358 and ZTE 3G/LTE modems; Mesh radio relay; cellular modems on some airframes.
- `lib-giraffe1x` `dwellTimeS` 0.0056 s, L2, INFERRED planning-factor; basis in the field note
- `lib-giraffe1x` `pulsesPerDwell` 11 count, L2, INFERRED planning-factor; basis in the field note
- `lib-gm200mmc` `dwellTimeS` 0.0083 s, L2, INFERRED planning-factor; basis in the field note
- `lib-gm200mmc` `pulsesPerDwell` 8 count, L2, INFERRED planning-factor; basis in the field note
- `lib-hdcmr` `pixelPitchUm` 12 um, L2, INFERRED planning-factor; basis in the field note
- `lib-hdcmr` `focalLengthMm` 290 mm, L2, INFERRED planning-factor; basis in the field note
- `lib-hdcmr` `detectorPixelsH` 1280 count, L1, REPORTED, Teledyne FLIR Ranger HDC MR datasheet 21-0714 (mirror at atline.pl; defense.flir.com returned 403)
- `lib-hdcmr` `fovDeg` 3 deg, L1, REPORTED, Teledyne FLIR Ranger HDC MR datasheet 21-0714 (mirror at atline.pl; defense.flir.com returned 403)
- `lib-hdcmr` `mrtdMk` 25 mK, L2, INFERRED planning-factor; basis in the field note
- `lib-iris` `dwellTimeS` 0.033 s, L2, INFERRED planning-factor; basis in the field note
- `lib-iris` `pulsesPerDwell` null, L3, UNKNOWN; FMCW radar: the count is chirps per coherent processing interval, and Robin publishes no sweep repetition rate; not established by the public record. The dwell is given.
- `lib-kumrfs-m` `dwellTimeS` 0.02 s, L2, INFERRED planning-factor; basis in the field note
- `lib-kumrfs-m` `pulsesPerDwell` 100 count, L2, INFERRED planning-factor; basis in the field note
- `lib-kurfs` `dwellTimeS` 0.02 s, L2, INFERRED planning-factor; basis in the field note
- `lib-kurfs` `pulsesPerDwell` 100 count, L2, INFERRED planning-factor; basis in the field note
- `lib-lancet3` `maxTurnRateDegS` 26 deg/s, L2, INFERRED planning-factor; basis in the field note
- `lib-lancet3` `climbRateMps` 5 mps, L2, INFERRED planning-factor; basis in the field note
- `lib-lancet3` `maxAccelMps2` 2 mps2, L2, INFERRED planning-factor; basis in the field note
- `lib-lancet3` `radiatedPowerW` 2 W, L2, INFERRED planning-factor; basis in the field note
- `lib-lancet3` `linkProtocol` 'proprietary', L1, CORROBORATED, Wikipedia, ZALA Lancet (868 to 870 and 902 to 928 MHz, relay UAVs) and Armada International, Russian UAV operating frequencies
- `lib-lstar` `dwellTimeS` 0.02 s, L2, INFERRED planning-factor; basis in the field note
- `lib-lstar` `pulsesPerDwell` 50 count, L2, INFERRED planning-factor; basis in the field note
- `lib-m350` `maxTurnRateDegS` 22 deg/s, L2, INFERRED planning-factor; basis in the field note
- `lib-m350` `climbRateMps` 6 mps, L1, MANUFACTURER_CLAIM, DJI Matrice 350 RTK specs page
- `lib-m350` `maxAccelMps2` 5.7 mps2, L2, INFERRED planning-factor; basis in the field note
- `lib-m350` `radiatedPowerW` 2 W, L1, MANUFACTURER_CLAIM, DJI Matrice 350 RTK specs page, O3 Enterprise transmitter power
- `lib-m350` `linkProtocol` 'ocusync', L1, MANUFACTURER_CLAIM, DJI Matrice 350 RTK specs page, DJI O3 Enterprise Transmission
- `lib-mavic3` `maxTurnRateDegS` 33 deg/s, L2, INFERRED planning-factor; basis in the field note
- `lib-mavic3` `climbRateMps` 8 mps, L1, MANUFACTURER_CLAIM, DJI Mavic 3 Classic specs page (same airframe)
- `lib-mavic3` `maxAccelMps2` 6.9 mps2, L2, INFERRED planning-factor; basis in the field note
- `lib-mavic3` `radiatedPowerW` 0.4 W, L1, MANUFACTURER_CLAIM, DJI Mavic 3 Classic specs page (same airframe), O3+ transmitter power
- `lib-mavic3` `linkProtocol` 'ocusync', L1, MANUFACTURER_CLAIM, DJI Mavic 3 Classic specs page (same airframe), video transmission system O3+
- `lib-mini4` `maxTurnRateDegS` 39 deg/s, L2, INFERRED planning-factor; basis in the field note
- `lib-mini4` `climbRateMps` 5 mps, L1, MANUFACTURER_CLAIM, DJI Mini 4 Pro specs page
- `lib-mini4` `maxAccelMps2` 6.9 mps2, L2, INFERRED planning-factor; basis in the field note
- `lib-mini4` `radiatedPowerW` 2 W, L1, MANUFACTURER_CLAIM, DJI Mini 4 Pro specs page, O4 transmitter power
- `lib-mini4` `linkProtocol` 'ocusync', L1, MANUFACTURER_CLAIM, DJI Mini 4 Pro specs page, video transmission system O4
- `lib-mohajer6` `maxTurnRateDegS` 8 deg/s, L2, INFERRED planning-factor; basis in the field note
- `lib-mohajer6` `climbRateMps` 5 mps, L2, INFERRED planning-factor; basis in the field note
- `lib-mohajer6` `maxAccelMps2` 2 mps2, L2, INFERRED planning-factor; basis in the field note
- `lib-mohajer6` `radiatedPowerW` 10 W, L2, INFERRED planning-factor; basis in the field note
- `lib-mohajer6` `linkProtocol` 'proprietary', L1, REPORTED, Wikipedia, Qods Mohajer-6: direct line-of-sight data link 200 to 500 km
- `lib-mugin5` `maxTurnRateDegS` 19 deg/s, L2, INFERRED planning-factor; basis in the field note
- `lib-mugin5` `climbRateMps` 5 mps, L2, INFERRED planning-factor; basis in the field note
- `lib-mugin5` `maxAccelMps2` 2 mps2, L2, INFERRED planning-factor; basis in the field note
- `lib-mugin5` `radiatedPowerW` 0 W, L2, INFERRED planning-factor; basis in the field note
- `lib-mugin5` `linkProtocol` 'none', L2, INFERRED; Converted strike flies without a control link; the OEM platform offers proprietary 1.4 GHz links.
- `lib-mxgcs` `pixelPitchUm` 15 um, L2, INFERRED planning-factor; basis in the field note
- `lib-mxgcs` `focalLengthMm` 275 mm, L2, INFERRED planning-factor; basis in the field note
- `lib-mxgcs` `detectorPixelsH` 640 count, L1, REPORTED, L3 WESCAM MX-GCS product data sheet (November 2016, reseller-hosted PDF)
- `lib-mxgcs` `fovDeg` 2 deg, L1, REPORTED, L3 WESCAM MX-GCS product data sheet (November 2016, reseller-hosted PDF)
- `lib-mxgcs` `mrtdMk` 25 mK, L2, INFERRED planning-factor; basis in the field note
- `lib-orlan10` `maxTurnRateDegS` 19 deg/s, L2, INFERRED planning-factor; basis in the field note
- `lib-orlan10` `climbRateMps` 5 mps, L2, INFERRED planning-factor; basis in the field note
- `lib-orlan10` `maxAccelMps2` 2 mps2, L2, INFERRED planning-factor; basis in the field note
- `lib-orlan10` `radiatedPowerW` 2 W, L2, INFERRED planning-factor; basis in the field note
- `lib-orlan10` `linkProtocol` 'proprietary', L1, CORROBORATED, Wikipedia, Orlan-10 (850 to 930 MHz command, 3/4/8 GHz payload downlinks) and Armada International, Russian UAV operating frequencies; Cellular modems on some payload variants.
- `lib-r8ss` `dwellTimeS` 0.02 s, L2, INFERRED planning-factor; basis in the field note
- `lib-r8ss` `pulsesPerDwell` 100 count, L2, INFERRED planning-factor; basis in the field note
- `lib-rf360` `receiverSensitivityDbm` -90 dBm, L2, INFERRED planning-factor; basis in the field note
- `lib-rf360` `geolocationMinNodes` 2 count, L1, REPORTED, Dedrone RF-360 datasheet V2.0 (AoA) and RF-360 manual as quoted by the search index of manualslib (page returned 403)
- `lib-rfone` `receiverSensitivityDbm` -90 dBm, L2, INFERRED planning-factor; basis in the field note
- `lib-rfone` `geolocationMinNodes` 2 count, L1, REPORTED, Army Technology, DroneShield RfOne MkII long-range sensors for Australia
- `lib-rfpatrol` `receiverSensitivityDbm` -90 dBm, L2, INFERRED planning-factor; basis in the field note
- `lib-rfpatrol` `geolocationMinNodes` null, L3, UNKNOWN; Omnidirectional body-worn detector: alarm by signal strength, no bearing and no multi-node geolocation documented (DroneShield dismounted products page); bearing-only at best, so no node count applies.
- `lib-rps42` `dwellTimeS` 0.02 s, L2, INFERRED planning-factor; basis in the field note
- `lib-rps42` `pulsesPerDwell` 100 count, L2, INFERRED planning-factor; basis in the field note
- `lib-rps62` `dwellTimeS` 0.02 s, L2, INFERRED planning-factor; basis in the field note
- `lib-rps62` `pulsesPerDwell` 100 count, L2, INFERRED planning-factor; basis in the field note
- `lib-sentinela4` `dwellTimeS` 0.02 s, L2, INFERRED planning-factor; basis in the field note
- `lib-sentinela4` `pulsesPerDwell` 100 count, L2, INFERRED planning-factor; basis in the field note
- `lib-sentry-lr-fc` `dwellTimeS` 0.02 s, L2, INFERRED planning-factor; basis in the field note
- `lib-sentry-lr-fc` `pulsesPerDwell` 100 count, L2, INFERRED planning-factor; basis in the field note
- `lib-shahed136` `maxTurnRateDegS` 11 deg/s, L2, INFERRED planning-factor; basis in the field note
- `lib-shahed136` `climbRateMps` 5 mps, L2, INFERRED planning-factor; basis in the field note
- `lib-shahed136` `maxAccelMps2` 2 mps2, L2, INFERRED planning-factor; basis in the field note
- `lib-shahed136` `radiatedPowerW` 0 W, L1, CORROBORATED, The War Zone, Shahed-136 with cellular modem found in Ukraine; Luftlage, Networking the Shahed
- `lib-shahed136` `linkProtocol` 'none', L1, CORROBORATED, The War Zone (pre-programmed, little emission) and Luftlage (cellular antennas on nearly all observed Geran-2); Baseline has no control link; cellular telemetry on many current Geran-2.
- `lib-spexer2000` `dwellTimeS` 0.02 s, L2, INFERRED planning-factor; basis in the field note
- `lib-spexer2000` `pulsesPerDwell` 100 count, L2, INFERRED planning-factor; basis in the field note
- `lib-spyglass` `dwellTimeS` 0.02 s, L2, INFERRED planning-factor; basis in the field note
- `lib-spyglass` `pulsesPerDwell` 100 count, L2, INFERRED planning-factor; basis in the field note
- `lib-spynel` `pixelPitchUm` 15 um, L2, INFERRED planning-factor; basis in the field note
- `lib-spynel` `focalLengthMm` 100 mm, L2, INFERRED planning-factor; basis in the field note
- `lib-spynel` `detectorPixelsH` 512 count, L1, MANUFACTURER_CLAIM, HGH Spynel-S leaflet (SPS-Len-al1, PDF), Spynel-S 6000 column
- `lib-spynel` `fovDeg` 4.4 deg, L1, MANUFACTURER_CLAIM, HGH Spynel-S leaflet (SPS-Len-al1, PDF), Spynel-S 6000 column
- `lib-spynel` `mrtdMk` 25 mK, L2, INFERRED planning-factor; basis in the field note
- `lib-tb2` `maxTurnRateDegS` 7 deg/s, L2, INFERRED planning-factor; basis in the field note
- `lib-tb2` `climbRateMps` 6.1 mps, L1, REPORTED, Wikipedia, Baykar Bayraktar TB2 (TB2T-AI climb)
- `lib-tb2` `maxAccelMps2` 2 mps2, L2, INFERRED planning-factor; basis in the field note
- `lib-tb2` `radiatedPowerW` 10 W, L2, INFERRED planning-factor; basis in the field note
- `lib-tb2` `linkProtocol` 'proprietary', L1, MANUFACTURER_CLAIM, Baykar Bayraktar TB2 page: LOS and BLOS communication, triple bands for LOS control and video
- `lib-teleidoscope` `pixelPitchUm` 10 um, L2, INFERRED planning-factor; basis in the field note
- `lib-teleidoscope` `focalLengthMm` 300 mm, L2, INFERRED class-median of lib-cm262
- `lib-teleidoscope` `detectorPixelsH` 1280 count, L2, INFERRED class-median of lib-cm262, lib-hdcmr
- `lib-teleidoscope` `fovDeg` 2.7 deg, L2, INFERRED class-median of lib-cm262, lib-hdcmr
- `lib-teleidoscope` `mrtdMk` 25 mK, L2, INFERRED planning-factor; basis in the field note
- `lib-titan` `receiverSensitivityDbm` -90 dBm, L2, INFERRED planning-factor; basis in the field note
- `lib-titan` `geolocationMinNodes` null, L3, UNKNOWN; The Titan datasheet (AV 250501) states no direction-finding method and no multi-node geolocation; the 1° azimuth and elevation tracking belongs to the Titan SV LOB variant, which is bearing only. Not established by the public record.
- `lib-tpq53` `dwellTimeS` 0.011 s, L2, INFERRED planning-factor; basis in the field note
- `lib-tpq53` `pulsesPerDwell` 56 count, L2, INFERRED planning-factor; basis in the field note
- `lib-wingman` `receiverSensitivityDbm` -90 dBm, L2, INFERRED planning-factor; basis in the field note
- `lib-wingman` `geolocationMinNodes` null, L3, UNKNOWN; Signal-strength direction finding to ±30° by sweeping the 90° internal antenna (MyDefence Wingman 103/105 sheet); bearing only, no multi-node geolocation documented, so no node count applies.
- `lib-wisp` `pixelPitchUm` null, L3, UNKNOWN; Anduril publishes no detector, band, pitch or head count for Wisp (product page is a script shell; trade press gives only 360° x 125° system coverage and DRI ranges); not established by the public record.
- `lib-wisp` `focalLengthMm` null, L3, UNKNOWN; Anduril publishes no optics figures for Wisp; not established by the public record.
- `lib-wisp` `detectorPixelsH` null, L3, UNKNOWN; Anduril publishes no detector format for Wisp's Computational Pixel Imager; not established by the public record.
- `lib-wisp` `fovDeg` null, L3, UNKNOWN; Only the whole-system coverage (360° horizontal, 125° vertical; Military Aerospace and the COBBS reseller page) is published; the per-head instantaneous field and the head count are not. The 360° coverage is already in sectorDeg.
- `lib-wisp` `mrtdMk` null, L3, UNKNOWN; Anduril publishes no MRTD or NETD and does not state the band; not established by the public record.
- `lib-xbaeu` `dwellTimeS` 0.02 s, L2, INFERRED planning-factor; basis in the field note
- `lib-xbaeu` `pulsesPerDwell` 100 count, L2, INFERRED planning-factor; basis in the field note
- `lib-zvook` `noiseFloorDb` 26 dB, L2, INFERRED planning-factor; basis in the field note
- `lib-zvooknw0` `noiseFloorDb` 32 dB, L2, INFERRED planning-factor; basis in the field note
