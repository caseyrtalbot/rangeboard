---
title: "Public-Source UAS / UCAS Threat Study for Counter-UAS Test and Evaluation"
subtitle: "Observed tactics, threat-system characteristics, raid geometry, guidance/control, autonomy, and defensive test-representation requirements"
version: "1.0"
date: "2026-08-22"
classification: "UNCLASSIFIED // PUBLIC-SOURCE RESEARCH"
scope: "Defensive counter-UAS threat representation and T&E"
---

# Public-Source UAS / UCAS Threat Study for Counter-UAS Test and Evaluation

> Dated source document, 2026-08-22. A public-source study that informed the threat seeds
> and tactics. Source and tests decide current behaviour. It is not edited.

**Version:** 1.0  
**Date:** 22 August 2026  
**Information basis:** Publicly available, unclassified sources available through 22 August 2026.  
**Purpose:** Build evidence-based threat representations for defensive Counter-Unmanned Aircraft System (C-UAS) test, evaluation, analysis, modeling, simulation, red-team activity, and operational assessment.

> **Use constraint.** This document describes publicly observed or officially assessed UAS employment to support defensive C-UAS test and evaluation. It is not an attack-planning guide. It intentionally does not provide target-specific attack recipes, vulnerable-point selection, lethal-radius calculations, instructions for evading a named defensive system, or procedures for weapon construction.

---

## Executive assessment

The public record no longer supports a single generic "drone threat" model. At minimum, a modern C-UAS test program must distinguish the following threat families because they create materially different detection, tracking, identification, command-and-control, and engagement problems:

1. **COTS and military multirotor ISR / munition-dropping UAS.** Very small, slow, highly maneuverable aircraft that can hover, use terrain and structures for masking, and operate at short range under direct radio control.
2. **RF-controlled FPV one-way attack UAS.** Small, fast, maneuverable aircraft with an operator in the loop and a live video link. Russia and Ukraine employ them at very high tactical density.
3. **Fiber-optic FPV UAS.** Operator-controlled aircraft whose command/video path is carried by a physical fiber rather than an RF control link; fielded by both Russia and Ukraine. These invalidate any defensive model that assumes every hostile small UAS must present a useful RF control/video signature.
4. **Heavy multirotor bomber UAS.** Larger, slower aircraft that can carry substantially more payload than an FPV, hover, re-attack, and are frequently used at night.
5. **Tactical fixed-wing ISR UAS.** Systems such as Orlan and ZALA families that provide persistent observation, targeting, communications support, and battle-damage assessment and often enable the strike UAS rather than conduct the strike themselves.
6. **Loitering munitions / operator-in-the-loop strike UAS.** Systems such as Lancet that combine endurance, electro-optical target acquisition, terminal maneuver, and increasingly automated terminal target acquisition.
7. **Propeller-driven long-range one-way attack (OWA) UAS.** Shahed-136/Geran-2-class threats that combine long reach, relatively low speed, small signatures compared with conventional aircraft, preprogrammed navigation, and mass employment.
8. **Connected long-range OWA UAS.** Evolving Geran variants incorporate cameras, cellular/mesh communications, anti-jam navigation, and other components that support telemetry, relay, route update, or operator interaction. These cannot be represented solely as fire-and-forget GNSS waypoint aircraft.
9. **Turbojet OWA / missile-drone systems.** Geran-3/4/5 and Ukrainian jet-powered missile-drone families increase speed and compress the C-UAS detect-to-engage timeline while retaining UAS-like cost, launch, and production characteristics.
10. **Emitter-seeking / anti-radar OWA UAS.** On 12 August 2026, Defence Intelligence of Ukraine (DIU) reported components of a passive radar seeker that Russia had begun installing on Geran-2 UAS to detect and engage surface-to-air missile systems and radar stations. This creates a defensive test case in which an emitting air-defense or C-UAS radar can itself be a threatened object. [R22]
11. **MALE UCAV / EW-integrated reconnaissance-strike systems.** Bayraktar TB2, ANKA-S, Wing Loong-family and comparable aircraft operate at materially higher altitudes, endurance, payload and sensor quality than small UAS. Türkiye's 2020 Syria and Libya campaigns provide a public precedent for integrating UCAVs with electronic warfare, ISR and conventional fires in operations against ground forces and air-defense systems. [TUR01][TUR03]
12. **Decoy / false-target UAS.** Gerbera and historical An-2 decoy employment demonstrate that an aircraft can be operationally valuable even when it is not carrying a major warhead. Its function can be to create tracks, stimulate emissions or interceptor expenditure, collect information, or complicate classification.
13. **Mixed UAS-missile salvos.** Iran, the Houthis, Russia, and other actors have combined UAS with cruise missiles, ballistic missiles, rockets, or anti-ship missiles. C-UAS performance cannot always be evaluated independently from the wider integrated air and missile defense problem.
14. **Close-in / internally launched UAS attacks.** Israel's June 2025 operations in Iran demonstrated the defensive relevance of UAS launched from inside or near the defended area. Perimeter range is not equivalent to warning time.
15. **Collaborative or swarm-capable UAS.** Public evidence supports direct-action "swarming" and massed multi-UAS attacks, but it does **not** justify labeling every mass raid an autonomous swarm. Current PRC public doctrine and development reporting also distinguishes present human-controlled/preprogrammed systems from more ambitious AI-enabled collaborative concepts.

### Core T&E conclusion

A defensible threat library should be **multidimensional**. Platform type alone is insufficient. Each threat presentation should preserve, where evidence exists:

- airframe and propulsion;
- NATO class and/or U.S. DoD group;
- mass and payload/warhead class;
- speed and acceleration regime;
- altitude regime with the correct datum (AGL, MSL, ASL, or unspecified);
- endurance and launch-to-target range;
- navigation architecture;
- command/control architecture;
- terminal guidance and autonomy;
- sensor payload;
- RF dependence or RF independence;
- maneuverability / hover / terminal dive behavior;
- raid size and temporal density;
- formation or track geometry;
- decoy-to-strike mixture when known;
- use with other weapon classes;
- ISR / relay / battle-damage-assessment support;
- confidence and provenance of every parameter.

A fixed "representative drone" with one speed, one altitude, one control link, and one inbound bearing is therefore not a representative contemporary threat model.

---

# 1. Methodology and evidence rules

## 1.1 Scope

This study covers UAS/UCAS tactics and counter-tactics that have direct relevance to C-UAS defensive testing. Priority is given to:

- Russia and Ukraine, because the war has generated the largest public body of evidence on high-density UAS warfare;
- Iran and Iranian-enabled Houthi forces, because of repeated long-range OWA and mixed-salvo employment;
- Hezbollah and Hamas/Palestinian Islamic Jihad (PIJ), because of observed low-altitude UAS penetration, infrastructure attack, and combined rocket/UAS tactics;
- Azerbaijan in the 2020 Second Nagorno-Karabakh War, because of documented decoy-to-sensor-to-shooter and air-defense suppression behavior;
- Israel in Operation Rising Lion in June 2025, because of documented close-in UAS employment against air-defense infrastructure;
- India and Pakistan in May 2025, because of large-scale UAS exchanges involving loitering munitions, ISR UAS, decoys, quadcopters, and air-defense interaction;
- the Islamic State in Mosul, because it remains an important documented benchmark for weaponized COTS multirotor mass employment;
- the People's Republic of China (PRC), where public U.S. government reporting provides a useful **doctrinal/developmental** threat baseline even without a comparable recent combat record.

## 1.2 Evidence labels

Every major claim should be read with one of these status labels:

| Label | Meaning |
|---|---|
| **OBSERVED** | Public evidence documents actual operational employment. |
| **TECH-EXPLOITED** | A government/intelligence organization or other credible technical exploitation source examined recovered hardware/components. |
| **DECLARED** | A government, military, or manufacturer publicly states the characteristic. This is not necessarily independently verified. |
| **OFFICIAL-ASSESSMENT** | An official military/intelligence publication assesses the behavior or capability. |
| **DOCTRINAL / DEVELOPMENTAL** | Published doctrine, training material, RFI, or capability-development reporting; not equivalent to combat observation. |
| **SECONDARY-CORROBORATED** | Multiple credible research or news sources agree, but primary technical or official confirmation is incomplete. |
| **LOW-CONFIDENCE / EXCLUDED** | Single-source, actor propaganda, or technically inconsistent data. Such data are not used as baseline parameters in this study. |

## 1.3 Source hierarchy

**Tier A — preferred baseline sources**

- NATO publications and NATO-hosted documents;
- U.S. Department of Defense / U.S. Army / Defense Intelligence Agency / U.S. Central Command publications;
- Ukrainian Ministry of Defence, Defence Intelligence of Ukraine (GUR/HUR), and official Presidential publications when reporting on Ukrainian or recovered Russian systems;
- United Nations Panel/Secretariat documents containing technical inspection findings;
- other government technical exploitation or official operational reporting.

**Tier B — corroborating sources**

- RUSI, CSIS, IISS, U.S. Army University Press, T2COM/TRADOC Operational Environment products, and comparable defense research organizations;
- peer-reviewed or professional military literature using attributable evidence.

**Tier C — contextual sources**

- Reuters and other major news organizations when they provide event chronology, scale, or attributed statements unavailable in Tier A/B sources.

Where sources conflict, this study either gives a range, identifies the conflict, or leaves the parameter **unknown** rather than averaging incompatible figures.

## 1.4 Unit conventions

Preferred units in this study are:

- **speed:** knots (kt), with km/h retained when it is the source unit;
- **distance/range:** nautical miles (NM), with km retained;
- **altitude:** feet, explicitly marked **AGL**, **MSL**, **ASL**, or **datum not stated**;
- **mass:** pounds (lb), with kg retained;
- **endurance:** minutes or hours.

Conversions are rounded for threat-model use:

- 1 km = 0.540 NM
- 1 km/h = 0.540 kt
- 1 m = 3.281 ft
- 1 kg = 2.205 lb

**Important:** A source-reported "maximum altitude," "flight altitude," "useful altitude," or "ceiling" is not automatically MSL or AGL. This report does not change the altitude datum unless the source identifies it.

---

# 2. Official UAS nomenclature and classification

## 2.1 NATO UAS classification

NATO materials adapted from STANAG 4670 / ATP-3.3.8.1 divide UAS broadly into three classes by maximum takeoff mass and operational characteristics. Public NATO tables use the following structure. [N01]

| NATO class | Category | Normal mass | Normal altitude / reach in public NATO table | Representative operational level |
|---|---:|---:|---|---|
| **Class I** | Micro | <2 kg and low-energy criterion | up to ~200 ft AGL; ~2.7 NM LOS | tactical unit / individual |
| **Class I** | Mini | <15 kg | up to ~3,000 ft AGL; ~13.5 NM LOS | tactical unit |
| **Class I** | Small | >15 kg and <150 kg | up to ~5,000 ft AGL; ~27 NM LOS | tactical formation |
| **Class II** | Tactical | 150–600 kg | up to ~18,000 ft AGL; ~108 NM LOS | tactical / operational |
| **Class III** | MALE | >600 kg | up to ~45,000 ft MSL; BLOS | operational / theater |
| **Class III** | HALE / Strike-Combat | >600 kg | up to ~65,000 ft MSL; BLOS | strategic / national |

**Caution:** NATO class is a broad UAS classification, not a direct measure of detectability, lethality, or C-UAS difficulty. Where this study maps a named foreign system into a NATO class or U.S. DoD group, the mapping is an **analytic application of the published mass/altitude/speed thresholds**, not a claim that NATO or DoD has formally assigned that foreign system to the class/group. If public data are insufficient, the study leaves the classification unassigned.

## 2.2 U.S. Department of Defense UAS Groups

The DoD Counter-Small UAS Strategy public annex provides the standard Group 1–5 framework. [N02]

| DoD Group | Maximum gross takeoff weight | Normal operating altitude | Airspeed |
|---|---:|---:|---:|
| **Group 1** | 0–20 lb | <1,200 ft AGL | <100 kt |
| **Group 2** | 21–55 lb | <3,500 ft AGL | <250 kt |
| **Group 3** | <1,320 lb | <18,000 ft MSL | <250 kt |
| **Group 4** | >1,320 lb | <18,000 ft MSL | any airspeed |
| **Group 5** | >1,320 lb | >18,000 ft MSL | any airspeed |

U.S. Army ATP 3-01.81, *Counter-Unmanned Aircraft System Techniques*, is the current public Army C-UAS techniques publication used in this study. It treats Group 1–3 UAS as a major tactical C-UAS problem and includes a "swarm attack" threat construct. [N03]

## 2.3 Terms used in this study

| Term | Working definition for this study |
|---|---|
| **UAS** | The aircraft plus control, communications, launch/recovery, payload, and support elements required for operation. |
| **UA / UAV** | The unmanned aircraft itself. "UAV" remains common in source material. |
| **UCAS / UCAV** | Unmanned combat aircraft system / unmanned combat aerial vehicle capable of strike or other combat functions. |
| **sUAS** | Small UAS. Exact mass boundary depends on source; DoD Group 1–3 is often the practical C-UAS focus. |
| **OWA UAS** | One-way attack UAS intended to terminate at the target. This is broader than "loitering munition." |
| **Loitering munition (LM)** | Weapon that can remain airborne in an area while searching, waiting for, or receiving designation of a target before terminal attack. |
| **FPV** | "First-person-view" UAS whose operator uses live onboard video for flight/terminal control. |
| **COTS UAS** | Commercial off-the-shelf UAS used with little or substantial military modification. |
| **Decoy / false target** | UAS whose principal mission is to create a track, signature, stimulus, or deception effect rather than deliver a major kinetic payload. |
| **Raid** | One or more hostile aerial vehicles presented against a defended area during a coherent attack period. It does not imply autonomous cooperation. |
| **Wave** | A temporally grouped portion of a raid. Multiple waves can be separated by minutes or longer. |
| **Salvo** | A concentration of weapons launched/fired to arrive in a compressed interval; may contain multiple weapon classes. |
| **Swarm** | Multiple UAS operating in coordinated fashion. This report does not use "swarm" merely as a synonym for "many drones." |
| **Mixed salvo / complex attack** | UAS employed with missiles, rockets, or other aerial threats so that the defender must classify and engage multiple kinematic/signature classes. |
| **Non-cooperative behavior** | Threat behavior that complicates detection, track continuity, identification, engagement, or defeat—e.g., low/high altitude changes, terrain masking, abrupt maneuver, hover, terminal dive, RF independence, decoys, or path diversity. |

---

# 3. Threat-description dimensions for C-UAS T&E

A test threat card should contain the following dimensions. If evidence does not exist, mark the field **UNKNOWN / NOT PUBLICLY VERIFIED**.

## 3.1 Physical and signature dimensions

