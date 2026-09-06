# Research gaps

What the public record does not establish, and how the app treats it. A gap is
a deliberate output: an entry recorded here is one the inventory declines to
guess at.

## Command, control and fusion

### Northrop Grumman AiON

**Known:** Unveiled 15 May 2025 as Northrop's C-UAS C2 bid to replace FAAD C2, entered into the Defense Innovation Unit Forward C-UAS C2 solicitation of Dec 2024. Claims easy sensor and effector integration and swarm engagement management. Lost the competition to Anduril Lattice in Oct 2025.

**Unknown:** Whether AiON is fielded anywhere, with what sensors or effectors, or over what interfaces. The launch coverage is subscriber-gated and names none.

**Why:** Single-source, subscriber-gated trade coverage; no OEM datasheet found; the losing bid attracted no follow-up reporting.

**App treatment:** EXCLUDE as a model. Record in the FAAD C2 dossier as the incumbent's unsuccessful successor bid, so the Lattice succession reads as a competition outcome rather than a sole-source hand-off.

### SAPIENT (UK Dstl interface standard)

**Known:** Sensing for Asset Protection with Integrated Electronic Networked Technology. UK MOD C-UAS standard under the 2019 C-UAS Strategy. Exercised at NATO TIE21-TIE23 with 57 companies across 18 nations; at TIE23 it fed 12 different C2 applications and linked 17 autonomous sensor modules to 7 decision-making modules. DroneShield added SAPIENT across sensors in Oct 2025 and to DroneSentry-C2.

**Unknown:** Its NATO STANAG number and whether ratification has completed. Janes (Sep 2023) said a year-long ratification needing 14 nations would start in 2024; a Jun 2026 review still says NATO 'is currently evaluating the architecture for ratification'. No source gives a STANAG number.

**Why:** NATO standardisation records for in-progress agreements are not published in a form the open web indexes, and the trade coverage repeats the 2023 framing.

**App treatment:** Keep 'sapient' as a protocol slug only. Do NOT add a STANAG number anywhere in the data, and do not model SAPIENT as a system. It is an interface, and RangeBoard already treats it correctly.

### CAC2S (Common Aviation Command and Control System, USMC)

**Known:** General Dynamics Mission Systems; consolidates seven Marine Air Command and Control System functions; replacing 1960s-era MACCS equipment; fielding under way. Secondary sources describe MADIS and LMADIS as linked into the Marine C2 ecosystem through CAC2S.

**Unknown:** Whether CAC2S has any documented C-UAS-specific interface, and whether the MADIS-CAC2S link is a data interface or an organisational description. DOT&E coverage found is 2008-2011 and predates the C-UAS mission entirely.

**Why:** The GD product page and the congress.gov CRS report both refuse automated fetch; the MADIS-CAC2S claim appears only in aggregator prose without a primary citation.

**App treatment:** Do not add. Revisit only with a Marine Corps or DOT&E primary source that names a C-UAS interface. Adding it on aggregator prose would be the exact 'both sides exist, therefore they connect' error.

### NGC2 and Maven (named by Picogrid as target networks)

**Known:** Picogrid LAPIS lists NGC2 and Maven alongside TAK, FAAD C2 and Lattice as C2 networks it can integrate with.

**Unknown:** Whether either has a documented C-UAS C2 role of its own, what they ingest, and what they task.

**Why:** Not researched in this pass; web search budget exhausted before reaching them.

**App treatment:** No models. Note in the Picogrid dossier that its network list extends beyond what RangeBoard models.

### Palantir C-UAS C2

**Known:** Nothing established in this pass.

**Unknown:** Whether Palantir has any publicly documented C-UAS command-and-control product role.

**Why:** No search returned a Palantir C-UAS C2 product. Maven Smart System is a targeting and intelligence platform, not a C-UAS engagement C2, and no source connected it to a C-UAS kill chain.

**App treatment:** EXCLUDE. Do not add a Palantir node on the strength of general defence-software prominence.

### NATO ACCS and allied national C-UAS C2 (UK ORCUS, Leonardo Falcon Shield, etc.)

**Known:** SAPIENT is the NATO-track interface standard for C-UAS sensor-to-C2. Named SAPIENT prototype developers are Durham University, Create Technologies, AptCore and QinetiQ.

**Unknown:** Which allied national C-UAS C2 systems are fielded, and whether any has a documented relationship to a RangeBoard library system.

**Why:** Search budget exhausted before this line could be worked. The SAPIENT retrospective names trial participants, not production C2 systems.

**App treatment:** No models. Flag as the largest remaining coverage gap in this domain.

### Anduril Lattice CoT / TAK support

**Known:** Lattice exposes Entities, Tasks and Objects APIs over REST and gRPC, plus the Lattice SDK and Lattice Mesh with Go, Java, TypeScript and Python libraries.

**Unknown:** Whether Lattice implements Cursor-on-Target or connects to TAK. No Anduril source names either.

**Why:** Anduril's developer documentation lists only its own data models; the anduril.com Lattice C2 page returned no body content to the fetcher.

**App treatment:** Treat the existing 'cot-tak' slug on lib-lattice as unverified. It is load-bearing: the OPEN_STANDARDS shared-protocol fallback will manufacture 'probable' links from it.

### FAAD C2 'Anduril' sensor entry

**Known:** Northrop's FAAD C2 supported-technology list includes a bare 'Anduril' entry in the Sensors column.

**Unknown:** Which Anduril product. Sentry is the likely candidate given its tower role, but the OEM names no product.

**Why:** The OEM list is vendor-level for this one entry while being product-level for most others.

**App treatment:** Do not create a FAAD C2 to Anvil or Roadrunner edge from this. Sensor-side only, product unspecified.

### Human authorization requirement in C-UAS doctrine

**Known:** A Joint C-sUAS Office official stated 'you have to have a human within the decision cycle at some point to authorize the engagement'. Army writing describes an evolution toward 'human on the loop', where automation may act without preapproval under human oversight. Dedrone gates mitigation on legal authority.

**Unknown:** Whether any binding DoD policy requires a human in the loop for C-UAS engagement. Analysis of DoDD 3000.09 states no such requirement appears in that directive or any other DoD policy.

**Why:** The 2024 DoD Strategy for Countering Unmanned Systems is classified with only an unclassified fact sheet, which media.defense.gov refuses to serve to automated fetch.

**App treatment:** Do not encode a human-in-the-loop constraint as a system property on any C2 model. It is a posture setting, and RangeBoard already models posture with Roe ('hold' / 'tight' / 'free'), which is the right home for it.

## Directed energy

### DragonFire LDEW (UK, MBDA / Leonardo UK / QinetiQ / Dstl)

**Known:** 50 kW-class fibre-combined solid-state laser. GBP 316M order placed to fit a Royal Navy Type 45 destroyer by 2027, five years earlier than originally planned. Nov 2025 Hebrides Range trials shot down drones flying at up to 650 km/h and achieved a UK first in above-the-horizon track, target and engage. About GBP 10 per shot. Would be the first high-power laser in service with a European nation.

