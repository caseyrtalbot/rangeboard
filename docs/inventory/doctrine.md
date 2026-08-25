# Doctrine terminology audit

The app's vocabulary measured against US and NATO doctrine. This audit was
commissioned alongside the inventory research.

**Most of it was not acted on.** The findings below target the engine, the
weapons-control model and UI labels, which are outside an inventory change. They
are recorded here so that acting on them stays a deliberate decision rather than
a side effect.

Two findings were inventory and were applied: the four shipped presets carried
their representative caveat only in a code comment, invisible to anyone who
drops a preset and screenshots it into a test product; and the
`seedLibrary.ts` header cited DoD nomenclature without naming the documents.

## Sources read

- Countering Air and Missile Threats (2017-04-21) — https://s3.documentcloud.org/documents/3723744/2017-Joint-Publication-3-01-Countering-Air-and.pdf
- Joint Air Operations (2019-07-25) — https://aerospace.csis.org/wp-content/uploads/2019/09/JointAirOperations_jp3_30.pdf
- Joint Targeting (2007-04-13) — https://www.bits.de/NRANEU/others/jp-doctrine/jp3_60(07).pdf
- Joint Security Operations in Theater (2006-08-01) — https://www.bits.de/NRANEU/others/jp-doctrine/jp3_10(06).pdf
- U.S. Army Air and Missile Defense Operations (2025-08-26) — https://armypubs.army.mil/epubs/DR_pubs/DR_a/ARN44767-FM_3-01-000-WEB-1.pdf
- Counter-Unmanned Aircraft System Techniques (2017-04-13) — https://aviation-assets.info/wp-content/uploads/ARN3099_ATP-3-01x81-FINAL-WEB.pdf
- Counter-Unmanned Aircraft System (C-UAS) Operations (2025-05-23) — https://armypubs.army.mil/epubs/DR_pubs/DR_a/ARN43877-ATP_3-01.81-000-WEB-1.pdf
- Common Warfighting Symbology (1994-09-30) — https://nps.edu/documents/104517539/109705106/MIL-STD-2525.PDF/87529131-72ce-44a7-91fb-b6c05381f7a4
- U.S. Department of Defense Counter-Small Unmanned Aircraft Systems Strategy (2021-01) — https://upload.wikimedia.org/wikipedia/commons/8/80/%22U.S._Department_of_Defense_Counter-Small_Unmanned_Aircraft_Systems_Strategy%22_%282021%29%2C_by_Christopher_C._Miller.pdf
- Department of Defense Counter Unmanned Aircraft Systems: Background and Issues for Congress (2025-03-31) — https://www.congress.gov/crs_external_products/R/PDF/R48477/R48477.1.pdf
- Army Publishing Directorate publication index (ATP, FM, ADP product maps) (2026-08-24 (accessed)) — https://armypubs.army.mil/ProductMaps/PubForm/ATP.aspx

## Findings

### detect / track / identify / defeat sequence

- **App:** `src/model/types.ts SensorRole doc comment; src/model/seedLibrary.ts header comment`
- **Doctrinal term:** detect, track, identify, and, if necessary, deter, deny, or defeat
- **Verdict:** MATCHES_WITH_OMISSIONS

The four-verb chain matches the DoD C-sUAS Strategy. Two things the app does not carry: (1) doctrine's fourth step is a three-way option set - deter, deny, or defeat - and the app models only defeat and jam; (2) the statutory verb set under 10 U.S.C. 130i is detect, track, and MITIGATE, not defeat.

> At home and abroad, U.S. forces will increasingly encounter sUAS and must be able to detect, track, identify, and, if necessary, deter, deny, or defeat them.


### D / TRK / ID / TGT / ENG / FX stage ladder

- **App:** `src/panels/analysis/ThreatPicture.tsx lines 107-112; referenced in CLAUDE.md design-system section`
- **Doctrinal term:** find, fix, track, target, engage, and assess (F2T2EA), also called the kill chain
- **Verdict:** DIVERGES

Against F2T2EA: D substitutes for FIND (defensible, detect is the DoD C-sUAS Strategy verb); FIX is missing entirely; ID is inserted as a rung although doctrinally identification runs across find/fix/track rather than being an F2T2EA step; FX substitutes for ASSESS. Recommend relabelling the last rung ASSESS, or stating in the tooltip that FX is the app's measured-effect proxy for the doctrinal assess step.

> Targeting in phase 5 consists of five steps: find, fix, track, target, and engage. ... Dynamic targeting has often been called F2T2EA (find, fix, track, target, engange, and assess) or the kill chain and has also been used for specifically engaging TSTs.


### SensorRole: early-warning

- **App:** `src/model/types.ts`
- **Doctrinal term:** early warning
- **Verdict:** MATCHES

> Adequate early warning of air and missile attacks provides the reaction time necessary for friendly forces to seek shelter or take appropriate action. Early warning of hostile air and missile attacks to support cueing and early engagement is vital for a layered defense.