- NATO class and DoD Group;
- maximum takeoff mass;
- wingspan / rotor span where useful;
- fixed-wing, delta-wing, multirotor, hybrid VTOL, helicopter, or other configuration;
- electric, piston, rotary, turbojet, or hybrid propulsion;
- optical/IR/acoustic/radar-signature descriptors only when measured or credibly documented;
- payload/warhead mass and broad type.

## 3.2 Kinematic dimensions

- cruise and maximum speed;
- climb/descent regime where documented;
- useful operating altitude / ceiling and datum;
- hover capability;
- endurance;
- launch-to-target range;
- communications/control radius if different from airframe range;
- terminal acceleration, dive, or maneuver where documented.

## 3.3 Guidance and control dimensions

1. **Direct RF teleoperation** — operator controls aircraft via RF command and live video.
2. **RF relay / repeater** — control/video extended through airborne or terrestrial relay.
3. **Cellular / IP network** — 3G/4G/LTE or other network component present and used for telemetry/control where confirmed.
4. **SATCOM / satellite-enabled BLOS** — satellite communications or commercial satellite service used or technically evidenced.
5. **Fiber-optic control** — command/video transmitted through physical fiber; RF-link defeat is not the primary control-path countermeasure.
6. **Preprogrammed autonomous navigation** — aircraft follows a route or target coordinate without continuous operator control.
7. **INS + GNSS** — combined inertial/satellite navigation.
8. **Anti-jam GNSS** — CRPA or other interference-resistant satellite navigation.
9. **Terrain / visual navigation** — onboard visual/terrain data used to navigate in degraded or denied GNSS.
10. **Terminal operator-in-the-loop** — onboard video/sensor feed supports manual terminal correction.
11. **Terminal automatic guidance / ATR** — onboard target tracking/recognition provides terminal guidance with reduced operator input.
12. **Collaborative autonomy** — multiple aircraft coordinate behavior with one another; public combat evidence remains more limited than mass-raid reporting.

## 3.4 Raid and formation geometry taxonomy

Public reporting often uses "formation" loosely. For C-UAS T&E, the following geometry terms are more precise than forcing drone raids into manned-aircraft formations such as wedge or fingertip when evidence does not support that description.

| Geometry / temporal pattern | Description | Public examples |
|---|---|---|
| **Singleton** | One UAS, independent attack or reconnaissance mission. | Tactical FPV; Hezbollah penetrations; ISR UAS. |
| **Pair / hunter-killer team** | One UAS locates/maintains observation while another performs the strike. | Ukrainian ISR-to-strike employment; Russian ZALA/Orlan-to-Lancet/FPV ecosystem. |
| **Small serial group** | Two or more UAS attack the same defended area/target set sequentially. | FPV direct-action swarming; repeated reattack. |
| **Single wave** | Multiple UAS arrive within one bounded attack interval. | Shahed/Geran raids; Iranian/Houthi OWA attacks. |
| **Multi-wave raid** | Several groups separated in time, potentially changing route/altitude/axis. | Russian long-range strike campaigns; Iranian retaliation waves. |
| **Multi-azimuth / converging raid** | Tracks approach the defended area from different directions rather than one common axis. | Russian long-range strike reporting; mixed regional attacks. |
| **Overlapping-track / staggered raid** | Tracks overlap spatially but are intentionally distributed in time. | CSIS description of later Russian Shahed tactics. |
| **Mixed decoy/strike raid** | False targets and weapon-carrying aircraft are intermixed. | Russian Gerbera + Geran; decoy precedents in Nagorno-Karabakh. |
| **Mixed-weapon salvo** | UAS combined with cruise/ballistic/anti-ship missiles or rockets. | Iran April 2024; Houthis January 2024; Russia Ukraine; Hezbollah rocket/UAS combinations. |
| **Close-in / internal launch** | Threat begins within or near the nominal defended perimeter. | Israel against Iranian air defenses, June 2025. |
| **Collaborative swarm** | UAS cooperate through shared autonomy/networked behavior. | Developmental/doctrinal PRC reporting; limited public evidence compared with mass raids. |

**Finding:** For long-range OWA raids, public evidence generally supports **track diversity, multiple axes, waves, decoy mixing, overlapping paths, and staggered timing**. It does **not** establish a standard tactical shape such as line-abreast, echelon, or wedge. A test plan should therefore use evidence-based track geometry rather than impose an aviation formation that has not been observed.

---

# 4. Master C-UAS threat-archetype matrix

| Threat archetype | Typical class/group | Kinematic / flight character | Guidance / control | Observed employment | Primary C-UAS test stressor |
|---|---|---|---|---|---|
| COTS quadcopter ISR/dropper | NATO I; DoD G1 | Very low altitude, slow, hover, abrupt lateral/vertical maneuver | RF teleoperation; GNSS-assisted autopilot common | ISR, targeting, munition drop, local infrastructure attack | clutter, hover/slow Doppler, short warning, dense urban/terrain masking |
| RF FPV OWA | NATO I; DoD G1 | ~tens of kt to >60 kt; high maneuverability; terminal dive/turns | live video + RF command | direct attack, reattack, anti-logistics, anti-UAS | short reaction time, low RCS, maneuver, RF environment |
| Fiber FPV | NATO I; DoD G1 | similar airframe kinematics to RF FPV | operator-in-loop via fiber | direct attack in heavy EW environments | no useful RF command/video dependency; small optical/kinematic signature |
| Heavy multirotor bomber | NATO I small / DoD G2–G3 depending model | slow, hover, larger payload, frequently night | RF; assisted nav | repeated munition delivery, logistics/frontline attack | night EO/IR, low speed, hover, payload/endurance trade |
| Tactical fixed-wing ISR | NATO I–II; DoD G1–G3 | tens of kt; multi-hour endurance; orbiting | RF LOS/relay; autopilot; GNSS/INS | persistent reconnaissance, target handoff, BDA, relay | persistent track, altitude variation, sensor-to-shooter latency |
| Loitering munition | NATO I–II; DoD G1–G3 | endurance + terminal dive/acceleration | EO terminal guidance; operator or automatic target tracking | precision attack after search/target handoff | late terminal maneuver, sensor lock, link-loss behavior |
| Long-range prop OWA | NATO II / DoD G3 for Shahed-136 class | ~80–100 kt typical cruise; low-to-high altitude profiles | preprogrammed GNSS/INS; anti-jam variants | waves, mass raids, fixed infrastructure attack | long-duration raid, small signature, altitude diversity, magazine depth |
| Connected long-range OWA | NATO II–III / DoD G3–G4 by variant | as platform; may maneuver after route update | mesh/cellular/SATCOM + INS/GNSS + camera depending series | evolving Russian Geran variants | defender cannot assume linkless fire-and-forget behavior |
| Emitter-seeking / anti-radar OWA | host-airframe class; confirmed on Geran-2 variant | host-airframe kinematics | passive radar homing seeker on documented Geran-2 variant | detection/engagement of SAM systems and radar stations | defensive emitter may itself be threatened; test sensor/track continuity and defensive resilience without assuming a conventional waypoint-only terminal phase |
| Turbojet OWA / missile-drone | NATO II–III / DoD G3–G5 by MTOW and normal operating altitude | ~170–320+ kt public Russian/Ukrainian examples | INS/GNSS; anti-jam; network features on some | deep strike, higher-speed penetration | compressed detection/engagement timeline, high closure, mixed speed classes |
| False target / decoy | NATO I–II / DoD G2–G3 | platform dependent | preprogrammed or controlled | generate tracks, confuse classification, stimulate response | discrimination, weapons allocation, track management |
| Medium/large UCAV | NATO II–III / DoD G3–G5 | medium altitude, long endurance | LOS/BLOS datalink, EO/IR/SAR, operator | ISR + precision strike | higher-altitude persistent threat, sensor/weapon integration |
| Mixed UAS-missile salvo | multi-class | simultaneous slow and high-speed threats | mixed | Russia, Iran, Houthis, Hezbollah | sensor/track saturation, prioritization, engagement sequencing |
| Close-in/internal launch | often NATO I / DoD G1 | very short transit; terrain/structure constrained | remote/preprogrammed | Israel-Iran 2025; sabotage/irregular precedent | near-zero strategic warning, perimeter bypass |
| Collaborative/swarm UAS | varies | coordinated route/spacing/role | networked autonomy / supervisory control | limited combat verification; active development | many-to-many track correlation, distributed intent, dynamic replanning |

---

# 5. Russia — observed and exploited UAS threat system

## 5.1 Operational pattern

Russia operates a layered UAS ecosystem rather than a collection of independent aircraft. Public RUSI and U.S. Army reporting describes:

- persistent tactical/operational ISR using **Orlan** and **ZALA** families;
- target handoff from reconnaissance UAS to **FPV**, **Lancet**, artillery, and other fires;
- long-range strike campaigns using **Geran/Shahed** OWA aircraft and **Gerbera** false targets;
- growing use of **fiber-optic FPV** to maintain operator control in heavy EW;
- terminal automation and image-processing in Lancet and other systems;
- development of connected long-range Geran variants using cameras, mesh modems, cellular components, anti-jam GNSS, and inertial navigation;
- introduction of faster turbojet Geran-3, Geran-4, and Geran-5 families; and
- an August 2026 technically exploited Geran-2 passive-radar-homing variant intended to detect and engage surface-to-air missile systems and radar stations. [R01][R03][R04][R05][R08][R17][R22]

RUSI's February 2025 study described Russian long-range Geran/Gerbera employment as a two-track pattern: continual harassment by strike/false-target UAS, with some aircraft low but many flying higher to make interception more costly; raids normally occurred in waves, and RUSI reported that information from early UAS could inform routes used by later UAS. [R01]

CSIS later described Russian salvo evolution toward larger raid sizes, **overlapping flight paths**, **staggered timing**, and shorter intervals between large attacks. [R20][R21]

## 5.2 Russian platform benchmark table

### 5.2.1 Long-range strike, decoy, and jet UAS

| System | Role / status | NATO / DoD class | Public physical data | Speed | Range / endurance | Altitude | Payload / warhead | Guidance / C2 evidence | Evidence |
|---|---|---|---|---:|---:|---:|---:|---|---|
| **Shahed-136 / Geran-2** | OWA strike; combat observed at scale | NATO II; DoD G3 (approx. 200 kg / 441 lb airframe) | ~200 kg commonly reported | ~150–185 km/h = **81–100 kt** | ~1,000–2,500 km = **540–1,350 NM** depending configuration/source | Public technical sources vary; observed profiles include low flight and >2,000 m (~6,560 ft) in later campaigns; datum usually not stated | ~40 kg in UN technical report; other Russian configurations vary | hardened GNSS-INS; anti-jam GNSS variants; preprogrammed fixed-target attack documented; later Russian series add connected components | TECH-EXPLOITED / OBSERVED [R15][R16][R01] |
| **Gerbera** | false target / barrage / reconnaissance | NATO I Small; DoD G2 | 18 kg / 39.7 lb MTOW; 2.5 m span | max 160 km/h = **86 kt** | 600 km = **324 NM** | useful altitude up to 3,000 m = **9,843 ft**, datum not stated | variants include unarmed/limited payload; role officially listed as false target/barrage/recon | catapult launch; recovered systems include GNSS/IMU and communications components | TECH-EXPLOITED [R02] |
| **Geran-3** | turbojet OWA; combat use documented by Ukraine | Exact public MTOW not consistently released in current GUR page | airframe/component exploitation public | high-speed relative to Geran-2; public secondary estimates vary and are not used as a fixed baseline here | public range figures vary | public figures vary | variant-dependent | Telefly JT80 turbojet; Kometa interference-resistant satellite nav; inertial navigation and flight-control components documented | TECH-EXPLOITED [R05] |
| **Geran-4** | turbojet strike UAS, introduced 2026 | NATO II; DoD G3 | up to 450 kg / **992 lb** MTOW; 3.6 m long; 3.05 m span | cruise 320 km/h = **173 kt**; max 350 km/h = **189 kt** | 770 km = **416 NM**; 2.2 h | max 4,000 m = **13,123 ft**, datum not stated | 50 kg / **110 lb**; thermobaric and incendiary/HE-frag types identified | SADRA INS; 16-element CRPA-based NASIR anti-jam nav; Honpho camera; mesh modem and network switch recovered | TECH-EXPLOITED [R03] |
| **Geran-5** | larger turbojet strike UAS; public Ukrainian exploitation 2026 | NATO III; DoD G4/G5 depends normal operating altitude (GUR max 19,685 ft; observed employment 656–9,843 ft) | 850 kg / **1,874 lb** MTOW; 6.5 m long; 3.2 m span | cruise 450–600 km/h = **243–324 kt** | ~950 km = **513 NM**; up to 2 h | max 6,000 m = **19,685 ft**; GUR reported actual observed use ~200 m–3 km (**656–9,843 ft**), datum not stated | 90 kg / **198 lb** | Kometa-M12 anti-jam satellite nav; SADRA/MINSOO-type INS; 3G/LTE tracker; mesh modem; turbojet | TECH-EXPLOITED + OBSERVED-ALTITUDE REPORT [R04] |
| **Harpiya-A1** | long-range OWA | NATO II; DoD G3 | 300 kg / **661 lb** MTOW | max 185 km/h = **100 kt** | 1,500 km = **810 NM** | not consistently public in high-confidence source | target load listed up to 150 kg on GUR page; actual warhead configurations vary | satellite/inertial navigation components documented in exploitation reporting | TECH-EXPLOITED [R14] |
| **Izdeliye-54 / Italmas** | barrage / strike UAS | not assigned; public MTOW/normal operating-altitude data insufficient in cited source | public GUR data incomplete | not fixed here | 200 km = **108 NM** public declared range | not fixed | not fixed | piston engine; catapult | DECLARED / TECH-EXPLOITED [R23] |

### 5.2.2 Tactical ISR, loitering munition, FPV, and strike UAS