**Unknown:** Engagement range. The UK MOD, Dstl and MBDA publish trial results, accuracy and cost per shot but no engagement range. The system is line-of-sight and the range figure is treated as classified.

**Why:** UK MOD policy on LDEW performance disclosure. Accuracy claims ('hit a GBP 1 coin at a kilometre') are marksmanship statements, not engagement range, and must not be converted into one.

**App treatment:** OMIT for now. Every field except role and platform would be REPRESENTATIVE, and it is a shipboard naval system with limited relevance to a US land C-UAS T&E board. Revisit if MOD publishes an engagement envelope or if the Land DragonFire variant matures.

### IFPC-HEL 'Valkyrie' 300 kW (US Army, Lockheed Martin)

**Known:** 300 kW-class. Demonstrator delivered Sep 2022. OTA July 2023 worth up to $220.8M for four prototypes. GAO found integration 'more complex than the Army anticipated' and the program-office transition delayed with a possibility it would not occur. On 9 Mar 2026 the Army announced it would not transition IFPC-HEL to a program of record; successor effort is the Joint Laser Warfighting System (JLWS), an Army-Navy collaboration.

**Unknown:** Engagement range, dwell time, C-UAS-specific performance. Also whether any JLWS configuration has a C-UAS role.

**Why:** Never published, and the program is now terminated as a transition path.

**App treatment:** OMIT. Cancelled transition, primary target set was cruise missiles and artillery rather than small UAS, and no performance figure exists. Recorded here so the reason for omission is on the record.

### Mjolnir HPM (AFRL / Leidos)

**Known:** $26.9M AFRL contract awarded 24 Feb 2022 for a 'mature prototype' based on THOR, delivery targeted early 2024. Intended to extend THOR's range, increase power by about 50 percent, improve usability, be operationally deployable and exportable, and enable transition to a program of record.

**Unknown:** Whether the prototype was delivered, any test results, any performance figure, and current program status. Nothing found after 2024.

**Why:** No public status update located in this research pass.

**App treatment:** OMIT as a separate model. Record it in the lib-thor description as the follow-on so the card does not read as a dead end.

### ODIN (Optical Dazzling Interdictor, Navy)

**Known:** Fielded on eight US Navy destroyers. Counter-ISR dazzler role.

**Unknown:** Engagement range, and whether it has any hard-kill C-UAS role.

**Why:** Dazzle effect and range are not published.

**App treatment:** DO NOT ADD as effectorType 'de'. RangeBoard treats 'de' as a HARD KILL. ODIN is a sensor-effect dazzler; modelling it as 'de' would report kills that do not happen. There is no schema slot that represents 'defeats the seeker, not the airframe' - the closest honest slot is 'jammer' (soft kill), which is also wrong because ODIN is optical. Recommend EXCLUDE until the model supports a counter-sensor effect.

### Leonidas variants: Leonidas H2O, Leonidas VehicleKit (VK), Stryker-mounted Expeditionary

**Known:** H2O is a maritime interdiction variant (counter-USV, boat motors). The VehicleKit is the platform used in the Dec 2025 fibre-optic FPV defeat. Gen II claims more than double Gen I maximum effective range, about 30 percent power increase, high-density batteries, extra-long pulse widths, a high-duty burst mode for faster multi-target engagement, and advanced waveform and polarisation for increased lethality.

**Unknown:** Any absolute range figure for any variant. One H2O statement gives 'effective up to nearly 100 metres working at half power', which is a counter-boat-motor figure and must NOT be read across to the C-UAS mission.

**Why:** Epirus publishes relative improvements, never absolutes.

**App treatment:** Keep one Leonidas entry (lib-leonidas). Adding variants would multiply entries that all share the same unknown.

### USMC compact laser systems (CLaWS, JLTV-mounted directed energy)

**Known:** BlueHalo announced a USMC JLTV directed-energy integration.

**Unknown:** Power class, current program name, status and whether it survived the AV acquisition. The bluehalo.com source pages now 301-redirect to avinc.com and the specific releases are gone.

**Why:** Primary sources removed during the corporate transition; no replacement page found.

**App treatment:** OMIT. Cannot cite a live source for any value.

### German / other NATO HEL (Rheinmetall, MBDA Deutschland naval laser demonstrator)

**Known:** Nothing verified in this pass.

**Unknown:** Everything.

**Why:** NOT RESEARCHED. The session web-search budget was exhausted before this line item. This is a coverage gap in the research, not a conclusion that no such system exists.

**App treatment:** OMIT. Flagged so a follow-on pass knows this was never checked.

### Every HEL in this domain: single-shot Pk

**Known:** Nothing.

**Unknown:** No Pk figure is published for any HEL or HPM C-UAS system by any government or OEM source.

**Why:** Pk against a specific target class is the performance datum every operator withholds.

**App treatment:** Omit the pk field on all new models so the app's DEFAULT_PK type baselines apply (de 0.8, hpm 0.7). Recommend the same for lib-phel (currently 0.85) and lib-demshorad (currently 0.85).

### Every HEL in this domain: weather-degraded performance

**Known:** CRS states rain, fog and obscurants 'could potentially limit the range and beam quality' of HEL weapons. Iron Beam is publicly stated not to function effectively in low visibility, heavy cloud or inclement weather, with Iron Dome covering the all-weather case.

**Unknown:** Any quantified derate. No source gives a percentage or a degraded range for any system.

**Why:** Never published.

**App treatment:** The app's EnvironmentSpec carries precipitation ('clear' | 'rain' | 'fog') and derates radar, EO/IR and acoustic sensors. It does NOT derate effectors. A HEL in fog is the most weather-sensitive object on a C-UAS board and the engine currently ignores that. This is an ENGINE gap, not a data gap, and is worth raising separately: no defensible derate factor exists in the public record, so any implementation would need to be an explicitly labelled planning factor.

## EO/IR and acoustic

### Sky Fortress (Ukraine) acoustic node

**Known:** About 14,000 sensors deployed since 2022, third-generation custom hardware replacing the original cell-phone processors, $400-1,000 per unit, NATO funding committed for 15,000 more after demonstrations at Ramstein Air Base before 11 observer nations, Lithuania acquiring for 2026 deployment, Romania testing. Ukraine's acoustic networks track about 20% of all targets entering Ukrainian airspace on acoustic data alone. In one documented attack the network detected all 84 incoming drones and enabled 80 intercepts.

**Unknown:** Per-node detection range, bearing accuracy, coverage angle, node spacing, false-positive rate. All undisclosed. The one comparison table that tries lists Sky Fortress detection range as 'Network-dependent' and its false-positive rate as 'Not disclosed'.