### SensorRole: surveillance

- **App:** `src/model/types.ts`
- **Doctrinal term:** surveillance / air surveillance / wide-area surveillance
- **Verdict:** MATCHES

> Determine Surveillance Coverage Areas. Defended airspace and its approaches must be under continuous surveillance to provide early warning and support engagements.


### SensorRole: target-acquisition

- **App:** `src/model/types.ts`
- **Doctrinal term:** target acquisition
- **Verdict:** MATCHES

> ADA further contributes to targeting by defending field artillery target acquisition radars that are required to detect targets and deliver ordnance. Target acquisition radars are generally considered a high priority asset by maneuver commanders.


### SensorRole: tracking

- **App:** `src/model/types.ts`
- **Doctrinal term:** track / tracking
- **Verdict:** MATCHES

> Sensor and weapon placements are selected based on reconnaissance to maximize surveillance, tracking, and engagements.


### SensorRole: fire-control

- **App:** `src/model/types.ts`
- **Doctrinal term:** fire control quality track / fire control quality data
- **Verdict:** MATCHES

> In addition to positioning sensors for wide-area surveillance purposes, planners must balance the need to achieve fire control quality track data to support engagements by weapon systems.


### SensorRole: classification

- **App:** `src/model/types.ts`
- **Doctrinal term:** identification (ID); classification is the PRODUCT of identification, not a role
- **Verdict:** DIVERGES

The app names the output where it means the function. In doctrine a sensor performs identification or contributes to combat identification; classification is what identification assigns to the track. Sensor-side discrimination (drone-vs-bird micro-Doppler, RF protocol match) is real but doctrine files it under identification METHODS - non-cooperative target recognition and other physics-based ID techniques - not as a separate role. Recommend renaming the enum value to identification, or keeping the value and labelling it Identification (combat ID) in the UI with a comment pointing at JP 3-01 para III-11a.

> ID is the process of determining the friendly or hostile character of an unknown detected contact and the product (classification) of that process. Assigning ID requires ID authority and criteria.


### Roe = hold | tight | free, labelled ROE in the UI

- **App:** `src/model/types.ts Roe type; src/panels/Toolbar.tsx ROE_PILLS; src/panels/AnalysisPanel.tsx roe-label`
- **Doctrinal term:** weapons control status (WCS): WEAPONS FREE, WEAPONS TIGHT, WEAPONS HOLD
- **Verdict:** CATEGORY_ERROR_PLUS_TWO_WRONG_MAPPINGS

These three values are weapons control statuses, not rules of engagement. Weapons control status is ONE of the six AMD ROE categories. Calling the control ROE is a category error. Beyond the naming, two of the three mappings are substantively wrong: (1) app free = engage on first detection, but doctrinal WEAPONS FREE is a NOT-POSITIVELY-IDENTIFIED-AS-FRIENDLY test, not a detection test - the app removes the friendly-PID discriminator that is the entire content of the status; (2) app hold = zero engagement windows, but doctrinal WEAPONS HOLD preserves the inherent right of self-defense. Only tight maps correctly.

> The WCSs are free, tight, and hold. 1. Weapons Free-The least restrictive status; when any target not positively identified as friendly in accordance with current ROE may be engaged. ... 2. Weapons Tight-The normal status. Units may only fire on targets identified as hostile in accordance with current ROE. ... 3. Weapons Hold-The most restrictive status. Units may only fire in self-defense or when ordered by proper higher authority.


### ThreatClassification = pending | unknown | suspected | hostile

- **App:** `src/playback/sim.ts (documented as ported from PicoGrid drone-swarm track statuses)`
- **Doctrinal term:** standard identity: PENDING, UNKNOWN, ASSUMED FRIEND, FRIEND, NEUTRAL, SUSPECT, HOSTILE
- **Verdict:** DIVERGES_IN_FIVE_SPECIFIC_WAYS

The app's ladder derives from a vendor source, not doctrine. Divergences, exactly: (1) spelling - app suspected, doctrine SUSPECT; (2) three rungs missing - FRIEND, ASSUMED FRIEND, NEUTRAL - which is why the app cannot express not positively identified as friendly and therefore why its WEAPONS FREE behaviour is wrong; (3) app pending means pre-detection, but doctrinal PENDING presupposes a track exists and UNKNOWN is the stronger statement of an EVALUATED track that has not been identified, so the app collapses the evaluation step; (4) the app ladder only climbs, but doctrine's ID matrix is a logic tree that follows a track throughout its life and permits re-identification downward; (5) the promotion criteria are hardcoded engine constants (SUSPECT_SPEED_KPH 50, SUSPECT_RANGE_FACTOR 1.5, ATTACK_INTENT_KEYWORDS) where doctrine requires commander-approved, promulgated HOSTILE CRITERIA.