| System | Role | NATO / DoD class | Speed | Endurance / range | Altitude | Payload / warhead | Guidance / control | Defensive relevance | Evidence |
|---|---|---|---:|---:|---:|---:|---|---|---|
| **Orlan-10** | ISR / targeting / relay family | NATO I Small; DoD G2 (18 kg / 39.7 lb) | 90–150 km/h = **49–81 kt** | up to 16 h; 600 km airframe range; 120 km = **64.8 NM** comm distance | max 5,000 m = **16,404 ft**, datum not stated | up to 5.5 kg target load | GNSS/autopilot; RF comm; multiple payload configurations | persistent orbit, target handoff, BDA, communications support | TECH-EXPLOITED [R11] |
| **Orlan-30** | ISR / targeting | NATO I Small or II depending actual MTOW; public GUR page does not state MTOW | max 170 km/h = **92 kt** | 8 h; 600 km airframe; 120 km comm | max 6,000 m = **19,685 ft** | up to 12 kg target load | RF/autopilot family | operational-depth observation and fires support | TECH-EXPLOITED [R12] |
| **ZALA Z-16 (421-16E)** | ISR | NATO I Mini; DoD G1 | 65–110 km/h = **35–59 kt** | >4 h; >75 km = **>40.5 NM** comm | useful 200–5,000 m = **656–16,404 ft** | >1.8 kg | RF + autopilot | persistent ISR / Lancet ecosystem | TECH-EXPLOITED [R09] |
| **ZALA Z-16-5G** | long-endurance ISR | NATO I Small; DoD G3 by 49.5 kg / 109 lb mass | 80–125 km/h = **43–67 kt** | 12 h; 150 km = **81 NM** comm | useful 500–3,600 m = **1,640–11,811 ft** | 3.5 kg | hybrid propulsion; RF/autopilot | long dwell and wider sensor-to-shooter footprint | TECH-EXPLOITED [R10] |
| **Lancet / Izdeliye-51** | loitering munition | NATO I; DoD G1/2 family depending variant; exact current MTOW not provided on GUR page | 80 km/h = **43 kt** declared cruise value | 40 min; 50 km = **27 NM** comm | not fixed in GUR public spec | 5 kg / **11 lb** fragmentation/cumulative | EO/video; operator control; image-processing hardware; U.S. Army observed improved terminal target-acquisition behavior | persistent search + terminal attack; can continue terminal process after target acquisition with reduced dependence on last-second RF control | TECH-EXPLOITED / OFFICIAL-ASSESSMENT [R08][R17] |
| **Bumerang-E** | FPV kamikaze | NATO I Mini; DoD G1 | max 165 km/h = **89 kt** | 10 min; 10 km = **5.4 NM** | max 3,000 m = **9,843 ft** | up to 4 kg / 8.8 lb target load | RF control and video bands declared by GUR | high maneuverability, short reaction, operator-in-loop | TECH-EXPLOITED [R13] |
| **Fiber-optic FPV family** | FPV strike | NATO I; DoD G1 typical | platform dependent | public early-2025 RUSI baseline ~10 km / **5.4 NM**; later systems longer | tactical low-altitude | small anti-personnel/anti-materiel payloads; model dependent | **fiber-optic command/video** | RF-link jamming does not remove operator control; physical tether is part of aircraft system | OBSERVED [R01] |
| **Heavy multirotor bomber family** | reusable munition drop / strike | NATO I Small; DoD G2–G3 depending aircraft | slow; hover capable | model dependent | tactical low altitude | materially larger than FPV; Russian/Ukrainian models vary | RF command/video | RUSI reports slow/hovering behavior and strong nighttime employment | OBSERVED [R01] |

## 5.3 Russian long-range raid tactics relevant to C-UAS

### RUS-LR-01 — Multi-wave OWA attack

**Status:** OBSERVED.  
**Evidence:** RUSI, CSIS, Ukrainian reporting. [R01][R20][R21]

Characteristics:

- Geran-2 and Gerbera are routinely employed in **waves**, not only as isolated aircraft.
- Wave composition can include strike UAS and false targets.
- Later campaigns show higher monthly sortie volume and much larger individual raids than early-war baselines.
- Public analysis describes shorter intervals between raids, creating a sustained rather than episodic air-defense burden.

**T&E representation:** Evaluate sustained track generation and engagement over repeated waves, not only a single simultaneous group.

### RUS-LR-02 — Multi-azimuth / path-diverse ingress

**Status:** OBSERVED / SECONDARY-CORROBORATED. [R20][R21]

Characteristics:

- Later Russian raids have used multiple routes and approach directions.
- CSIS describes overlapping tracks and staggered timing.
- Public evidence does not establish a standard fixed formation shape.

**T&E representation:** Use path diversity and arrival-time diversity grounded in historical raid data rather than a single bearing or symmetric formation.

### RUS-LR-03 — Altitude adaptation

**Status:** OBSERVED. [R01]

Characteristics:

- Russian Geran employment includes both low-altitude and higher-altitude flight.
- RUSI reported by early 2025 that many aircraft were being flown high enough to increase the cost/difficulty of interception by short-range gun/mobile teams.
- Other public testimony has described profiles above roughly 2 km (~6,560 ft), but exact altitude distributions are not consistently public.

**T&E representation:** A Geran-class test model should not be restricted to nap-of-earth/very-low-altitude flight. It requires at least low- and higher-altitude profiles consistent with observed reporting.

### RUS-LR-04 — Decoy/false-target integration

**Status:** OBSERVED / TECH-EXPLOITED. [R02][R01]

Characteristics:

- Gerbera is officially cataloged by Ukrainian intelligence as **False target / Barrage / Reconnaissance**.
- It has sufficient range (~324 NM) to participate in deep raids.
- Some variants can carry communications or reconnaissance equipment; not all tracks represent the same payload or lethality.

**T&E representation:** Classification, identification, weapons allocation, and track-quality scoring should be tested with heterogeneous but visually/kinematically plausible raid members.

### RUS-LR-05 — Adaptive routing / information from early wave

**Status:** OBSERVED reporting by RUSI. [R01]

RUSI reported that early UAS in a wave could push information back to inform the path taken by later UAS. The public source does not provide a universal technical architecture for every sortie, and this study does not assume one. The defensive fact is that **later tracks in the same campaign may not be independent repetitions of the first route**.

**T&E representation:** Do not assume identical route replay across all waves when evaluating persistent defense.

### RUS-LR-06 — Mixed long-range strike package

**Status:** OBSERVED. [R20][R21]

Russia combines OWA UAS with cruise and ballistic missile attacks in major strikes. This creates simultaneous slow/small and fast/high-energy threat classes.

**T&E representation:** C-UAS sensors and command systems should be evaluated for track continuity, classification, and resource management when other aerial threat classes are present; C-UAS-only range events can miss this systems-level problem.

### RUS-LR-07 — Passive-radar-homing / anti-radar Geran-2 variant

**Status:** TECH-EXPLOITED / OFFICIAL, 12 August 2026. [R22]

DIU reported components of a **passive radar seeker** that Russia had begun installing on Geran-2 UAS **to detect and engage surface-to-air missile systems and radar stations** of Ukraine's Defence Forces. The War & Sanctions component database identifies the weapon subsystem as the **Passive radar homing head for the 'Geran-2' UAV (PRGS-UAV)**. [R22]

This is a materially different terminal threat function from the baseline preprogrammed fixed-coordinate Geran-2. The public evidence establishes the seeker purpose and installation activity; it does **not** establish a universal fit across all Geran-2 production series or sorties.

**T&E representation:** Include a configuration-controlled emitter-seeking OWA threat case when evaluating radar-dependent C-UAS/GBAD architectures. Score defensive sensor continuity, track continuity, alternate-sensor operation, and mission resilience under the condition that the emitting defensive radar may itself be a threatened object. Do not generalize this seeker to baseline Geran-2 variants without configuration evidence.

## 5.4 Russian tactical reconnaissance-strike and FPV tactics

### RUS-TAC-01 — Persistent ISR orbit + strike handoff

**Status:** OBSERVED. [R01][R17]

RUSI reports Orlan and ZALA aircraft maintaining operational observation orbits and supporting target acquisition. Tactical strike assets include FPVs and Lancet. The result is a **reconnaissance-strike complex** in which the aircraft a defender sees first may be the sensor rather than the weapon.

**T&E implication:** A C-UAS event should test whether the defensive system detects and classifies persistent ISR/relay aircraft separately from terminal strike UAS and whether its track/alert architecture can correlate the two.

### RUS-TAC-02 — FPV direct attack and serial reattack

**Status:** OBSERVED. [R19][R01]

U.S. Army professional reporting describes Russian FPV use in pairs/small numbers in some sectors and sustained attacks on vehicles, positions, and lines of communication. The core defensive characteristic is **short-range, operator-controlled, highly maneuverable serial attack**, not a fixed formation.

### RUS-TAC-03 — Fiber-optic FPV in contested EW

**Status:** OBSERVED. [R01]

Fiber-optic FPVs preserve an operator video/control path without relying on the conventional RF command/video link. Public reporting in early 2025 used approximately 10 km (~5.4 NM) as a common range; by 2026 both Russian and Ukrainian fiber systems had expanded beyond early baselines.

**T&E implication:** RF detection/jamming success must not be treated as equivalent to defeat of every FPV class.

### RUS-TAC-04 — Terminal automatic target acquisition

**Status:** OFFICIAL-ASSESSMENT / TECHNICAL EVIDENCE. [R17][R08]

The U.S. Army's 2025 *How Russia Fights* compendium reports observed Lancet improvements in terminal target acquisition and assesses visual/photo-recognition as intended to reduce last-second failures caused by EW or moving targets. GUR exploitation shows substantial onboard image-processing hardware in Lancet systems.

**T&E implication:** Include terminal segments in which loss/degradation of the command link does not automatically end the engagement after target acquisition.

## 5.5 Russian emerging anti-air / counter-UAS UAS

Ukraine's GUR has publicly documented Geran-2 experimental/modified series carrying **Verba MANPADS** and an **R-60 air-to-air missile**. GUR explicitly states or assesses manual real-time control for these variants. [R06][R07]

These should be represented as **emerging/limited special-purpose threats**, not as the standard Geran baseline. They matter because the UAS can become a threat to the interceptor aircraft or other airborne C-UAS layer, rather than only a ground-target OWA.

---

# 6. Ukraine — observed UAS employment and system characteristics

Ukraine's force has evolved from COTS reconnaissance and improvised munition-dropping UAS into a broad unmanned force containing FPV strike systems, heavy bombers, fiber-optic systems, long-range propeller OWA aircraft, jet-powered missile-drones, autonomous navigation, interceptor UAS, and carrier/relay concepts.

## 6.1 Observed tactical employment

U.S. Army T2COM's 2024 *Ukrainian Unmanned Aerial System Tactics* describes three core patterns relevant to C-UAS threat representation: [U06]

- reconnaissance to locate positions, routes, minefields, and lines of communication;
- direct-action UAS, including reusable munition-dropping aircraft and one-way systems;
- direct-action "swarming" in which multiple UAS are employed against the same target or group of targets to defeat C-UAS;
- sensor-shooter teaming in which one UAS locates/identifies a target and another attacks while ISR can remain on station.

RUSI reporting adds that tactical FPV and bomber operations are commonly cued by quadcopters or longer-range fixed-wing ISR. Heavy bomber UAS are slower and hover-capable and are often used at night. [R01]

## 6.2 Ukrainian long-range system benchmarks

In April 2026, the President of Ukraine publicly identified a number of fielded Ukrainian systems and performance figures. These are **official Ukrainian declarations**, useful for defensive threat modeling but not independent technical validation. [U01]

| System | Type / role | Declared range | Declared warhead/payload | Speed / altitude | Guidance/control public evidence | Classification note |
|---|---|---:|---:|---|---|---|
| **Liutyi** | long-range strike kamikaze UAS | up to 2,000 km = **1,080 NM** | 50–75 kg = **110–165 lb** | official 2026 source did not state speed/altitude | long-range autonomous route flight; public research reports evolving terminal/navigation options | not assigned; cited official source does not provide MTOW/normal operating altitude |
| **FP-1** | long-range strike kamikaze UAS | up to 1,600 km = **864 NM** | up to 120 kg = **265 lb** | not stated in cited official source | not fully disclosed | classification depends MTOW; not assigned here |
| **Sichen** | long-range strike kamikaze UAS | up to 1,400 km = **756 NM** | up to 40 kg = **88 lb** | not stated | not fully disclosed | not assigned |
| **Morok** | long-range UAS | up to 800 km = **432 NM** | 30 kg = **66 lb** | not stated | not fully disclosed | not assigned |
| **Bars** | turbojet cruise missile-drone | 700–800 km = **378–432 NM** | not stated in cited official source | compact turbojet; speed not stated | not fully disclosed | jet OWA / missile-drone threat family |
| **Obriy** | jet-powered kamikaze UAS | 800 km = **432 NM** | 10 kg = **22 lb** | jet powered; speed not stated | not fully disclosed | jet OWA / missile-drone |
| **Peklo** | missile-drone | up to 700 km = **378 NM** | ≥23 kg = **≥51 lb** | officially described as high-speed and maneuverable | not fully disclosed | high-speed OWA |
| **Palianytsia** | long-range turbojet missile-drone | range not disclosed in cited 2026 official description | not disclosed | turbojet | not fully disclosed | high-speed OWA |

### AQ-400 Scythe

Terminal Autonomy currently publishes the following figures for AQ-400: [U02]

- MTOW: 100 kg / **220 lb** → NATO Class I Small; DoD Group 3.
- Payload: 43 kg / **95 lb**.
- Cruise speed: 144 km/h = **78 kt**.
- Range: 750 km = **405 NM**.
- Ceiling: 4,000 m = **13,100 ft**, datum not stated.
- Endurance: ~7 h.
- Guidance: manufacturer states autonomous visual/terrain navigation with AI assistance and operation without GPS or communications; GNSS-denied terrain navigation is a principal design feature.

This is an important C-UAS benchmark because it combines **long-range OWA mass**, **relatively low cruise speed**, and **non-GNSS navigation**.

## 6.3 Ukrainian tactical systems and control-link evolution

### UKR-TAC-01 — RF FPV

**Status:** OBSERVED.

Public Army reporting characterizes typical Ukraine/Russia FPVs as low-cost quadcopters carrying small warheads, commonly operating within roughly 5–10 km in earlier-war RF configurations and capable of speeds around 120 km/h (~65 kt), though current systems vary substantially. [R19]

Threat characteristics for defense:

- operator-in-the-loop terminal control;
- high lateral/vertical maneuverability;
- small radar/EO cross section;
- direct attack or serial reattack;
- high local sortie density;
- strong dependence on local RF architecture **for RF variants only**.

### UKR-TAC-02 — Fiber-optic FPV

Ukraine's Ministry of Defence in February 2026 authorized the **Baton Optik** fiber-controlled strike UAS with a stated strike range **exceeding 30 km (16.2 NM)**. The Ministry states that command and video are carried by fiber and protected from enemy EW effects on conventional RF links. [U03]

This demonstrates that the early 2025 ~10 km fiber baseline is no longer adequate for a contemporary range model.

### UKR-TAC-03 — Heavy bomber UAS

In January 2025 the President of Ukraine publicly described domestically produced bomber UAS capable of carrying/dropping **up to 40 kg (88 lb)** of ammunition over **more than 15 km (8.1 NM)** and emphasized effectiveness at night. [U04]

Defensive threat characteristics:

- slower than FPV;
- hover/loiter capability;
- heavier payload;
- repeatable munition delivery rather than necessarily one-way attack;
- night operation.