**Why:** Wartime OPSEC. Sky Fortress publishes network-level outcomes, not sensor-level specifications, and every Western write-up inherits that.

**App treatment:** Do NOT create lib-skyfortress. Its whole identity as a SensorSpec would rest on an unknown detectRangeM, which the brief says is an EXCLUDE. Keep the generic lib-acoustic-picket as the representative stand-in (renamed to drop the false attribution) and use lib-zvook where a sourced number is needed.

### Sky Map (Sky Fortress company) C2 platform

**Known:** Reuters, 22 Apr 2026: the US military deployed Sky Map at Prince Sultan Air Base, Saudi Arabia, after attacks that destroyed aircraft and buildings; Ukrainian military officials arrived at the base to train US warfighters on it. Sky Map is 'a dashboard featuring maps and video feeds' that 'synthesises data from radars and sensors to detect incoming threats' and coordinates counter-drone engagements.

**Unknown:** Whether any acoustic SENSORS went to Prince Sultan with it. The Reuters text says only that the company 'deployed more than 10,000 acoustic sensors across Ukraine'; it does not place sensors at the base.

**Why:** The reporting is sourced anonymously and describes the software deployment only.

**App treatment:** OUT OF SCOPE FOR THIS AGENT: this is a C2 model, kind 'c2', not a sensor. Flagged for the C2 analyst. Important caution for whoever picks it up: do not let 'the US fielded Sky Fortress' become 'the US fielded Ukrainian acoustic sensors'. Only the C2 dashboard is evidenced.

### Chess Dynamics Hawkeye DS EO/IR tracker (AUDS)

**Known:** A long-range colour camera plus a high-sensitivity thermal imager with video tracking, used in AUDS to classify a radar-detected target. Chess quotes a 0-10 km C-UAS suite envelope for airport protection.

**Unknown:** Every range attributable to the EO/IR itself. The 10 km figure is a whole-system airport-protection envelope, driven by the Blighter radar, and reusing it as an EO/IR detection range would be exactly the range-type substitution the brief forbids.

**Why:** Chess Dynamics publishes capability marketing, not DRI tables.

**App treatment:** Investigated and dropped in favour of Spynel, which publishes a real DRI table under a stated standard. Revisit if a Chess datasheet with DRI figures surfaces.

### Scientific Applications and Research Associates (SARA), Battelle, Rheinmetall acoustic sensors

**Known:** Named in the tasking as candidates.

**Unknown:** Nothing usable was reached. No datasheet, program, or range figure for any of the three in an acoustic C-UAS role.

**Why:** The session's web-search budget was exhausted (200/200) before these could be worked; only WebFetch on already-surfaced URLs remained available.

**App treatment:** Not proposed. Left as an explicit gap for a follow-on pass rather than filled with a guess.

### EO/IR environmental derates in src/analysis/sensorEnv.ts

**Known:** The engine applies rain 0.6, fog 0.4, night 0.6 to eo-ir, sourced to the COURAGEOUS project.

**Unknown:** No OEM in this research publishes a quantified weather derate. Teledyne FLIR offers a fog filter and an optional Merlin ASX turbulence filter; HGH claims imaging 'in total darkness in any weather conditions' without qualification. Thermal crossover, sun angle and solar glare are not addressed by any source found.

**Why:** Weather derates are test data, and no vendor publishes theirs.

**App treatment:** Leave the COURAGEOUS factors as they are, they are honestly labelled as planning factors. One nuance worth recording: the night 0.6 factor is wrong for a cooled thermal sensor like the Spynel or the MX-GCS MWIR channel, which are night sensors by design; it is right for the visible channel. The engine has one factor per technology and cannot express that split.

### Acoustic wind and ambient-noise derates

**Known:** sensorEnv.ts applies 0.03 range loss per m/s of wind with a 0.4 floor, plus urban 0.85.

**Unknown:** No vendor publishes a wind curve. The one independent figure found is qualitative: 'severe degradation in wind above 5 m/s'.

**Why:** Acoustic propagation depends on wind shear, temperature gradient, terrain and background noise together; a single scalar cannot capture it and no one publishes the surface.

**App treatment:** The existing model is reasonable: at 5 m/s it gives 0.85, which reads as noticeable but not severe, so it may be slightly optimistic against the one source available. Not proposing a change without data. Recorded so the assumption is visible.

### Quiet-drone threat to all acoustic models

**Known:** An emerging class of low-noise drones is reported, with Israel's Aerosol G2 cited at 14.9 dB at one kilometre, effectively inaudible against ambient noise.

**Unknown:** How far this class has spread, and whether any fielded acoustic system has been tested against it.

**Why:** New and thinly reported.

**App treatment:** Not modeled. RangeBoard has no per-threat acoustic signature field, so a quiet threat cannot be expressed. Flagged as a structural limit: every acoustic range in the library implicitly assumes a conventionally noisy target.

## Electronic attack

### DroneShield DroneGun Mk4 / Mk3 / Tactical

**Known:** Widely procured handheld/portable directional jammers. Mk4: 3.2-3.37 kg, IP67, -20 to 55 C, startup under 3 s, over 1 hour active disruption on a NATO-standard battery, jams a wide range of ISM bands and GNSS, can disrupt control, navigation and video of multiple UAVs simultaneously. Documented jam outcome: vertical controlled landing on the spot, or return to the operator-controller or starting point.

**Unknown:** Effective/defeat range and beamwidth. DroneShield's own product page publishes no range figure, and Janes reported that 'the company declined to comment on the range and the RF jamming range of the DroneGun Mk4'. Simultaneous target count is claimed but never quantified.

**Why:** Deliberate OEM non-disclosure, confirmed by a Tier 3 source directly asking and being refused.

**App treatment:** NOT PROPOSED as a model. The board already carries two dismounted directional jammers (lib-dronebuster, and lib-pitbull if accepted), both in the same envelope, and a third with a wholly invented ring adds no analytical value. If the DroneGun family is later required for a specific customer question, add it as ADD_REPRESENTATIVE at the same 1000 m and 60 deg used for the other handhelds, clearly labelled.

### US Navy DRAKE (Drone Restricted Access using Known Electromagnetic Warfare), Northrop Grumman

**Known:** CRS-named Navy program of record derived from the JCREW counter-IED family. Backpack-worn, also usable on ship power, and Humvee-mounted in its earlier form. Delivers non-kinetic selective electronic attack against Group 1 drones; target set described as under 20 lb, below 1,200 ft, slower than 100 kt. Emits high-band and low-band to break the operator-to-UAV link.

**Unknown:** Every range. No jam range, no beamwidth, no Pk.

**Why:** No OEM datasheet is public; reporting is descriptive only.

**App treatment:** Not proposed. Functionally overlaps lib-modi (man-pack ECM of counter-IED lineage) with strictly less published data. Note for the QA pass: DRAKE's 1,200 ft is the TARGET altitude limit, not an effector ceiling, and it is very likely the origin of the 1200 ft values sitting in lib-dronebuster and lib-enforceair.