> Pending - A track for which identification is to be determined. (STANAG 1241) ... Unknown - An evaluated track which has not been identified. (STANAG 1241) ... Assumed friend - A track which is assumed to be a friend because of its characteristics, behavior, or origin. (STANAG 1241) ... Friend - A track belonging to a declared friendly nation. (STANAG 1241) ... Neutral - A track whose characteristics, behavior, origin or nationality indicate that it is neither supporting nor opposing friendly forces. (STANAG 1241) ... Suspect - A track which is potentially hostile because of its characteristics, behavior, origin or nationality. (STANAG 1241) ... Hostile - A track which is eligible to be engaged. (STANAG 1241)


### UasGroup = 1 | 2 | 3 | 4 | 5

- **App:** `src/model/types.ts; UasSpec.group across the seed threats`
- **Doctrinal term:** Unmanned Aircraft Systems Categorization Chart, Groups 1 through 5
- **Verdict:** MATCHES

The enum is the official partition. Defining parameters are maximum gross takeoff weight, normal operating altitude, and speed in KIAS. Two doctrinal details the app should carry: the altitude reference changes from AGL (Groups 1-2) to MSL (Groups 3-5), and the app's UasSpec.altBandFt has no AGL/MSL flag; and small UAS is a C-UAS term of art meaning Groups 1-3, not a group.


### engagement authority

- **App:** `NOT MODELLED. The app has one gate (Scenario.roe) standing in for identification, commit and engagement authority.`
- **Doctrinal term:** engagement authority; also identification authority and commit authority, which are three separate authorities
- **Verdict:** ABSENT_FROM_APP

Doctrine separates three authorities the app models as none. ID authority assigns the identity classification. Commit authority authorises assets to PREPARE to engage and explicitly does not imply engagement authority. Engagement authority permits the engagement decision. This is acceptable for a plan-view engine, but the vocabulary must not claim more than is modelled, and any C2 node in the app should be described in these terms.

> Engagement authority is an authority vested with a JFC that may be delegated to a subordinate commander that permits an engagement decision. The AMD authority with engagement authority is permitted to authorize engagement of an air or missile threat. For AMD engagements within the theater, the authority is normally delegated to the AADC who may further delegate the engagement authority to tactical levels (e.g., RADC/SADC). The degree of delegation must be consistent with the ROE, the DAL, and the inherent right of self-defense.


### sensor-to-shooter

- **App:** `not used in app source; commonly used in C-UAS trade vernacular and in the research brief`
- **Doctrinal term:** no doctrinal term. Doctrinal equivalents are the F2T2EA execution process and sensor networking / launch on remote / engage on remote.
- **Verdict:** NOT_DOCTRINAL

Full-text search for sensor-to-shooter and sensor to shooter returned ZERO hits across JP 3-01 (2017), JP 3-30 (2019), JP 3-60 (2007), FM 3-01 (2025), ATP 3-01.81 (2017), the DoD C-sUAS Strategy (2021) and CRS R48477 (2025). Doctrine uses sensors, shooters and C2 descriptively but never as a compound term. Recommend not using it as a UI label.

> The development of sensor networking and advanced engagement capabilities (e.g., launch on remote and engage on remote) have added complexity to the development of a sensor employment plan.


### kill chain (app definition: the Connection list; sim.killChainConnected accepts sensor to C2 to effector, or direct sensor to effector)

- **App:** `CLAUDE.md Domain semantics; src/playback/sim.ts`
- **Doctrinal term:** kill chain, in two distinct doctrinal senses
- **Verdict:** DIVERGES_FROM_BOTH_DOCTRINAL_SENSES

Doctrine uses kill chain in two senses: a sequence of ACTIONS (F2T2EA, JP 3-60) and a chain of AUTHORITIES, that is people (FM 3-01). The app uses a third sense: a materiel and data connectivity graph. The app sense is a legitimate engineering abstraction but it is not either doctrinal usage. Recommend one clarifying line in CLAUDE.md and the Inspector tooltip: materiel/data path, not the doctrinal engagement authorization chain (FM 3-01 para 2-6).

> Control of AMD engagements is executed through various personnel and agencies that collectively constitute the engagement authorities in the kill chain. ... The kill chain is the successive linkage of commanders who can authorize engagements of air and missile threats. The kill chain emanates from the joint force commander, who normally designates the AADC as the engagement authority. In joint operations, the kill chain is, in essence, a joint engagement authorization chain. In divisional and below operations, the kill chain consists of designated ADA commanders who control and direct SHORAD units in accordance with the promulgated ROE.


### kill web

- **App:** `not used in app source`
- **Doctrinal term:** none
- **Verdict:** NOT_DOCTRINAL

Full-text search returned ZERO hits for kill web across JP 3-01 (2017), JP 3-30 (2019), JP 3-60 (2007), FM 3-01 (2025), ATP 3-01.81 (2017), the DoD C-sUAS Strategy (2021) and CRS R48477 (2025). It is JADC2 and service concept vocabulary, not an approved joint or Army doctrinal term in the publications retrieved. Recommend the app does not adopt it; if it must appear, label it explicitly as non-doctrinal concept vocabulary.