### UKR-TAC-04 — ISR-to-strike teaming

**Status:** OBSERVED / U.S. Army OE reporting. [U06]

The defender may face:

1. a reconnaissance UAS that detects/identifies the target;
2. a separate strike UAS launched or redirected against it;
3. continued ISR/BDA after engagement.

This is a **functional formation**—sensor + shooter—rather than a geometric formation.

### UKR-TAC-05 — Direct-action multi-UAS attack

**Status:** OBSERVED / T2COM reporting. [U06]

T2COM states that direct-action swarming has been developed to defeat C-UAS by employing multiple UAS against the same target or group of targets.

The source does not establish one universal spacing, count, or geometric shape. The defensible T&E variable is therefore **multiple near-concurrent/serial strike UAS against one defended problem**, not an invented wedge/line formation.

## 6.4 Autonomy and GNSS-denied navigation

CSIS and Ukrainian manufacturer reporting document an increasing role for:

- onboard route autonomy;
- inertial navigation;
- visual/terrain navigation when GNSS is degraded;
- terminal machine vision/target recognition on some systems;
- automatic terminal guidance on interceptor and strike systems. [U02][U05]

**Important distinction:** preprogrammed waypoint flight is autonomy in navigation but is not evidence of collaborative swarm intelligence. Terminal target tracking is also not equivalent to autonomous mission planning.

---

# 7. Iran — OWA UAS and mixed-salvo employment

## 7.1 Shahed-136 technical baseline

The UN document S/2023/362 provides one of the strongest public technical baselines for Shahed-136: [I01]

- delta-wing OWA aircraft;
- MADO-550 four-cylinder piston engine;
- hardened **GNSS-INS** navigation;
- preprogrammable attack against stationary targets at known coordinates;
- navigation designed to resist jamming/spoofing;
- range up to **2,500 km / 1,350 NM**;
- warhead approximately **40 kg / 88 lb**.

The same UN report notes evidence from maritime attacks indicating a development toward **moving-target engagement**. It states that moving-target attack would require a seeker and/or operator-in-the-loop real-time feed and records recovery of an Iridium satellite phone SIM in debris from a February 2023 vessel attack, indicating potential BLOS control. [I01]

## 7.2 Iranian UAS families

DIA's *Iran Military Power* publicly identifies Iranian families including Ababil, Shahed, Mohajer, Toufan, Fotros, Karrar, Hemaseh, and IRN-170 variants with ISR, multirole, air-to-ground, and one-way attack roles. [I02]

For C-UAS threat representation, the most operationally evidenced current categories are:

- Shahed-131/136 long-range OWA;
- Mohajer-series ISR/strike UAS;
- Ababil/Qasef/Waid family derivatives proliferated to proxies;
- small COTS UAS within proxy forces.

## 7.3 Operation True Promise — 13–14 April 2024

**Status:** OBSERVED; U.S. DoD official counts. [I03]

The U.S. Department of Defense stated that Iran launched a mass attack including:

- **more than 150 UAVs**;
- **more than 30 land-attack cruise missiles**;
- **more than 110 medium-range ballistic missiles**.

This is a canonical **mixed-speed, mixed-signature, mixed-weapon salvo** for C-UAS/IAMD T&E. UAS were not an isolated attack system; they were one layer of a larger raid.

### Defensive representation principles from the observed event

- very slow OWA tracks can coexist with supersonic/hypersonic ballistic trajectories and cruise-missile tracks;
- track management and engagement prioritization become a system-of-systems problem;
- raid size and duration are as important as single-target intercept performance;
- C-UAS success should be measured without assuming the C-UAS element is the only defensive mission active.

---

# 8. Houthi forces — maritime and regional UAS attack pattern

DIA assessed in February 2024 that Houthi forces used Iranian-origin missiles and UAS against military and civilian targets and commercial shipping. [HOU01]

## 8.1 Houthi long-range UAS benchmark

DIA gives the **Waid 2 / Shahed-136** comparison: [HOU01]

- estimated range: **2,500 km / 1,350 NM**;
- estimated payload: **50 kg / 110 lb**;
- strong physical similarity to Iranian Shahed-136.

DIA range graphics also identify other Houthi/Iranian-derived UAS families with shorter regional reach, including Sammad and Waid/Qasef-type systems; exact performance varies by model.

## 8.2 Observed mixed maritime attacks

### HOU-TAC-01 — 9 January 2024 complex attack

**Status:** OBSERVED; U.S. CENTCOM. [HOU02]

CENTCOM reported a complex Houthi attack involving:

- **18 one-way attack UAVs**;
- **2 anti-ship cruise missiles**;
- **1 anti-ship ballistic missile**;

against the southern Red Sea shipping lanes. U.S. and UK forces defeated the attack.

### HOU-TAC-02 — 9 March 2024 large UAS raid

**Status:** OBSERVED; U.S. CENTCOM. [HOU03]

CENTCOM reported a large-scale attack involving **15 one-way attack UAVs** into the Red Sea/Gulf of Aden region over an approximately multi-hour period.

## 8.3 C-UAS-relevant characteristics

- maritime background and sea clutter;
- long-range one-way navigation;
- potential moving-vessel terminal targeting in the broader Shahed family;
- mixed UAS/ASCM/ASBM threat presentation;
- attacks against both military and commercial vessels;
- raids occurring over extended time windows rather than only one instantaneous salvo.

No fixed formation geometry is established in the cited official sources; represent the threat as a **distributed maritime raid / mixed salvo**, not a tactical aircraft formation.

---

# 9. Hezbollah — low-altitude UAS penetration and mixed fires

Hezbollah has used Iranian-supplied and locally adapted UAS for reconnaissance and strike. CSIS documented more than 40 UAS attacks against Israeli targets by March 2024 and an inventory spanning commercial quadcopters, one-way/suicide drones, loitering munitions, and larger ISR/strike aircraft. [HEZ01]

## 9.1 Observed threat behaviors

### HEZ-TAC-01 — low-altitude / terrain-masked penetration

**Status:** SECONDARY-CORROBORATED / observed-event analysis. [HEZ03]

Critical Threats/ISW assessed that Hezbollah had previously penetrated Israeli air defenses with single drones by flying at low altitude and through challenging terrain to reduce radar detection opportunities.

For T&E, this supports a **terrain-constrained low-altitude** threat profile, but the public evidence does not justify a single universal altitude or route.

### HEZ-TAC-02 — rockets + UAS / complex local attack

**Status:** OBSERVED. [HEZ02][HEZ03]

Hezbollah repeatedly combined rockets and UAS in attacks on northern Israel. The 13 October 2024 strike on the Golani Brigade training base occurred in a broader attack context involving multiple aerial threats; one UAS penetrated defenses and struck the base.

### HEZ-TAC-03 — ISR and precision attack

**Status:** OBSERVED.

Hezbollah uses UAS for surveillance and attack, including against military sites. This produces both:

- non-kinetic ISR tracks that can precede later fires;
- kinetic UAS that may use similar approach corridors or signatures.

## 9.2 C-UAS representation

A Hezbollah-derived defensive test threat should emphasize:

- small/medium Iranian-derived UAS;
- low-altitude terrain masking when terrain permits;
- singleton and small multi-threat attacks;
- combination with rockets/missiles;
- ISR-to-strike relationship;
- operator or preprogrammed guidance depending aircraft.

Do not assume autonomous swarming; CSIS discussed it as a possible future tactic in early 2024, not a confirmed standard employment method. [HEZ01]

---

# 10. Hamas / Palestinian Islamic Jihad — COTS UAS and defensive-system blinding

## 10.1 7 October 2023 border-system attacks

**Status:** OBSERVED; widely documented. [HAM01][HAM02][HAM03]

CSIS and IISS document Hamas use of commercial quadcopters and other UAS during the 7 October attack. Observed functions included:

- dropping explosive munitions on observation towers and surveillance/communications systems;
- disabling or degrading remotely controlled weapons/observation infrastructure;
- attacking vehicles and personnel;
- employing UAS under the cover of a much larger rocket attack.

The important C-UAS threat characteristic is **mission kill against sensing/C2 infrastructure**, not only direct destruction of the defended high-value asset.

## 10.2 Threat geometry

- short-range, very-low-altitude multirotors;
- distributed attacks against multiple border-system nodes;
- combined with heavy rocket fire and ground action;
- very short warning time because launch points were geographically close to targets.

This event demonstrates that a C-UAS test focused only on protecting the "primary asset" can miss the adversary's ability to attack **sensors, communications, remote weapon stations, and other enabling nodes**.

---

# 11. Azerbaijan — Second Nagorno-Karabakh War decoy / SEAD precedent

The 2020 war remains one of the clearest documented examples of UAS and decoys being used to interact deliberately with ground-based air defenses.

## 11.1 An-2 decoy employment

**Status:** OBSERVED / U.S. Army professional analysis. [AZ01][AZ02]

U.S. Army sources describe Azerbaijan using old An-2 aircraft as remotely piloted or unmanned decoys at medium altitude during the opening phase. Armenian air-defense systems engaged or emitted against the decoys, exposing positions that were subsequently attacked by loitering munitions and UCAVs.

### Defensive significance

- the decoy's mission was to **stimulate the defensive system**, not necessarily to survive;
- decoy fidelity only needed to be sufficient to create an actionable defensive response;
- sensor emission, engagement, and weapons expenditure became part of the attack chain;
- loitering munitions / UCAVs then exploited the resulting target information.

This is a high-value **counter-C-UAS / SEAD threat representation** for testing air-defense survivability and emission discipline, but it should be modeled at the functional level rather than turned into a target-specific attack recipe.

## 11.2 UCAV / ISR-strike integration

Azerbaijan combined Bayraktar TB2 and loitering munitions with ISR and precision fires. U.S. Army analysis highlights persistent surveillance, target acquisition, strike, and battle-damage imagery. [AZ02]

For C-UAS, this is the **medium-altitude UCAV / loitering-munition** end of the threat spectrum, distinct from Group-1 FPV attacks.

---

# 12. Israel — Operation Rising Lion, June 2025: close-in UAS against air defenses

## 12.1 Observed/credible public pattern

CSIS and RUSI analyses of the June 2025 Israel-Iran war describe Israeli use of small explosive UAS and other precision systems that had been positioned or launched from inside Iran to strike air-defense radars, missile systems, and command infrastructure immediately before or alongside large conventional air strikes. [ISR01][ISR02][ISR03]

## 12.2 Defensive threat characteristics

- **close-in or internal launch**: the threat can begin inside the normal long-range surveillance/perimeter problem;
- small precision-strike aircraft against air-defense elements;
- coordinated timing with conventional fighter/missile strike packages;
- short defender reaction time;
- attack on the defensive system itself, not only the defended asset.

## 12.3 C-UAS test implication

A complete critical-site defense test should include an **inside-perimeter / near-perimeter UAS security case** as a separate threat class from long-range inbound air defense. The evidence supports the existence of the threat class; exact clandestine emplacement procedures are outside the scope of this defensive study.

---

# 13. India–Pakistan, May 2025 — large-scale drone exchange

## 13.1 Evidence quality note

Public details remain contested by the parties. This study uses only high-level characteristics supported by Reuters, Indian government/DRDO-hosted material, and other attributable sources. Exact loss claims and claimed platform counts should not be treated as settled facts.

## 13.2 C-UAS-relevant observed characteristics

**Status:** OBSERVED at broad level; exact numbers/platform attribution medium confidence. [IP01][IP02]

The May 2025 conflict included:

- ISR UAVs;
- armed drones;
- loitering munitions;
- electronic decoys;
- quadcopters;
- air-defense and EW interaction;
- large numbers of UAS over multiple locations.

Indian DRDO-hosted press compilation described decoys used to spoof/bait air defenses and exhaust interceptors, and broad UAS use by both sides for surveillance and precision attack. Reuters described large-scale drone warfare by both India and Pakistan and Indian use of HAROP-class loitering munitions.

## 13.3 Defensive representation

The defensible test archetype is:

- **regional multi-location raid**;
- mixed ISR/strike/decoy UAS;
- a mixture of military and commercial-derived systems;
- interaction with EW and gun/missile air defense;
- possible SEAD/DEAD role for loitering munitions.

Do not use unverified claims of exact "swarm" size as a fixed baseline without event-specific corroboration.

---

# 14. Islamic State — Mosul 2016–2017 COTS weaponized-UAS benchmark

The Islamic State's Mosul campaign is an important lower-technology but operationally significant benchmark.

## 14.1 Observed tactics

**Status:** OBSERVED; Combating Terrorism Center / U.S. military reporting. [ISIS01][ISIS02]

- camera-equipped hobby quadcopters provided local real-time ISR;
- modified commercial multirotors dropped grenade-sized munitions;
- attacks occurred by day and night;
- by February 2017, Iraqi forces were reportedly experiencing up to **70 UAS attacks per day** at the peak of the campaign;
- effects included casualties, vehicle attacks, persistent harassment, and morale impact.

## 14.2 Defensive significance

- low unit sophistication does not imply low operational burden;
- high sortie frequency can create cumulative effects even when single-aircraft payload is small;
- urban vertical/horizontal clutter strongly affects detection and engagement;
- the same COTS platform can perform ISR on one sortie and kinetic attack on another.

This remains a valid C-UAS test case for **high-frequency Group-1 COTS threats in complex urban terrain**.

---

# 15. People's Republic of China — doctrinal and developmental threat baseline

## 15.1 Evidence status

**DOCTRINAL / DEVELOPMENTAL; not a direct recent combat-observed analogue to Ukraine.**

The 2025 U.S. Department of Defense report on military and security developments involving the PRC states that China has debuted numerous unmanned systems and advertises developmental AI-enabled capabilities for navigation and coordination. The report also cautions that many systems still rely on human operators, fixed-target preprogramming, remote piloting, or substantial human input; more ambitious swarming concepts are not equivalent to widespread fielded collaborative autonomy. [PRC01]

T2COM reporting describes PLA use and development of UAS for:

- ISR;
- communications relay;
- electronic/information functions;
- precision strike;
- logistics;
- tactical target acquisition;
- multi-UAS / swarm experimentation. [PRC02]

## 15.2 Tactical range layering in U.S. Army OE reporting

T2COM threat templates describe small UAS supporting different echelons over increasing distances, with representative local reconnaissance/targeting bands from a few kilometers at company level to deeper brigade support. [PRC02]

The important defensive point is **echeloned sensor coverage and fires integration**, not a single drone range.

## 15.3 Swarm terminology

For PRC threat modeling:

- treat current fielded systems as human-supervised/remote/preprogrammed unless a specific system demonstrates more autonomy;
- maintain a separate **developmental collaborative swarm** threat card for future-force testing;
- do not use advertising demonstrations as evidence of combat-proven autonomy.

---