### Bal Chatri / Bal Chatri 2 (SOCOM-sponsored, Army dismounted)

**Known:** Appears on the JCO dismounted list with Modi, SmartShooter and Dronebuster, and was fielded to 1st Cavalry Division alongside Modi Smart Short and Dronebuster. CRS lists Bal Chatri 2 among dismounted solutions in the FY2025 request.

**Unknown:** n/a for this domain.

**Why:** n/a

**App treatment:** OUT OF SCOPE FOR THIS AGENT AND FOR THE EFFECTOR LIBRARY. Bal Chatri is a DETECTION and alert device, not a jammer. It belongs to the RF-sensor agent as kind 'sensor', sensorType 'rf'. Flagging so it is not mistakenly added as an effector because it appears in jammer company.

### MyDefence Wingman 103 / 105 RF sensor

**Known:** Passive RF detector, 200 MHz to 6 GHz, full 360 deg coverage, identifies drone threats in under 10 s at ranges up to 6 km, emits nothing detectable. It is the automatic-mode cue for the Pitbull jammer and half of the US Army Soldier Kit order.

**Unknown:** n/a for this domain.

**Why:** n/a

**App treatment:** RECOMMEND the RF-sensor agent add it (sensorType 'rf', role 'surveillance' or 'target-acquisition', detectRangeM 6000 with the 'up to' condition). Without it, lib-pitbull's documented automatic engagement mode cannot be drawn on the board, and its IntegrationProfile has to ship with an empty pairs array.

### Probability of kill (pk) for every EW effector in the library

**Known:** The RangeBoard attrition model needs a per-engagement probability, and five of the six jammer entries now carry one.

**Unknown:** There is no public Pk, defeat rate, or success-rate statistic for ANY of them: Modi II, Dronebuster, EnforceAir2, CUAEWS, NINJA, CORIAN, Pulsar or Pitbull. Not one vendor and no government document publishes one. The nearest thing found is MyDefence's undefined 'Jamming Ratio: Up to 80%', which is not a Pk.

**Why:** Jam effectiveness is target-, waveform-, geometry- and range-dependent, and the numbers that exist are test data, not marketing data.

**App treatment:** Every jammer pk in the library is a REPRESENTATIVE planning value and the UI should say so. The values used here (0.6 for protocol-specific and handheld effects, 0.65 for the fixed-site broadband systems) are internally consistent, not measured. A T&E user must be able to override them per scenario.

### What RF defeat does NOT work against

**Known:** Four documented immunity classes. (1) FIBER-GUIDED: NATO ACT states 'EW counter-UAS systems are ineffective against this type of drone' (RFIP-ACT-SACT-25-48, 30 Apr 2025). (2) INERTIAL / hardened GNSS-INS: the library's own lib-shahed136 and lib-geran4 already carry jamBehavior 'continue' on that basis. (3) OPTICAL / autonomous terminal guidance: no RF link and no GNSS to deny. (4) PROTOCOL-SPECIFIC LIMITS: RF-cyber takeover only works on airframes in the supported set, and CACI states its identification works by comparing signals 'to an unclassified library of known signals'.

**Unknown:** No public source quantifies the residual effect a jammer has on a frequency-agile or spread-spectrum link. SRC states the DF function 'focuses on advanced threats that utilize interference resistance technology, such as spread spectrum signals and rapid hop sequences', which is a DETECTION claim, not a defeat claim. Do not read it as one.

**App treatment:** src/analysis/sensorEnv.ts jammable() already excludes fiber, inertial and optical, which matches the public record. The remaining gap is that the model does not distinguish a GNSS-denial effector (works on navMode 'gps') from a link-takeover effector (needs 'rf-manual' or 'mixed'). See the lib-enforceair modelling flag.

### Regulatory and ROE constraints on RF defeat

**Known:** DoD mitigation authority is 10 U.S.C. 130i, which permits 'disrupting or seizing control of the aircraft' and the use of 'reasonable force', limited to defined 'covered facilities' (nuclear deterrence, missile defence, national security space, air defence, special operations, high-yield explosives, Major Range and Test Facility Bases, and others). Congress directed the Secretary of Defense to coordinate with the Secretary of Transportation and the FAA. CRS records the authority as set to expire 31 Dec 2026. Separately, the Communications Act (47 U.S.C. 301, 302a, 333) prohibits operating, marketing or selling devices that jam authorised radio communications, which is why domestic C-UAS jamming is a federal-authority activity rather than a commercial one.

**Unknown:** Post-2026 status of the 130i authority. The 2026 SAFER SKIES provisions reported to extend mitigation to trained state and local agencies were not verified against primary text within this task's budget.

**App treatment:** Not a spec field. Belongs on the T&E test card as a constraint: any RangeBoard scenario placing a jammer at a CONUS range must state the authority and the spectrum deconfliction it is running under. Note that a Major Range and Test Facility Base is explicitly a covered facility under 130i, which is directly relevant to this app's use case.

### European / NATO OEM effectors (Hensoldt Xpeller, Rheinmetall, Leonardo Falcon Shield effector element, Thales)

**Known:** All are real and relevant. Leonardo's NINJA-into-ORCUS integration is documented and is the strongest single NATO thread found.

**Unknown:** Not researched to this brief's evidence standard.

**Why:** This session's web-search budget was exhausted (200/200) before these could be worked. WebFetch remained available but a targeted search was needed to find the right primary pages.

**App treatment:** Open task. A follow-on pass should cover the Hensoldt Xpeller jammer element and the Leonardo Falcon Shield effector, since ORCUS/Falcon Shield is the one documented NATO host for a US system already proposed here (NINJA).

### US Army doctrine text (ATP 3-01.81, Counter-Unmanned Aircraft System, Aug 2023)

**Known:** Identified as the authoritative doctrine for C-UAS electronic attack, jam response, spectrum deconfliction and ROE.

**Unknown:** Its actual wording. Could not be retrieved: fas.org returned an empty body and armypubs.army.mil returned an HTML interstitial rather than the PDF.

**Why:** Retrieval failure, not absence of the source.

**App treatment:** The JamBehavior and deconfliction findings in this submission rest on OEM effect descriptions plus the NATO ACT statement, NOT on US doctrine. A follow-on pass should confirm them against ATP 3-01.81 before any of it is presented as doctrinal.

## System components (gap fill)

### SkyView MP (Verus Technology Group) on L-MADIS

**Known:** Multiple independent reports place a 'Skyview' or 'Skyview MP' on the L-MADIS sensor vehicle and describe it as a PASSIVE RF DETECTION system, not a C2. The War Zone: 'the CM262U electro-optical sensor turret, the RPS-42 radar, and the Skyview MP passive radio frequency detection system'. USNI Proceedings: 'a Skyview radio-frequency (RF) detection system... all controlled from a tablet in one of the UTVs'. Defense News 2019 lists the 'Skyview RF Detection system' among L-MADIS content. Verus Technology Group delivered SkyView-MP V2 units to USSOCOM and describes SkyView as 'a small, lightweight, mobile drone detection system that provides 360 degree detection capability for long range fact-of detection'.