# 15A. Syria — Hmeimim / Tartus improvised multi-UAS attack, January 2018

**Evidence status:** SECONDARY-CORROBORATED; Russian Ministry of Defence defensive-result claims reported by RAND; attacker attribution remains unresolved in the public record. [SYR01][SYR02]

RUSI described the January 2018 attack on Russian facilities in Syria as **13 rudimentary, GPS-guided/preprogrammed UAS**, divided into groups of approximately **10 and 3**, flying more than **50 km (~27 NM)** on programmed paths toward the defended bases. The aircraft carried improvised munitions. RUSI characterized the event as a self-guided swarm attack; for C-UAS modeling, the public evidence is sufficient to represent **coordinated or near-simultaneous preprogrammed multi-UAS attack**, but not peer-to-peer collaborative autonomy. [SYR01]

RAND, citing the Russian Ministry of Defence, reports that Russian forces claimed electronic-warfare troops took control of six aircraft and Pantsir-S1 systems destroyed the remaining seven. RAND also notes that Russian claims that the aircraft required sophisticated external-state support were not supported by public evidence. [SYR02]

**Threat geometry / T&E significance:** small improvised fixed-wing UAS; preprogrammed route; multiple simultaneous or closely timed tracks; attack against an installation protected by both EW and kinetic air defense. This case is a useful historical baseline for testing **mixed soft-kill/hard-kill allocation against a low-cost multi-UAS raid**.

---

# 15B. Türkiye — integrated UCAV, EW and fires against air defenses, Syria/Libya 2020

**Evidence status:** OBSERVED campaign pattern + SECONDARY-CORROBORATED operational analysis. Exact platform-to-target kill attribution in public reporting is incomplete and should not be inferred beyond the source. [TUR01][TUR03]

During **Operation Spring Shield** in Syria in 2020, Türkiye employed **Bayraktar TB2** and **ANKA-S** UCAVs at scale and integrated them with artillery/fires and electronic warfare. Türkiye's Ministry of National Defence states that 10 air-defense systems were neutralized during the operation; it does not publicly attribute every system loss to a specific UAS or EW effect. RUSI describes integration of KORAL electronic warfare, ANKA-S/TB2 UACVs and precision munitions as a SEAD-enabling operational construct and reports similar integration in Libya. [TUR01][TUR03]

### Bayraktar TB2 current manufacturer benchmark

> **Configuration note:** The following is Baykar's 2026 public specification and should not be assumed to match every 2020 combat configuration. [TUR02]

| Parameter | Public manufacturer value |
|---|---:|
| MTOW | **700 kg / 1,543 lb** |
| Payload capacity | **150 kg / 331 lb** |
| Cruise speed | **90 KTAS** |
| Maximum speed | **110 KTAS** |
| Operational altitude | **16,000 ft** |
| Service ceiling | **22,000 ft** in Feb 2026 technical sheet |
| Endurance | **20+ h** |
| Communications | **LOS and BLOS** |
| ISR payloads | EO/IR/laser designator or surveillance radar |
| Weapon integration | laser-guided, INS/GPS-guided, IR-guided munitions and mini cruise missiles |
| Flight-control mode | autonomous takeoff/landing/cruise/taxi with operator mission control |

**Threat geometry / T&E significance:** persistent medium-altitude ISR/strike aircraft operating as part of a **system-of-systems** with EW and surface fires. A C-UAS/GBAD evaluation that tests only the aircraft without degraded sensing, external ISR, or simultaneous fires will not reproduce this historical threat construct.

---

# 15C. Saudi Arabia — Abqaiq / Khurais mixed UAV–LACM attack, 14 September 2019

**Evidence status:** UN-DOCUMENTED weapon count; actor/launch-point attribution was disputed and is not treated as settled here. [SAU01]

The UN Panel of Experts on Yemen documented **at least 25 weapon systems** in the attack: **18 weaponized UAVs** used against Abqaiq and **seven land-attack cruise missiles (LACMs)** associated with the wider attack, including missiles that fell short. The Panel described the scale and complexity as unprecedented and indicative of a high degree of military capacity. [SAU01]

CSIS identified the event as a warning about **low-flying precision-guided weapons**, emphasizing radar-horizon, sensor-coverage and 360-degree surveillance limitations. [SAU02]

**Threat geometry / T&E significance:** coordinated mixed-weapon raid; at least 18 UAS plus LACMs; fixed critical-infrastructure defense; low-altitude detection/classification problem; heterogeneous track speeds and signatures. This is an important non-Russia precedent for **mixed slow-UAS / cruise-missile raid representation**.

---

# 15D. Democratic People's Republic of Korea — small-UAS national-airspace penetration, 26 December 2022

**Evidence status:** OBSERVED / SECONDARY-CORROBORATED. [DPRK01]

Five DPRK UAVs crossed into Republic of Korea airspace. 38 North reports that one entered the no-fly zone protecting the Yongsan presidential office area; the Republic of Korea Ministry of National Defense did not intercept any of the five. The aircraft were described as basic, unarmed ISR-type UAS broadly similar to systems recovered in earlier incursions; 38 North cites an approximate **500 km (~270 NM)** operational range for those comparable systems. [DPRK01]

38 North also identified a command-and-control problem: the ROK air-defense architecture was fragmented across services and one operational command failed to transmit UAS information to other commands during the incident. [DPRK01]

**Threat geometry / T&E significance:** multiple small ISR penetrators crossing national airspace; intermittent track continuity; difficult low-altitude identification; cross-service C2 and engagement-authority challenge. The case demonstrates that a successful C-UAS evaluation must include **track dissemination and command integration**, not just sensor detection probability.

---

# 15E. Iran-aligned militia UAS attacks on defended bases and leadership targets

## 15E.1 Tower 22, Jordan — 28 January 2024

**Evidence status:** OFFICIAL event confirmation + preliminary U.S.-official reporting on the defensive identification failure. [JORD01][JORD02]

The Operation Inherent Resolve Inspector General quarterly report confirms that a drone attack on the U.S.-manned installation known as **Tower 22** killed three U.S. service members. Associated Press reporting, citing two U.S. officials and a preliminary account, stated that the hostile UAS approached at low altitude while a U.S. UAS was returning to the installation and may have been mistaken for the friendly aircraft. [JORD01][JORD02]

There is **no public evidence establishing that the attacker intentionally synchronized with or followed the friendly UAS**. The defensible threat lesson is therefore not an adversary deception tactic; it is a **friend/foe identification, airspace deconfliction, and engagement-authority stress case** under coincident friendly and hostile UAS traffic.

## 15E.2 Leadership / point-target precedents

CSIS documents a broader small-UAS point-target pattern: a failed explosive-UAS assassination attempt against Venezuelan president Nicolás Maduro in August 2018; a Houthi Qasef-1 attack against senior Yemeni military officials in January 2019; and the November 2021 attempt against Iraqi prime minister Mustafa al-Kadhimi. Iraqi authorities reported **three UAS** in the al-Kadhimi attack, with two intercepted and one reaching the residence. [PT01]

A more recent example occurred on **17 August 2026**, when the Kurdistan Regional Government security agency said **two drones** targeted the KRG prime minister's office in Iraq; Reuters reported no casualties and reported the KRG's statement that the attack originated from Iranian territory. Public reporting available by 22 August did not establish a detailed platform, guidance or kinematic profile, so this incident is used only as a current point-target precedent and not as a source of threat-envelope values. [PT02]

**T&E significance:** protected compounds and leadership/security sites require threat presentations that include short-warning, low-altitude small UAS, multiple simultaneous tracks, and defended-airspace identification constraints. These incidents should not be generalized into a single platform envelope because the aircraft and control architectures differed.

---

# 16. Cross-conflict threat-tactic taxonomy

The following taxonomy consolidates the public evidence into C-UAS-relevant threat behaviors. Each behavior has at least one observed or officially assessed precedent.

## 16.1 Detection / track-denial behaviors

| Behavior | Evidence actors | Defensive effect |
|---|---|---|
| Very-low-altitude flight | Hezbollah; tactical FPV; some Geran profiles | terrain/structure masking, short radar horizon, clutter |
| Higher-altitude OWA transit | Russia Geran campaigns | moves threat outside some local gun/interceptor envelopes; changes sensor/engagement geometry |
| Hover / very-low radial velocity | multirotor ISR/bombers | can challenge filters optimized for conventional air targets |
| Small physical/RCS signature | COTS, FPV, Lancet-class | late/fragile detection and classification |
| Night operation | Russia/Ukraine heavy bombers, tactical UAS | shifts dependence toward radar/IR and low-light EO |
| Terrain-constrained routing | Hezbollah; tactical systems | intermittent LOS and track breaks |
| Close-in/internal launch | Israel 2025 | eliminates much of normal strategic/operational warning |
| Decoy / false-target generation | Gerbera; An-2 precedent | track ambiguity, weapons allocation burden, defensive emissions |
| Friendly/hostile UAS temporal overlap | Tower 22 preliminary U.S. reporting | identification/deconfliction uncertainty can delay engagement; public evidence does not show attacker intentionally created the overlap |
| Distributed national-airspace penetration | DPRK 2022 | cross-service track dissemination and engagement-authority stress |

## 16.2 C2 / guidance resilience behaviors

| Behavior | Evidence | C-UAS consequence |
|---|---|---|
| Preprogrammed GNSS/INS route | Shahed-136 | command-link jamming alone may not stop flight |
| Anti-jam GNSS / CRPA | Geran series | raises required EW sophistication; navigation may remain usable in interference |
| INS continuation | Russian/Ukrainian deep-strike systems | temporary GNSS denial may not immediately terminate mission |
| Visual/terrain-aided navigation | AQ-400 and other Ukrainian development | GNSS denial cannot be treated as a universal defeat condition |
| Fiber-optic command/video | Russia and Ukraine FPV | conventional RF command/video jamming does not sever operator link |
| Cellular/mesh communication | later Geran components | additional control/telemetry paths may exist beyond line-of-sight RF architecture |
| Satellite/BLOS evidence | Shahed maritime evidence; Russian use allegations/observations | route/terminal control may extend beyond terrestrial LOS |
| Automatic terminal guidance | Lancet assessment; Ukrainian interceptors and strike systems | last-mile engagement can continue after operator burden/link quality changes |
| External EW support to UCAV strike package | Türkiye 2020 public analysis | aircraft performance must be evaluated as part of a sensor/EW/fires system-of-systems, not as an isolated track |

## 16.3 Saturation / resource-exhaustion behaviors

| Behavior | Evidence | C-UAS consequence |
|---|---|---|
| High-count OWA raids | Russia; Iran | track/engagement capacity and magazine depth become limiting variables |
| Repeated waves | Russia; Iran | sustained crew/system performance and reload/rearm matter |
| Staggered timing | Russian campaign analysis | prevents simple simultaneous-salvo assumptions and extends alert period |
| Mixed decoy/strike aircraft | Russia | forces classification and weapons-allocation decisions |
| Mixed missile/UAS salvo | Iran, Houthis, Russia, Hezbollah | C-UAS competes with wider IAMD priorities |
| High daily tactical sortie count | Russia/Ukraine; ISIS historical | cumulative local load and operator fatigue |
| Improvised preprogrammed multi-UAS base attack | Hmeimim/Tartus 2018 | simultaneous soft-kill/hard-kill allocation and low-cost raid economics |
| Mixed weaponized-UAV/LACM infrastructure raid | Abqaiq/Khurais 2019 | heterogeneous speed/signature tracks and 360-degree low-altitude surveillance burden |

## 16.4 Sensor-to-shooter / kill-chain behaviors

| Behavior | Evidence actors | Function |
|---|---|---|
| ISR UAS + FPV shooter | Russia, Ukraine | target discovery and terminal attack separated between aircraft |
| ISR UAS + loitering munition | Russia ZALA/Lancet; Azerbaijan | persistent target acquisition plus precision strike |
| ISR + artillery/other fires | Russia, Ukraine, Azerbaijan | UAS enables non-UAS weapon effects |
| BDA persistence | Russia/Ukraine/Azerbaijan | post-strike observation supports reattack |
| Decoy + shooter | Azerbaijan; Russia false-target campaigns | defender response produces targeting or resource effects |

## 16.5 Terminal / maneuver behaviors

| Behavior | Evidence | C-UAS consequence |
|---|---|---|
| High-angle/terminal dive | loitering munitions / FPV families | rapid LOS/closure change late in engagement |
| Hover then attack/drop | multirotor bomber/dropper | non-ballistic path; can pause/reposition |
| High lateral maneuver | FPV | stresses track filters and pointing loops |
| Moving-target pursuit | FPV; maritime Shahed-family development evidence | target motion does not guarantee miss |
| Terminal target acquisition/lock | Lancet, other modern systems | command-link defeat late in terminal may be insufficient |
| High-speed jet terminal approach | Geran-4/5; Ukrainian jet missile-drones | compressed detection-to-effect timeline |

---

# 17. Raid-density and timing observations

## 17.1 Russia

CSIS documented major growth in Russian long-range drone raid size during 2025 and continuing high launch volumes into 2026. Later salvos included hundreds of OWA/decoy aircraft, and public analysis described overlapping paths and staggered timing. [R20][R21]

**Do not derive one permanent "Russian raid size" from the maximum observed event.** A credible test library should contain distributions or scenario bins such as:

- singleton/small raid;
- medium wave;
- large wave;
- multi-wave mass raid;
- mixed decoy/strike mass raid;
- mixed UAS/missile strike.

The bins should be populated from the specific period/campaign being represented.

## 17.2 Iran

The April 2024 strike demonstrates a **national-scale mixed salvo** with >150 UAVs plus cruise and ballistic missiles. [I03]

## 17.3 Houthis

CENTCOM events provide validated smaller but operationally complex maritime examples: 18 OWA UAV + 3 missiles on 9 January 2024, and a 15-OWA-UAV attack on 9 March 2024. [HOU02][HOU03]

## 17.4 Tactical FPV environment

At tactical depth in Ukraine, the meaningful variable is often **sortie density per area and time** rather than a formation. Public Army/RUSI reporting supports persistent high local FPV activity, ISR cueing, and repeated attacks. Exact densities are sector/date dependent and should not be generalized across the front.

---

# 18. Weapons / engagement envelopes

## 18.1 Definition used here

For defensive C-UAS T&E, "weapons envelope" is represented as the **air vehicle's operational strike envelope**, consisting of:

- launch-to-target range;
- endurance;
- command/control or terminal-control distance;
- altitude band;
- cruise/max speed;
- payload/warhead mass;
- target type capability (fixed coordinate / moving target / operator-selected / seeker-selected) where documented.

This study does **not** calculate lethal blast radius, fragmentation fan, armor-penetration geometry, or optimal aimpoints.

## 18.2 Representative public envelopes

| Threat | Strike / flight reach | Control / comm reach | Speed | Altitude | Payload/warhead | Targeting character |
|---|---:|---:|---:|---:|---:|---|
| Shahed-136 / Geran-2 | 540–1,350 NM public range band | originally preprogrammed; connected variants differ | ~81–100 kt typical public prop values | low to >6,500 ft observed; broader ceiling reports vary | ~88 lb UN baseline; variants differ | fixed coordinates; maritime moving-target development evidenced |
| Gerbera | 324 NM | variant dependent | max 86 kt | ≤9,843 ft useful altitude, datum unstated | usually false-target/recon role; some armed variants reported | deception/recon/limited strike by variant |
| Geran-4 | 416 NM | mesh/network components present | 173 kt cruise; 189 kt max | ≤13,123 ft, datum unstated | 110 lb | deep strike; connected navigation/C2 architecture |
| Geran-5 | 513 NM | 3G/LTE + mesh components present | 243–324 kt cruise | max 19,685 ft; observed 656–9,843 ft | 198 lb | high-speed deep strike |
| Lancet Izd-51 | endurance 40 min | ~27 NM comm | 43 kt declared | not public high-confidence | 11 lb | operator/EO + terminal acquisition |
| ZALA Z-16 | airframe endurance >4 h | >40.5 NM comm | 35–59 kt | useful 656–16,404 ft | sensor payload | ISR / targeting |
| ZALA Z-16-5G | 12 h endurance | 81 NM comm | 43–67 kt | useful 1,640–11,811 ft | sensor payload | ISR / targeting |
| Orlan-10 | 600 km / 324 NM airframe stated | 64.8 NM comm | 49–81 kt | ≤16,404 ft | sensor payload | ISR / relay / targeting |
| Bumerang-E FPV | 5.4 NM | ~5.4 NM RF declared | max 89 kt | ≤9,843 ft max, datum unstated | up to 8.8 lb load | operator-in-loop |
| Early fiber FPV benchmark | ~5.4 NM public 2025 common figure | fiber | platform dependent | tactical low-altitude | model dependent | operator-in-loop |
| Baton Optik fiber FPV | **>16.2 NM** official 2026 | fiber | not public in cited source | tactical | sufficient for light-armor/field targets per MoD | operator-in-loop |
| Ukrainian heavy bomber class | >8.1 NM official 2025 example | RF | slow/hover | tactical | up to 88 lb ammunition | operator drop/reusable |
| AQ-400 Scythe | 405 NM | autonomous; no comm required for baseline mission | 78 kt cruise | ceiling 13,100 ft | 95 lb payload | visual/terrain autonomous nav; optional terminal capability by config |
| Liutyi | 1,080 NM official 2026 | long-range autonomous architecture; exact C2 not public | not official in cited source | not official | 110–165 lb | deep fixed-target strike; variants evolving |
| FP-1 | 864 NM official 2026 | not fully public | not public | not public | ≤265 lb | deep strike |
| Houthi Waid-2 | 1,350 NM DIA estimate | system dependent | Shahed-family | system dependent | 110 lb DIA estimate | OWA regional/maritime strike |

---

# 19. Guidance and autonomy matrix

| Autonomy / control level | Description | Systems / actors with public evidence | Threat-model note |
|---|---|---|---|
| **Manual RF teleoperation** | Operator continuously controls flight from live video | COTS quadcopters, many FPVs | include link latency, video loss, operator maneuver; do not assume GNSS dependence |
| **Assisted/manual** | Stabilized autopilot with operator steering/targeting | many military multirotors / FPVs | most common small-UAS mode |
| **Preprogrammed autonomous navigation** | route/waypoints to target without continuous control | Shahed/Geran baseline, deep-strike UAS | command-link denial may have no effect |
| **INS/GNSS integrated navigation** | inertial state + satellite correction | Shahed/Geran, many military UAS | test degraded GNSS separately from total nav failure |
| **Anti-jam GNSS** | CRPA/other interference-resistant architecture | later Geran variants | EW test must specify jammer geometry/power and verified threat receiver capability |
| **Visual/terrain autonomous navigation** | onboard imagery/terrain data supports route without GNSS | AQ-400; other Ukrainian development | include GNSS-denied but visually navigable test conditions |
| **Fiber operator-in-loop** | command/video over physical fiber | Russia/Ukraine FPV | RF jammer is not command-link defeat mechanism |
| **Cellular/IP connected** | 3G/LTE or IP network component | Geran-5 exploitation; other connected variants | network may support telemetry/control/relay; exact mission use must be variant-specific |
| **Mesh connected** | airborne/peer or relay mesh modem present | Geran-4/5 exploitation | do not assume every aircraft uses peer autonomy; component presence ≠ swarm intelligence |
| **Satellite/BLOS** | satellite service or satcom evidence | maritime Shahed evidence; some conflict reporting | allows operator interaction beyond terrestrial LOS |
| **Terminal EO operator control** | operator selects/corrects target late | Lancet/FPV/moving-target systems | terminal video link is key where applicable |
| **Passive radar homing** | onboard passive radar/RF seeker homes on emitting radar energy | Geran-2 PRGS-UAV variant documented by DIU, Aug 2026 | configuration-specific threat to emitting SAM/C-UAS radar systems; do not extrapolate to all Geran-2 variants |
| **Automatic terminal tracking** | target acquired and onboard system performs final guidance | Lancet assessment; multiple modern UAS/interceptor systems | link interruption after lock may not stop engagement |
| **Collaborative multi-UAS autonomy** | aircraft share tasks/trajectory decisions | PRC developmental concepts; limited public combat verification | separate future-threat card; do not conflate with mass raids |

---

# 20. Counter-countermeasure and non-cooperative characteristics

The following behaviors are sufficiently documented to require explicit C-UAS T&E representation.

## 20.1 Against electronic warfare

- **preprogrammed INS/GNSS navigation** reduces dependence on a command link;
- **anti-jam CRPA satellite navigation** appears on later Geran variants;
- **fiber-optic FPV** removes the conventional RF control/video path;
- **visual/terrain navigation** can sustain route navigation in GNSS-denied conditions;
- **terminal automatic target tracking** can reduce the effect of last-second RF disruption after acquisition;
- **connected cellular/mesh/SATCOM variants** increase communication-path diversity.

**Testing rule:** Do not score "jammer on" as a kill. Measure the actual threat aircraft state: navigation error, control loss, mission abort, terminal acquisition loss, crash, diversion, or continued flight.

## 20.2 Against kinetic / interceptor C-UAS

Observed adaptations include:

- higher-altitude long-range OWA profiles;
- faster turbojet OWA;
- increased raid size and repeated waves;
- decoy integration;
- small maneuverable FPVs;
- changes in route and timing;
- emerging anti-air UAS variants capable of threatening airborne interceptors; and
- passive-radar-homing Geran-2 variants capable of threatening emitting SAM/radar systems. [R22]

## 20.3 Against sensor/classification systems

- false targets/decoys create nonlethal tracks;
- COTS and modified military UAS may share similar size/speed characteristics despite different missions;
- slow/hovering multirotors differ sharply from conventional air-target Doppler assumptions;
- mixed salvos create concurrent track classes;
- ISR aircraft may be operationally more important than their lack of warhead suggests;
- passive-radar-homing OWA variants can make an emitting defensive radar part of the threat engagement problem. [R22]

---

# 21. Defensive C-UAS threat-representation library

This section converts the observed evidence into a **minimum threat-library structure**. The labels are analytic bins, not claims that adversaries use these names.

| Threat card | Evidence basis | Required variables | Do not assume |
|---|---|---|---|
| **T01 COTS-MR-ISR** | ISIS, Ukraine, Hamas, Hezbollah | very low altitude, hover, EO sensor, RF control, small mass | that unarmed = irrelevant |
| **T02 COTS-MR-DROPPER** | ISIS, Ukraine, Hamas | hover, short-range RF, munition release, return/reuse | that threat terminates at first pass |
| **T03 FPV-RF-OWA** | Russia/Ukraine | small mass, high maneuver, live video, RF command, terminal dive | straight-line constant-speed target |
| **T04 FPV-FIBER-OWA** | Russia/Ukraine | fiber link, no conventional control RF reliance, maneuver | RF jamming = defeat |
| **T05 HEAVY-BOMBER** | Russia/Ukraine | slow/hover, night sensor, heavier payload, repeated drop | high speed or one-way behavior |
| **T06 TACTICAL-ISR-FW** | Orlan/ZALA | multi-hour endurance, orbit, moderate altitude, sensor/relay | no-warhead track can be ignored |
| **T07 LOITERING-MUNITION-EO** | Lancet, Harop-type precedent | loiter, operator/EO, terminal acquisition/dive | command-link loss before/after lock has same outcome |
| **T08 OWA-PROP-PREPROGRAMMED** | Shahed/Geran baseline | 80–100 kt class, long range, GNSS/INS, low/high altitude | active C2 link exists |
| **T09 OWA-PROP-CONNECTED** | later Geran | camera + mesh/cellular/SATCOM evidence, anti-jam nav | fire-and-forget only |
| **T10 OWA-JET** | Geran-4/5; Ukrainian jet systems | 170–320+ kt public bands, deeper range, smaller warning | prop-UAS engagement timeline |
| **T11 FALSE-TARGET** | Gerbera, An-2 | plausible air track, minimal/variable payload, raid mixing | every track deserves same weapon |
| **T12 MIXED-UAS-MISSILE** | Iran, Houthis, Russia, Hezbollah | slow UAS + higher-speed missiles, concurrent tracking | C-UAS operates in isolation |
| **T13 CLOSE-IN-LAUNCH** | Israel 2025, Hamas short-range precedent | very short range, minimal warning, infrastructure target | all threats cross outer surveillance ring |
| **T14 DIRECT-ACTION-MULTI-UAS** | Ukraine/Russia tactical; Army ATP concept | multiple strike UAS against same defended problem | autonomous swarm required |
| **T15 COLLABORATIVE-SWARM-DEVELOPMENTAL** | PRC official/developmental reporting | peer coordination, supervisory control, distributed roles | combat-proven maturity |
| **T16 ANTI-AIR-UAS** | Russian modified Geran; Ukrainian interceptors | airborne target acquisition, manual/auto terminal guidance | UAS only attacks ground targets |
| **T17 EMITTER-SEEKING-OWA** | Geran-2 PRGS-UAV passive radar seeker, DIU Aug 2026 | host-airframe kinematics, passive radar homing, emitter-target threat function | every Geran-2 carries the seeker or that all sorties use this configuration |
| **T18 MALE-UCAV-ISR-STRIKE** | TB2/ANKA; Syria/Libya/Azerbaijan | medium-altitude endurance, EO/IR/laser or radar ISR, LOS/BLOS, guided weapons, external fires/EW integration | small-UAS kinematics or isolated-aircraft employment |
| **T19 IMPROVISED-PREPROGRAMMED-MULTI-UAS** | Hmeimim/Tartus 2018 | low-cost fixed-wing UAS, programmed route, multi-aircraft timing, improvised payload | autonomous collaborative swarm |
| **T20 LOW-ALT-MIXED-PGM-RAID** | Abqaiq/Khurais 2019 | weaponized UAS + LACM, low-altitude sensor challenge, heterogeneous track speeds | one uniform UAS class |
| **T21 NATIONAL-AIRSPACE-ISR-PENETRATOR** | DPRK 2022 | small ISR UAS, low-altitude penetration, multi-track C2 dissemination | successful detection guarantees interception |

---

# 22. Recommended threat-card data schema

For each actual threat emulation or digital model, record the following fields.

```yaml
threat_id: unique identifier
actor: country / organization
system_family: exact model or archetype
status: OBSERVED | TECH-EXPLOITED | DECLARED | OFFICIAL-ASSESSMENT | DOCTRINAL
last_verified_date: YYYY-MM-DD
source_ids: [Sxx, Syy]

classification:
  nato_class: I | II | III | unknown
  nato_category: micro | mini | small | tactical | MALE | HALE | strike-combat | unknown
  dod_group: 1 | 2 | 3 | 4 | 5 | unknown

physical:
  configuration: multirotor | fixed-wing | delta | hybrid-vtol | other
  propulsion: electric | piston | turbojet | hybrid | other
  mtow_lb: value_or_range
  span_ft: value_or_range
  payload_lb: value_or_range
  warhead_type: broad public category only

kinematics:
  cruise_speed_kt: value_or_range
  max_speed_kt: value_or_range
  altitude_min_ft: value_or_range
  altitude_max_ft: value_or_range
  altitude_datum: AGL | MSL | ASL | UNSTATED
  endurance_hr: value_or_range
  flight_range_nm: value_or_range
  control_range_nm: value_or_range
  hover_capable: true | false | unknown

navigation:
  ins: true/false/unknown
  gnss: true/false/unknown
  anti_jam_gnss: true/false/unknown
  visual_terrain_nav: true/false/unknown
  preprogrammed_route: true/false/unknown

control:
  rf_los: true/false/unknown
  relay: true/false/unknown
  cellular_ip: true/false/unknown
  satcom_blos: true/false/unknown
  fiber: true/false/unknown
  operator_in_loop: true/false/unknown
  terminal_auto_guidance: true/false/unknown
  collaborative_autonomy: true/false/unknown

employment:
  mission: ISR | strike | OWA | dropper | decoy | relay | BDA | anti-air | EW | other
  geometry: singleton | pair | small_serial | wave | multi_wave | multi_azimuth | mixed_salvo | close_in
  raid_size: observed_or_scenario-specific
  temporal_pattern: observed_or_scenario-specific
  terminal_behavior: hover | dive | pursuit | fixed_coordinate | auto_lock | other

confidence:
  parameter_confidence: high | medium | low
  conflicts_or_unknowns: free_text
```

---

# 23. What should **not** be collapsed into one threat model

## 23.1 "Drone" is not a useful single kinematic class

A hovering 5-lb quadcopter, a 200-kg Geran-2 at ~90 kt, and an 850-kg Geran-5 at 243–324 kt create fundamentally different sensor and engagement problems.

## 23.2 "GPS jamming" is not a universal defeat mechanism

Public evidence now includes:

- INS continuation;
- CRPA anti-jam navigation;
- visual/terrain navigation;
- fiber operator control;
- terminal image guidance;
- non-GNSS control paths.

## 23.3 "Swarm" is not synonymous with "raid"

A mass of independently preprogrammed Shaheds can overwhelm a defense without collaborative swarm autonomy. Conversely, a much smaller group can be a true collaborative swarm if aircraft coordinate decisions. The two must be separate T&E constructs.

## 23.4 "One-way attack" is not synonymous with "loitering munition"

A long-range fixed-coordinate Shahed mission and a Lancet searching/loitering with EO terminal acquisition are different engagement problems.

## 23.5 "No warhead" is not synonymous with "no threat"