**Unknown:** Detection range against any target class. One low-tier aggregator quotes 3,000 m for a 'Skyview MPV-3'; no vendor or government source supports it, so it is not used. Frequency coverage, bearing accuracy and the current fielded variant are also unknown.

**Why:** Verus publishes no specification sheet that could be reached in this session, and the L-MADIS reporting names the product without characterising it.

**App treatment:** DIRECT CORRECTION to the task premise: the brief suggested SkyView might be the L-MADIS C2 and that lib-skyview might be proposed as a c2 id. It is not a C2. Every source that characterises it calls it an RF detection system. No c2 model is proposed for it. It is a good candidate for the RF/ES domain agent as a sensor id lib-skyview, but only once a conditioned range exists. Until then L-MADIS in RangeBoard is radar plus EO/IR plus jammer, with the passive RF layer missing and flagged.

### The C2 software actually hosted on the MADIS Mk2 and the L-MADIS 'brain' vehicle

**Known:** The Mk2 is the section's engagement authority. The Navy's PM GBAD solicitation describes MADIS Increment 1 as focusing on 'the integration of command and control (C2) software with emerging and existing components integrated onto the Marine Corps JLTV HGC variant'. Reporting says the L-MADIS section is 'all controlled from a tablet in one of the UTVs'.

**Unknown:** The product name of that C2 software, and whether it has a data interface to CAC2S, FAAD C2 or anything else.

**Why:** The solicitation names no product; a DVIDS news search for 'MADIS CAC2S' returns zero results; congress.gov and the Marine Corps Concepts and Programs site both refused automated fetch in this session.

**App treatment:** lib-cac2s is used as the C2 node in sys-madis and sys-lmadis because it is the right service's air C2 and has a Tier 1 C-UAS-adjacent citation through MRIC. Its pair with lib-rps42 is authored as 'inferred' and its unknowns say plainly that no MADIS-to-CAC2S interface is published. Do not upgrade that pair without a Marine Corps or DOT&E primary source.

### XBAEU / Ku720-2 performance

**Known:** CRS names it as the M-LIDS Increment 2.1 radar. RTX calls it 'the scaled Ku720-2 XBAEU distributed, mobile sensing radar' and pairs it with KuRFS to 'deliver 360-degree, persistent detection, identification and tracking of airborne threats'. An RTX job posting confirms it is an active AESA programme with its own array electronics workstream.

**Unknown:** Every range. No detection, track, classification or instrumented range exists in public for XBAEU or for Ku720 in any variant. Band is implied by the Ku720 lineage but not stated. 'Distributed' is not explained, so the number of array units per vehicle is unknown.

**Why:** RTX's own KuRFS product page carries no numbers at all, and the only release naming XBAEU is a test-event announcement with no results data.

**App treatment:** lib-xbaeu ships as ADD_REPRESENTATIVE at 8000 m from SENSOR_ROLE_DEFAULT_RANGE_M['fire-control'], loudly labelled. If the reviewing standard is that no ring may be drawn without a sourced number, change it to EXCLUDE and hold sys-mlids-stryker: that is a legitimate outcome and the record is written so the switch costs nothing.

### Extended Range Sentry Tower as a C-UAS sensor

**Known:** 80-foot tower, modular long-range sensor head, Lattice-native, built for US Customs and Border Protection counter-intrusion, detection and classification of objects of interest to 7.5 miles (5+ miles autonomously), stated as 5mi/8km on the 2026 product page. It appears as a line item in the June 2026 Kuwait C-UAS arms-sale package.

**Unknown:** What is in the sensor head, and any range against a UAS target class.

**Why:** Anduril describes the head only as 'modular' and publishes ranges against ground objects of interest, which is the mission CBP bought it for.

**App treatment:** EXCLUDE, recorded as a full model record with recommendation EXCLUDE so the evidence is preserved. sys-anduril-site should drop its two XR components and build with lib-sentry-lr-fc, lib-pulsar and the existing lib-wisp / lib-spyglass.

### Anduril Sentry variants not researched

**Known:** The June 2026 arms-sale list also names Long Range Sentry Tower-82 Mobile and Maritime Sentry Towers; Anduril's page adds Standard Range (personnel and vehicles to 3.5 km), Cold Weather, Mobile Sentry, and gives Maritime as surface vessels beyond 15 km. Menace tactical operations centres are in the same package.

**Unknown:** Sensor fits and UAS-conditioned ranges for all of them. Note that the Standard Range 3.5 km figure is against personnel and vehicles and the Maritime 15 km figure is against surface vessels: neither is a UAS number.

**Why:** Out of scope for this task, which was given two Sentry ids.

**App treatment:** No models. If lib-sentry-lr82m or lib-sentry-maritime are wanted later, the same target-class trap applies: only the Long Range variant has a published drone figure.

### Leonardo DRS S3 vendor specification

**Known:** The S3 is named in a government-approved-for-public-release brochure as the RIwP turret's EO/IR, providing D/R/I and a built-in auto-tracker through kinetic engagements.

**Unknown:** Fields of view, focal lengths, sensor formats, stabilisation performance, turret traverse and elevation, and any DRI range table.

**Why:** leonardodrs.com returned HTTP 403 to every fetch attempt in this session.

**App treatment:** lib-drs-s3 ships on the brochure figure only. Re-verify against a Leonardo DRS datasheet before quoting the 2000 m figure as an S3 specification rather than an M-LIDS vehicle specification.

### CUAEWS DF detection range

**Known:** The find-fix-classify sequence is fully documented, including lines of bearing to both the UAS and its operator, and the physical emplacement is fully specified.

**Unknown:** Detection range, DF range, bearing accuracy. SRC publishes none.

**Why:** SRC's brochure is a capability document; the only range figures in it are the EW EFFECTS range (8 km), the EO/IR classification range (10 km) and the AN/TPQ-50 surveillance range (>35 km), none of which belong to the DF.

**App treatment:** lib-cuaews-df ships at 6000 m REPRESENTATIVE from the library's fielded passive-RF band, with the reason for rejecting SENSOR_ROLE_DEFAULT_RANGE_M['surveillance'] (20000 m) recorded in the provenance. The 8 km effects figure is explicitly ring-fenced.

### M-LIDS EW vehicle organic radar

**Known:** The brochure's EW vehicle list is FAAD C2, mission data recorder, secure comms, wired/wireless network, Weapon Finding CUAEWS and an M2 .50 cal. No radar appears.

**Unknown:** Whether the fielded EW vehicle carries a radar in 2026.

**Why:** The brochure is the only bill of materials found and it is undated in text.

**App treatment:** Not modelled. sys-mlids-section should keep the EW vehicle sensor-poor: CUAEWS DF is its only organic find capability, which is a real and interesting T&E constraint, not a data gap to paper over.

### CACI CM262 DRI ranges

**Known:** Full optical specification: EO 1280x720 with 35-264 mm, MWIR 1280x1024 with 15-300 mm, SWIR 640x512 with 40-400 mm, 1535 nm LRF to 16 km, 360 deg continuous azimuth, +90/-16 deg elevation, 16 kg.

**Unknown:** Detect, recognise and identify ranges against any target class.

**Why:** CACI's datasheet publishes optics rather than performance, which is normal for an export-controlled gimbal.

**App treatment:** 5000 m REPRESENTATIVE from the role-default table. The LRF's 16 km is recorded in provenance and explicitly marked not-a-detection-range, because it is the number most likely to be lifted by mistake.

### Primary-source access in this session

**Known:** Two Tier 1 documents were read directly and in full: the SRC LIDS Family of Systems brochure (PDF extracted locally) and the CACI CM262 datasheet. Anduril's Sentry page and XRST announcement, the GD Mission Systems CAC2S page and the RTX KuRFS page were read directly.

**Unknown:** congress.gov (CRS R48477), crsreports.congress.gov, dsca.mil, leonardodrs.com, breakingdefense.com and candp.marines.mil all refused automated fetch. CRS quotations here are relayed verbatim from the radar- and systems-domain agents' extracts of the same product, with one congress.gov index snippet independently confirming the XBAEU expansion.

**Why:** HTTP 403 / 404 responses to WebFetch and curl. The session's 200-call web search budget was already exhausted by earlier agents, so searching ran through the Brave and Mojeek HTML endpoints until both rate-limited.

**App treatment:** Every CRS-sourced claim in this file carries the relay note in its condition field. A reviewer with congress.gov access should spot-check three sentences: the L-MADIS component list, the Increment 2.1 XBAEU sentence, and the MRIC component list.

## Kinetic effectors

### Coyote Block 3 / 3NK

**Known:** Non-kinetic payload, recoverable and reusable, loiters and defeats drone swarms, can be recalled and redeployed. Army plans 700 Block 3 across FY2025-FY2029 against 6,000 Block 2. Demonstrated against multiple drone swarms in a US Army test reported February 2026. One independent reference describes the payload as high-power microwave.

**Unknown:** Range, altitude, endurance, effect radius, number of targets per sortie, and whether the payload is HPM or another non-kinetic mechanism. RTX confirms only 'non-kinetic'.

**Why:** RTX publishes no Block 3 performance data and the payload type is not officially stated.

**App treatment:** Do NOT add under the kinetic domain. Hand to the directed-energy / HPM agent as a candidate lib-coyote3nk with effectorType 'hpm'. If added, every number would be REPRESENTATIVE.

### Leonardo DRS RPS-40 radar

**Known:** Compact S-band AESA in the Multi-Mission Hemispheric Radar family, detection of low-flying aerial targets to 10 km, the organic sensor on EAGLS and used on the Stryker M-SHORAD.

**Unknown:** Track range, classification range, elevation coverage, resolution.

**Why:** Only a headline detection figure is published.

**App treatment:** Sensor gap, not mine. Recommend the sensor agent add lib-rps40 so lib-eagls can point at its real radar instead of the RPS-42 family proxy.

### Sentinel A3 / A4 radar and IBCS

**Known:** Sentinel A3 (AN/MPQ-64A3) was used in the September 2024 Enduring Shield intercept trials; Sentinel A4 is planned as the primary IFPC sensor; IBCS provides the fire control and engagement authority.

**Unknown:** Neither is modelled in the RangeBoard library, so lib-ifpc2 has no in-library fire-control or C2 to route through.

**Why:** Out of scope for the kinetic domain.

**App treatment:** Recommend the sensor agent add lib-sentinela4 and the C2 agent add lib-ibcs. Until then lib-ifpc2 carries guidance 'c2-cue' with no requiredC2 and only inferred pairs.

### NGSRI (Next Generation Short Range Interceptor)

**Known:** Competitive Stinger replacement. Lockheed Martin and Raytheon both under contract since September 2023. Lockheed first test fire announced 13 January 2026; Raytheon ballistic test February 2026 and a guided-missile demonstration from a soldier-portable Command Launch Assembly on 15 July 2026 that detected, tracked and intercepted Army-simulated aerial threats. Raytheon states the range is extended beyond current systems. Low-rate production expected 2028; CRS gives production by FY2028.

**Unknown:** Range, speed, altitude, seeker type, Pk, magazine. No winner selected. No numbers published by either competitor.

**Why:** Source selection is not complete and the designs are competition-sensitive.

**App treatment:** EXCLUDE. The system's identity rests entirely on an unpublished range claim ('beyond current systems'). Revisit after a down-select.

### XRC (extended-range counter-sUAS missile)

**Known:** CRS names it as a Stinger successor programme with greater range than Stinger.

**Unknown:** Everything else.

**Why:** Early programme, no public data.

**App treatment:** EXCLUDE.

### L3Harris VAMPIRE family (ground-launched APKWS)

**Known:** Four-round baseline launcher on HMMWV, 12-round Stalker XR, plus CASKET containerised, BAT tower, Black Wake USV, Dead Wing Apache and Killcode EW-only variants (announced 9 October 2025). Wescam MX-series EO/IR with laser designator. 14 systems delivered to Ukraine since 2023 with hundreds of drone shoot-downs, mainly Shahed-series. Family envelope stated as Group 1 (under 20 lb, below 1,200 ft, under 100 kt) through Group 3 (under 1,320 lb, to 18,000 ft, to 250 kt).

**Unknown:** Engagement range as distinct from the target-class envelope. The Group 1-3 figures describe what the TARGET can do, not what the weapon can reach.

**Why:** L3Harris publishes a target envelope, not a weapon envelope.

**App treatment:** Covered functionally by lib-eagls, which is the US-fielded ground-launched APKWS system with a documented magazine and organic radar. Add lib-vampire only if a distinct Ukraine-configuration entry is wanted; it would duplicate lib-eagls's rocket performance and add nothing but a different magazine count.

### AGR-20F FALCO (air-launched APKWS C-UAS)

**Known:** Fixed Wing, Air Launched, Counter-UAS Ordnance: APKWS II with a proximity fuze and reworked guidance for air targets. Primary anti-drone weapon for USAF jets in the Middle East. L3Harris awarded $48.5 M (to $98.3 M with options) for FALCO fuzes on 4 June 2026, deliveries to July 2027. BAE delivered its 100,000th APKWS kit in February 2026 and is adding an infrared seeker. UK trialled APKWS on Typhoon in March 2026.

**Unknown:** Not applicable to a plan-view ground laydown.

**Why:** It is an air-launched effector with no ground footprint.