Gerbera and An-2 decoy precedents demonstrate operational value in generating tracks, stimulating emissions/engagements, or enabling other shooters.

## 23.6 "Command link lost" is not synonymous with "threat defeated"

Preprogrammed autonomous navigation and terminal automatic guidance can allow continued mission execution after RF loss.

---

# 24. Country / actor comparative matrix

| Actor | Dominant public UAS threat types | Observed raid / formation behavior | Guidance/control sophistication | C-UAS-relevant adaptation |
|---|---|---|---|---|
| **Russia** | FPV, fiber FPV, heavy bombers, Orlan/ZALA ISR, Lancet, Geran-2/3/4/5, Gerbera | singleton to mass multi-wave raids; multi-azimuth; staggered/overlapping tracks; decoy mixing; sensor-shooter teams | RF, fiber, GNSS/INS, CRPA, EO terminal, mesh/cellular, emerging BLOS | altitude shifts, jet speed, false targets, link diversity, terminal auto guidance, passive-radar-homing variant |
| **Ukraine** | COTS ISR/dropper, RF/fiber FPV, heavy bombers, long-range prop OWA, jet missile-drones, interceptor UAS | hunter-killer teams; direct-action multi-UAS attacks; deep-strike raids; serial reattack | RF, fiber, INS/GNSS, visual/terrain nav, terminal auto guidance | GNSS-denied nav, >30 km fiber, long-range OWA diversification |
| **Iran** | Shahed OWA, Mohajer ISR/strike, Ababil family | mass national-scale mixed salvo | preprogrammed GNSS/INS, anti-jam; maritime BLOS/moving-target evidence | scale, mixed missile/UAS attack, moving-target development |
| **Houthis** | Waid/Shahed-type OWA, Sammad/Qasef families, reconnaissance UAS | maritime singleton/small group and complex attacks; mixed OWA/ASCM/ASBM | Iranian-derived; model dependent | maritime targeting, mixed-weapon timing |
| **Hezbollah** | COTS quadcopters, Iranian OWA/loitering/ISR UAS | singleton, small attacks, rockets + UAS | RF/preprogrammed depending model | low-altitude terrain masking, ISR-strike, combined fires |
| **Hamas/PIJ** | COTS quadcopters, direct-attack/loitering UAS | distributed short-range UAS under rocket cover | RF quadcopter; fixed-wing variants | attack on sensors/C2/remote weapon infrastructure |
| **Azerbaijan (2020)** | An-2 decoys, TB2 UCAV, loitering munitions | decoy-to-emitter-to-shooter sequence; persistent ISR-strike | remote/autopilot/EO seeker by system | deliberate interaction with air defenses / SEAD |
| **Israel (2025 Iran)** | close-in small explosive UAS + conventional strike | close-in/internal launch synchronized with air campaign | precision remote/autonomous systems; exact details classified | bypass outer warning; attack air defenses directly |
| **India/Pakistan (2025)** | ISR UAS, loitering munitions, decoys, quadcopters | large multi-location exchanges; reported mass/saturation attempts | mixed military/COTS; EW interaction | decoys, EW, SEAD/precision strike |
| **ISIS (Mosul)** | COTS quadcopter ISR/dropper | high-frequency distributed local attacks | direct RF | urban clutter, high sortie rate, low-cost mass |
| **Türkiye (2020 Syria/Libya precedent)** | TB2, ANKA-S; EW-enabled UACV package | persistent ISR/strike with fires; air-defense suppression campaign | LOS/BLOS, autonomous flight functions, EO/IR targeting; EW support | system-of-systems integration of UCAV, EW and fires |
| **Syria opposition / unattributed Hmeimim attackers (2018)** | improvised fixed-wing attack UAS | 10+3 grouped/preprogrammed tracks in public reporting | programmed route/GPS-class navigation | low-cost multi-UAS attack against combined EW/kinetic defense |
| **DPRK** | small ISR penetrators; larger developmental UAS also reported | five-aircraft 2022 incursion; dispersed penetration rather than verified swarm | exact 2022 control architecture not public | low-altitude track continuity, cross-service C2/engagement challenge |
| **Iran-aligned militias in Iraq/Syria/Jordan** | OWA small attack UAS | singleton/small-group base and leadership attacks | model-dependent; Iranian-derived components/systems in some cases | low-altitude defended-site penetration; friend/foe deconfliction stress demonstrated at Tower 22 |
| **PRC** | broad tactical to theater UAS, loitering/strike, developmental swarm | echeloned ISR/strike; swarm experimentation | human-supervised, preprogrammed, AI-enabled developmental coordination | future collaborative autonomy; large industrial scale |

---

# 25. Data gaps and facts that cannot be responsibly standardized

The following values are often requested in C-UAS test design but are **not** consistently available in public high-confidence sources:

1. **Radar cross section by aspect and frequency** for most threat UAS.
2. **IR signature** as a function of engine state, aspect, weather, and range.
3. **Exact acoustic signature** in operational configuration.
4. **Acceleration and turn-rate envelopes** for FPVs and most OWA aircraft.
5. **Exact terminal dive angles and maneuver logic** by production series.
6. **Live-link frequencies, waveforms, encryption, hopping patterns, and transmit powers** for current military systems; public snapshots age rapidly.
7. **Precise decoy-to-strike ratios** for Russian raids; ratios vary and public claims conflict.
8. **Exact route-generation logic** for large OWA raids.
9. **True autonomous-swarm coordination algorithms** for combat systems.
10. **Lethal radii / penetration** for many improvised and variable warheads.
11. **Current production-series configuration** for rapidly iterating Russian and Ukrainian aircraft; fielded aircraft in the same named family can differ materially.
12. **Actual probability of navigation failure under specific jamming/spoofing conditions** without controlled test data.

For these fields, a threat model should use measured intelligence/range data if available to the test authority. Public-source values should not be invented to fill the blank.

---

# 26. High-priority C-UAS test cases supported by public evidence

These are **defensive test cases**, each tied to an observed/officially assessed threat phenomenon.

## TC-01 — Group-1 COTS multirotor in clutter

Evidence: ISIS Mosul; Ukraine; Hamas.  
Represent: very low altitude, hover, stop/start movement, urban/vegetation clutter, ISR and munition-drop variants.

## TC-02 — RF FPV maneuvering terminal attack

Evidence: Russia/Ukraine.  
Represent: small Group-1 aircraft, live operator control, high maneuver, short warning, serial attacks.

## TC-03 — Fiber-optic FPV

Evidence: Russia/Ukraine; Ukrainian Baton Optik >30 km.  
Represent: same/similar kinematic class as FPV with **no reliance on conventional RF command/video defeat**.

## TC-04 — Heavy night bomber

Evidence: Russia/Ukraine; official Ukrainian 40-kg/15-km class disclosure.  
Represent: slow/hover, night EO/IR, heavier payload, return/repeat capability.

## TC-05 — ISR-to-shooter kill chain

Evidence: Orlan/ZALA/Lancet/FPV; Ukrainian T2COM reporting.  
Represent: persistent ISR track followed by separate strike UAS and possible BDA.

## TC-06 — Long-range prop OWA low-altitude profile

Evidence: Geran/Shahed campaigns.  
Represent: ~80–100 kt class, long endurance, GNSS/INS, small signature, low altitude appropriate to terrain/evidence.

## TC-07 — Long-range prop OWA higher-altitude profile

Evidence: Russian adaptation reported by RUSI.  
Represent: same airframe at several-thousand-foot altitude rather than only low-altitude flight.

## TC-08 — Decoy + strike wave

Evidence: Gerbera/Geran; An-2 precedent.  
Represent: heterogeneous tracks with different actual lethality but overlapping kinematics/signatures.

## TC-09 — Multi-wave / staggered mass raid

Evidence: Russia 2025–26.  
Represent: repeated groups, changing routes/axes, sustained duration, magazine/reload burden.

## TC-10 — Jet OWA

Evidence: Geran-4/5; Ukrainian missile-drone families.  
Represent: 170–320+ kt threat bands based on exact emulated system, with smaller warning and track dwell.

## TC-11 — Mixed UAS + missile salvo

Evidence: Iran April 2024; Houthis January 2024; Russia.  
Represent: slow OWA tracks while higher-speed cruise/ballistic/anti-ship threats compete for sensors and command attention.

## TC-12 — Close-in/internal launch

Evidence: Israel Operation Rising Lion 2025; Hamas short-range border attack.  
Represent: threat begins inside/near nominal perimeter and targets defensive enabling infrastructure.

## TC-13 — Terminal automatic guidance after link degradation

Evidence: U.S. Army Lancet assessment; modern Ukrainian/Russian terminal-guidance systems.  
Represent: different kill criteria before and after terminal target acquisition.

## TC-14 — Moving-target maritime OWA

Evidence: UN Shahed-family maritime investigation; Houthi campaign.  
Represent: moving defended asset and operator/seeker-capable threat configuration only when using a variant for which such capability is supported.

## TC-15 — Developmental collaborative swarm

Evidence: PRC official/developmental reporting.  
Represent separately from mass independent OWA raid; label **DOCTRINAL/DEVELOPMENTAL**, not combat-proven.

## TC-16 — Passive-radar-homing OWA against defensive emitters

Evidence: DIU technical exploitation of the Geran-2 PRGS-UAV passive radar seeker, 12 August 2026. [R22]  
Represent: Geran-2-class host-airframe kinematics with a configuration-specific passive-radar-homing terminal threat function. Evaluate the defensive architecture under the fact that an emitting radar may itself be a threatened object. Do **not** extrapolate the seeker to all Geran-2 aircraft.

## TC-17 — Medium-altitude UCAV integrated with EW and fires

Evidence: Türkiye Operation Spring Shield / Libya public analysis; TB2 and ANKA-S. [TUR01][TUR03]  
Represent: persistent medium-altitude ISR/strike track, BLOS/LOS control, external fires and a degraded/contested sensing environment. Do not assign a specific EW effect to a named defensive radar unless test-authority intelligence supports it.

## TC-18 — Improvised preprogrammed multi-UAS attack on defended installation

Evidence: Hmeimim/Tartus January 2018. [SYR01][SYR02]  
Represent: multiple low-cost fixed-wing UAS on programmed routes, grouped timing, combined soft-kill/hard-kill defensive response. Do not label the case collaborative autonomy.

## TC-19 — Low-altitude weaponized-UAV + LACM mixed raid

Evidence: Abqaiq/Khurais September 2019, UN Panel of Experts. [SAU01]  
Represent: at least two distinct speed/signature classes, low-altitude surveillance burden, heterogeneous engagement priorities, fixed-infrastructure defense.

## TC-20 — National-airspace penetration and distributed C2

Evidence: DPRK December 2022. [DPRK01]  
Represent: multiple small ISR penetrators, intermittent tracks, cross-service data dissemination, command handoff and engagement authority.

## TC-21 — Coincident friendly and hostile UAS at a defended base

Evidence: Tower 22 preliminary U.S.-official reporting. [JORD01][JORD02]  
Represent: low-altitude hostile UAS concurrent with friendly UAS traffic, with identity confidence and engagement authority as scored variables. Do not represent deliberate adversary timing or mimicry because public evidence does not establish it.

---

# 27. Source catalog

The following sources form the principal evidence base. Access dates are no later than 22 August 2026.

## NATO / U.S. doctrine and classification

**[N01] NATO / JALLC public UAS classification material, adapted from STANAG 4670 / ATP-3.3.8.1.**  
https://nllp.jallc.nato.int/iks/sharing%20public/uas-unmanned-aircraft-systems.pdf

**[N02] U.S. Department of Defense, Counter-Small Unmanned Aircraft Systems Strategy, Annex C.**  
https://media.defense.gov/2021/Jan/07/2002561080/-1/-1/0/DEPARTMENT-OF-DEFENSE-COUNTER-SMALL-UNMANNED-AIRCRAFT-SYSTEMS-STRATEGY.pdf

**[N03] U.S. Army ATP 3-01.81, Counter-Unmanned Aircraft System Techniques, 23 May 2025.**  
https://armypubs.army.mil/epubs/DR_pubs/DR_a/ARN43877-ATP_3-01.81-000-WEB-1.pdf

## Russia / Ukraine technical exploitation and operational analysis

**[R01] RUSI, Tactical Developments During the Third Year of the Russo–Ukrainian War, February 2025.**  
https://static.rusi.org/tactical-developments-third-year-russo-ukrainian-war-february-2205.pdf

**[R02] Defence Intelligence of Ukraine, War & Sanctions — Gerbera.**  
https://war-sanctions.gur.gov.ua/en/uav/329

**[R03] Defence Intelligence of Ukraine, War & Sanctions — Geran-4.**  
https://war-sanctions.gur.gov.ua/en/page-geran-4

**[R04] Defence Intelligence of Ukraine, War & Sanctions — Geran-5.**  
https://war-sanctions.gur.gov.ua/en/page-geran-5

**[R05] Defence Intelligence of Ukraine, War & Sanctions — Geran-3.**  
https://war-sanctions.gur.gov.ua/en/page-geran-3

**[R06] Defence Intelligence of Ukraine, Geran-2 series with Verba MANPADS.**  
https://gur.gov.ua/en/content/warsanctions-nova-modyfikatsiia-yerani-odnochasno-nese-na-bortu-pzrk-ta-boiovu-chastynu

**[R07] Defence Intelligence of Ukraine, Geran-2 series with R-60 air-to-air missile.**  
https://gur.gov.ua/en/content/warsanctions-hur-rozkryvaie-detali-novoi-modyfikatsii-rosiiskoi-erani-z-aviatsiinoiu-raketoiu-r60

**[R08] Defence Intelligence of Ukraine, War & Sanctions — Lancet / Izdeliye-51.**  
https://war-sanctions.gur.gov.ua/en/page-lancet

**[R09] Defence Intelligence of Ukraine, War & Sanctions — ZALA Z-16 (421-16E).**  
https://war-sanctions.gur.gov.ua/en/uav/272

**[R10] Defence Intelligence of Ukraine, War & Sanctions — ZALA Z-16-5G.**  
https://war-sanctions.gur.gov.ua/en/uav/373

**[R11] Defence Intelligence of Ukraine, War & Sanctions — Orlan-10.**  
https://war-sanctions.gur.gov.ua/en/uav/207

**[R12] Defence Intelligence of Ukraine, War & Sanctions — Orlan-30.**  
https://war-sanctions.gur.gov.ua/en/uav/406

**[R13] Defence Intelligence of Ukraine, War & Sanctions — Bumerang-E FPV.**  
https://war-sanctions.gur.gov.ua/en/uav/415

**[R14] Defence Intelligence of Ukraine, War & Sanctions — Harpiya-A1.**  
https://war-sanctions.gur.gov.ua/en/uav/379