**App treatment:** EXCLUDE from the effector library. RangeBoard places ground entities; an air-launched rocket has no fixed position to draw a ring around. Recorded here so the capability is not lost.

### Skyranger 35 (Rheinmetall)

**Known:** 35x228 mm KDG revolver cannon, effective range up to 4,000 m, airburst ammunition with a C-RAM capability, same modular sensor options as the 30.

**Unknown:** Ready rounds, orders, C-UAS-specific engagement data, in-service status in any NATO country.

**Why:** Far less publicly documented than the 30 and with no confirmed orders found.

**App treatment:** Hold. Add later if a NATO order is confirmed. lib-skyranger30 covers the family's C-UAS role today.

### Mistral 3, Starstreak, IRIS-T SLS/SLM, NASAMS with AMRAAM

**Known:** All are NATO short- or medium-range SAMs. Mistral 3 (8 km) and Stinger (5 km) appear as Skyranger 30 turret missile options. NASAMS and IRIS-T are widely reported in Ukraine against Russian air and OWA threats.

**Unknown:** A documented, dated C-UAS engagement with a stated engagement range against a UAS target, for any of them. Every range figure found is a weapon maximum against an aircraft.

**Why:** Search budget was exhausted before these could be run down to primary sources, and the ranges that are public are aircraft-target maxima, which the brief explicitly forbids substituting for a C-UAS engagement range.

**App treatment:** NOT ADDED. This is the largest remaining coverage gap in the kinetic domain. Recommend a follow-on pass with a fresh search budget, targeting a documented UAS engagement per system before any range is assigned.

### magazineSize unit definition (engine-wide)

**Known:** RangeBoard consumes magazineSize once per firing opportunity, so it behaves as a SHOT count. The existing gun entries use burst counts (XM914 30, LPWS 20, SMASH 24). The brief defines magazineSize as ready rounds or interceptors on one launcher.

**Unknown:** Which definition the project intends.

**Why:** The type comment says 'Rounds or interceptors carried', which reads as ready rounds, but the attrition model consumes one per engagement.

**App treatment:** Decide before merging. Interceptor entries are unaffected (one round = one engagement). Gun entries are affected: Skyranger 30 is delivered as 300 ready rounds per the brief, which is roughly 12-15 bursts. If the engine meaning is bursts, use 12 for Skyranger 30 and leave the existing gun entries alone.

## Radar

### Raytheon XBAEU (eXpeditionary Battlefield AESA External Unit)

**Known:** CRS R48477 (31 Mar 2025) names it as the radar on M-LIDS Increment 2.1, the single-Stryker consolidation the Army began in 2022, alongside the Moog RIwP turret, Coyote and SRC CUAEWS.

**Unknown:** Band, array geometry, coverage, every range figure, and whether it is a KuRFS derivative. RTX publishes nothing under this name.

**App treatment:** Do not model as a separate sensor. Record in the lib-kurfs program note so the M-LIDS Inc 2.1 configuration is not silently misattributed to KuRFS.

### RTX Ku-720 Mobile Sensing Radar

**Known:** Referenced in trade reporting as the mobile 360 deg Ku-band radar deployed with M-LIDS and as the DE M-SHORAD onboard radar; the library already mentions it inside the lib-kurfs to lib-demshorad note.

**Unknown:** No published coverage, range or resolution figures.

**App treatment:** Leave as a note on lib-kurfs and lib-demshorad. Not modellable.

### Fortem TrueView R30 / R20

**Known:** K-band true AESA, 256 receive elements, 16 digital channels, onboard GPU, links for 360 deg; R20i is the DroneHunter airborne radar.

**Unknown:** Every range and coverage figure. Radartutorial's specification table for the R30 is blank in every performance row.

**App treatment:** EXCLUDE until Fortem publishes a conditioned range.

### Weibel XENTA-C / XENTA-M (Denmark; Norwegian NOMADS with Kongsberg)

**Known:** X-band CW-FMCW AESA family explicitly built for LSS C-UAS; XENTA-M for SHORAD, XENTA-C for C-UAS; a DJI Phantom 4 tracked at 3 km in central Oslo; delivered to Kongsberg for NOMADS.

**Unknown:** Could not read either the XENTA-C brochure or the XENTA SHORAD/C-UAS white paper (server refused the fetch and returned HTML in place of the PDF), so no variant-level coverage or range table is in hand.

**App treatment:** Strong candidate for a later pass. Not added, because the only range figure I hold is a single anecdotal urban track, not a specification.

### IAI ELTA ELM-2026 family (Drone Guard)

**Known:** X-band pulse-Doppler solid-state ESA rotating for 360 deg, digital beamforming, track-while-scan of more than 100 targets; variants D/B/BF quoted at 10 / 15 / 20 km in secondary sources; in service with several NATO armies.

**Unknown:** IAI's own product page gives no detection range and no RCS condition, so the 10/15/20 km tier figures cannot be tied to a target class.

**App treatment:** Excluded from this pass. Adding it would mean presenting an unconditioned tier figure as a small-UAS range.

### Magos SR-500 / AR-300

**Known:** C-band MIMO perimeter radar, 120 deg azimuth, 30 deg elevation, 0.4 m range resolution.

**Unknown:** Nothing military. Its published drone range is about 100 m.

**App treatment:** Out of scope. It is a perimeter intrusion sensor, not a C-UAS radar at any tactically useful range.

### DOT&E primary sources

**Known:** DOT&E publishes annual Sentinel A4 and G/ATOR assessments that would be the best available evidence for both systems.

**Unknown:** dote.osd.mil returned HTTP 403 to every direct fetch in this session; only search-engine extracts of the FY2023 Sentinel A4 report were readable.

**App treatment:** Sentinel A4 mission-set provenance is marked VERIFIED but flagged as read through a search extract, not a direct fetch. Re-verify before publishing anything downstream.

### Small-UAS detection ranges for large multi-mission radars generally

**Known:** Sentinel A4, G/ATOR, GM200 MM/C and AN/TPQ-53 all have documented UAS missions.

**Unknown:** None of the four has any published detection range conditioned on a UAS class. The public figures are instrumented ranges or counterfire ranges against completely different targets.

**App treatment:** All four ship with role-default REPRESENTATIVE rings and an explicit 'no public small-UAS range' line in the description. Never promote an instrumented range into a detect ring.

## Passive RF / electronic support

### CACI SkyValor (trailer) and BEAM (backpackable)

**Known:** JIATF-401 awarded CACI a three-year IDIQ worth up to USD 500m on 28 Jul 2026, first task order USD 25m, after operational evaluation at MCAS Yuma. SkyValor uses 'radio frequency sensing and artificial intelligence-enabled electronic warfare'. BEAM is described by JIATF-401 as a 'low size, weight and power system with radio frequency and direction' capability.

**Unknown:** Any conditioned detection range. The only figure in the record is 'more than 40 miles away in some cases' for automated sense-and-shoot, which mixes sensing with engagement and carries no target class, no emitter type and no EM background.

**Why:** The systems are new to the public record (Jul 2026) and CACI publishes capability sheets without performance numbers.

**App treatment:** EXCLUDE for now. A 64 km RF detection ring drawn from 'in some cases' would be the single most misleading object on the board. Revisit if a conditioned figure appears.

### AFRL NINJA (Negation of Improvised Non-state Joint Aerial-threats)

**Known:** Air Force-sponsored; one of three fixed/semi-fixed systems in the Jun 2020 JCO interim C-sUAS selection; works by disrupting the RF link between UAS and operator.

**Unknown:** Detection range, DF or geolocation capability, frequency coverage, node count, whether its sensing element is separable from its defeat element, current fielding status.

**Why:** No manufacturer datasheet is public and the JCO announcement gave acronyms only.

**App treatment:** EXCLUDE. Its identity as a SENSOR rests entirely on unknowns; what is documented is the defeat function, which belongs to the effector domain.

### SkySafe

**Known:** Passive RF only; 'passively analyzes the communication link between the drone and its controller', classifies type, reconstructs flight paths, identifies manufacturer and model, and localizes the operator. Customers include the Department of the Navy and SOCOM. Partnered with Fortem Technologies (radar) Oct 2024.

**Unknown:** Every range figure. No detection, DF, geolocation or protocol-ID range is published in any condition. Node count for operator localization is not published.

**Why:** SkySafe sells a subscription airspace-intelligence service rather than a boxed sensor, so it markets outcomes, not ranges.

**App treatment:** EXCLUDE. Strong programmatic evidence, zero performance evidence. Its whole identity on a range-ring board rests on the unknown, so the brief's own rule applies.

### Aaronia AARTOS DDS

**Known:** German; passive RF DF with an 8-sector antenna, 360 deg azimuth, claimed 4-6 deg tracking accuracy; markets real-time monitoring across 700 MHz - 6 GHz and emitter detection 400 MHz - 8 GHz.

**Unknown:** Which range figure is real. Aaronia's own materials variously claim 'passive RF detection range of up to 14 km', 'up to 100 km ... for Military UxS' and '40 km for consumer grade drones', with no target, no emitter power and no EM background attached to any of them.

**Why:** The claims are marketing spans across an unstated product configuration set. They differ by a factor of seven with no stated condition.

**App treatment:** EXCLUDE. Evidence rule 8 says record conflicting sources with their conditions and never average — here there are no conditions to record, so there is nothing to ship. A 100 km passive RF ring on a C-UAS board would be indefensible.

### Hensoldt Xpeller (RF element)

**Known:** Modular German C-UAV family combining Hensoldt radars, IR cameras and jammers with 'close-in RF detectors from Danish partner company myDefence'. JED's 2019 survey lists Xpeller DF output as 'Sector, LOB or Position'.

**Unknown:** Xpeller's RF element has no separate published range, and the RF detector is a MyDefence product, so a distinct Xpeller RF model would duplicate lib-wingman.

**Why:** Xpeller is sold as a configured system, not as a component with its own datasheet.

**App treatment:** EXCLUDE as a model; captured instead as integration evidence on lib-wingman (Xpeller uses MyDefence close-in RF detectors).

### Dedrone RF-160

**Known:** Newer sibling of the RF-360 already in the library. Dedrone state 'Long-range drone detection (up to 5 km) and early-warning', integrated LTE and GPS. Trade reporting adds 'average detection range of 1.6 km, and under ideal conditions, up to 5 km for certain drones'.

**Unknown:** Whether the RF-160 direction-finds at all (the RF-360 datasheet names AoA; the RF-160 page does not), coverage angle, frequency bands.

**Why:** Dedrone's current RF-160 page is a marketing page and the downloadable datasheet was not reachable.

**App treatment:** EXCLUDE as a near-duplicate of lib-rf360. Adding a second Dedrone RF sensor whose distinguishing capability is unverified would add clutter, not coverage. Revisit if the RF-160 datasheet becomes reachable.

### Remote ID receiver systems in a C-UAS role

**Known:** DroneShield's RfRecon DF Kit 'detects Remote ID (Wi-Fi and Bluetooth), custom protocols, RF signals, broadcasts, and AIS/ADS-B' and weighs ~8.8 kg. Remote ID reception is a distinct sensing mode from control-link interception.

**Unknown:** No Remote ID reception range is published by any vendor found. Remote ID is also cooperative: a hostile UAS simply does not broadcast it, so reception range is close to irrelevant against a threat.

**Why:** Vendors treat Remote ID as a compliance feature, not a performance-specified sensor mode.

**App treatment:** EXCLUDE. No model, no field. Recorded here so the team knows the Remote-ID branch of the tasking was searched and came back empty. Every remote_id_reception_range_m in this file is null and that is a finding, not an omission.

### Fiber-optic FPV detection (the negative-space gap for this whole domain)

**Known:** NATO Allied Command Transformation issued RFIP-ACT-SACT-25-48 on 30 Apr 2025 seeking fiber-optic FPV detection at 300 m threshold and 500 m objective in open terrain, stating 'EW counter-UAS systems are ineffective against this type of drone' and citing 'the combination of high maneuverability, jamming immunity, and low visual and radar signature'.

**Unknown:** No fielded passive RF answer exists, because there is no emission to receive. The required ranges NATO is asking for (300-500 m) are one to two orders of magnitude shorter than any RF ring in this file.

**Why:** Physics, not secrecy.

**App treatment:** No model. This is the limitation to carry on EVERY RF entry. RangeBoard already enforces it correctly in src/analysis/sensorEnv.ts rfDetectable(): only navMode 'rf-manual' and 'mixed' are held. A planner who fills the board with RF rings and runs lib-fpv-fiber against them should see near-total leakage, and that is the correct answer, not a bug.

## Systems researched and excluded

- **lib-ehel** (Enduring High Energy Laser (E-HEL)): Pre-award program: no vendor, no published power class, no published range. Its only documented integration is a requirement in an RFI, not an interface that exists.
- **lib-sentry-xr** (Extended Range Sentry Tower (XRST)): Sensor head contents undisclosed, so the single sensorType cannot be chosen on evidence; every published range is against ground objects for border counter-intrusion.
- **lib-anvilm** (Anduril Anvil-M): Every board-drawable field is copied from the shipped lib-anvil, and the one differential (pk 0.85) is invented. Two indistinguishable rings under two names.
- **lib-ifpc2** (Indirect Fire Protection Capability Increment 2 (Enduring Shield)): maxRangeM 15000 is a self-declared placeholder identical to the shipped Coyote and Roadrunner rings, so the medium-range entry draws the existing short-range tier.
- **lib-truviewr30** (Fortem TrueView R30 radar): Researcher EXCLUDE, red-team concurred: no record delivered.