**[R15] CSIS Missile Threat — Shahed-131 and Shahed-136, updated June 2026.**  
https://missilethreat.csis.org/missile/shahed-131-and-136/

**[R16] United Nations Security Council document S/2023/362, Shahed technical findings.**  
https://digitallibrary.un.org/record/4011958/files/S_2023_362-EN.pdf

**[R17] U.S. Army, How Russia Fights: A Compendium of TRoika Observations on Russia's Special Military Operations, 2025.**  
https://api.army.mil/e2/c/downloads/2025/07/11/f2b1e75e/how-russia-fights-a-compendium-of-troika-observations-on-russia-s-special-military-operations.pdf

**[R18] U.S. Army T2COM, Ukrainian Unmanned Aerial System Tactics, 8 October 2024.**  
https://oe.t2com.army.mil/product/ukrainian-unmanned-aerial-system-tactics/

**[R19] U.S. Army University Press, Lessons from Ukraine / Russian adaptation and FPV employment, Military Review, 2025.**  
https://www.armyupress.army.mil/Journals/Military-Review/English-Edition-Archives/September-October-2025/Lessons-from-Ukraine/

**[R20] CSIS, The New Salvo War, 31 July 2025.**  
https://www.csis.org/analysis/new-salvo-war

**[R21] CSIS, The Geography of Coercion: Russian Missile and Drone Campaigns in Ukraine, 7 July 2026.**  
https://www.csis.org/analysis/geography-coercion-russian-missile-and-drone-campaigns-ukraine

**[R22] Defence Intelligence of Ukraine, 12 August 2026 — passive radar seeker installed on Geran-2 for detection/engagement of SAM systems and radar stations; War & Sanctions identifies the subsystem as PRGS-UAV.**  
https://gur.gov.ua/en/content/warsanctions-u-novii-rosiiskii-raketi-monokhrom-vyiavyly-mikrokompiuter-nvidia-jetson-shcho-mozhe-svidchyty-pro-vykorystannia-shi.html  
https://war-sanctions.gur.gov.ua/en/components

**[R23] Defence Intelligence of Ukraine, War & Sanctions — Izdeliye-54 (Italmas), updated 4 May 2026.**  
https://war-sanctions.gur.gov.ua/en/uav/368

## Ukraine official systems / autonomy

**[U01] Office of the President of Ukraine, Arms Makers' Day: fielded Ukrainian weapons, 14 April 2026.**  
https://www.president.gov.ua/en/news/u-zvernenni-z-nagodi-dnya-zbroyara-prezident-pokazav-ponad-5-103821

**[U02] Terminal Autonomy, AQ-400 Scythe public specifications.**  
https://terminalautonomy.com/aq-400-scythe/

**[U03] Ministry of Defence of Ukraine, Baton Optik fiber-optic FPV, 5 February 2026.**  
https://mod.gov.ua/en/news/defence-forces-expand-their-arsenal-with-new-baton-optik-drones-capable-of-destroying-enemy-equipment-beyond-30-km

**[U04] Office of the President of Ukraine, bomber and reconnaissance UAS with UK components, 16 January 2025.**  
https://www.president.gov.ua/en/news/volodimir-zelenskij-i-kir-starmer-oznajomilisya-z-dronami-bo-95489

**[U05] CSIS, Ukraine's Future Vision and Current Capabilities for Waging AI-Enabled Autonomous Warfare.**  
https://www.csis.org/analysis/ukraines-future-vision-and-current-capabilities-waging-ai-enabled-autonomous-warfare

**[U06] U.S. Army T2COM, Ukrainian Unmanned Aerial System Tactics.**  
https://oe.t2com.army.mil/product/ukrainian-unmanned-aerial-system-tactics/

## Iran / Houthis

**[I01] United Nations S/2023/362 — Shahed-136 navigation, range, warhead, maritime moving-target evidence.**  
https://digitallibrary.un.org/record/4011958/files/S_2023_362-EN.pdf

**[I02] U.S. Defense Intelligence Agency, Iran Military Power, 2019.**  
https://www.dia.mil/Portals/110/Images/News/Military_Powers_Publications/Iran_Military_Power_LR.pdf

**[I03] U.S. Department of Defense, Israel, U.S., Partners Neutralize Iranian Airborne Attacks, 16 April 2024.**  
https://www.defense.gov/News/News-Stories/Article/Article/3742552/israel-us-partners-neutralize-iranian-airborne-attacks/

**[HOU01] U.S. Defense Intelligence Agency, Iran: Enabling Houthi Attacks Across the Middle East, February 2024.**  
https://www.dia.mil/Portals/110/Documents/News/Military_Power_Publications/Iran_Houthi_Final2.pdf

**[HOU02] U.S. Central Command, 9 January 2024 Houthi complex attack statement.**  
https://www.centcom.mil/MEDIA/PUBLIC-RELEASES/Article/3639970/us-centcom-statement-on-26th-houthi-attack-on-commercial-shipping-lanes-in-the/

**[HOU03] U.S. Central Command, U.S. and Coalition Defeat Houthi Attack in Red Sea Area, 9 March 2024.**  
https://www.centcom.mil/MEDIA/PUBLIC-RELEASES/Article/3702101/us-and-coalition-defeat-houthi-attack-in-red-sea-area/

## Hezbollah / Hamas

**[HEZ01] CSIS, The Coming Conflict with Hezbollah, 21 March 2024.**  
https://www.csis.org/analysis/coming-conflict-hezbollah

**[HEZ02] Israel Defense Forces, The Northern Front: 12 Months of Hezbollah Attacks on Israel, 2024.**  
https://www.idf.il/en/articles/2024/swords-of-iron-the-northern-front-12-months-of-hezbollah-attacks-on-israel/

**[HEZ03] Critical Threats / Institute for the Study of War, Iran Update, 19 October 2024.**  
https://www.criticalthreats.org/analysis/iran-update-october-19-2024-6712bc4ac448b

**[HAM01] CSIS, Hamas's October 7 Attack: Visualizing the Data.**  
https://www.csis.org/analysis/hamass-october-7-attack-visualizing-data

**[HAM02] IISS, The Hamas attack and Israeli military options, October 2023.**  
https://www.iiss.org/online-analysis/online-analysis/2023/10/Hamas-attack-and-israeli-military-options/

**[HAM03] CSIS, The Evolution of Airpower, 2025.**  
https://www.csis.org/analysis/chapter-10-evolution-airpower

## Syria 2018 / Türkiye 2020 / Saudi Arabia 2019 / DPRK / defended-base precedents

**[SYR01] RUSI, UAVs in the Middle East: Coming of Age, 6 February 2019.**  
https://www.rusi.org/explore-our-research/publications/commentary/uavs-middle-east-coming-age

**[SYR02] RAND, Russian Air Defense Systems and Small UAS / campaign evidence, RRA1233-5.**  
https://www.rand.org/content/dam/rand/pubs/research_reports/RRA1200/RRA1233-5/RAND_RRA1233-5.pdf

**[TUR01] RUSI, Turkey's Electronic Warfare Capabilities: The Invisible Power Behind its UACVs, 2021.**  
https://www.rusi.org/explore-our-research/publications/commentary/turkeys-electronic-warfare-capabilities-invisible-power-behind-its-uacvs

**[TUR02] Baykar, Bayraktar TB2 Technical Features, February 2026 technical sheet.**  
https://cdn.baykartech.com/media/upload/userFormUpload/sOQikTjeCwcpFTiNLoVok27Zr8Yulmy9.pdf

**[TUR03] Republic of Türkiye Ministry of National Defence, Operation Spring Shield (Bahar Kalkanı Harekâtı).**  
https://www.msb.gov.tr/BaharKalkani

**[SAU01] United Nations Security Council S/2020/326, Final Report of the Panel of Experts on Yemen, 28 April 2020.**  
https://digitallibrary.un.org/record/3859381/files/S_2020_326-EN.pdf

**[SAU02] CSIS Missile Threat, Don't Waste This Lesson: How Drone Attacks Reveal Fixable Flaws with American Air Defenses, 24 September 2019.**  
https://missilethreat.csis.org/how-drone-attacks-reveal-fixable-flaws-with-american-air-defenses/

**[DPRK01] 38 North, How to Respond to the New North Korean Threat From UAVs, 27 January 2023.**  
https://www.38north.org/2023/01/how-to-respond-to-the-new-north-korean-threat-from-uavs/

**[JORD01] Lead Inspector General for Operation Inherent Resolve, Quarterly Report to Congress, 1 January–31 March 2024.**  
https://media.defense.gov/2024/May/02/2003455424/-1/-1/1/OIR_Q2_MAR2024_FINAL_508.PDF

**[JORD02] Associated Press, preliminary U.S. account of Tower 22 hostile/friendly UAS identification confusion, 29 January 2024.**  
https://apnews.com/article/f175962e058b9b6f668303faf248d8e6

**[PT01] CSIS, Countering Small Uncrewed Aerial Systems: Air Defense by and for the Joint Force, 14 November 2023.**  
https://www.csis.org/analysis/countering-small-uncrewed-aerial-systems

**[PT02] Reuters, Drones attack the Kurdistan Regional Government prime minister's office in Iraq, 17 August 2026.**  
https://www.reuters.com/world/middle-east/drones-attack-kurdistan-regional-government-prime-ministers-office-iraq-2026-08-17/

## Azerbaijan / Israel / India-Pakistan / ISIS

**[AZ01] U.S. Army University Press, Beating the Sensor Symphony: Why Decoys Still Matter, 2026.**  
https://www.armyupress.army.mil/Journals/Military-Review/English-Edition-Archives/July-August-2026/Sensor-Symphony/

**[AZ02] U.S. Army, Tactical Reconnaissance Strike in Ukraine: A Mandate for the U.S. Army, 2025.**  
https://www.army.mil/article/284138/tactical_reconnaissance_strike_in_ukraine_a_mandate_for_the_u_s_army

**[ISR01] CSIS, Ungentlemanly Robots: Israel's Operation Rising Lion and the New Way of War, 13 June 2025.**  
https://www.csis.org/analysis/ungentlemanly-robots-israels-operation-rising-lion-and-new-way-war

**[ISR02] CSIS, Air Superiority in the Twenty-First Century: Lessons from Iran and Ukraine, 2025.**  
https://www.csis.org/analysis/air-superiority-twenty-first-century-lessons-iran-and-ukraine

**[ISR03] RUSI, Operation Rising Lion: The First 72 Hours, 16 June 2025.**  
https://www.rusi.org/explore-our-research/publications/commentary/operation-rising-lion-first-72-hours

**[IP01] Reuters, India and Pakistan's drone battles mark new arms race in Asia, 27 May 2025.**  
https://www.reuters.com/business/aerospace-defense/india-pakistans-drone-battles-mark-new-arms-race-asia-2025-05-27/

**[IP02] DRDO-hosted press compilation, Newspaper Clippings, 30 May 2025.**  
https://drdo.gov.in/drdo/sites/default/files/drdo_news/NPC30May2025.pdf

**[ISIS01] Combating Terrorism Center at West Point, Defeat by Annihilation: Mobility and Attrition in the Islamic State's Defense of Mosul.**  
https://ctc.westpoint.edu/defeat-by-annihilation-mobility-and-attrition-in-the-islamic-states-defense-of-mosul/

**[ISIS02] Combating Terrorism Center at West Point, The Islamic State's Drone Documents: Management, Acquisitions, and DIY Tradecraft.**  
https://ctc.westpoint.edu/ctc-perspectives-the-islamic-states-drone-documents-management-acquisitions-and-diy-tradecraft

## PRC

**[PRC01] U.S. Department of Defense, Military and Security Developments Involving the People's Republic of China 2025.**  
https://media.defense.gov/2025/Dec/23/2003849070/-1/-1/1/ANNUALREPORT-TO-CONGRESS-MILITARY-AND-SECURITY-DEVELOPMENTS-INVOLVING-THEPEOPLES-REPUBLIC-OF-CHINA-2025.PDF

**[PRC02] U.S. Army T2COM, China's UAS Revolution, 11 December 2025.**  
https://oe.t2com.army.mil/product/chinauasrevolution/

---

# 28. Bottom-line findings for a C-UAS evaluator

1. **Model the kill chain, not just the aircraft.** ISR, relay, strike, BDA, and decoy functions can be distributed across different UAS.
2. **Use multiple altitude regimes.** Contemporary OWA employment includes both very low and several-thousand-foot profiles.
3. **Use multiple control architectures.** RF, fiber, preprogrammed, anti-jam GNSS/INS, visual navigation, mesh/cellular, and BLOS-connected variants all exist publicly.
4. **Separate mass from autonomy.** A 500-aircraft raid is not automatically a swarm; a small networked group can be.
5. **Test decoys explicitly.** Classification and weapons allocation are part of C-UAS performance.
6. **Test repeated waves, not only peak concurrency.** Sustained raid duration stresses magazines, crews, C2, and sensor track management.
7. **Include jet-speed UAS.** Geran-4/5 and Ukrainian missile-drone families materially change timelines from Shahed-136-class propeller aircraft.
8. **Include fiber FPV.** RF-link defeat cannot be a universal small-UAS assumption.
9. **Include terminal autonomy.** "Lost link" must not automatically equal "kill" in scoring.
10. **Include mixed weapon classes.** Real campaigns often combine UAS with rockets, cruise missiles, ballistic missiles, or anti-ship missiles.
11. **Include close-in launch.** Critical infrastructure and air-defense nodes can face UAS launched inside the normal outer surveillance ring.
12. **Treat defensive emitters as potential threatened objects when configuration evidence supports it.** DIU's August 2026 Geran-2 passive-radar-seeker disclosure establishes an emitter-seeking OWA test case; it should not be generalized to all Geran-2 variants. [R22]
13. **Test medium-altitude UCAVs as part of a system-of-systems.** Türkiye's 2020 precedent couples UAS with EW, ISR and surface fires; an isolated-aircraft trial does not reproduce the historical defensive problem. [TUR01][TUR03]
14. **Score identification, deconfliction and distributed C2.** DPRK's 2022 incursion and Tower 22 show that detection alone is not sufficient when track dissemination, friend/foe confidence, or engagement authority fails. [DPRK01][JORD01][JORD02]
15. **Preserve provenance.** Every test parameter should identify whether it is observed, exploited, declared, assessed, or developmental—and the date/production series to which it applies.

---

## Revision note

This study should be treated as a **living threat baseline**. Russia and Ukraine are changing production-series UAS hardware on timelines measured in weeks to months, and public evidence in 2026 already shows Geran-4/5, longer-range fiber systems, anti-jam navigation, connected control architectures, terminal guidance, and a Geran-2 passive-radar-homing configuration that differ materially from 2023–2024 baselines. A C-UAS threat library that is not configuration- and date-controlled will become stale.
