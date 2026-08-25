# Inventory provenance

Per-field evidence for every model added to `src/model/seedLibrary.ts` in the
August 2026 C-UAS inventory expansion. 41 models.

Read this alongside `gaps.md` (what the public record does not establish) and
`changelog.md` (what changed and why).

## How to read a value

Every number carries a **range type**, a **condition**, and a **grade**. The
range type matters: a detection range, an instrumented range, a track range and
an effective engagement range are different quantities and are never
substituted for one another here.

| Grade | Meaning |
| --- | --- |
| VERIFIED | authoritative documentation |
| CORROBORATED | two or more credible independent sources |
| REPORTED | credible single reporting |
| MANUFACTURER_CLAIM | OEM datasheet or product page |
| INFERRED | reasonable but not documented |
| UNKNOWN | no public evidence |

**Layer** separates what is known from what is drawn for the board:

- **L1** the public value, with its condition recorded.
- **REPRESENTATIVE / L2** no public value exists. The board needs a ring, so the
  entry carries a planning figure whose basis is stated. It is not measured
  performance and must never be cited as such.
- **L3** left to the user: the field is `null` and the app draws nothing.


## Command, control and fusion

### `lib-ibcs` IBCS battle command (Northrop Grumman)

- **Manufacturer:** Northrop Grumman
- **Country:** United States
- **Operators:** US Army, Poland
- **Program:** Army Integrated Air and Missile Defense (AIAMD) modernization; IBCS Maneuver (IBCS-M)
- **Status:** CURRENT
- **Mobility:** mobile
- **UAS groups:** 1, 2, 3

| Field | Value | Range type / condition | Grade | Layer | Source |
| --- | --- | --- | --- | --- | --- |
| `spec_model.description` | fielded, network-enabled MOSA C2; fuses networked sensor data into fire-control-quality tracks over the IFCN; 'plug-and-fight' kit adapts sensors and weapons | OEM overview document, quoted verbatim | MANUFACTURER_CLAIM | L1 | [IBCS - Transforming Integrated Air and Missile Defense (Northrop Grumman overview)](https://cdn.northropgrumman.com/-/media/Project/Northrop-Grumman/ngc/what-we-do/land/ibcs/Northrop-Grumman_IBCS-Overview-1.pdf), 2023 |
| `status` | CURRENT | OEM statement; corroborated by trade press reporting of FRP approval | CORROBORATED | L1 | [IBCS - Transforming Integrated Air and Missile Defense; army-technology IBCS project page](https://www.army-technology.com/projects/integrated-battle-command-system-ibcs-usa/), 2023 |
| `uas_groups / C-UAS role` | documented C-UAS engagement | White Sands Missile Range flight test, December 2024 | CORROBORATED | L1 | [US Army's IBCS Defeats Fast-Moving Drone, Missile Targets in Recent Trial](https://thedefensepost.com/2024/12/11/us-army-ibcs-trial/), 2024-12-11 |
| `integration_profile.protocols` | link-16 | Only Link 16 and MADL are publicly named. MADL has no RangeBoard slug; no CoT, SAPIENT or JREAP claim is made here. | REPORTED | L1 | [Bringing powerful battlespace capabilities to bear through the unified C2 of IBCS](https://breakingdefense.com/2023/04/bringing-powerful-battlespace-capabilities-to-bear-through-the-unified-c2-of-ibcs/), 2023-04 |
| `integration_profile.media` | fiber,cable,mesh-radio | OEM overview. RangeBoard has no satellite medium; satellite bearer is recorded here but not modelled. | MANUFACTURER_CLAIM | L1 | [IBCS - Transforming Integrated Air and Missile Defense (Northrop Grumman overview)](https://cdn.northropgrumman.com/-/media/Project/Northrop-Grumman/ngc/what-we-do/land/ibcs/Northrop-Grumman_IBCS-Overview-1.pdf), 2023 |

**Not established by the public record:** Which C-UAS sensors and effectors in the RangeBoard library IBCS is documented to ingest or task. The published integration list (Patriot, Sentinel A4, LTAMDS, IFPC, ALPS, RIG-360, F-35, CAMM, Giraffe) contains no RangeBoard library id. Whether IBCS-M is a distinct fielded configuration or a Lattice-hosted fire-control layer inside IBCS. Public reporting uses both framings. Whether IBCS supports CoT, SAPIENT or JREAP. Only Link 16 and MADL are publicly named.

### `lib-adsi` ADSI data link gateway (Ultra)

- **Manufacturer:** Ultra Intelligence & Communications (Ultra I&C)
- **Country:** United States
- **Operators:** US Army, US Navy, US Air Force, US Marine Corps, 35+ partner nations
- **Program:** DoD C-sUAS C2 selection (FAAD C2-interoperable), 2020; continuous ATO 2024
- **Status:** CURRENT
- **Mobility:** fixed
- **UAS groups:** 1, 2, 3

| Field | Value | Range type / condition | Grade | Layer | Source |
| --- | --- | --- | --- | --- | --- |
| `spec_model.description` | joint-certified tactical data link forwarding and control | OEM datasheet, quoted verbatim. Note the word is FORWARDING, not fusion. | MANUFACTURER_CLAIM | L1 | [Air Defense Systems Integrator ADSI datasheet (1003.6-I&C-en-REV0723)](https://www.ultra-ic.com/media/ceadli11/adsi-datasheet-0723.pdf), 2023-07 |
| `integration_profile.protocols` | link-16,faad-c2,cot-tak | OEM datasheet interface list. Link 16 = MIL-STD-6016; FAAD data link and CoT are each named explicitly, so neither is an assumption. | MANUFACTURER_CLAIM | L1 | [Air Defense Systems Integrator ADSI datasheet (1003.6-I&C-en-REV0723)](https://www.ultra-ic.com/media/ceadli11/adsi-datasheet-0723.pdf), 2023-07 |
| `capacity (recorded only, not a RangeBoard field)` | 16000 tracks (16000 tracks) | track capacity — manufacturer-stated, with 32 simultaneous reconfigurable data links | MANUFACTURER_CLAIM | L1 | [Air Defense Systems Integrator ADSI datasheet](https://www.ultra-ic.com/media/ceadli11/adsi-datasheet-0723.pdf), 2023-07 |
| `status / fielding` | CURRENT | Trade reporting quoting Ultra I&C, Dec 2024. The 2023 datasheet gives 'more than 2,000 ADSI products installed worldwide'. | REPORTED | L1 | [DoD authorizes first C2 gateway to modernize and update on its own for CJADC2](https://breakingdefense.com/2024/12/dod-authorizes-first-c2-gateway-to-modernize-and-update-on-its-own-for-cjadc2/), 2024-12 |
| `C-sUAS designation` | named in the 2020 DoD C-sUAS C2 selection as FAAD C2-interoperable | US Army announcement of the interim C-sUAS selections, June 2020, as reproduced by secondary outlets (army.mil returns 403 to automated fetch) | VERIFIED | L1 | [Army announces selection of interim C-sUAS systems (army.mil), reproduced by AOFS](https://www.aofs.org/2020/07/05/us-army-selects-future-counter-uav-systems/), 2020-06-25 |

**Not established by the public record:** Which service sponsored ADSI in the 2020 JCO C2 selection. One reproduction of the Army release attributes ADSI to the Air Force and MEDUSA to the Marine Corps; Breaking Defense reports the reverse. Not resolved. Whether ADSI is still carried on the JIATF-401 C-UAS C2 list after the JCO was disestablished in 2025. Whether ADSI performs multi-source track fusion or only correlation and forwarding. The datasheet says 'forwarding and control' and lists correlation under digital air control; it never claims fusion.

**Unresolved source conflict:**
- sponsoring service in the 2020 C-sUAS C2 selection: AOFS reproduction of army.mil release, 5 Jul 2020 gives ADSI = Air Force; MEDUSA = Marine Corps; Breaking Defense, 26 Jun 2020 gives ADSI = Marines; MEDUSA = Air Force. Secondary outlets reordered the parenthetical service attributions from the original release. MEDUSA = Air Force is independently corroborated by its Al Dhafra AB deployment with the 380th Expeditionary Security Forces Squadron. Resolution: UNRESOLVED.

### `lib-tak` TAK / CoT node (Team Awareness Kit)

- **Manufacturer:** US Army C5ISR Center TAK Product Center (government-owned), originated at Air Force Research Laboratory
- **Country:** United States
- **Operators:** US DoD, DHS, US and allied law enforcement, NATO partners
- **Program:** TAK Product Center, C5ISR Center (Army Futures Command / DEVCOM); supports 15 DoD programs of record
- **Status:** CURRENT
- **Mobility:** dismounted
- **UAS groups:** 1, 2, 3

| Field | Value | Range type / condition | Grade | Layer | Source |
| --- | --- | --- | --- | --- | --- |
| `spec_model.description (ownership and origin)` | government-owned, AFRL origin, managed by the C5ISR Center TAK Product Center | AFRL origin from trade guide (Feb 2024); Product Center and 15-programs figure from an army.mil article (Tier 1) surfaced in search; army.mil blocks automated fetch, so the quote is as returned by the search index. | CORROBORATED | L1 | [Defense Threat Reduction Agency transitions new situational awareness tool to C5ISR Center's TAK Product Center (army.mil); Tactical Awareness Kit (TAK): Ultimate Guide](https://www.army.mil/article/257450/defense_threat_reduction_agency_transitions_new_situational_awareness_communication_tool_to_c5isr_centers_tak_product_center), 2022 |
| `integration_profile.protocols` | cot-tak | CoT is the only protocol claimed. No Link 16, JREAP, SAPIENT or ASTERIX claim is made for TAK itself. | CORROBORATED | L1 | [Tactical Awareness Kit (TAK): Ultimate Guide; ATAK Integration (MyDefence)](https://www.offgridweb.com/gear/tactical-awareness-kit-tak-ultimate-guide/), 2024-02-01 |
| `role (forwarding, not fusion, no engagement authority)` | track forwarding and alerting only | No public source describes TAK fusing multi-sensor tracks or issuing engagement orders to an effector. Absence of a fire-control claim is recorded as a limit, not asserted as a capability. | REPORTED | L1 | [Tactical Awareness Kit (TAK): Ultimate Guide](https://www.offgridweb.com/gear/tactical-awareness-kit-tak-ultimate-guide/), 2024-02-01 |

**Not established by the public record:** Whether any TAK variant performs multi-sensor track fusion. Nothing public says it does; it is modelled here as forwarding only. Whether TAK is ever used to issue an engagement order in a fielded C-UAS kill chain. No public source shows this. The exact CoT schema version each C-UAS vendor implements, so interoperability at message level is assumed within CoT, not verified per pair.

### `lib-dronesentryc2` DroneSentry-C2 (DroneShield)

- **Manufacturer:** DroneShield
- **Country:** Australia
- **Operators:** US DoD units, NATO-flank European customer (undisclosed), Asia-Pacific military customer (undisclosed)
- **Program:** DroneShield DroneSentry layered defence
- **Status:** CURRENT
- **Mobility:** expeditionary
- **UAS groups:** 1, 2

| Field | Value | Range type / condition | Grade | Layer | Source |
| --- | --- | --- | --- | --- | --- |
| `spec_model.description (fusion engine and modalities)` | sensor-agnostic 3D fusion of RF, radar and optical, plus ADS-B | manufacturer product page and Oct 2025 release reporting | MANUFACTURER_CLAIM | L1 | [Counter-UAS Systems Software & Analytics (DroneShield)](https://www.droneshield.com/products-software), 2026 |
| `integration_profile.protocols (SAPIENT)` | sapient | DroneSentry-C2 Enterprise launch, 15 Oct 2025. Separately, the 4Q25 release (8 Oct 2025) added SAPIENT to DroneSentry-X Mk2 and RfPatrol Mk2 sensors. | MANUFACTURER_CLAIM | L1 | [DroneShield Launches DroneSentry-C2 Enterprise](https://www.droneshield.com/media/press-releases/droneshield-launches-dronesentry-c2-enterprise), 2025-10-15 |
| `integration_profile.protocols (CoT / TAK)` | cot-tak | Feb 2022 TAK integration announcement; Apr 2026 Q2 release. Products named in 2022: RfPatrol, RfOne, DroneSentry-X, DroneSentry-C2. | CORROBORATED | L1 | [DroneShield integrates C-UAS command and control platform with US DoD TAK system; DroneShield Q2 software release](https://www.unmannedairspace.info/counter-uas-systems-and-policies/droneshield-integrates-c-uas-command-and-control-platform-with-us-dod-tak-system/), 2022-02-01 |
| `third-party sensor interoperability` | Bosch,Echodyne,Leonardo DRS,RADA,Teledyne FLIR,Sentrycs,ADS-B | manufacturer product page listing, vendor-level not model-level | MANUFACTURER_CLAIM | L1 | [Counter-UAS Systems Software & Analytics (DroneShield)](https://www.droneshield.com/products-software), 2026 |

**Not established by the public record:** Whether DroneSentry-C2 has any FAAD C2 or Lattice interface. Neither is claimed by DroneShield and neither is claimed by Northrop or Anduril. Whether the SAPIENT support is sensor-side only or a full SAPIENT C2 role. The Oct 2025 sensor release and the Oct 2025 C2E release describe it differently. Which named US DoD units field DroneSentry-C2. DroneShield reports contract values and regions, not units.

**Unresolved source conflict:**
- scope of SAPIENT support: DroneShield 4Q25 release, 8 Oct 2025 gives SAPIENT added to DroneSentry-X Mk2 and RfPatrol Mk2 (sensors/effectors); DroneSentry-C2 Enterprise launch, 15 Oct 2025 gives the core DroneSentry-C2 offering updated with SAPIENT protocol compatibility. Two releases a week apart covering different parts of the same product family; both may be true. Resolution: UNRESOLVED.

### `lib-dedronetracker` DedroneTracker.AI C2 (Dedrone by Axon)

- **Manufacturer:** Dedrone by Axon
- **Country:** United States
- **Operators:** US federal government (unnamed), NATO member governments (unnamed), 35+ countries
- **Program:** Dedrone commercial airspace security; acquired by Axon Oct 2024
- **Status:** CURRENT
- **Mobility:** fixed
- **UAS groups:** 1, 2

| Field | Value | Range type / condition | Grade | Layer | Source |
| --- | --- | --- | --- | --- | --- |
| `spec_model.description (fusion and kill chain)` | sensor fusion, AI/ML threat prioritisation, autonomous interrogation and classification, mitigation from one interface | OEM launch release for version 6.0 | MANUFACTURER_CLAIM | L1 | [Dedrone Launches DedroneTracker.AI: AI-Driven Counterdrone C2 Platform](https://www.dedrone.com/press/dedrone-launches-dedronetracker-ai-the-ai-driven-command-and-control-platform-enabling-the-complete-counterdrone-kill-chain), 2023-07-12 |
| `human authorization` | mitigation gated on legal authority | OEM product page. This is a legal-authority gate, not a stated human-in-the-loop engineering constraint; the distinction is preserved. | MANUFACTURER_CLAIM | L1 | [DedroneTracker.AI drone detection software](https://www.dedrone.com/products/drone-detection-software), 2026 |
| `third-party sensor integrations` | Echodyne,FLIR,Robin Radar Systems,Axis Communications,Bosch | OEM product page; vendor-level, not model-level | MANUFACTURER_CLAIM | L1 | [DedroneTracker.AI drone detection software](https://www.dedrone.com/products/drone-detection-software), 2026 |
| `ownership` | Dedrone by Axon | corporate reporting | CORROBORATED | L1 | [Dedrone Holdings (corporate record)](https://en.wikipedia.org/wiki/Dedrone_Holdings), 2024-10 |

**Not established by the public record:** Whether DedroneTracker.AI supports CoT or TAK. Neither the launch release nor the current product page names it, and no third-party source confirms it. Which US federal agencies field it. The OEM says 'US federal government' and 'NATO member governments' without naming any. Which kinetic effectors it can task. 'Kinetic measures' is listed as a mitigation category with no named product.

## Directed energy

### `lib-amphel` AMP-HEL 20 kW laser (LOCUST on ISV)

- **Manufacturer:** AeroVironment (AV), BlueHalo (acquired by AeroVironment May 2025), General Motors Defense (ISV platform)
- **Country:** United States
- **Operators:** US Army (RCCTO prototypes)
- **Program:** US Army RCCTO AMP-HEL prototyping. Increment 1 = ISV. Increment 2 = JLTV with radar and C2.
- **Status:** DEMONSTRATED
- **Mobility:** vehicle
- **UAS groups:** 1, 2

| Field | Value | Range type / condition | Grade | Layer | Source |
| --- | --- | --- | --- | --- | --- |
| `effector.output_power (metadata, not a schema field)` | 20 kW (20 kW-class) | laser output power class — OEM-stated class, not a measured figure. NOT convertible to an engagement range. | MANUFACTURER_CLAIM | L1 | [AV Delivers First Two Multi-Purpose High Energy Laser Systems to U.S. Army](https://www.avinc.com/2025/09/03/av-delivers-first-two-multi-purpose-high-energy-laser-systems-to-u-s-army/), 2025-08-31 |
| `effector.maxRangeM` | 5000 m | effective engagement range — NO PUBLIC VALUE EXISTS. AV/BlueHalo publish LOCUST power, setup time and cost per shot but withhold engagement range. Representative value from SENSOR_ROLE_DEFAULT_RANGE_M['classification'] = 5000 m; explicitly NOT derived from the 20 kW figure. | UNKNOWN | REPRESENTATIVE | [AV Unveils LOCUST X3: Third-Generation Modular Directed Energy Weapon System (engagement range not specified)](https://www.avinc.com/2026/03/24/av-unveils-locust-x3-third-generation-modular-directed-energy-weapon-system/), 2026-03-24 |
| `effector.engageTimeS` | 15 s | dwell time to effect — NO PUBLIC VALUE. Dwell to effect varies with range, aspect and airframe. Representative value = app DE baseline (DEFAULT_SALVO_COOLDOWN_S.de = 15 s) and the existing library DE tier. | UNKNOWN | REPRESENTATIVE | RangeBoard src/playback/attrition.ts DEFAULT_SALVO_COOLDOWN_S, 2026-08-24 |
| `status / delivery` | two ISV-mounted prototypes delivered to Army RCCTO | program milestone — Increment 1. Two JLTV-mounted sets with radar and C2 stated for the following month (Oct 2025). | MANUFACTURER_CLAIM | L1 | [AV Delivers First Two Multi-Purpose High Energy Laser Systems to U.S. Army](https://www.avinc.com/2025/09/03/av-delivers-first-two-multi-purpose-high-energy-laser-systems-to-u-s-army/), 2025-08-31 |
| `program history` | $45.7M initial award to BlueHalo April 2023; later expanded ($76M prototype OTA reported) | contract — AMP-HEL prototype OTA, US Army RCCTO | CORROBORATED | L1 | [BlueHalo Awarded $76M Prototype Other Transaction Authority for Army AMP-HEL; Defense Daily 'Army Taps BlueHalo For ISV-Mounted 20KW Laser Prototyping Effort'](https://www.prnewswire.com/news-releases/bluehalo-awarded-76m-prototype-other-transaction-authority-for-army-amp-hel-multi-purpose-high-energy-laser-vehicle-program-301794064.html), 2023-04 |
| `weather constraint (description text)` | rain, fog and obscurants limit range and beam quality | environmental limitation — General to all HEL weapons, stated by CRS, not measured for AMP-HEL specifically. | VERIFIED | L1 | [CRS R46925, DoD Directed Energy Weapons: Background and Issues for Congress](https://www.everycrsreport.com/reports/R46925.html), 2024-07-11 |

**Not established by the public record:** Effective engagement range against any UAS group. Not published in any source found. Dwell time to effect. Single-shot Pk. Shots per charge / sustained-fire limit on ISV prime power. The ISV is a light vehicle; a 20 kW laser plus cooling is a real power constraint, but no duty-cycle figure is public. Whether the Increment 2 radar is an existing library type (RPS-42, KuRFS, EchoShield) or an AV-supplied unit. Engagement ceiling. Whether Group 3 is in the AMP-HEL target set. AV claims Group 1-3 for the later LOCUST X3 generation, not for AMP-HEL Increment 1.

### `lib-helios` HELIOS 60 kW shipboard laser

- **Manufacturer:** Lockheed Martin
- **Country:** United States
- **Operators:** US Navy (USS Preble, DDG 88)
- **Program:** US Navy Surface Navy Laser Weapon System Increment 1
- **Status:** DEMONSTRATED
- **Mobility:** fixed
- **UAS groups:** 1, 2, 3

| Field | Value | Range type / condition | Grade | Layer | Source |
| --- | --- | --- | --- | --- | --- |
| `output power class` | 60 kW (60 kW-class) | laser output power class — 60 kW-class with stated growth potential (120 kW per Navy budget material; 150 kW per Lockheed Martin commentary). NOT convertible to an engagement range. | CORROBORATED | L1 | [CRS R46925 / Navy budget material via CRS; TWZ 'USS Preble Used HELIOS Laser To Zap Four Drones'](https://www.twz.com/sea/uss-preble-used-helios-laser-to-zap-four-drones-in-expanding-testing), 2026-02-02 |
| `role` | counter-UAS, counter fast inshore attack craft, counter-ISR dazzle | mission — HELIOS is 'focused on rapid development and fielding of a 60 kW-class high-energy laser (with growth potential to 120 kW) and dazzler in an integrated weapon system for use in countering UAS, fast inshore attack craft, and ISR sensors.' | VERIFIED | L1 | [CRS, Navy Lasers, Railgun, and Gun-Launched Guided Projectile (R44175) / Navy budget material](https://www.congress.gov/crs_external_products/R/PDF/R44175/R44175.64.pdf), 2024 |
| `counter-UAS engagement record` | four UAS defeated in one at-sea counter-UAS demonstration | test event — Disclosed by the Lockheed Martin CEO on a quarterly earnings call and reported Feb 2026. A separate single-UAV engagement in FY2024 was reported in the DOT&E annual report published Jan 2025. | REPORTED | L1 | [USS Preble Used HELIOS Laser To Zap Four Drones In Expanding Testing; Navy Times / Naval News on the DOT&E FY2024 report](https://www.twz.com/sea/uss-preble-used-helios-laser-to-zap-four-drones-in-expanding-testing), 2026-02-02 |
| `magazine` | unlimited (magazineSize omitted) | magazine — 'Functionally unlimited, constrained only by power generation and cooling capacity.' No shot count exists, so magazineSize is correctly absent. | REPORTED | L1 | [USS Preble Used HELIOS Laser To Zap Four Drones In Expanding Testing](https://www.twz.com/sea/uss-preble-used-helios-laser-to-zap-four-drones-in-expanding-testing), 2026-02-02 |
| `effector.maxRangeM` | 5000 m | effective engagement range — NO PUBLIC VALUE. Reporting states only that the system is 'relatively short-range' because of atmospheric beam degradation and power demand at distance. Representative value from SENSOR_ROLE_DEFAULT_RANGE_M['classification'] = 5000 m; explicitly NOT derived from the 60 kW figure, and deliberately identical to the 20 kW AMP-HEL ring for that reason. | UNKNOWN | REPRESENTATIVE | [USS Preble Used HELIOS Laser To Zap Four Drones In Expanding Testing](https://www.twz.com/sea/uss-preble-used-helios-laser-to-zap-four-drones-in-expanding-testing), 2026-02-02 |
| `effector.sectorDeg` | null deg | azimuth coverage — OMITTED, which the schema reads as 360. This overstates a forward deckhouse mount whose arcs are certainly restricted by ship structure, but no public sector figure exists and inventing one would be worse. Recorded here as a known overstatement. | UNKNOWN | L3 | [TWZ 'Here's Our First Look At A HELIOS Laser-Armed Navy Destroyer'](https://www.twz.com/heres-our-first-look-at-a-helios-laser-armed-navy-destroyer), 2022 |
| `single-target constraint` | one target at a time | engagement capacity — 'A single laser can only engage one target at once.' The four-drone event was sequential, not simultaneous. This is exactly what the app models for 'de'. | REPORTED | L1 | [USS Preble Used HELIOS Laser To Zap Four Drones In Expanding Testing](https://www.twz.com/sea/uss-preble-used-helios-laser-to-zap-four-drones-in-expanding-testing), 2026-02-02 |

**Not established by the public record:** Effective engagement range against any target class. Dwell time to effect. Firing arcs / sectorDeg. Engagement ceiling. Sustained-fire limit imposed by DDG power and chilled-water capacity. Reporting flags this as the binding constraint but publishes no figure. Whether the designation AN/SEQ-4 applies. Sources found use Mk 5 Mod 0 only; AN/SEQ-4 was not confirmed and is NOT asserted here. Whether the dazzler mode has a separate, longer effective range than the hard-kill mode. Almost certainly yes physically, but no figure is public.

**Unresolved source conflict:**
- growth power class: CRS / Navy budget material gives growth potential to 120 kW; Lockheed Martin commentary via TWZ gives potential upgrade to 150 kW. Different vintages: 120 kW is the program-of-record growth objective, 150 kW an OEM aspiration. Resolution: UNRESOLVED.

### `lib-ironbeam` Iron Beam 100 kW laser (Rafael)

- **Manufacturer:** Rafael Advanced Defense Systems, Israeli Ministry of Defense DDR&D
- **Country:** Israel
- **Operators:** Israeli Air Force
- **Program:** Israeli MoD / Rafael laser air-defence layer, complementary to Iron Dome
- **Status:** CURRENT
- **Mobility:** fixed
- **UAS groups:** 1, 2, 3

| Field | Value | Range type / condition | Grade | Layer | Source |
| --- | --- | --- | --- | --- | --- |
| `effector.maxRangeM` | 10000 m (10 km) | effective engagement range — 'The Iron Beam can burn or fry objects at a range of around ten kilometers.' Approximate, condition not stated by the source but corroborating coverage attaches it to clear air. Range collapses in fog. See conflicts for a competing 7 km figure. | REPORTED | L1 | [Breaking Defense, 'Lasers in the field: Iron Beam clears last test before operational use' and 'Israel's new laser system goes active'](https://breakingdefense.com/2025/09/lasers-iron-beam-iron-dome-israel-pew-pew/), 2025-09-17 |
| `output power class` | 100 kW (100 kW) | laser output power class — Full-size Iron Beam described as a 450 mm aperture, 100 kW beam. NOT the basis for the range value above; the range value is independently published. | CORROBORATED | L1 | [Calcalist/Ctech and multiple Israeli defence outlets; Defense Update 'Iron Beam 450'](https://www.calcalistech.com/ctechnews/article/bjh9rzzvwx), 2025 |
| `effector.engageTimeS` | 5 s | dwell time to effect — An Israeli defence official said 'the interception takes seconds'. A separate lower-tier report gives about five seconds. Five is used as the representative reading of 'seconds'; it is target-dependent and not a published threshold. | REPORTED | REPRESENTATIVE | [Breaking Defense, 'Lasers in the field: Iron Beam clears last test before operational use'](https://breakingdefense.com/2025/09/lasers-iron-beam-iron-dome-israel-pew-pew/), 2025-09-17 |
| `status` | declared operational Sep 2025; first combat-ready system handed to the IDF 28 Dec 2025 | program milestone — Israeli MoD reported completion of 'an advanced series of operational tests, which lasted several weeks' against rockets, mortars and drones at a southern Israel range, Sep 2025. Handover ceremony 28 Dec 2025. 'Numerous additional systems already in production.' | VERIFIED | L1 | [Times of Israel, 'Laser-based Iron Beam interception system declared operational' and 'Defense Ministry hands IDF first combat-ready Iron Beam laser interception system'](https://www.timesofisrael.com/defense-ministry-hands-idf-first-combat-ready-iron-beam-laser-interception-system/), 2025-12-28 |
| `combat C-UAS record (lower-power variant)` | about 35 Hezbollah drones downed  (35 drones) | combat employment — Achieved by a LOWER-POWERED variant (reported as 'Lite Beam') operated by the IDF 946th Air Defense Battalion over northern Israel, NOT by the 100 kW Iron Beam. Do not attribute this record to the full-size system. | REPORTED | L1 | [Times of Israel, 'Laser-based Iron Beam interception system declared operational'](https://www.timesofisrael.com/laser-based-iron-beam-interception-system-declared-operational/), 2025-09-17 |
| `weather constraint` | does not function effectively in low visibility, heavy cloud cover or inclement weather | environmental limitation — Named as the system's primary weakness. Iron Dome Tamir interceptors cover the zero-visibility case. Breaking Defense adds that the design has 'been tailored to deal with atmospheric conditions that affect lasers, such as fog', which is a mitigation claim, not a removal of the limit. | CORROBORATED | L1 | [Times of Israel handover report; Breaking Defense Sep 2025](https://www.timesofisrael.com/defense-ministry-hands-idf-first-combat-ready-iron-beam-laser-interception-system/), 2025-12-28 |
| `mobility` | fixed / static emplacement | platform — 'Designed to remain stationary for periods of time, and cannot be fired while moving.' | REPORTED | L1 | [Calcalist/Ctech Iron Beam coverage](https://www.calcalistech.com/ctechnews/article/bjh9rzzvwx), 2025 |
| `magazine` | unlimited (magazineSize omitted) | magazine — 'As long as energy source remains constant, system never runs out of ammunition.' Marginal cost per interception estimated at less than several dollars. | VERIFIED | L1 | [Times of Israel handover report; Breaking Defense Sep 2025](https://www.timesofisrael.com/defense-ministry-hands-idf-first-combat-ready-iron-beam-laser-interception-system/), 2025-12-28 |

**Not established by the public record:** The condition attached to the ~10 km figure. No source states target class, target size, atmospheric visibility or Pk at that range. Degraded range in fog, rain or dust. Only qualitative statements exist. Engagement ceiling. Dwell time by target class. 'Seconds' is all that is public. Sector coverage of one emplacement. Number of systems delivered beyond the first. Whether the system has been used operationally since handover. Reporting through mid-2026 says integration is still in progress.

**Unresolved source conflict:**
- effective engagement range: Breaking Defense (Sep 2025, Dec 2025) gives about 10 km; Lower-tier aggregation citing 'destroy within five seconds at a range of up to 7 km' gives up to 7 km. 10 km is likely the maximum reach claim; 7 km may be the range at which a stated 5 s dwell holds. Different conditions, not different facts. Do not average. Resolution: UNRESOLVED.

## EO/IR and acoustic

### `lib-wisp` Wisp wide-area IR sensor (Anduril)

- **Manufacturer:** Anduril Industries
- **Country:** United States
- **Operators:** US Air Force (Air Force Test Center, Edwards AFB) - sole-source order Dec 2023, Washington National Guard (Counterdrug Program / 10th Civil Support Team) - fielded Aug 2026
- **Program:** Anduril Lattice C-UAS family; USAF AFTC perimeter security; National Guard domestic C-sUAS
- **Status:** CURRENT
- **Mobility:** fixed
- **UAS groups:** 1, 2, 3

| Field | Value | Range type / condition | Grade | Layer | Source |
| --- | --- | --- | --- | --- | --- |
| `sensor.detectRangeM` | 4800 m (about 3 to 10 miles) | automated UAV detection range — Trade-press figure for automated (unaided) UAV detection. Target size not stated; the 3-10 mile spread is not attributed to a target class. 4800 m is the LOW end of the stated band (3 mi = 4828 m), used as the conservative planning ring. The high end is 16000 m (10 mi = 16093 m). | REPORTED | L1 | [Anduril to use artificial intelligence (AI) and sensor fusion for IR-based counter-UAV perimeter security](https://www.militaryaerospace.com/computers/article/14303950/artificial-intelligence-ai-sensor-fusion-counter-uav), 2024-01-24 |
| `sensor.classifyRangeM` | 4800 m | classification range — No separate classification range is published. WISP is documented to 'detect, classify and continuously track drones while reducing false alarms generated by birds or environmental clutter' - the detection event IS the classifier output, so classification is modeled as available wherever detection is. Set equal to detectRangeM. | INFERRED | REPRESENTATIVE | [U.S. Deploys Anduril Counter-Drone System to Strengthen Homeland Defense Against Drone Threats](https://www.armyrecognition.com/news/army-news/2026/u-s-deploys-anduril-counter-drone-system-to-strengthen-homeland-defense-against-drone-threats), 2026-08 |
| `sensor.sectorDeg` | 360 deg (360 deg) | field of regard, azimuth — Stated sensor field of view is 360 deg horizontal by 125 deg vertical. Horizontal coverage is continuous and simultaneous (staring/persistent), not a slewed gimbal. | REPORTED | L1 | [Anduril to use artificial intelligence (AI) and sensor fusion for IR-based counter-UAV perimeter security](https://www.militaryaerospace.com/computers/article/14303950/artificial-intelligence-ai-sensor-fusion-counter-uav), 2024-01-24 |
| `sensor.elevationDeg` | null deg (125 deg (vertical FOV extent)) | field of view, elevation — The 125 deg vertical extent is published but the datum (how it is split above and below the horizon) is not. Writing [min,max] would require inventing the split, so the field stays null and the extent is recorded here. | UNKNOWN | L3 | [Anduril to use artificial intelligence (AI) and sensor fusion for IR-based counter-UAV perimeter security](https://www.militaryaerospace.com/computers/article/14303950/artificial-intelligence-ai-sensor-fusion-counter-uav), 2024-01-24 |
| `sensor.maxAltitudeFt` | null ft (commercial aircraft at 12,000 ft from about 93 miles ft / miles) | detection range, large manned aircraft — This is a DIFFERENT target class (airliner-sized, high thermal contrast) and must never be read as a small-UAS range. It shows coverage extends at least to 12,000 ft but no ceiling is published, so the field stays null. Recorded only; RangeBoard reads no altitude. | REPORTED | L3 | [Anduril to use artificial intelligence (AI) and sensor fusion for IR-based counter-UAV perimeter security](https://www.militaryaerospace.com/computers/article/14303950/artificial-intelligence-ai-sensor-fusion-counter-uav), 2024-01-24 |
| `cueing_relationship` | primary search sensor, NOT confirmation-only | n/a — Quoted: WISP 'serves as the primary sensing layer for identifying low, slow and small unmanned aircraft that are often difficult to detect using conventional air surveillance radars.' This directly contradicts RangeBoard's blanket EO/IR cue gate in src/playback/sim.ts:77. | REPORTED | L1 | [U.S. Deploys Anduril Counter-Drone System to Strengthen Homeland Defense Against Drone Threats](https://www.armyrecognition.com/news/army-news/2026/u-s-deploys-anduril-counter-drone-system-to-strengthen-homeland-defense-against-drone-threats), 2026-08 |
| `technology_basis` | Computational Pixel Imager (MIT Lincoln Laboratory), edge AI, passive IR | n/a — Available in several sophistication levels by lens type, wavelength and pixel format. Hundreds of WISP sensors reported deployed at domestic and foreign sites as of Feb 2024. Specific IR sub-band (MWIR vs LWIR) is NOT published. | REPORTED | L1 | [Anduril Says Its Sensor For Drones Can Track Hundreds Of Targets](https://www.forbes.com/sites/erictegler/2024/02/13/anduril-says-its-sensor-for-drones-can-track-hundreds-of-targets/), 2024-02-13 |

**Not established by the public record:** IR sub-band (MWIR vs LWIR vs SWIR) is not published. What drives the 3-10 mile spread (target size, weather, mounting height) is not stated. Frame rate, revisit rate and simultaneous track capacity for WISP specifically are not published. Elevation datum for the 125 deg vertical FOV. No published DRI (detection / recognition / identification) breakdown; only a single 'detection' figure exists. Slew rate is not applicable (staring sensor) but no dwell or revisit figure is published either.

**Unresolved source conflict:**
- sensor modalities inside WISP: Military & Aerospace Electronics, 2024-01-24 (and Anduril's own expansion of the acronym: Wide-Area Infrared Sensing with Persistence) gives passive infrared imaging only; Army Recognition, Aug 2026 gives 'WISP combines electro-optical imaging, passive radio frequency sensing and advanced software analytics'. The 2026 article likely folds the co-fielded Pulsar passive RF sensor into its WISP description; the same article separately names Pulsar as the RF sensor. Resolution: UNRESOLVED. Modeled as sensorType 'eo-ir' on the strength of the product name and the 2024 technical description..

### `lib-mxgcs` WESCAM MX-GCS EO/IR sight (L3Harris)

- **Manufacturer:** L3Harris Technologies (WESCAM)
- **Country:** United States / Canada
- **Operators:** US Army (SGT Stout M-SHORAD battalions)
- **Program:** US Army SGT Stout Maneuver-Short Range Air Defense (M-SHORAD) Mission Equipment Package; Leonardo DRS is the MEP integrator, General Dynamics Land Systems installs on the Stryker
- **Status:** CURRENT
- **Mobility:** vehicle
- **UAS groups:** 1, 2, 3

| Field | Value | Range type / condition | Grade | Layer | Source |
| --- | --- | --- | --- | --- | --- |
| `sensor.detectRangeM` | 8000 m | no published range of any type — L3Harris publishes NO detection, recognition, identification or tracking range for the MX-GCS. The only qualitative statement is that it can 'identify threats beyond the range of the vehicle's weapon system, allowing for standoff distance engagements at maximum effective ranges'. Planning value taken from the app's own role default table SENSOR_ROLE_DEFAULT_RANGE_M['fire-control'] = 8000 m. | UNKNOWN | REPRESENTATIVE | [WESCAM MX-GCS, Independent Stabilized Sighting Systems](https://www.l3harris.com/all-capabilities/wescam-mx-gcs-independent-stabilized-sighting-system), 2026-08-24 (accessed) |
| `sensor.classifyRangeM` | 5000 m | no published range — Planning value from SENSOR_ROLE_DEFAULT_RANGE_M['classification'] = 5000 m. Chosen because identification range is always shorter than detection range under DRI convention, and this keeps classify < detect. | UNKNOWN | REPRESENTATIVE | RangeBoard src/model/types.ts SENSOR_ROLE_DEFAULT_RANGE_M, 2026-08-24 |
| `sensor.sectorDeg` | 360 deg (360 deg) | field of regard, azimuth — Quoted: '360 degree scanning capability independent of the gun turret axis'. This is a SLEWED field of regard, not an instantaneous field of view; the instantaneous FOV is narrow and is not published. | MANUFACTURER_CLAIM | L1 | [WESCAM MX-GCS, Independent Stabilized Sighting Systems](https://www.l3harris.com/all-capabilities/wescam-mx-gcs-independent-stabilized-sighting-system), 2026-08-24 (accessed) |
| `spectral_bands` | cooled mid-wave IR (MWIR) large-format imager + HD daylight colour imager; day/IR image blending; haze penetration | n/a — Quoted: 'Mid-wave large-format cooled thermal imager' and 'High-Definition (HD) daylight imaging sensor'. No SWIR channel is listed. Pixel formats and exact wavelengths are not published. | MANUFACTURER_CLAIM | L1 | [WESCAM MX-GCS, Independent Stabilized Sighting Systems](https://www.l3harris.com/all-capabilities/wescam-mx-gcs-independent-stabilized-sighting-system), 2026-08-24 (accessed) |
| `laser_rangefinder` | present - eyesafe laser rangefinder, boresighted and stabilized with the imagers | n/a — LRF maximum range is not published. The gimbal 'stabilizes and steers the imager and rangefinder's line-of-sight in azimuth and elevation with high-accuracy gimbal position feedback for target handoff applications'. | MANUFACTURER_CLAIM | L1 | [WESCAM MX-GCS, Independent Stabilized Sighting Systems](https://www.l3harris.com/all-capabilities/wescam-mx-gcs-independent-stabilized-sighting-system), 2026-08-24 (accessed) |
| `platform_fit` | named component of the SGT Stout M-SHORAD Mission Equipment Package | n/a — The Leonardo DRS data sheet labels the platform diagram with 'MX-GCS EO/IR' alongside MHR radar, XM914 30 mm, M240 7.62 mm, Stinger, RIwP turret and IFF antenna. Same sheet: 'Detects, identifies and tracks air threats with on-board sensors providing 360 degree aerial surveillance' and 'Defeats smaller air threats (Group 1 and 2 UAS) at closer ranges with direct fire (as required)'. | VERIFIED | L1 | [PLATFORM LETHALITY - SGT STOUT Maneuver-Short Range Air Defense data sheet](https://cdn.leonardodrs.com/uploads/wp-content/uploads/2025/12/SGT-Stout-MSHORAD-data-sheet.pdf), 2025-12 |
| `cueing_relationship` | confirmation and fire-control after a radar cue - RangeBoard's model is CORRECT for this system | n/a — The MX-GCS is a narrow-FOV slewed gimbal co-mounted with the MHR radar, which provides the 360 deg aerial surveillance. Nothing in either source claims the MX-GCS searches independently. | CORROBORATED | L1 | [Leonardo DRS SGT Stout data sheet + L3Harris MX-GCS page](https://cdn.leonardodrs.com/uploads/wp-content/uploads/2025/12/SGT-Stout-MSHORAD-data-sheet.pdf), 2025-12 |

**Not established by the public record:** Every range: detection, recognition, identification and tracking. None published in any tier. Field of view (narrow and wide), slew rate, elevation limits. Laser rangefinder maximum range. Whether automatic target recognition runs on the MX-GCS itself or in the MEP fire-control software. The Aug 2026 Group 1-2 UAS defeat was achieved 'entirely through updates to detection and fire control software, without adding new hardware', which implies the ATR change was in the MEP, not the sight. Detector pixel format and exact MWIR band.

### `lib-spynel` Spynel-S 6000 panoramic IR (HGH)

- **Manufacturer:** HGH Infrared Systems
- **Country:** France
- **Program:** HGH commercial product line; Cyclope video-analytics suite. No named US or NATO C-UAS program of record found.
- **Status:** CURRENT
- **Mobility:** fixed
- **UAS groups:** 1, 2, 3

| Field | Value | Range type / condition | Grade | Layer | Source |
| --- | --- | --- | --- | --- | --- |
| `sensor.detectRangeM` | 5000 m (5 km) | small-drone detection range — Third-party C-UAS survey figure, model not specified within the Spynel family. HGH's own leaflet publishes NO UAS DRI number. Sanity bound: HGH's published HUMAN detection range for the Spynel-S 6000 is 6 km, so a 5 km small-drone figure sits below it and is not physically absurd. Do NOT treat 5000 as a manufacturer figure. | REPORTED | REPRESENTATIVE | [Counter-UAS 101 - Electro-Optical and Infrared Detection](https://drone-warfare.com/counter-uas/eo-ir-detection/), 2026-01 |
| `sensor.classifyRangeM` | 2000 m (2 km) | RECOGNITION range for a HUMAN target, used only as a bound — PROXY, NOT A UAS FIGURE. HGH publishes Spynel-S 6000 human recognition at 2 km (Johnson criterion, STANAG). No UAS recognition or identification range exists in any source. 2000 m is used as a representative classification ring because it is the OEM's own recognition figure for the smallest published target class, which bounds a Group 1 UAS from above. | MANUFACTURER_CLAIM (for the human figure) / INFERRED (as a UAS proxy) | REPRESENTATIVE | [SPYNEL SERIES Wide Area Surveillance Solutions leaflet](https://hgh-infrared.com/wp-content/uploads/2025/10/Leaflet_Spynel-Series_2025_LR.pdf), 2025-10 |
| `published_DRI_table` | Spynel-S 6000: human detection 6 km / human recognition 2 km; vehicle detection 10 km / vehicle recognition 4 km. Spynel-S 2000: human detection 1.5 km / recognition 500 m; vehicle detection 3.5 km / recognition 1.2 km. Spynel-X 8000: human detection 9 km / recognition 3.3 km; vehicle detection 12.5 km / recognition 6 km. km | detection and recognition ranges, ground targets — Leaflet footnote, quoted: 'DRI ranges according to Johnson criterium and STANAG standards. Range values represent optimal performance, which will vary depending on target size, clutter environment, atmospheric conditions and sensor operational settings.' All figures are prefixed 'Up to'. NO IDENTIFICATION range is published for any model, only Detection and Recognition. NO aerial-target figure is published. | MANUFACTURER_CLAIM | L1 | [SPYNEL SERIES Wide Area Surveillance Solutions leaflet](https://hgh-infrared.com/wp-content/uploads/2025/10/Leaflet_Spynel-Series_2025_LR.pdf), 2025-10 |
| `sensor.sectorDeg` | 360 deg (360 deg) | field of regard, azimuth — Spynel-S 6000 video size is 360 deg (H) x 5 deg (V), scan rate 0.5 Hz for 360 deg (one full panorama every 2 s), image resolution 46,000 (H) x 640 (V). The azimuth coverage is swept, not staring: any single target is revisited every 2 s. | MANUFACTURER_CLAIM | L1 | [SPYNEL SERIES Wide Area Surveillance Solutions leaflet](https://hgh-infrared.com/wp-content/uploads/2025/10/Leaflet_Spynel-Series_2025_LR.pdf), 2025-10 |
| `sensor.elevationDeg` | -45,45 deg (+/- 45 deg (vertical motorized tilt)) | field of REGARD, elevation — IMPORTANT DISTINCTION. The instantaneous vertical FIELD OF VIEW of the Spynel-S 6000 is only 5 deg. The +/- 45 deg figure is the motorized tilt limit, i.e. where that 5 deg band can be pointed. RangeBoard has one elevation field, so the field of regard is stored and the 5 deg instantaneous band is recorded here. The sensor cannot cover -45 to +45 simultaneously. | MANUFACTURER_CLAIM | L1 | [SPYNEL SERIES Wide Area Surveillance Solutions leaflet](https://hgh-infrared.com/wp-content/uploads/2025/10/Leaflet_Spynel-Series_2025_LR.pdf), 2025-10 |
| `detector_and_environment` | MWIR FPA 640 x 512, Stirling microcooler, IP66, -40 C to +71 C, under 40 kg, 385 x 580 mm, 24 V DC | n/a — Cooled mid-wave infrared. Because it is thermal, HGH claims 'day and night' and 'in total darkness in any weather conditions'. No fog, rain or thermal-crossover derate figure is published; treat the weather claim as marketing. | MANUFACTURER_CLAIM | L1 | [SPYNEL SERIES Wide Area Surveillance Solutions leaflet](https://hgh-infrared.com/wp-content/uploads/2025/10/Leaflet_Spynel-Series_2025_LR.pdf), 2025-10 |
| `laser_rangefinder` | optional | n/a — Units can be fitted with a visible channel, an eyesafe laser rangefinder, or both. LRF range not published. A 30x continuous optical zoom visible channel is offered for small flying objects. | MANUFACTURER_CLAIM | L1 | [Spynel S 360 deg Panoramic Thermal Camera product page](https://hgh-infrared.com/was/products/spynel-s/), 2026-08-24 (accessed) |
| `cueing_relationship` | primary search sensor, NOT confirmation-only | n/a — Quoted from the leaflet: 'passive wide-area surveillance systems for automatic intrusion detection, tracking and classification of an unlimited number of threats, coming from any direction (land, air or sea)' and 'Passive operation unlike radars (undetectable, no EM disturbance)'. Counter-UAS is a listed AIR application. Nothing states a radar cue is required. | MANUFACTURER_CLAIM | L1 | [SPYNEL SERIES Wide Area Surveillance Solutions leaflet](https://hgh-infrared.com/wp-content/uploads/2025/10/Leaflet_Spynel-Series_2025_LR.pdf), 2025-10 |

**Not established by the public record:** Any UAS-specific detection, recognition or identification range from HGH. Identification range for any target class: HGH publishes D and R only, never I. US or NATO operator, program or contract. A Camp Roberts demonstration against Class I and II UAVs of 2-55 lb is referenced by a third-party survey but I could not reach a primary account of it, so it is NOT counted as evidence here. Any documented integration with a C2 or effector in the RangeBoard library. Rain, fog and thermal-crossover derates. The leaflet claims all-weather without qualification.

**Unresolved source conflict:**
- Spynel-X coverage diameter: HGH web copy (search snippet) gives 18 km diameter for early human intrusion detection; HGH web copy (search snippet, other page) gives 16 km diameter. Different Spynel-X variants (X 8000 vs X 6000) quoted without naming the variant. The leaflet's X 8000 human detection of 9 km implies an 18 km diameter; X 8000 is the top model. Resolution: UNRESOLVED. Neither figure is used; the model ships the Spynel-S 6000 leaflet values instead..

### `lib-zvook` Zvook acoustic station (Ukraine)

- **Manufacturer:** Zvook (Lviv, Ukraine)
- **Country:** Ukraine
- **Operators:** Ukrainian Armed Forces (national network, operational since 2022), Latvian National Armed Forces (trial, NATO BATT26 exercise, 2026)
- **Program:** Ukrainian national acoustic early-warning network feeding the Delta situational awareness system; NATO BATT26 experimentation in Latvia
- **Status:** CURRENT
- **Mobility:** fixed
- **UAS groups:** 2, 3

| Field | Value | Range type / condition | Grade | Layer | Source |
| --- | --- | --- | --- | --- | --- |
| `sensor.detectRangeM` | 5000 m (5 km) | detection range — Manufacturer claim as reported by Militarnyi: 'the complex is capable of detecting a drone at a distance of up to 5 km'. Target is Shahed-type one-way-attack UAS (piston engine, high acoustic output). Background noise condition NOT stated. This does NOT transfer to a quiet quadcopter. A separate figure of 7 km applies to CRUISE MISSILES and is not used here. | CORROBORATED | L1 | [Ukraine Develops Acoustic Detector for FPV Drones](https://militarnyi.com/en/news/ukraine-develops-acoustic-detector-for-fpv-drones/), 2026-01-23 |
| `sensor.detectRangeM (second target class, NOT used)` | 7000 m (7 km) | detection range, cruise missile — Cruise missile, a louder and faster target. Recorded so the 5 km UAS figure is never silently swapped for it. Independently reported at the same values by a C-UAS survey table (Zvook: 5 km Shahed, 7 km cruise missiles, 1.6% false positive rate, about 10,000 sensors, about $500 per unit). | CORROBORATED | L1 | [Counter-UAS 101 - Acoustic Drone Detection](https://drone-warfare.com/counter-uas/acoustic-detection/), 2026-01 |
| `sensor.classifyRangeM` | 5000 m | classification range — No separate classification range is published. Zvook runs a multiclass model that recognises Shaheds, cruise missiles, turboprop and propeller aircraft, jet engines and helicopters; the detection event IS the class decision, so classification is modeled as available wherever detection is. | INFERRED | REPRESENTATIVE | [Ukraine develops acoustic system for determining azimuth of air targets / Militarnyi](https://militarnyi.com/en/news/ukraine-develops-acoustic-detector-for-fpv-drones/), 2026-01-23 |
| `sensor.sectorDeg` | 200 deg (about 200 deg) | coverage angle — Quoted: 'Most listening stations have a coverage angle of about 200 deg.' The station is directional because it uses a half-metre curved acoustic mirror to concentrate sound onto a single microphone; that gain is what buys the 5 km range and it costs omnidirectionality. | REPORTED | L1 | [Ukraine Develops Acoustic Detector for FPV Drones](https://militarnyi.com/en/news/ukraine-develops-acoustic-detector-for-fpv-drones/), 2026-01-23 |
| `array_architecture` | single microphone behind a 0.5 m curved acoustic mirror, plus a microcomputer running ML at the edge, battery with solar recharge, mounted on radio towers at 10-12 m | n/a — This is a BEARING-CLASS sensor, not a beamforming array: one microphone cannot localize. Position comes from crossing bearings across the network. About $500 per station, so density substitutes for per-node accuracy. Stations are sited near border entry points. | CORROBORATED | L1 | [Ukrainian firm tests mobile version of its acoustic drone detector](https://defence-blog.com/ukrainian-firm-tests-mobile-version-of-its-acoustic-drone-detector/), 2026-08-11 |
| `latency_and_c2` | detections reach Ukraine's Delta situational awareness system in about 12 seconds s (about 12 s) | n/a — Reported, not measured by the source. Mobile anti-aircraft teams work off tablets fed by Delta. | REPORTED | L1 | [Ukrainian firm tests mobile version of its acoustic drone detector](https://defence-blog.com/ukrainian-firm-tests-mobile-version-of-its-acoustic-drone-detector/), 2026-08-11 |
| `primary_vs_supplementary` | PRIMARY detection for the RF-silent and low-altitude case; supplementary elsewhere | n/a — Ukraine's acoustic networks are reported to track about 20% of all targets entering Ukrainian airspace on acoustic data ALONE. Against that, an independent survey positions acoustic as 'the initial detection layer in multi-sensor fusion architectures, cueing radar, electro-optical, and infrared systems'. Both readings are recorded; they are not averaged. | REPORTED | L1 | [Counter-UAS 101 - Acoustic Drone Detection](https://drone-warfare.com/counter-uas/acoustic-detection/), 2026-01 |
| `resilience` | false positive rate driven from about 50% to 1.6%; only 3% accuracy loss when Russia altered Shahed acoustic signatures, recovered by retraining | n/a — Reported operational figures, no test report behind them. | REPORTED | L1 | [Counter-UAS 101 - Acoustic Drone Detection](https://drone-warfare.com/counter-uas/acoustic-detection/), 2026-01 |
| `nato_status` | First vehicle-mounted trial during NATO exercise BATT26 in Latvia, with the Latvian National Armed Forces, Aug 2026 | n/a — The company itself called the result 'promising rather than polished': 'It worked. Not perfectly, there were challenges'. Standard deployment remains fixed infrastructure. Do not read this as a fielded mobile capability. | CORROBORATED | L1 | [Ukraine's Zvook Acoustic System Tests Mobile Detection of Low-Flying Missiles and Drones](https://united24media.com/defense-tech/ukraines-zvook-acoustic-system-tests-mobile-detection-of-low-flying-missiles-and-drones-21587), 2026-08-11 |

**Not established by the public record:** Bearing accuracy per station. No figure is published, so localization error across a picket cannot be estimated. Node spacing for the long-range stations (the 400-600 m figure belongs to the NW0 tactical sensor, not to these). Elevation coverage and altitude ceiling. Wind, terrain and ambient-noise derates specific to Zvook. Only a generic acoustic figure exists (severe degradation above 5 m/s wind). Detection range against quiet electric multirotors. The 5 km figure is a piston-engine OWA figure only. Any machine interface to a Western C2. Delta is not in the RangeBoard library.

**Unresolved source conflict:**
- network size: Counter-UAS 101 survey table, Jan 2026 gives Zvook about 10,000 sensors; United24 Media, Jul 2025 (describing the combined Ukrainian acoustic effort) gives 14,000 sensors. The 14,000 figure is Sky Fortress's separate network, not Zvook's. Sources routinely merge the two Ukrainian acoustic networks. Resolution: UNRESOLVED. Not a spec field, recorded for context only..

### `lib-zvooknw0` Zvook NW0 tactical FPV sensor

- **Manufacturer:** Zvook (Lviv, Ukraine)
- **Country:** Ukraine
- **Operators:** Ukrainian Armed Forces (front-line units)
- **Program:** Zvook tactical product line for line-of-contact, frontline city and logistics route protection
- **Status:** CURRENT
- **Mobility:** dismounted
- **UAS groups:** 1

| Field | Value | Range type / condition | Grade | Layer | Source |
| --- | --- | --- | --- | --- | --- |
| `sensor.detectRangeM` | 450 m (150-450 m) | declared detection range — Manufacturer-declared BAND, not a single value: 'The declared detection range is 150-450 meters.' Target is FPV drones, explicitly including fibre-optic FPV. What separates the 150 m case from the 450 m case (background noise, drone type, mounting) is NOT stated. 450 m is the top of the declared band and is the value shipped; the low end is 150 m. | MANUFACTURER_CLAIM | L1 | [Ukraine Develops Acoustic Detector for FPV Drones](https://militarnyi.com/en/news/ukraine-develops-acoustic-detector-for-fpv-drones/), 2026-01-23 |
| `sensor.detectRangeM (independent cross-check)` | null m (300-500 m) | maximum effective range, small quadcopter — An independent C-UAS survey puts the physics limit for small quadcopters at 300-500 m and notes 'severe degradation in wind above 5 m/s'. The NW0's declared 150-450 m band sits inside that envelope, which corroborates the claim rather than contradicting it. | CORROBORATED | L1 | [Counter-UAS 101 - Acoustic Drone Detection](https://drone-warfare.com/counter-uas/acoustic-detection/), 2026-01 |
| `sensor.classifyRangeM` | 450 m | classification range — No separate classification range is published. The device's only output is an FPV-class decision (audible alarm plus a map symbol in the Zvook UI), so classification is modeled as available wherever detection is. | INFERRED | REPRESENTATIVE | [Ukraine Develops Acoustic Detector for FPV Drones](https://militarnyi.com/en/news/ukraine-develops-acoustic-detector-for-fpv-drones/), 2026-01-23 |
| `sensor.sectorDeg` | 360 deg (360 deg) | coverage angle — Quoted: 'the device itself operates at 360 degrees'. Omnidirectional, unlike the mirror-fed 200 deg long-range station. No bearing accuracy is published, so it is best read as a presence-and-alarm sensor. | MANUFACTURER_CLAIM | L1 | [Ukraine Develops Acoustic Detector for FPV Drones](https://militarnyi.com/en/news/ukraine-develops-acoustic-detector-for-fpv-drones/), 2026-01-23 |
| `node_spacing_for_localization` | 500 m (400-600 m) | recommended node spacing — Quoted: 'To build a reliable network, the manufacturer recommends placing sensors every 400-600 meters apart.' Recorded for laydown planning, NOT written to any SensorSpec field. RangeBoard has no spacing field. | MANUFACTURER_CLAIM | L1 | [Ukraine Develops Acoustic Detector for FPV Drones](https://militarnyi.com/en/news/ukraine-develops-acoustic-detector-for-fpv-drones/), 2026-01-23 |
| `physical_and_link` | IP67; 15-20 W; needs external power; data link by fibre, twisted pair, LTE or LoRa radio; remote firmware update; outputs an optional audible alarm plus a real-time map in the Zvook UI | n/a — Directly determines the IntegrationProfile media list. | MANUFACTURER_CLAIM | L1 | [Ukraine Develops Acoustic Detector for FPV Drones](https://militarnyi.com/en/news/ukraine-develops-acoustic-detector-for-fpv-drones/), 2026-01-23 |
| `why_it_matters_for_rangeboard` | detects fibre-optic FPV, which no other sensor in the library can hold | n/a — Quoted: 'it also detects FPV drones on fiber optics, which cannot be detected by RER [RF reconnaissance] means.' RangeBoard already carries lib-fpv-fiber with navMode 'fiber', which rfDetectable() correctly returns false for and jammable() correctly returns false for. Today nothing in the library detects it except radar. This sensor closes that gap. | MANUFACTURER_CLAIM | L1 | [Ukraine Develops Acoustic Detector for FPV Drones](https://militarnyi.com/en/news/ukraine-develops-acoustic-detector-for-fpv-drones/), 2026-01-23 |

**Not established by the public record:** Bearing accuracy, and whether the network localizes an FPV or only raises a proximity alarm along the picket. What separates the 150 m case from the 450 m case in the declared band. Ambient-noise floor assumed for the declared band. A front-line acoustic background is not a test-range background. Whether any US or NATO force has evaluated the NW0. No evidence found. Elevation coverage.

## Electronic attack

### `lib-cuaews` CUAEWS DF (SRC, LIDS EW)

- **Manufacturer:** SRC, Inc.
- **Country:** US
- **Operators:** US Army, US Air Force (Silent Archer lineage), Qatar (FS-LIDS FMS, 2025)
- **Program:** Army LIDS family of systems (FS-LIDS / M-LIDS); JCO interim fixed/semi-fixed selection 2020
- **Status:** CURRENT
- **Mobility:** fixed
- **UAS groups:** 1, 2, 3

| Field | Value | Range type / condition | Grade | Layer | Source |
| --- | --- | --- | --- | --- | --- |
| `effector.maxRangeM` | 8000 m (8 km) | EFFECT range (defeat range of the EW system inside the LIDS layered engagement sequence) — Verbatim: 'Effective range of the Coyote Block 2+ interceptor is approximately 15 kilometers, followed by the EW system with effects ranging up to 8 kilometers.' Fixed-site LIDS configuration. The same brochure states the mobile EW vehicle carries the fixed-site suite with a 'slight decrease in effective detection and defeat range', so a mounted emplacement is below 8 km by an unstated amount. | VERIFIED | L1 | [SRC, LIDS Family of Systems brochure (marked Approved for Public Release)](https://www.srcinc.com/pdf/lids-family-of-systems-brochure.pdf), 2021 (PDF metadata; document text undated). Retrieved 2026-08-24. |
| `effector.minRangeM` | 0 m | minimum engagement range — No minimum standoff is published for an EW effector. 0 is the schema convention for 'no inner keep-out', not a measured value. | INFERRED | L2 | [SRC, LIDS Family of Systems brochure](https://www.srcinc.com/pdf/lids-family-of-systems-brochure.pdf), 2021 |
| `effector.sectorDeg` | 360 deg | azimuth coverage — SRC publishes no azimuth sector. Basis for 360: the system is a guyed tower emplacement (156.5 in tower, 38 in diameter) with a multi-band direction finder using 'multiple detectors' and it 'automatically resumes passive RF search' after each engagement, which is a persistent all-round posture. This is INFERRED and must not be read as a measured beam. | INFERRED | L2 | [SRC, LIDS Family of Systems brochure, CUAEWS DF section](https://www.srcinc.com/pdf/lids-family-of-systems-brochure.pdf), 2021 |
| `effector.maxAltitudeFt` | null ft | engagement altitude ceiling — No altitude ceiling is published for CUAEWS. null, never 0. | UNKNOWN | L3 | [SRC, LIDS Family of Systems brochure](https://www.srcinc.com/pdf/lids-family-of-systems-brochure.pdf), 2021 |
| `effector.engageTimeS` | 5 s | time from assignment to effect — No numeric figure published. SRC states 'Defeat techniques are automatically prepped and ready to fire', 'A man in the loop activates the defeat technique', and 'Re-load/re-tasking is near instantaneous and indefinite'. 5 s is the app's existing representative for a human-authorised RF engagement (matches lib-modi and lib-dronebuster). REPRESENTATIVE. | UNKNOWN | L2 | [SRC, LIDS Family of Systems brochure, CUAEWS DF section](https://www.srcinc.com/pdf/lids-family-of-systems-brochure.pdf), 2021 |
| `effector.pk` | 0.65 probability | probability the jam produces the modelled effect — UNKNOWN. No public Pk, defeat rate, or test statistic exists for CUAEWS. 0.65 is a REPRESENTATIVE planning value carried over from the app's existing lib-modi jammer entry so the EW class stays internally consistent. It is not evidence. | UNKNOWN | L2 | No source; representative value |
| `effector.magazineSize` | null salvos | magazine — Field deliberately ABSENT (= unlimited). Directly supported: 'Re-load/re-tasking is near instantaneous and indefinite.' Power is mains or 28 VDC, so the practical limit is prime power, not rounds. | VERIFIED | L1 | [SRC, LIDS Family of Systems brochure, CUAEWS DF section](https://www.srcinc.com/pdf/lids-family-of-systems-brochure.pdf), 2021 |
| `non-schema: target set` | Groups 1, 2 and small Group 3, single targets or swarms | target class — Verbatim: 'designed to detect, track, classify and defeat groups 1, 2 and small group 3 UAS, whether individual targets or swarms'. The brochure gives no number for simultaneous engagements. | VERIFIED | L1 | [SRC, LIDS Family of Systems brochure](https://www.srcinc.com/pdf/lids-family-of-systems-brochure.pdf), 2021 |
| `non-schema: cue dependency and autonomy` | Self-cueing passive RF search and DF; man-in-the-loop to fire | autonomy — Verbatim: 'Passively searches RF environment for signals of interest', 'A "man in the loop" activates the defeat technique', 'System automatically resumes passive RF search upon cease fire'. It needs no external cue to find a target but does need a human to authorise the effect. | VERIFIED | L1 | [SRC, LIDS Family of Systems brochure, CUAEWS DF section](https://www.srcinc.com/pdf/lids-family-of-systems-brochure.pdf), 2021 |
| `non-schema: mobility` | Fixed-site and high-mobility configurations | mobility — Verbatim: 'Fixed-site & high-mobility configurations'. The mobile EW vehicle 'incorporates Fixed Site LIDS (slight decrease in effective detection and defeat range)'. Ships in 6 transport cases, 100-170 lb each; tower 140 lb, EW hardware 250 lb. | VERIFIED | L1 | [SRC, LIDS Family of Systems brochure](https://www.srcinc.com/pdf/lids-family-of-systems-brochure.pdf), 2021 |
| `non-schema: RF output / EIRP` | null W or dBm EIRP | maximum RF output specification — Not published. Prime power draw is published (2,200 W, 110/240 VAC or 28 VDC) and is NOT an RF output figure. Do not convert one into the other. | UNKNOWN | L3 | [SRC, LIDS Family of Systems brochure](https://www.srcinc.com/pdf/lids-family-of-systems-brochure.pdf), 2021 |
| `non-schema: spectrum fratricide control` | Per-technique collateral estimate; techniques scoped to the UAS | deconfliction — Verbatim: 'System provides an estimate of potential collateral damage to the electromagnetic spectrum for each defeat technique' and 'Advanced smart defeat techniques are used to affect only the UAS devices without causing collateral spectral interference to other radio frequency (RF) systems'. The NAVWAR effect is described as 'low-power, low-collateral damage'. | VERIFIED | L1 | [SRC, LIDS Family of Systems brochure, CUAEWS DF section](https://www.srcinc.com/pdf/lids-family-of-systems-brochure.pdf), 2021 |
| `non-schema: service attribution` | Army; component of M-LIDS | program — CRS names 'The Counter-small Unmanned Aircraft Electronic Warfare System (CUAEWS) from SRC' in the list of M-LIDS components. | VERIFIED | L1 | [CRS R48477, Department of Defense Counter Unmanned Aircraft Systems: Background and Issues for Congress](https://www.everycrsreport.com/reports/R48477.html), 2025-03-31 |

**Not established by the public record:** Azimuth sector and elevation coverage of the EW aperture. Engagement altitude ceiling. Number of simultaneous engagements. The brochure claims swarm capability but prints no count. Maximum RF output or EIRP. The magnitude of the 'slight decrease' in defeat range for the mobile EW vehicle vs fixed site. Any Pk, defeat rate, or DOT&E test result. Which of the 8 km effect applies to control-link denial vs the separate NAVWAR effect.

### `lib-ninja` NINJA RF-cyber defeat (AFRL)

- **Manufacturer:** US Air Force Research Laboratory (AFRL), Black River Systems Company (lead developer)
- **Country:** US
- **Operators:** US Air Force, UK Royal Air Force (integrated into ORCUS)
- **Program:** US Air Force C-sUAS program of record; JCO interim fixed/semi-fixed selection 2020
- **Status:** CURRENT
- **Mobility:** fixed
- **UAS groups:** 1, 2

| Field | Value | Range type / condition | Grade | Layer | Source |
| --- | --- | --- | --- | --- | --- |
| `effector.maxRangeM` | 2000 m | EFFECT range (RF-cyber takeover / disable range) — NO PUBLIC FIGURE OF ANY KIND. Neither AFRL, Black River, CRS nor Leonardo prints a NINJA range. The only relative statement is Leonardo's: NINJA delivers 'a similarly surgical cyber effect at a shorter range' than the Guardian long-range jammer. REPRESENTATIVE 2000 m, basis: the only published mitigation band for a comparable RF-cyber takeover system is D-Fend EnforceAir2 at 1.2-4 km, and 2 km is also the app's existing planning value for the dismounted Modi II jammer, so the ring stays inside the class envelope without claiming precision. | UNKNOWN | REPRESENTATIVE | [Leonardo press release, UK-US counter-drone collaboration (relative range statement only)](https://www.leonardo.com/en/news-and-stories-detail/-/detail/leonardo-supports-uk-us-counter-drone-collaboration-integrates-new-technology), 2021-09-15 |
| `effector.sectorDeg` | 360 deg | azimuth coverage — No azimuth sector is published for the fixed-site defeat function. Basis for 360: the fixed-site build is a distributed array of software-defined radios with optional range-extension nodes (Ninja TRx, Ninja 4925 RFFE, Ninja Sentinel), which is a site-perimeter architecture rather than a pointed beam. INFERRED. | INFERRED | L2 | [Black River Systems, Fixed-Site C-UAS](https://www.blackriversystems.com/c-uas-systems-fixed-site/), undated; retrieved 2026-08-24 |
| `effector.maxAltitudeFt` | null ft | engagement altitude ceiling — Not published. null, never 0. | UNKNOWN | L3 | [Black River Systems, Fixed-Site C-UAS](https://www.blackriversystems.com/c-uas-systems-fixed-site/), retrieved 2026-08-24 |
| `effector.engageTimeS` | 20 s | time from assignment to effect — Not published. 20 s is the app's existing representative for an RF-cyber takeover effect (lib-enforceair) and is deliberately longer than the 5 s used for broadband jamming, because a takeover must acquire, identify the protocol and then command the airframe. REPRESENTATIVE. | UNKNOWN | L2 | No source; representative value consistent with lib-enforceair |
| `effector.pk` | 0.6 probability | probability the effect is produced — UNKNOWN. No public Pk. 0.6 is REPRESENTATIVE and set slightly below the broadband jammers because a protocol-specific effect only works on a supported airframe: AFRL's own framing is 'capable of taking control of OR disabling' commercially available drones, i.e. the effect is not uniform across the threat set. | UNKNOWN | L2 | [Unmanned Airspace, US Air Force expands counter UAS research](https://www.unmannedairspace.info/counter-uas-systems-and-policies/us-air-force-expands-counter-uas-research-with-addition-of-dds-sense-and-detect-know-how/), 2021-09-14 |
| `non-schema: effect mechanism` | Exploits the RF link between drone and operator; takes control or disables | effect — CRS verbatim: 'designed to detect, track, locate, identify, and defeat UAS threats using the radio frequency communications between the drone and the operator'. Leonardo verbatim: 'can take control of a drone's protocols and maneuver it to a safe location'. | VERIFIED | L1 | [CRS R48477; Leonardo press release](https://www.everycrsreport.com/reports/R48477.html), 2025-03-31 |
| `non-schema: fielding` | 99 Air Force locations (CRS, as of 2023); over 565 systems at 190 locations (vendor) | fielding count — TWO DIFFERENT COUNTS, DIFFERENT DATES AND SCOPES. CRS: '99 Air Force locations had installed the NINJA system' as of 2023. Black River: 'over 565 Ninja systems are fielded at 190 unique locations worldwide', undated vendor page retrieved 2026. Recorded separately, not reconciled. | CORROBORATED | L1 | [CRS R48477 (2025-03-31); Black River Systems Counter-UAS page (retrieved 2026-08-24)](https://www.everycrsreport.com/reports/R48477.html), 2025-03-31 and 2026-08-24 |
| `non-schema: spectrum fratricide control` | Non-indiscriminate; friendly drones whitelisted | deconfliction — Verbatim: 'detects, disrupts, and defeats hostile unmanned aircraft - without any indiscriminate interference to friendly systems caused by conventional sUAS jamming technologies' and 'Enables whitelisting of friendly drones for unrestricted operations'. Vendor claim. | MANUFACTURER_CLAIM | L1 | [Black River Systems, Fixed-Site C-UAS](https://www.blackriversystems.com/c-uas-systems-fixed-site/), retrieved 2026-08-24 |
| `non-schema: RF receive coverage` | 70 MHz to 6 GHz interception (sensing side) Hz | receiver tuning coverage, NOT a transmit or jamming band plan — Verbatim: 'employs an array of industry-standard Software Defined Radios (SDRs)... to intercept and decipher sUAS communication signals ranging from 70 MHz to 6 GHz in real-time'. This is a published receive coverage figure only; no transmit plan is recorded or sought. | MANUFACTURER_CLAIM | L1 | [Black River Systems, Fixed-Site C-UAS](https://www.blackriversystems.com/c-uas-systems-fixed-site/), retrieved 2026-08-24 |

**Not established by the public record:** Defeat range. This is the single largest gap and the reason for the REPRESENTATIVE label. Azimuth sector for the defeat function specifically. Simultaneous target capacity. Time from cue to effect. Whether NINJA is netted into MEDUSA or FAAD C2 in practice. Which airframes and link types are in the supported set, and therefore what fraction of a raid it can actually affect.

**Unresolved source conflict:**
- fielding count: CRS R48477 (2025-03-31) gives 99 Air Force locations had installed NINJA (as of 2023); Black River Systems Counter-UAS page (retrieved 2026-08-24) gives over 565 systems at 190 unique locations worldwide. Different dates (2023 vs 2026), different units (locations vs systems), and different scopes (Air Force locations vs worldwide including non-USAF). Resolution: UNRESOLVED.

### `lib-pulsar` Pulsar EW node (Anduril)

- **Manufacturer:** Anduril Industries
- **Country:** US
- **Operators:** US Special Operations Command (IDIQ), US Marine Corps (installation C-sUAS plans)
- **Program:** Anduril Pulsar EW family; SOCOM 10-year C-UAS IDIQ up to $1B covering Pulsar, Lattice, Sentry and Anvil
- **Status:** FIELDING
- **Mobility:** expeditionary
- **UAS groups:** 1, 2

| Field | Value | Range type / condition | Grade | Layer | Source |
| --- | --- | --- | --- | --- | --- |
| `effector.maxRangeM` | 2000 m (2 km) | AMBIGUOUS: 'effective range', source does not say whether detection or electronic attack — Verbatim: 'The information displayed at WDS lists an effective range of 2 km against Group 1 targets.' This is a trade-show product placard reported by Army Recognition, conditioned on Group 1 targets. THE SOURCE DOES NOT DISCRIMINATE DETECTION FROM EFFECT. Mapped to maxRangeM because the exhibit was 'positioned as an expeditionary, fixed-site style effector', but the QA pass should treat this as the weakest range-type attribution in this submission. | REPORTED | L1 | [Army Recognition, US Anduril Reveals Pulsar Electronic Warfare System for 360 Anti-Drone Defense at WDS 2026](https://www.armyrecognition.com/archives/archives-defense-exhibitions/2026-archives-news-defense-exhibitions/world-defense-show-2026/u-s-anduril-reveals-pulsar-electronic-warfare-system-for-360-anti-drone-defense-at-wds-2026), 2026-02-11 |
| `effector.sectorDeg` | 90 deg (90 deg) | azimuth coverage of one panel — Verbatim: 'two directional panels to build a full 360-degree protected bubble through sector coverage, with the product placard describing 90-degree sectors that can be combined to cover the full azimuth.' 90 is the honest per-emplacement value; a user who wants 360 places multiple entities. DO NOT enter 360 for a single node. | REPORTED | L1 | [Army Recognition, WDS 2026](https://www.armyrecognition.com/archives/archives-defense-exhibitions/2026-archives-news-defense-exhibitions/world-defense-show-2026/u-s-anduril-reveals-pulsar-electronic-warfare-system-for-360-anti-drone-defense-at-wds-2026), 2026-02-11 |
| `effector.maxAltitudeFt` | null ft | engagement altitude ceiling — Not published. | UNKNOWN | L3 | [Army Recognition, WDS 2026](https://www.armyrecognition.com/archives/archives-defense-exhibitions/2026-archives-news-defense-exhibitions/world-defense-show-2026/u-s-anduril-reveals-pulsar-electronic-warfare-system-for-360-anti-drone-defense-at-wds-2026), 2026-02-11 |
| `effector.engageTimeS` | 5 s | time from assignment to effect — No assignment-to-effect figure published. The only published time is a SETUP time: Pulsar-L delivers 'detect, ID, track, and defeat capabilities at the tactical edge in just 2 minutes', which is emplacement, NOT engagement. 5 s is REPRESENTATIVE, matching the app's other directed jammers. | UNKNOWN | L2 | [Anduril, Introducing Pulsar-L (setup time only)](https://www.anduril.com/news/introducing-pulsar-l-the-lightweight-ew-system-for-rapid-deployment), 2025-04-29 |
| `effector.pk` | 0.6 probability | probability the jam produces the modelled effect — UNKNOWN. No public Pk. 0.6 REPRESENTATIVE. | UNKNOWN | L2 | No source; representative value |
| `non-schema: architecture` | Software-defined radio plus GPU edge compute; RF machine learning adapts to new emitters | architecture — Published at capability level: 'integrates a software-defined radio, a graphics processing unit, and additional diverse computing capabilities, allowing radio frequency machine learning to identify and adapt to emerging threats at the edge'. Described as 'not limited to one band or one manufacturer's control link'. | CORROBORATED | L1 | [Inside Unmanned Systems (Pulsar family reveal); Army Recognition WDS 2026](https://insideunmannedsystems.com/anduril-reveals-pulsar-family-of-ai-learning-electronic-warfare-systems/), 2024 (family reveal); 2026-02-11 (WDS) |
| `non-schema: mobility and SWaP` | Pulsar-L under 25 lb, shoebox-sized; mountable on ground vehicles, aircraft, drones and maritime platforms. Fixed-site tripod build draws under 4 kW at 110-240 VAC. | mobility — Two different builds. The 4 kW figure is PRIME POWER DRAW for the tripod node, not RF output. IP65, -30 C to +65 C. | CORROBORATED | L1 | [Defense News, Anduril announces lighter, smaller Pulsar jammer; Army Recognition WDS 2026](https://www.defensenews.com/pentagon/2025/04/29/anduril-announces-lighter-smaller-pulsar-jammer/), 2025-04-29 and 2026-02-11 |
| `non-schema: spectrum fratricide control` | Selectable bands and directional transmission to reduce interference with friendly communications | deconfliction — Verbatim: 'marketed around disciplined electromagnetic effects, with selectable bands and directional transmission to reduce interference with friendly communications, an issue that has repeatedly punished indiscriminate jamming in combat environments'. Vendor positioning reported by trade press. | REPORTED | L1 | [Army Recognition, WDS 2026](https://www.armyrecognition.com/archives/archives-defense-exhibitions/2026-archives-news-defense-exhibitions/world-defense-show-2026/u-s-anduril-reveals-pulsar-electronic-warfare-system-for-360-anti-drone-defense-at-wds-2026), 2026-02-11 |
| `non-schema: RF output / EIRP` | null W or dBm EIRP | maximum RF output specification — Not published. The 'under 4 kW' figure is AC prime power and must never be reported as radiated power. | UNKNOWN | L3 | [Army Recognition, WDS 2026](https://www.armyrecognition.com/archives/archives-defense-exhibitions/2026-archives-news-defense-exhibitions/world-defense-show-2026/u-s-anduril-reveals-pulsar-electronic-warfare-system-for-360-anti-drone-defense-at-wds-2026), 2026-02-11 |

**Not established by the public record:** Whether the 2 km placard figure is a detection or an electronic-attack range. This is the record's central ambiguity. Whether Pulsar-V, Pulsar-L and the tripod node share that 2 km figure or each has its own. Simultaneous target and swarm capacity, despite the swarm marketing. Assignment-to-effect time. Radiated power / EIRP. Whether it operates fully autonomously under Lattice or requires an operator to authorise the electronic attack.

### `lib-pitbull` Pitbull 101 wearable jammer (MyDefence)

- **Manufacturer:** MyDefence A/S
- **Country:** Denmark (NATO)
- **Operators:** US Army (485 Soldier Kits ordered 2025), Ukraine (reported frontline use), NATO users
- **Program:** MyDefence Soldier Kit (Wingman RF sensor + Pitbull jammer); US Army order, announced Jul 2025
- **Status:** CURRENT
- **Mobility:** dismounted
- **UAS groups:** 1

| Field | Value | Range type / condition | Grade | Layer | Source |
| --- | --- | --- | --- | --- | --- |
| `effector.maxRangeM` | 1000 m (1000 m) | EFFECT range (jamming range) — Manufacturer product page: 'up to 1000 meters of jamming range'. 'Up to' is a ceiling under unstated favourable conditions, not a guaranteed value. NOTE: the January 2025 Pitbull 100/101 datasheet prints NO range at all, so the figure lives only on the product page and in trade coverage. Distinct from the paired Wingman sensor's 6 km DETECTION range, which is a different device and must never be used as the jam range. | MANUFACTURER_CLAIM | L1 | [MyDefence, Pitbull Drone Jammer product page; corroborated by European Security & Defence](https://mydefence.com/products/pitbull-drone-jammer/), retrieved 2026-08-24; ESD article 2026-03 |
| `effector.sectorDeg` | 60 deg (60 deg) | azimuth coverage (jamming angle) — Datasheet table, both Pitbull 100 and 101: 'Jamming Angle: Horizontal 60 / Vertical 60'. Directional, not omnidirectional. The 60 deg vertical figure is recorded here but the RangeBoard engine is plan-view and reads no elevation. | MANUFACTURER_CLAIM | L1 | [MyDefence, Pitbull 100/101 RF Jammer datasheet (MDC-000458-2)](https://mydefence.com/wp-content/uploads/2025/01/Pitbull_100_101_Flyer_2025_MyDefence.pdf), 2025-01 |
| `effector.maxAltitudeFt` | null ft | engagement altitude ceiling — No altitude ceiling published. null, never 0. Do not back-fill from a Group 1 altitude definition. | UNKNOWN | L3 | [MyDefence, Pitbull 100/101 RF Jammer datasheet](https://mydefence.com/wp-content/uploads/2025/01/Pitbull_100_101_Flyer_2025_MyDefence.pdf), 2025-01 |
| `effector.engageTimeS` | 5 s | time from assignment to effect — No assignment-to-effect figure published. The nearby published figure is the Wingman sensor identifying a threat 'in under 10 seconds', which is a DETECTION-to-classification time on a different device. 5 s REPRESENTATIVE, matching the app's other handheld jammers. | UNKNOWN | L2 | [No source for engage time; Wingman detection time from ESD, 2026-03](https://euro-sd.com/2026/03/articles/armed-forces/49834/infantry-portable-anti-drone-options/), 2026-03 |
| `effector.pk` | 0.6 probability | probability the jam produces the modelled effect — UNKNOWN. WARNING for the QA pass: the datasheet prints 'Jamming Ratio: Up to 80%'. MyDefence does not define that term and it is NOT a probability of kill. Do not map it to pk. 0.6 is REPRESENTATIVE, set at the same level as the other directional handhelds. | UNKNOWN | L2 | [MyDefence, Pitbull 100/101 RF Jammer datasheet ('Jamming Ratio: Up to 80%', undefined)](https://mydefence.com/wp-content/uploads/2025/01/Pitbull_100_101_Flyer_2025_MyDefence.pdf), 2025-01 |
| `effector.magazineSize` | null salvos | magazine — Field ABSENT (= unlimited), which is correct for a jammer. Real constraint is battery, not rounds: '20 hours in Standby Mode, 2 hours in Continuous Active Mode' on an AN/PRC-148/152 battery. RangeBoard has no field for that, so it is recorded here only. | MANUFACTURER_CLAIM | L1 | [MyDefence, Pitbull 100/101 RF Jammer datasheet](https://mydefence.com/wp-content/uploads/2025/01/Pitbull_100_101_Flyer_2025_MyDefence.pdf), 2025-01 |
| `non-schema: jammed bands (as printed by the vendor)` | Pitbull 100: 2.4 / 5.2 / 5.8 GHz. Pitbull 101 adds 1.6 GHz (GPS). GHz | band labels published by the OEM — Datasheet table. Recorded because it is the discriminator between the two models and it establishes that only the 101 denies GNSS. No frequency plan, technique or waveform detail beyond these vendor-printed band labels. | MANUFACTURER_CLAIM | L1 | [MyDefence, Pitbull 100/101 RF Jammer datasheet](https://mydefence.com/wp-content/uploads/2025/01/Pitbull_100_101_Flyer_2025_MyDefence.pdf), 2025-01 |
| `non-schema: autonomy and cue dependency` | Manual (human-in-the-loop) or automatic; automatic mode is cued by the Wingman detector | autonomy — Verbatim: 'In manual mode, the operator decides when and what to jam. In automatic mode, the Pitbull 100/101 Jammers function based on detection frequency received from the MyDefence drone detector, Wingman.' Automatic mode therefore has a HARD CUE DEPENDENCY on a sensor RangeBoard does not yet model. | MANUFACTURER_CLAIM | L1 | [MyDefence, Pitbull 100/101 RF Jammer datasheet](https://mydefence.com/wp-content/uploads/2025/01/Pitbull_100_101_Flyer_2025_MyDefence.pdf), 2025-01 |
| `non-schema: jam behaviour produced` | return-home | JamBehavior (threat-side) — Vendor states the jam forces the UAS to 'land or return to its remote controller or starting point'. Both outcomes end the approach; RangeBoard's nearest label is 'return-home'. Not 'drift'. | MANUFACTURER_CLAIM | L1 | [MyDefence, Pitbull Drone Jammer product page](https://mydefence.com/products/pitbull-drone-jammer/), retrieved 2026-08-24 |
| `non-schema: US fielding` | 485 Soldier Kits, about $26M, US Army, announced Jul 2025 | procurement — Order covers the kit (Wingman + Pitbull), not the jammer alone. Reported destination: Transformation-in-Contact units in Europe and elsewhere for operational evaluation. Company states it is the largest order in its history. | CORROBORATED | L1 | [MyDefence press release; Soldier Systems Daily; The Defense Post](https://mydefence.com/mydefence-receives-landmark-26-million-c-uas-order-from-u-s-army/), 2025-07 (SSD 2025-07-16; TDP 2025-07-10) |
| `non-schema: RF output / EIRP` | null W or dBm EIRP | maximum RF output specification — Not published anywhere in the datasheet. | UNKNOWN | L3 | [MyDefence, Pitbull 100/101 RF Jammer datasheet](https://mydefence.com/wp-content/uploads/2025/01/Pitbull_100_101_Flyer_2025_MyDefence.pdf), 2025-01 |

**Not established by the public record:** Radiated power / EIRP. The meaning of the datasheet's 'Jamming Ratio: Up to 80%'. Whether the 1 km range applies to the control link, the video link and GNSS equally. Assignment-to-effect time. Simultaneous target capacity. US Army fielding status past the operational evaluation announced in 2025.

**Unresolved source conflict:**
- jamming range: MyDefence Pitbull 100/101 datasheet, Jan 2025 gives no range figure printed at all; MyDefence Pitbull product page and ESD Mar 2026 gives up to 1000 m. The controlled datasheet omits range, likely because it is condition-dependent; the marketing page and trade coverage carry the headline figure. Resolution: UNRESOLVED. Recorded as 'up to 1000 m, manufacturer product page, absent from the datasheet'..

## System components (gap fill)

### `lib-cac2s` CAC2S (USMC aviation C2)

- **Manufacturer:** General Dynamics Mission Systems
- **Country:** US
- **Operators:** US Marine Corps
- **Program:** USMC Marine Air Command and Control System (MACCS) modernisation; C2 element of the Marine MRIC air-defence system
- **Status:** CURRENT
- **Mobility:** expeditionary
- **UAS groups:** 1, 2, 3

| Field | Value | Range type / condition | Grade | Layer | Source |
| --- | --- | --- | --- | --- | --- |
| `role` | Air C2: integrates aerial and ground-based radar and sensor data into a common real-time air picture for the MAGTF | Manufacturer product page. Describes the C2 function, not a C-UAS-specific interface. | MANUFACTURER_CLAIM | L1 | [General Dynamics Mission Systems, Common Aviation Command & Control System (CAC2S) product page](https://gdmissionsystems.com/command-and-control/common-aviation-command-and-control-system), (c)2026 page, accessed 2026-08-24 |
| `role_in_air_defence` | C2 component of MRIC (Medium Range Intercept Capability) with G/ATOR and SkyHunter | CRS naming MRIC's three components. This is the strongest published evidence that CAC2S runs a Marine air-defence kill chain, and it is the basis for the documented lib-gator pair. congress.gov returned HTTP 403 to every direct fetch in this session. The quotation is reproduced verbatim from the radar- and systems-domain agents' extracts of the same CRS product; a congress.gov index snippet independently confirms the XBAEU expansion. | VERIFIED | L1 | [CRS R48477, Department of Defense Counter Unmanned Aircraft Systems: Background and Issues for Congress](https://www.congress.gov/crs-product/R48477), 2025-03-31 |
| `scope` | Consolidates seven Marine Air Command and Control System functions into one system; replaces 1960s-era Marine air C2 equipment; fielding under way | Manufacturer product page, undated body text on a (c)2026 page. 'Dozens of units to come' is not a delivery schedule. | MANUFACTURER_CLAIM | L1 | [General Dynamics Mission Systems, Common Aviation Command & Control System (CAC2S) product page](https://gdmissionsystems.com/command-and-control/common-aviation-command-and-control-system), accessed 2026-08-24 |
| `configurations` | Configurable as Direct Air Support Center, Tactical Air Operations Center or Tactical Air Command Center | Manufacturer product page. Matters for RangeBoard because one CAC2S entity on the board can stand for any of the three echelons. | MANUFACTURER_CLAIM | L1 | [General Dynamics Mission Systems, Common Aviation Command & Control System (CAC2S) product page](https://gdmissionsystems.com/command-and-control/common-aviation-command-and-control-system), accessed 2026-08-24 |
| `test_status` | Operational test completed in a live-fly environment at Weapons and Tactics Instructor Course, Yuma | Trade reporting, 2016. A 2016 configuration is not the 2026 configuration; recorded only as evidence that the system reached operational test. | REPORTED | L1 | [Military Embedded Systems, 'U.S. Marines complete operational test of Common Aviation Command & Control System'](https://militaryembedded.com/avionics/safety-certification/u-s-marines-complete-operational-test-of-common-aviation-command-control-system), 2016-09-23 |
| `MADIS_interface` | null | UNKNOWN. No source read in this session names a MADIS-to-CAC2S or L-MADIS-to-CAC2S data interface. A DVIDS news search for 'MADIS CAC2S' returns no results at all. The Navy's own MADIS solicitation describes the programme as focusing on 'the integration of command and control (C2) software' WITHOUT naming a product. The association is organisational: LAAD battalions sit inside the Marine Air Control Group whose C2 system is CAC2S. Recorded as DOCTRINALLY_ASSOCIATED and authored as an inferred pair, never as documented. | UNKNOWN | L3 | [Unmanned Airspace, 'US Navy issues tender in relation to US Marine Corps MADIS programme', quoting the PM GBAD solicitation; DVIDS news search 'MADIS CAC2S' (0 results)](https://www.unmannedairspace.info/latest-news-and-information/us-navy-issues-tender-in-relation-to-us-marine-corps-madis-programme/), 2023-11-13; DVIDS search run 2026-08-24 |

**Not established by the public record:** Whether any MADIS or L-MADIS vehicle has a data interface to CAC2S. Nothing read in this session says so. The name of the C2 software actually hosted on the MADIS Mk2 vehicle. The PM GBAD solicitation calls the programme an integration of 'command and control (C2) software' and names no product. Whether CAC2S carries Link 16 / TADIL-J. Plausible for a Marine air C2 node, but no source read here states it, so no link-16 protocol slug is claimed. Which CAC2S increment and phase is fielded in 2026. Whether CAC2S has any C-UAS-specific interface as opposed to a general air-picture interface.

### `lib-kumrfs-m` KuMRFS-M mobile fire-control radar (Raytheon)

- **Manufacturer:** Raytheon (RTX)
- **Country:** US
- **Operators:** US Army
- **Program:** Army LIDS family of systems; masted radar on the M-LIDS kinetic-defeat vehicle
- **Status:** CURRENT
- **Mobility:** vehicle
- **UAS groups:** 1, 2, 3

| Field | Value | Range type / condition | Grade | Layer | Source |
| --- | --- | --- | --- | --- | --- |
| `sensor.detectRangeM` | 7000 m (7 km) | capability range against UAS Group 1-3, type unstated — Verbatim KuMRFS-M capability bullet: 'UAS Group 1-3 capability beyond 7 Km'. The brochure does NOT say whether this is detection, track or fire-control-quality range, and it does not name a target RCS. 'Beyond' makes 7000 a floor, not a ceiling. The paired KuMRFS-T bullet reads 'UAS Group 1 - 3 capability beyond 15 Km', which is what lib-kurfs already carries: the two figures belong to different products and must not be interchanged. | VERIFIED | L1 | [SRC, LIDS Family of Systems brochure (marked Approved for Public Release), KuMRFS-M CAPABILITIES panel](https://www.srcinc.com/pdf/lids-family-of-systems-brochure.pdf), undated in text; PDF metadata 2021. Text extracted directly 2026-08-24. |
| `sensor.classifyRangeM` | null m | classification range — UNKNOWN. No classification or identification range is published for any KuMRFS variant. null, never 0. This follows the radar-domain agent's convention of leaving classifyRangeM null when unpublished. | UNKNOWN | L3 | [SRC, LIDS Family of Systems brochure (marked Approved for Public Release)](https://www.srcinc.com/pdf/lids-family-of-systems-brochure.pdf), undated in text; PDF metadata 2021. Text extracted directly 2026-08-24. |
| `sensor.sectorDeg` | 360 deg (360 deg) | azimuth coverage — Verbatim: 'KuMRFS -T and -M radars each feature four (4) independent AESA quadrant radars which operate together to provide 360-degree radar coverage of the full upper hemisphere.' One RangeBoard entity therefore represents all four quadrants, exactly as lib-kurfs does for the -T. | VERIFIED | L1 | [SRC, LIDS Family of Systems brochure (marked Approved for Public Release), SYSTEM DESCRIPTION](https://www.srcinc.com/pdf/lids-family-of-systems-brochure.pdf), undated in text; PDF metadata 2021. Text extracted directly 2026-08-24. |
| `sensor.role` | fire-control | Verbatim from the M-LIDS kinetic-vehicle bullet list. Fire control is stated outright, and the short-halt limitation is stated with it. RangeBoard has no on-the-move flag, so the limitation lives in the description. | VERIFIED | L1 | [SRC, LIDS Family of Systems brochure (marked Approved for Public Release), MOBILE SOLUTIONS / Kinetic](https://www.srcinc.com/pdf/lids-family-of-systems-brochure.pdf), undated in text; PDF metadata 2021. Text extracted directly 2026-08-24. |
| `non-schema: array scaling` | KuMRFS-M quadrant arrays are one quarter the size of the KuMRFS-T quadrant arrays | This is the physical reason the -M figure is roughly half the -T figure, and the reason substituting lib-kurfs for the mobile radar draws a ring about twice too large. | VERIFIED | L1 | [SRC, LIDS Family of Systems brochure (marked Approved for Public Release), SYSTEM DESCRIPTION](https://www.srcinc.com/pdf/lids-family-of-systems-brochure.pdf), undated in text; PDF metadata 2021. Text extracted directly 2026-08-24. |
| `non-schema: physical` | Masted radar for expeditionary vehicle platforms; 889 kg; 15 kW vehicle, generator or shore power; GPS/INS; MIL-STD-810 transport (composite tactical vehicles, C-130); 55 C plus solar load | KuMRFS-M capabilities panel. The -T equivalents are 2295 kg on an Intex 461L pallet with a 30 kW generator, which is the other half of the fixed-versus-mobile distinction. | VERIFIED | L1 | [SRC, LIDS Family of Systems brochure (marked Approved for Public Release)](https://www.srcinc.com/pdf/lids-family-of-systems-brochure.pdf), undated in text; PDF metadata 2021. Text extracted directly 2026-08-24. |
| `non-schema: missions` | Simultaneous C-UAS, C-RAM, air surveillance and effector support; 'best in class' low false alarm claim; filters biological tracks, small-arms fire and ground movers | Multi-mission claim covers the KuMRFS family, not the -M specifically. | VERIFIED | L1 | [SRC, LIDS Family of Systems brochure (marked Approved for Public Release), KuMRFS narrative](https://www.srcinc.com/pdf/lids-family-of-systems-brochure.pdf), undated in text; PDF metadata 2021. Text extracted directly 2026-08-24. |

**Not established by the public record:** Whether 'beyond 7 Km' is a detection, track or fire-control-quality range, and against which of Groups 1, 2 and 3 it was measured. Target RCS, track capacity, update rate, range resolution and minimum range. None are published. Elevation coverage in degrees. 'Full upper hemisphere' is stated but no numeric band is given, so elevationDeg stays null. Whether the fielded M-LIDS Increment 2 radar is still KuMRFS-M in 2026, given that CRS records XBAEU on the Increment 2.1 single-Stryker build.

**Unresolved source conflict:**
- M-LIDS radar identity: SRC LIDS brochure, two-vehicle M-LIDS system description gives KuMRFS-M on the kinetic-defeat vehicle mast; CRS R48477 gives XBAEU on the Increment 2.1 single-Stryker build. Different increments: the brochure documents the two-vehicle Increment 2, CRS documents the later single-vehicle Increment 2.1. Resolution: Both kept. lib-kumrfs-m models the two-vehicle build, lib-xbaeu the single-Stryker build..

### `lib-xbaeu` XBAEU Ku720-2 mobile sensing radar (Raytheon)

- **Manufacturer:** Raytheon (RTX)
- **Country:** US
- **Operators:** US Army
- **Program:** Army M-LIDS Increment 2.1 (single Stryker); RTX Ku720 / KuRFS radar family
- **Status:** FIELDING
- **Mobility:** vehicle
- **UAS groups:** 1, 2, 3

| Field | Value | Range type / condition | Grade | Layer | Source |
| --- | --- | --- | --- | --- | --- |
| `sensor.detectRangeM` | 8000 m | NONE - no public range of any type exists for XBAEU or Ku720-2 — UNKNOWN. Neither the RTX KuRFS product page nor the October 2024 RTX release gives any range for XBAEU or Ku720-2. 8000 m is SENSOR_ROLE_DEFAULT_RANGE_M['fire-control'] from src/model/types.ts used as a REPRESENTATIVE planning factor. The role default was chosen because the Increment 2.1 Stryker carries no other radar and therefore has to supply the Coyote and 30 mm engagement track. It is deliberately NOT KuMRFS-M's 'beyond 7 Km' and NOT KuRFS's 'beyond 15 Km': neither figure belongs to this product. Do not quote 8000 m as an XBAEU capability. | UNKNOWN | REPRESENTATIVE | [RangeBoard SENSOR_ROLE_DEFAULT_RANGE_M (src/model/types.ts) - basis only; RTX KuRFS product page confirms no published figure](https://www.rtx.com/raytheon/what-we-do/integrated-air-and-missile-defense/kurfs), accessed 2026-08-24 |
| `sensor.classifyRangeM` | null m | classification range — UNKNOWN. null, never 0. | UNKNOWN | L3 | [RTX (Raytheon) news release, 'RTX's Raytheon demos KuRFS and Coyote performance against complex UAS threats'](https://www.rtx.com/news/news-center/2024/10/14/rtxs-raytheon-demos-kurfs-and-coyote-performance-against-complex-uas-threats), 2024-10-14 |
| `sensor.sectorDeg` | 360 deg (360 deg) | azimuth coverage — Verbatim: 'KuRFS precision targeting radar and the scaled Ku720-2 XBAEU distributed, mobile sensing radar deliver 360-degree, persistent detection, identification and tracking of airborne threats.' The sentence covers KuRFS and XBAEU jointly, so the 360 deg attribution to XBAEU alone is CORROBORATED by the sentence structure rather than stated in isolation. | MANUFACTURER_CLAIM | L1 | [RTX (Raytheon) news release, 'RTX's Raytheon demos KuRFS and Coyote performance against complex UAS threats'](https://www.rtx.com/news/news-center/2024/10/14/rtxs-raytheon-demos-kurfs-and-coyote-performance-against-complex-uas-threats), 2024-10-14 |
| `platform` | Radar of M-LIDS Increment 2.1, the single-Stryker build, with the Moog RIwP turret, Coyote and SRC CUAEWS | CRS naming the Increment 2.1 content. This is the whole reason the id exists: Increment 2.1 is NOT KuRFS and NOT KuMRFS. congress.gov returned HTTP 403 to every direct fetch in this session. The quotation is reproduced verbatim from the radar- and systems-domain agents' extracts of the same CRS product; a congress.gov index snippet independently confirms the XBAEU expansion. | VERIFIED | L1 | [CRS R48477, Department of Defense Counter Unmanned Aircraft Systems: Background and Issues for Congress](https://www.congress.gov/crs-product/R48477), 2025-03-31 |
| `test_event` | Flown at the US Army's annual summer test period at Yuma Proving Ground as part of the LIDS evaluation | RTX release describing a swarm stress test. The release reports no ranges, no raid size and no results beyond 'successfully detecting and tracking a swarm'. | MANUFACTURER_CLAIM | L1 | [RTX (Raytheon) news release, 'RTX's Raytheon demos KuRFS and Coyote performance against complex UAS threats'](https://www.rtx.com/news/news-center/2024/10/14/rtxs-raytheon-demos-kurfs-and-coyote-performance-against-complex-uas-threats), 2024-10-14 |
| `name_corroboration` | XBAEU is an RTX mobile radar programme with its own Array Electronics Unit / Digital Receiver-Exciter workstream | An RTX job posting indexed by Brave search. Used ONLY to corroborate that XBAEU is a real, current RTX radar programme and an AESA. No performance value is taken from it. | REPORTED | L1 | [RTX engineering job posting, 'Principal Radar AEU DREX Lead', via Hiring Our Heroes job board](https://jobs.hiringourheroes.org/jobs/444191705-principal-radar-aeu-drex-lead), search index snapshot accessed 2026-08-24 |

**Not established by the public record:** Every performance figure. No detection, track, classification or instrumented range is public, against any target class. Band. The Ku720 lineage implies Ku-band and RTX groups it with KuRFS, but no source states XBAEU's band outright. Elevation coverage, track capacity, update rate, resolution, minimum range. Whether XBAEU replaces or supplements KuMRFS-M on the Increment 2.1 vehicle. Whether 'distributed' means multiple externally mounted array units per vehicle, which would change how many RangeBoard entities one vehicle should place.

### `lib-cuaews-df` CUAEWS DF passive RF sensor (SRC)

- **Manufacturer:** SRC, Inc.
- **Country:** US
- **Operators:** US Army, Qatar (FS-LIDS FMS, 2025)
- **Program:** Army LIDS family of systems (FS-LIDS / M-LIDS); the find-and-fix half of the EW element
- **Status:** CURRENT
- **Mobility:** expeditionary
- **UAS groups:** 1, 2, 3

| Field | Value | Range type / condition | Grade | Layer | Source |
| --- | --- | --- | --- | --- | --- |
| `sensor.detectRangeM` | 6000 m | NONE - SRC publishes no detection or direction-finding range for CUAEWS DF — UNKNOWN. 6000 m is a REPRESENTATIVE planning figure set at the top of the library's fielded passive-RF band (lib-rfone 5000, lib-wingman 6000, lib-ardronis 5000, lib-corian 5000, lib-titan 3000), because CUAEWS DF is a mains-powered, guyed-tower, multi-detector military DF set rather than a man-portable one. SENSOR_ROLE_DEFAULT_RANGE_M['surveillance'] (20000 m) was deliberately NOT used: it is three to four times every fielded passive-RF entry in the library and would repeat the oversized-ring error this task exists to correct. CRITICAL: the brochure's 'effects ranging up to 8 kilometers' is the EW EFFECT range of the jammer half and must never be written into this field. | UNKNOWN | REPRESENTATIVE | [SRC, LIDS Family of Systems brochure (marked Approved for Public Release), CUAEWS DF section (no range published); RangeBoard passive-RF family band - basis only](https://www.srcinc.com/pdf/lids-family-of-systems-brochure.pdf), undated in text; PDF metadata 2021. Text extracted directly 2026-08-24. |
| `sensor.classifyRangeM` | 6000 m | classification range — REPRESENTATIVE, set equal to detectRangeM. Basis: for a passive RF set the detection event IS the classification event - the brochure states the system 'classifies SOI using combat ID matrix as SUSPECT, NEUTRAL/UNKNOWN, or FRIEND' as part of the FIND step. This matches the convention the RF-domain agent used for lib-wingman, lib-rfpatrol, lib-ardronis and lib-titan. | UNKNOWN | REPRESENTATIVE | [SRC, LIDS Family of Systems brochure (marked Approved for Public Release), CUAEWS DF FIND sequence](https://www.srcinc.com/pdf/lids-family-of-systems-brochure.pdf), undated in text; PDF metadata 2021. Text extracted directly 2026-08-24. |
| `sensor.sectorDeg` | 360 deg | azimuth coverage — INFERRED planning value, not a measured beam. Basis: the emplacement is a 156.5 in guyed tower, 38 in diameter, the DF works by 'capturing high-speed signals common to modern communications links using multiple detectors optimized for creating Lines of Bearing', and the system 'automatically resumes passive RF search upon cease fire' - all of which describe a persistent all-round posture. This matches the reasoning the EW-domain agent used for the jammer half. | INFERRED | REPRESENTATIVE | [SRC, LIDS Family of Systems brochure (marked Approved for Public Release), CUAEWS DF physical characteristics and CAPABILITIES](https://www.srcinc.com/pdf/lids-family-of-systems-brochure.pdf), undated in text; PDF metadata 2021. Text extracted directly 2026-08-24. |
| `sensor.role` | classification | Verbatim FIND sequence. Role 'classification' is chosen over 'surveillance' because combat-ID classification is an explicit published output, and because in sim.ts a classification-role sensor is one of the two roles that can promote a track to hostile. | VERIFIED | L1 | [SRC, LIDS Family of Systems brochure (marked Approved for Public Release), CUAEWS DF SYSTEM DESCRIPTION](https://www.srcinc.com/pdf/lids-family-of-systems-brochure.pdf), undated in text; PDF metadata 2021. Text extracted directly 2026-08-24. |
| `non-schema: DF output` | Lines of bearing to the UAS AND to its controller/operator | Verbatim. Operator geolocation is the capability that distinguishes this record from every other RF sensor in the library. RangeBoard has no LOB or operator-locate primitive, so this lives in the description only. | VERIFIED | L1 | [SRC, LIDS Family of Systems brochure (marked Approved for Public Release), CAPABILITIES](https://www.srcinc.com/pdf/lids-family-of-systems-brochure.pdf), undated in text; PDF metadata 2021. Text extracted directly 2026-08-24. |
| `non-schema: target set` | Groups 1, 2 and small Group 3 UAS, individual targets or swarms | Verbatim. The same sentence covers both halves of CUAEWS. | VERIFIED | L1 | [SRC, LIDS Family of Systems brochure (marked Approved for Public Release)](https://www.srcinc.com/pdf/lids-family-of-systems-brochure.pdf), undated in text; PDF metadata 2021. Text extracted directly 2026-08-24. |
| `non-schema: anti-jam-resistant threats` | DF is aimed at spread-spectrum and rapid frequency-hopping control links | Verbatim. Relevant to T&E: this is a claim about which threat links the DF can hold, not a range claim. | VERIFIED | L1 | [SRC, LIDS Family of Systems brochure (marked Approved for Public Release), CAPABILITIES](https://www.srcinc.com/pdf/lids-family-of-systems-brochure.pdf), undated in text; PDF metadata 2021. Text extracted directly 2026-08-24. |
| `non-schema: physical` | Tower 140 lb, 156.5 in adjustable height, 38 in diameter; EW hardware 250 lb; power supply 95 lb; 2,200 W at 110/240 VAC or 28 VDC; six transport cases | Shared with the jammer half: the brochure gives one physical-characteristics block for the whole CUAEWS DF emplacement. The 2,200 W figure is PRIME POWER DRAW and is not an RF output figure. Do not convert one into the other. | VERIFIED | L1 | [SRC, LIDS Family of Systems brochure (marked Approved for Public Release), PHYSICAL CHARACTERISTICS](https://www.srcinc.com/pdf/lids-family-of-systems-brochure.pdf), undated in text; PDF metadata 2021. Text extracted directly 2026-08-24. |

**Not established by the public record:** Detection range, direction-finding range, and bearing accuracy. None are published, against any link type or emitter power. Frequency coverage. Deliberately not sought: non-public frequency plans are out of scope under the brief. Whether the DF and the jammer share one aperture set or use separate ones, which is what would decide whether an M-LIDS EW vehicle should place one entity or two. Elevation coverage and altitude ceiling. Whether the mobile emplacement's DF range is reduced like the defeat range. The brochure says the EW vehicle 'incorporates Fixed Site LIDS (slight decrease in effective detection and defeat range)' but quantifies neither.

**Unresolved source conflict:**
- Product naming: SRC LIDS brochure section title gives 'CUAEWS DF' names the whole EW element, of which direction finding is one of three capabilities alongside electronic negation and NAVWAR; RangeBoard id split gives lib-cuaews (effector, jammer half) and lib-cuaews-df (sensor, find-and-fix half). One product, two RangeBoard kinds: a SpecModel carries either an EffectorSpec or a SensorSpec, never both. Resolution: Split kept, but see existing_entry_findings: the EW-domain agent's lib-cuaews is currently NAMED 'CUAEWS DF (SRC, LIDS EW)', which collides with this record. Rename the effector..

### `lib-cm262` CM262 EO/IR/SWIR gimbal (CACI)

- **Manufacturer:** CACI International (Ascent Vision Technologies)
- **Country:** US
- **Operators:** US Marine Corps (L-MADIS)
- **Program:** USMC L-MADIS sensor vehicle EO/IR
- **Status:** CURRENT
- **Mobility:** vehicle
- **UAS groups:** 1, 2, 3

| Field | Value | Range type / condition | Grade | Layer | Source |
| --- | --- | --- | --- | --- | --- |
| `sensor.detectRangeM` | 5000 m | NONE - CACI publishes no detect, recognise or identify range for the CM262 — UNKNOWN. 5000 m is SENSOR_ROLE_DEFAULT_RANGE_M['classification'] from src/model/types.ts used as a REPRESENTATIVE planning factor for an identification-role EO/IR. It sits inside the library's fielded EO/IR band (lib-teleidoscope 2000, lib-wisp 4800, lib-spynel 5000, lib-mxgcs 8000). WARNING: the datasheet's only large number is the laser rangefinder's 'Up to 16km', which is a ranging capability against whatever the operator can already see and is NOT a detection range. It must never be written into this field. | UNKNOWN | REPRESENTATIVE | [CACI, 'CM262 ground system - Multi-mission ISR and C-sUAS' datasheet (PDF), linked from https://www.caci.com/eo-ir-imaging-systems (no DRI table published)](https://caci-dam.widen.net/s/6nkd7zqbrc/gimbal_cm262), (c)2026 datasheet, retrieved accessed 2026-08-24 |
| `sensor.classifyRangeM` | 5000 m | identification range — REPRESENTATIVE, set equal to detectRangeM. Basis: this gimbal's role in L-MADIS is visual identification on a radar cue, so the detection event and the identification event are the same event. Matches the convention used for lib-wisp. | UNKNOWN | REPRESENTATIVE | [CACI, 'CM262 ground system - Multi-mission ISR and C-sUAS' datasheet (PDF), linked from https://www.caci.com/eo-ir-imaging-systems](https://caci-dam.widen.net/s/6nkd7zqbrc/gimbal_cm262), accessed 2026-08-24 |
| `sensor.sectorDeg` | 360 deg (360 deg) | azimuth coverage — Datasheet gimbal specification: 'Azimuth 360 deg continuous'. Slew rate 360 deg/s, acceleration 500 deg/s^2. This is a slewed single-aperture sight, so 360 deg is a field of REGARD, not simultaneous coverage; RangeBoard has no field-of-regard-versus-field-of-view distinction. | MANUFACTURER_CLAIM | L1 | [CACI, 'CM262 ground system - Multi-mission ISR and C-sUAS' datasheet (PDF), linked from https://www.caci.com/eo-ir-imaging-systems, GIMBAL SPECIFICATIONS](https://caci-dam.widen.net/s/6nkd7zqbrc/gimbal_cm262), accessed 2026-08-24 |
| `sensor.elevationDeg` | -16,90 deg (+90 deg / -16 deg from horizon deg) | elevation coverage — Datasheet gimbal specification, stated from the horizon, so the datum is unambiguous and the pair can be written directly. | MANUFACTURER_CLAIM | L1 | [CACI, 'CM262 ground system - Multi-mission ISR and C-sUAS' datasheet (PDF), linked from https://www.caci.com/eo-ir-imaging-systems, GIMBAL SPECIFICATIONS](https://caci-dam.widen.net/s/6nkd7zqbrc/gimbal_cm262), accessed 2026-08-24 |
| `non-schema: laser rangefinder` | 16000 m (16 km) | laser rangefinder maximum ranging range — Datasheet LASER block: 'Sensor: Range finder. Range: Up to 16km. Wavelength: 1535nm. Class 1.' RECORDED AND DELIBERATELY NOT USED. An LRF ranges a target the operator has already acquired; it says nothing about the range at which a Group 1 UAS can be detected or identified. This is the single most likely misreading in this record. | MANUFACTURER_CLAIM | L3 | [CACI, 'CM262 ground system - Multi-mission ISR and C-sUAS' datasheet (PDF), linked from https://www.caci.com/eo-ir-imaging-systems, LASER](https://caci-dam.widen.net/s/6nkd7zqbrc/gimbal_cm262), accessed 2026-08-24 |
| `non-schema: sensor suite` | HD EO 1280x720 (HFoV 8 to 1.1 deg, 35-264 mm), MWIR 1280x1024 (HFoV 46.2 to 2.4 deg, 15-300 mm), SWIR 640x512 (HFoV 13.7 to 1.4 deg, 40-400 mm), 1535 nm laser rangefinder | Datasheet. All four sensors are in one 16 kg gimbal, so one RangeBoard sensor entity is the right model for it. Frame rate 25 Hz on all three imagers. | MANUFACTURER_CLAIM | L1 | [CACI, 'CM262 ground system - Multi-mission ISR and C-sUAS' datasheet (PDF), linked from https://www.caci.com/eo-ir-imaging-systems, Configurations](https://caci-dam.widen.net/s/6nkd7zqbrc/gimbal_cm262), accessed 2026-08-24 |
| `non-schema: C-UAS features` | On-board object tracking, 'C-UAS tracking', GEO-Lock, scene steering, operator assist; MISB and STANAG 4609 compliant video | Datasheet video specifications. 'C-UAS tracking' is listed as a named video-processing feature, which is the vendor's own statement that this is a counter-UAS sight and not only an ISR gimbal. | MANUFACTURER_CLAIM | L1 | [CACI, 'CM262 ground system - Multi-mission ISR and C-sUAS' datasheet (PDF), linked from https://www.caci.com/eo-ir-imaging-systems, VIDEO SPECIFICATIONS](https://caci-dam.widen.net/s/6nkd7zqbrc/gimbal_cm262), accessed 2026-08-24 |
| `platform` | EO/IR of the L-MADIS sensor vehicle, paired with the RPS-42 radar | CRS naming the L-MADIS detection components. Trade reporting names the fitted variant 'CM262U'. congress.gov returned HTTP 403 to every direct fetch in this session. The quotation is reproduced verbatim from the radar- and systems-domain agents' extracts of the same CRS product; a congress.gov index snippet independently confirms the XBAEU expansion. | VERIFIED | L1 | [CRS R48477, Department of Defense Counter Unmanned Aircraft Systems: Background and Issues for Congress; The War Zone, 'Every Marine A Drone Defender Under Three Part Counter-UAS Plan' (names the CM262U turret)](https://www.congress.gov/crs-product/R48477), 2025-03-31 |
| `non-schema: physical` | 35.27 lb / 16 kg; 352 mm diameter, 378 mm high; 20-32 V; 40 W idle, 400 W peak; IP67; -10 to +60 C; TRL-9 | Datasheet. The 16 kg mass is what makes it viable on a Polaris MRZR mast. | MANUFACTURER_CLAIM | L1 | [CACI, 'CM262 ground system - Multi-mission ISR and C-sUAS' datasheet (PDF), linked from https://www.caci.com/eo-ir-imaging-systems, GIMBAL SPECIFICATIONS](https://caci-dam.widen.net/s/6nkd7zqbrc/gimbal_cm262), accessed 2026-08-24 |

**Not established by the public record:** Detect, recognise and identify ranges against any target class. The datasheet publishes optics and fields of view but no DRI table. Whether the L-MADIS fit is the CM262 or the CM262U, and what the U suffix changes. Whether the CM262 auto-tracks a UAS off a radar cue automatically or needs an operator to slew it. Stabilisation performance in microradians, which is what would let a DRI range be estimated from the optics.

### `lib-drs-s3` DRS S3 stabilised sight (RIwP turret)

- **Manufacturer:** Leonardo DRS
- **Country:** US
- **Operators:** US Army
- **Program:** Moog RIwP turret sight: M-LIDS kinetic-defeat vehicle and M-SHORAD Increment 1 (SGT STOUT)
- **Status:** CURRENT
- **Mobility:** vehicle
- **UAS groups:** 1, 2, 3

| Field | Value | Range type / condition | Grade | Layer | Source |
| --- | --- | --- | --- | --- | --- |
| `sensor.detectRangeM` | 2000 m (2 km) | target acquisition range of the M-LIDS electro-optical/infrared camera gun system — Verbatim, stated identically for both M-LIDS vehicles: 'Electro-optical/ infrared camera gun system target acquisition range >2 km'. 'Greater than 2 km' makes 2000 a floor, not a ceiling. The brochure attaches the figure to 'the EO/IR camera gun system', not to the S3 by name; see the attribution row below. | VERIFIED | L1 | [SRC, LIDS Family of Systems brochure (marked Approved for Public Release), MOBILE SOLUTIONS (Electronic Warfare and Kinetic vehicles)](https://www.srcinc.com/pdf/lids-family-of-systems-brochure.pdf), undated in text; PDF metadata 2021. Text extracted directly 2026-08-24. |
| `attribution of the >2 km figure to the S3` | The S3 is the only EO/IR named on the M-LIDS kinetic vehicle, so the vehicle's EO/IR camera gun system figure is attributed to it | INFERRED by elimination, not stated. The kinetic vehicle's component list is: FAAD C2, mission data recorder, secure comms, wired/wireless network, masted KuMRFS-M, and the RIwP with S3 sight, XM914E1, M240 and Coyote Block 2+. No second EO/IR appears. The EW vehicle carries the same '>2 km' bullet but the brochure does not name its camera at all. | INFERRED | L1 | [SRC, LIDS Family of Systems brochure (marked Approved for Public Release), Turreted Systems HIGH POINT and two-vehicle M-LIDS system description](https://www.srcinc.com/pdf/lids-family-of-systems-brochure.pdf), undated in text; PDF metadata 2021. Text extracted directly 2026-08-24. |
| `sensor.classifyRangeM` | 1500 m | identification range — REPRESENTATIVE planning value. No identification range is published. Basis: lib-teleidoscope, the library's other M-LIDS-family EO/IR at the same fire-control role, carries 2000 detect / 1500 classify, so this record uses the same pair rather than inventing a new ratio. | UNKNOWN | REPRESENTATIVE | [RangeBoard lib-teleidoscope (src/model/seedLibrary.ts) - basis only](https://www.srcinc.com/pdf/lids-family-of-systems-brochure.pdf), accessed 2026-08-24 |
| `sensor.role` | fire-control | Verbatim. 'Through kinetic engagements' is an explicit fire-control statement, and the auto-tracker is what holds the track while the gun fires. | VERIFIED | L1 | [SRC, LIDS Family of Systems brochure (marked Approved for Public Release), Turreted Systems](https://www.srcinc.com/pdf/lids-family-of-systems-brochure.pdf), undated in text; PDF metadata 2021. Text extracted directly 2026-08-24. |
| `sensor.sectorDeg` | 360 deg | azimuth coverage — INFERRED planning value. The S3 is described as 'an integrated, independently stabilized sight' inside a trainable remote weapons turret, which implies all-round field of regard, but the brochure publishes no traverse figure and Leonardo DRS's own site returned HTTP 403 in this session. Field of REGARD, not simultaneous coverage. | INFERRED | REPRESENTATIVE | [SRC, LIDS Family of Systems brochure (marked Approved for Public Release), Turreted Systems](https://www.srcinc.com/pdf/lids-family-of-systems-brochure.pdf), undated in text; PDF metadata 2021. Text extracted directly 2026-08-24. |
| `non-schema: host turret` | Moog RIwP: XM914E1 30 mm, coaxial M240 7.62 mm, two-round Coyote Block 2+ launcher, integrated weather sensor, both direct-fire weapons reloadable under armour | Brochure turret description. This is why the S3 belongs in both the M-LIDS and the SGT STOUT presets: it is the sight of the turret, not of the vehicle. | VERIFIED | L1 | [SRC, LIDS Family of Systems brochure (marked Approved for Public Release), Turreted Systems](https://www.srcinc.com/pdf/lids-family-of-systems-brochure.pdf), undated in text; PDF metadata 2021. Text extracted directly 2026-08-24. |

**Not established by the public record:** Whether the Stryker-based M-LIDS Increment 2.1 keeps the S3 sight. CRS names the Moog RIwP turret on that build but does not name the sight. Any vendor specification at all: field of view, focal lengths, sensor formats, turret traverse and elevation. Leonardo DRS returned HTTP 403 to every fetch in this session, so nothing is taken from the OEM. Whether the '>2 km' acquisition figure is against a Group 1 UAS, a ground vehicle, or a personnel target. The brochure states it without a target class. Whether the SGT STOUT RIwP carries the same S3 configuration as the M-LIDS RIwP.

### `lib-sentry-lr-fc` Long Range Sentry Tower w/ fire control (Anduril)

- **Manufacturer:** Anduril Industries
- **Country:** US
- **Operators:** US Marine Corps (I-CsUAS program of record), Kuwait (FMS approved June 2026, not yet delivered)
- **Program:** Anduril Sentry family; USMC Installation-Counter small Unmanned Aircraft Systems (I-CsUAS)
- **Status:** CURRENT
- **Mobility:** fixed
- **UAS groups:** 1, 2, 3

| Field | Value | Range type / condition | Grade | Layer | Source |
| --- | --- | --- | --- | --- | --- |
| `sensor.detectRangeM` | 15000 m (15 km) | detection and tracking range against Group 1-3 drone threats — Verbatim from the Sentry product page: 'Long Range Sentry with ultra-high-powered 360-degree radar for detecting and tracking Group 1-3 drone threats up to 15 km'. Target class is stated, which is rare and is why this record ships a real number. 'Up to' makes 15000 a ceiling, not a guaranteed range, and no RCS, altitude or environment condition is given. | MANUFACTURER_CLAIM | L1 | [Anduril Industries, Sentry product page](https://www.anduril.com/sentry), accessed 2026-08-24 |
| `sensor.classifyRangeM` | null m | classification range — UNKNOWN. Anduril states the radar is 'designed to identify, classify and track group 1-3 drone threats' but publishes no separate classification range, and the 15 km figure is written against detection and tracking only. null rather than a copy of detectRangeM, following the radar-domain agent's convention. Consequence in the engine: this sensor alone will not promote a track to hostile; the track reaches hostile when it enters an effector envelope. | UNKNOWN | L3 | [Anduril Industries, Sentry product page](https://www.anduril.com/sentry), accessed 2026-08-24 |
| `sensor.sectorDeg` | 360 deg (360 deg) | azimuth coverage — Verbatim: 'equipped with an ultra high powered, 360 radar'. Unlike the slewed EO/IR sights in this delivery, this is genuine simultaneous all-round radar coverage. | MANUFACTURER_CLAIM | L1 | [Anduril Industries, Sentry product page](https://www.anduril.com/sentry), accessed 2026-08-24 |
| `MULTI-SENSOR SIMPLIFICATION` | The tower is a fused radar + EO + MWIR mast; RangeBoard models the radar only | Anduril's own Sentry feature list. Radar was chosen as the single modelled sensorType because the only published UAS range for this variant is a radar range and because the radar is what the variant is named for. The EO and MWIR channels are NOT modelled: a planner reading this ring is seeing the radar only. Note also that the X-band MTI statement is a family-level feature callout, so it is not certain the LR variant's 'ultra high powered' radar is the same X-band MTI unit. | MANUFACTURER_CLAIM | L1 | [Anduril Industries, Sentry product page, feature callouts](https://www.anduril.com/sentry), accessed 2026-08-24 |
| `variant naming` | 'with Fire Control' comes from a US arms-sale component list, not from Anduril | The June 2026 US government arms-sale notice for Kuwait lists these four tower line items. Anduril's own product page calls the variant simply 'Long Range Sentry' and does not use the fire-control suffix, so the two names are joined here on strong but not stated grounds. Anduril separately won an Army and DIU counter-UAS fire-control competition in October 2025, which is consistent with a fire-control variant existing. | REPORTED | L1 | [Breaking Defense, 'US approves $2B sale of Anduril counter-drone systems to Kuwait' (relaying the DSCA component list); UAS Vision / Tectonic Defense on the Army-DIU counter-UAS fire control award](https://breakingdefense.com/2026/06/us-approves-2b-sale-of-anduril-counter-drone-systems-to-kuwait/), 2026-06-05 (arms-sale notice); 2025-10-21 (fire control award reporting) |
| `autonomy and power` | On-edge sensor fusion and object detection; solar with backup propane generator; buildable and online in under three hours | Anduril product page. This is why the integration profile marks it standalone: the tower completes detect, classify and track with no external connection. | MANUFACTURER_CLAIM | L1 | [Anduril Industries, Sentry product page](https://www.anduril.com/sentry), accessed 2026-08-24 |
| `family context` | Sentry ships in standard, long-range, extended, maritime, cold weather and mobile configurations | Recorded so nobody merges the variants: Standard Range detects personnel and vehicles up to 3.5 km, Maritime detects surface vessels beyond 15 km, Extended Range detects threats up to 8 km. Only the Long Range figure is against drones. Those are four different target classes and four different numbers. | MANUFACTURER_CLAIM | L1 | [Anduril Industries, Sentry product page](https://www.anduril.com/sentry), accessed 2026-08-24 |

**Not established by the public record:** Which radar the Long Range Sentry carries. It is NOT established that it is Anduril's Spyglass: lib-spyglass carries a 3.5 km manufacturer figure, and 15 km against Group 1-3 is a different claim. Do not merge the two records. Band. The Sentry family feature list names an X-band MTI radar, but it is not stated that the LR variant's 'ultra high powered' radar is that unit. Mast height for the Long Range variant. Anduril publishes 80 ft for the Extended Range tower and 5.5 m for Maritime, and gives no figure for Long Range. What the 'with Fire Control' line item adds over the baseline Long Range Sentry, and whether it is a hardware module or a Lattice software licence. Elevation coverage, track capacity, update rate, resolution, minimum range. None published. Towers per site, tower spacing, and whether US installation sites carry kinetic effectors at all.

**Unresolved source conflict:**
- Variant name: Anduril product page gives 'Long Range Sentry', no fire-control suffix; June 2026 US arms-sale component list gives 'Long Range Sentry Tower with Fire Control'. The arms-sale line item names a configuration or option package that the public product page does not break out. Resolution: UNRESOLVED. The record uses the arms-sale name because that is the name the preset asked for, and records the vendor name as an alias..

## Kinetic effectors

### `lib-stinger` FIM-92 Stinger (M-SHORAD / MADIS)

- **Manufacturer:** RTX (Raytheon)
- **Country:** United States
- **Operators:** US Army (M-SHORAD Inc 1 / Sgt. Stout), US Marine Corps (MADIS Mk1), Ukraine, multiple NATO members
- **Program:** M-SHORAD Increment 1 (Sgt. Stout); USMC MADIS Increment 1; Stinger Service Life Extension Program
- **Status:** CURRENT
- **Mobility:** vehicle
- **UAS groups:** 2, 3

| Field | Value | Range type / condition | Grade | Layer | Source |
| --- | --- | --- | --- | --- | --- |
| `effector.minRangeM` | 200 m (200 m) | minimum engagement range — quoted minimum effective range for the FIM-92 family; not variant-specific | CORROBORATED | L1 | [Raytheon (General Dynamics) FIM-92 Stinger — Directory of U.S. Military Rockets and Missiles](https://www.designation-systems.net/dusrm/m-92.html), 2024-12-15 |
| `effector.maxRangeM` | 4800 m (4800 m) | WEAPON MAXIMUM RANGE (FIM-92C, conventional IR-signature air target) — This is the weapon maximum range against a normal aircraft/helicopter IR signature, NOT a measured C-UAS engagement range. No public effective C-UAS engagement range exists. Used as the board planning ring for Group 2-3 targets with hot engines; against cold, low-signature Group 1 electric quads the usable range is shorter and UNKNOWN. RMP Block II was quoted at 8,000 m but that variant was cancelled and is not fielded — do not use 8 km. | CORROBORATED | REPRESENTATIVE | [Raytheon (General Dynamics) FIM-92 Stinger — Directory of U.S. Military Rockets and Missiles](https://www.designation-systems.net/dusrm/m-92.html), 2024-12-15 |
| `effector.maxAltitudeFt` | 12500 ft (3800 m) | engagement altitude ceiling — flight ceiling 3,800 m; recorded-only field, never used to alter a range value | CORROBORATED | L1 | [FIM-92 Stinger: The Shoulder-Fired Missile Changing Wars](https://thedefensepost.com/2025/11/13/fim-92-stinger-guide/), 2025-11-13 |
| `effector.engageTimeS` | 15 s | assignment-to-effect time — DERIVED, not published. Arithmetic: Stinger flyout is quoted at Mach 2.2+ (about 750 m/s); 4,800 m / 750 m/s = 6.4 s time of flight. Add roughly 8 s for seeker cool-down, IR lock tone and launch sequence: 6.4 + 8 = 14.4 s, rounded to 15 s. No public assignment-to-effect figure exists. | INFERRED | REPRESENTATIVE | [Raytheon (General Dynamics) FIM-92 Stinger — Directory of U.S. Military Rockets and Missiles](https://www.designation-systems.net/dusrm/m-92.html), 2024-12-15 |
| `effector.pk` | 0.7 probability | single-shot probability of kill — UNKNOWN in the public record. 0.7 is a representative planning value only, NOT tested performance. It is set below the Coyote entry because the Stinger IR seeker is poorly matched to cold, low-signature electric Group 1 quads; the FIM-92J proximity fuze was added specifically to improve performance against small UAS, which implies the baseline impact-fuzed missile performed poorly against them. | UNKNOWN | REPRESENTATIVE | [Raytheon (General Dynamics) FIM-92 Stinger — Directory of U.S. Military Rockets and Missiles](https://www.designation-systems.net/dusrm/m-92.html), 2024-12-15 |
| `effector.magazineSize` | 4 ready interceptors on one launcher (4 missiles) | ready rounds on the launcher — MADIS Mk1 turret carries a four-round Stinger ATAL pod; the Stryker M-SHORAD RIwP turret carries four Stingers. Reload is a manual crew task off the turret; reload time is not public. | CORROBORATED | L1 | [MADIS Marine Air Defense Integrated System](https://www.armyrecognition.com/military-products/army/air-defense-systems/air-defense-vehicles/madis-marine-air-defense-integrated-system), 2025 |
| `effector.salvoCooldownS` | 10 s | salvo cooldown — no public figure; representative turret re-slew and next-round tone time | UNKNOWN | REPRESENTATIVE | n/a — representative planning value, 2026-08-24 |
| `status.demonstrated_vs_fielded` | FIELDED (SHORAD role) / DEMONSTRATED (C-UAS role) | operational status — FIELDED as the SHORAD missile of M-SHORAD Inc 1 and MADIS Mk1. C-UAS use: first Stinger launch from a Stryker M-SHORAD against an Outlaw target drone, December 2025; USMC MADIS live-fire engaged multiple unmanned aerial targets with Stinger and the 30 mm cannon at Twentynine Palms / Yuma. Ukraine has used Stinger against Russian UAS since 2022 (REPORTED, not authoritatively confirmed per-engagement). | CORROBORATED | L1 | [U.S. Army conducts first Stinger missile launch from Stryker M-SHORAD air defense vehicle](https://www.armyrecognition.com/news/army-news/2025/u-s-army-conducts-first-stinger-missile-launch-from-stryker-m-shorad-air-defense-vehicle), 2025-12 |
| `guidance_and_seeker` | passive IR/UV two-colour imaging seeker, fire-and-forget; FIM-92K adds a vehicle datalink for lock-on-after-launch | guidance mode / seeker type — FIM-92B onward uses a two-band IR/UV microprocessor seeker; FIM-92J adds a proximity fuze mode optimised against small UAS; FIM-92K adds a datalink so the launch vehicle can update the missile from its own radar | CORROBORATED | L1 | [Raytheon (General Dynamics) FIM-92 Stinger — Directory of U.S. Military Rockets and Missiles](https://www.designation-systems.net/dusrm/m-92.html), 2024-12-15 |
| `radar_fire_control_dependency` | None required for terminal guidance (IR fire-and-forget). Acquisition cue on MADIS comes from the Mk2 vehicle's RPS-42-family radar; on M-SHORAD from the vehicle's RADA MHR-family radar. | fire-control dependency — no guidance uplink is required, unlike Coyote Block 2 which needs a Ku-band uplink | CORROBORATED | L1 | [Department of Defense Counter Unmanned Aircraft Systems: Background and Issues for Congress (CRS R48477)](https://www.congress.gov/crs-product/R48477), 2025-03-31 |

**Not established by the public record:** Effective C-UAS engagement range against a Group 1 electric quadcopter (low IR signature). No public figure. Single-shot Pk against any UAS class. No public figure. Minimum engagement range specific to the FIM-92J/K proximity-fuze modes. Turret reload time for the four-round pod. Whether FIM-92K datalink cueing measurably extends the usable C-UAS envelope.

**Unresolved source conflict:**
- maximum range: designation-systems.net FIM-92 (2024-12-15) gives 4,800 m (FIM-92C standard); 8,000 m attributed to RMP Block II; The Defense Post FIM-92 guide (2025-11-13) gives roughly 4-5 km. RMP Block II was cancelled and never fielded, so its 8 km figure does not describe a fielded round. Fielded FIM-92C/E/J/K sit at 4.8 km. Resolution: RESOLVED — use 4,800 m; explicitly reject the 8,000 m figure.
- altitude ceiling: designation-systems.net FIM-92 gives 3,800 m printed as 26,200 ft (internally inconsistent; 3,800 m = 12,467 ft); The Defense Post FIM-92 guide gives 3,800 m / 12,500 ft. typographic error in the first source's unit conversion Resolution: RESOLVED — 3,800 m = 12,500 ft.

### `lib-eagls` EAGLS 70 mm APKWS launcher

- **Manufacturer:** MSI Defense Solutions, BAE Systems (APKWS II guidance section), L3Harris (FALCO proximity fuze)
- **Country:** United States
- **Operators:** US Army (CENTCOM), US Navy / NAVAIR
- **Program:** US Army Rapid Acquisition Authority C-UAS; NAVAIR sole-source EAGLS buy
- **Status:** CURRENT
- **Mobility:** expeditionary
- **UAS groups:** 1, 2, 3

| Field | Value | Range type / condition | Grade | Layer | Source |
| --- | --- | --- | --- | --- | --- |
| `effector.maxRangeM` | 5000 m (5 km) | effective C-UAS engagement range (planning value) — This is the EFFECTIVE ENGAGEMENT RANGE used for the board ring, not a weapon maximum and not a detection range. Basis: APKWS II air-to-air engagement of rotary-wing class targets is quoted at 5 km maximum; a ground launcher gives up the launch aircraft's altitude and forward velocity, so ground-launched engagement range is at or below the air-launched figure. The widely repeated 'EAGLS envelope reaching about 10 km' figure is explicitly tied to the RPS-40 radar detection range and is a DETECTION figure, not a weapon figure — see conflicts. | REPORTED | REPRESENTATIVE | [APKWS: The Cheap Rocket That Kills Drones](https://migflug.com/jetflights/apkws-laser-guided-rocket-saudi-arabia-counter-drone-2026/), 2026 |
| `effector.minRangeM` | 500 m | minimum engagement range — no public figure; representative value covering rocket boost, fin deployment and guidance-section settling before the semi-active laser seeker can command | UNKNOWN | REPRESENTATIVE | n/a — representative planning value, 2026-08-24 |
| `effector.magazineSize` | 4 ready rockets on one launcher (4 rockets) | ready rounds on the launcher — EAGLS is a four-round 70 mm launcher on a CROWS II mount. Reload uses preloaded launcher pods. The L3Harris VAMPIRE family, which fires the same APKWS II round from a ground vehicle, offers a 12-round 'Stalker XR' pod — a different system, do not apply that count to EAGLS. | CORROBORATED | L1 | [Laser Rocket Anti-Drone Systems Being Rushed To U.S. Forces In The Middle East](https://www.twz.com/land/laser-rocket-anti-drone-systems-being-rushed-to-u-s-forces-in-the-middle-east), 2024-04-15 |
| `effector.engageTimeS` | 15 s | assignment-to-effect time — DERIVED, not published. Arithmetic: the Hydra 70 motor gives a burnout velocity near 700 m/s with an average velocity over a 5 km flight of roughly 500 m/s; 5,000 m / 500 m/s = 10 s time of flight. Add about 5 s for RWS slew, EO/IR handoff and laser designation settling: 10 + 5 = 15 s. | INFERRED | REPRESENTATIVE | [Laser Rocket Anti-Drone Systems Being Rushed To U.S. Forces In The Middle East](https://www.twz.com/land/laser-rocket-anti-drone-systems-being-rushed-to-u-s-forces-in-the-middle-east), 2024-04-15 |
| `effector.pk` | 0.7 probability | single-shot probability of kill — UNKNOWN in the public record. 0.7 is a representative planning value only, NOT tested performance. It is held below the interceptor-missile entries because semi-active laser guidance needs an unbroken designation line and is documented as degraded by weather, dust and obscurants. | UNKNOWN | REPRESENTATIVE | [U.S. Deploys EAGLS Counter-Drone Air Defense System to Protect Middle East Bases](https://www.armyrecognition.com/news/army-news/2026/u-s-deploys-eagls-counter-drone-air-defense-system-to-protect-middle-east-bases), 2026-01-22 |
| `effector.maxAltitudeFt` | null ft | engagement altitude ceiling — UNKNOWN. Reporting says EAGLS engages Group 1 and Group 2 UAS 'at low altitude and moderate speeds' but gives no ceiling. Left null rather than substituting the Group 2 definitional altitude band, which describes the target class and not the weapon. | UNKNOWN | L3 | [U.S. Deploys EAGLS Counter-Drone Air Defense System to Protect Middle East Bases](https://www.armyrecognition.com/news/army-news/2026/u-s-deploys-eagls-counter-drone-air-defense-system-to-protect-middle-east-bases), 2026-01-22 |
| `guidance_and_seeker` | semi-active laser homing (APKWS II mid-body guidance section) on the launcher's own EO/IR turret designator; FALCO proximity-fuzed warhead variant for air targets | guidance mode / seeker type — FALCO (Fixed Wing, Air Launched, Counter-UAS Ordnance, AGR-20F) is the proximity-fuzed air-to-air APKWS variant; L3Harris received a $48.5 M contract (potential $98.3 M) for FALCO fuzes on 2026-06-04. TWZ reports Navy work on a proximity-fuzed warhead for the ground-launched application but does not name it FALCO — treat ground FALCO fuzing as REPORTED, not confirmed. | CORROBORATED | L1 | [US Military Orders FALCO Fuzes to Turn APKWS Into Drone Killers](https://thedefensepost.com/2026/06/04/us-falco-fuzes-apkws/), 2026-06-04 |
| `radar_fire_control_dependency` | Organic Leonardo DRS RPS-40 S-band AESA (Multi-Mission Hemispheric Radar family), detection to 10 km, plus an organic EO/IR turret with laser designator. No external fire-control uplink required.  (10 km) | DETECTION RANGE of the organic radar — not an engagement range — RPS-40 detection range against low-flying aerial targets, manufacturer/reporting figure. Recorded here only to prevent it being mistaken for the weapon envelope. | CORROBORATED | L1 | [Laser Rocket Anti-Drone Systems Being Rushed To U.S. Forces In The Middle East](https://www.twz.com/land/laser-rocket-anti-drone-systems-being-rushed-to-u-s-forces-in-the-middle-east), 2024-04-15 |
| `status.demonstrated_vs_fielded` | FIELDED | operational status — Six EAGLS delivered to the US Army under Rapid Acquisition Authority, August 2024. NAVAIR sole-source order for five systems, $24,186,464, 12 April 2024. Live fire at Udairi Range, Kuwait during Exercise Sky Shield, 4 December 2025. USCENTCOM confirmed deployment to multiple operational sites in the Middle East, 18 January 2026. | CORROBORATED | L1 | [U.S. Deploys EAGLS Counter-Drone Air Defense System to Protect Middle East Bases](https://www.armyrecognition.com/news/army-news/2026/u-s-deploys-eagls-counter-drone-air-defense-system-to-protect-middle-east-bases), 2026-01-22 |

**Not established by the public record:** Published engagement range for the ground-launched APKWS in the EAGLS configuration. The 5 km value is a planning figure carried over from the air-to-air envelope. Minimum engagement range. Altitude ceiling of the engagement envelope. Single-shot Pk against any UAS class. Whether fielded EAGLS rockets carry the FALCO proximity fuze or a contact-fuzed warhead. Reload time for a spent four-round pod. Which specific C2 the CENTCOM EAGLS sites route through.

**Unresolved source conflict:**
- engagement envelope: Militarnyi, 2026 (US deploys EAGLS in the Middle East) gives engagement envelope 'can reach about 10 km, broadly matching the radar's detection range'; Army Recognition, 22 Jan 2026 gives effective engagement envelope 'measured in several kilometres'. The 10 km figure is the RPS-40 DETECTION range being restated as a weapon envelope. Detection range and effective engagement range are different quantities and a 70 mm rocket's terminal energy and laser designation geometry both fall off well inside the radar horizon. Resolution: UNRESOLVED — recorded both. Board value set at 5,000 m and labelled REPRESENTATIVE. Do not promote the 10 km detection figure into a weapon range..

### `lib-skyranger30` Skyranger 30 (Rheinmetall)

- **Manufacturer:** Rheinmetall Air Defence
- **Country:** Germany / Switzerland
- **Operators:** Germany (Boxer, 19 vehicles ordered Feb 2024), Austria (Pandur EVO), Hungary (Lynx KF41, launch customer 2023), Denmark (16 turrets, Sep 2024), Netherlands (ACSV Super Bison, selected 2025)
- **Program:** Bundeswehr Nächstbereichsschutz / NATO mobile SHORAD and C-UAS
- **Status:** FIELDING
- **Mobility:** vehicle
- **UAS groups:** 1, 2, 3

| Field | Value | Range type / condition | Grade | Layer | Source |
| --- | --- | --- | --- | --- | --- |
| `effector.maxRangeM` | 3000 m (3 km) | effective engagement range of the cannon — Rheinmetall states an effective range of up to 3,000 m for the 30x173 KCE revolver cannon; a secondary source qualifies it as 'up to 3 kilometres depending on target type'. This is the gun's effective engagement range, not a maximum ballistic range. Missile options mounted on the same turret (Stinger 5 km, Mistral 3 8 km, SkyKnight 10 km, MBDA DefendAir) extend the vehicle's envelope past the gun ring; those are separate effectors and are NOT folded into this value. | MANUFACTURER_CLAIM | L1 | [Skyranger — Mobile air defence (Rheinmetall product page)](https://www.rheinmetall.com/en/products/air-defence-systems/mobile-air-defence-skyranger), 2026-08-24 |
| `effector.minRangeM` | 200 m | minimum engagement range — no public figure; representative close-in limit for a programmable airburst round that must be fuze-set at the muzzle and needs flight time before the burst point | UNKNOWN | REPRESENTATIVE | n/a — representative planning value, 2026-08-24 |
| `effector.engageTimeS` | 8 s | assignment-to-effect time — DERIVED, not published. Arithmetic: 30x173 mm airburst projectile muzzle velocity is of order 1,000 m/s, so 3,000 m / 1,000 m/s = 3 s time of flight. Add about 5 s for turret slew, track settling and fuze programming: 3 + 5 = 8 s. | INFERRED | REPRESENTATIVE | [Skyranger 30 Air Defense System, Explained](https://thedefensepost.com/2026/08/10/skyranger-30-guide/), 2026-08-10 |
| `effector.pk` | 0.8 probability | single-shot probability of kill — UNKNOWN as a number. Rheinmetall claims 'an extremely high probability of hit against micro-drones' from AHEAD programmable airburst but publishes no figure. 0.8 is a representative planning value only, NOT tested performance. Note that a gun 'shot' here means a programmed burst, not a single projectile. | MANUFACTURER_CLAIM | REPRESENTATIVE | [Germany To Bet Big On Skyranger Gun System To Address Growing Drone Threat](https://www.twz.com/land/germany-to-bet-big-on-skyranger-gun-system-to-address-growing-drone-threat), 2025 |
| `effector.magazineSize` | 300 ready rounds in the turret (300 rounds) | ready rounds on the mount — 300 ready rounds of PMC308/PMC455 airburst ammunition in the turret. SINGLE SOURCE (REPORTED). WARNING for the integrator: RangeBoard consumes magazineSize once per firing opportunity, i.e. as a SHOT count, so 300 ready rounds is not 300 engagements. At 1,200-1,250 rd/min and a burst of roughly 20-25 rounds, 300 ready rounds is about 12-15 engagements. If the engine value must mean engagements, use 12; the brief asked for ready rounds, so 300 is delivered here. | REPORTED | L1 | [Skyranger 30 (Wikipedia)](https://en.wikipedia.org/wiki/Skyranger_30), 2026-08-24 |
| `effector.salvoCooldownS` | 5 s | salvo cooldown — no public figure; representative re-slew and re-track interval for a revolver cannon on a stabilised turret | UNKNOWN | REPRESENTATIVE | n/a — representative planning value, 2026-08-24 |
| `effector.maxAltitudeFt` | null ft | engagement altitude ceiling — UNKNOWN. Rheinmetall and secondary reporting describe 'low-altitude threats' and a large elevation span but publish no ceiling. | UNKNOWN | L3 | [Skyranger 30 Air Defense System, Explained](https://thedefensepost.com/2026/08/10/skyranger-30-guide/), 2026-08-10 |
| `ammunition` | AHEAD / ABM programmable airburst (PMC308, PMC455), 30x173 mm, 1,200-1,250 rd/min | ammunition and rate of fire — airburst rounds release a sub-projectile cloud just ahead of the target; a contact fuze setter in the cannon programs each round as it cycles | CORROBORATED | L1 | [Skyranger 30 Air Defense System, Explained](https://thedefensepost.com/2026/08/10/skyranger-30-guide/), 2026-08-10 |
| `radar_fire_control_dependency` | Organic 360-degree AESA search radar (Rheinmetall Italia AMMR S-band or Hensoldt Spexer 2000M 3D MkIII X-band), stabilised EO/IR, laser rangefinder, optional Ku-band tracker. No external fire control required. | sensor and fire-control fit — the Hensoldt option is quoted at about 6 km detection against micro-UAV — a DETECTION range, not an engagement range | CORROBORATED | L1 | [Skyranger 30 (Wikipedia); Rheinmetall Skyranger product page](https://en.wikipedia.org/wiki/Skyranger_30), 2026-08-24 |
| `status.demonstrated_vs_fielded` | FIELDING | operational status — Germany ordered 19 Boxer Skyranger 30 (prototype + 18 series) worth EUR 595 M on 27 Feb 2024, series delivery 2027-2028; a verification model was handed over to the Bundeswehr in February 2025. Austria 36, Denmark 16 turrets (Sep 2024), Hungary launch customer 2023, Netherlands selected 2025. No combat C-UAS record. | CORROBORATED | L1 | [Bundeswehr ordered air defence system Skyranger 30 (Rheinmetall news)](https://www.rheinmetall.com/en/media/news-watch/news/2024/02/2024-02-27-bundeswehr-ordered-skyranger-30-mobile-air-defence-system), 2024-02-27 |

**Not established by the public record:** Ready-round count is single-sourced (300). No Rheinmetall figure found. Altitude ceiling of the engagement envelope. Single-shot or single-burst Pk against any UAS class. Minimum engagement range. Which national C2 each customer routes Skyranger through, and whether any is interoperable with the C2 models already in the library. Whether the German fit uses the AMMR or the Spexer radar.

**Unresolved source conflict:**
- rate of fire: Skyranger 30 (Wikipedia) gives 1,200 rd/min nominal; The Defense Post, Aug 2026 gives up to 1,250 rd/min. nominal versus maximum cyclic rate for the same KCE revolver cannon Resolution: UNRESOLVED — both recorded; neither affects a board field.

### `lib-dronehunter` DroneHunter F700 net interceptor

- **Manufacturer:** Fortem Technologies
- **Country:** United States
- **Operators:** US DoD (JIATF-401 / Replicator 2), US federal and allied airspace-security users
- **Program:** Replicator 2 (JIATF-401 first operational purchase, January 2026)
- **Status:** CURRENT
- **Mobility:** expeditionary
- **UAS groups:** 1, 2

| Field | Value | Range type / condition | Grade | Layer | Source |
| --- | --- | --- | --- | --- | --- |
| `effector.maxRangeM` | 5000 m (5 km) | AIR-VEHICLE RANGE of the interceptor, used as the outer C-UAS engagement radius — Published as a 5 km range for the F700 air vehicle, with a note that it 'can be configured to offer extended range'. This is the interceptor's own reach from its launch point, not a weapon effective range and not a radar range. Fortem separately claims engagement distances 'often 3x-10x' other ground-based mitigation without giving a figure. | REPORTED | L1 | [DroneHunter Counter Unmanned Aerial System (C-UAS), US](https://www.army-technology.com/projects/dronehunter-counter-unmanned-aerial-system-c-uas/), 2024 |
| `effector.minRangeM` | 100 m | minimum engagement range — no public figure; representative launch-and-climb distance before a net shot is possible | UNKNOWN | REPRESENTATIVE | n/a — representative planning value, 2026-08-24 |
| `effector.engageTimeS` | 150 s | assignment-to-effect time — DERIVED, not published. Arithmetic: reported speed is above 100 km/h, i.e. about 27.8 m/s. Full envelope 5,000 m / 27.8 m/s = 180 s. A typical intercept nearer 3,500 m gives 3,500 / 27.8 = 126 s; adding about 20 s for launch, climb and radar lock gives 146 s, rounded to 150 s. Fortem states the aircraft 'launches in seconds', which is consistent with the 20 s allowance. | INFERRED | REPRESENTATIVE | [DroneHunter Counter Unmanned Aerial System (C-UAS), US](https://www.army-technology.com/projects/dronehunter-counter-unmanned-aerial-system-c-uas/), 2024 |
| `effector.pk` | 0.85 probability (15 percent evasion) | single-shot capture probability (vendor statistic) — Fortem states 'statistically, only 15% of target drones evade the first shot', i.e. an implied 0.85 first-shot capture rate. This is a MANUFACTURER CLAIM over the vendor's own capture population (more than 4,500 captures), not an independently tested Pk, and 'capture' is not 'kill'. | MANUFACTURER_CLAIM | L1 | [DroneHunter F700 (Fortem Technologies product page)](https://fortemtech.com/products/dronehunter-f700/), 2026-08-24 |
| `effector.magazineSize` | 1 net shots per sortie | ready shots on the launcher — INFERRED. Fortem does not publish shots per sortie. The statement that the aircraft 'can be completely reloaded for back-to-back sorties in less than 3 minutes' reads as one engagement per sortie followed by recovery and reload. Some configurations carry more than one NetGun payload; the public record does not say how many. | INFERRED | REPRESENTATIVE | [DroneHunter F700 (Fortem Technologies product page)](https://fortemtech.com/products/dronehunter-f700/), 2026-08-24 |
| `effector.salvoCooldownS` | 180 s (3 minutes) | reload / sortie turnaround — 'completely reloaded for back-to-back sorties in less than 3 minutes' — vendor claim; this is a turnaround, not a between-target cooldown in flight | MANUFACTURER_CLAIM | L1 | [DroneHunter F700 (Fortem Technologies product page)](https://fortemtech.com/products/dronehunter-f700/), 2026-08-24 |
| `effector.maxAltitudeFt` | null ft | engagement altitude ceiling — UNKNOWN. Fortem states only that the F700 does 'not fly at the same high altitudes of larger drones'. | UNKNOWN | L3 | [DroneHunter F700 (Fortem Technologies product page)](https://fortemtech.com/products/dronehunter-f700/), 2026-08-24 |
| `guidance_and_seeker` | onboard Fortem TrueView R20 radar for detect, track and terminal lock; INS/GPS navigation; optical and optional 4K cameras; fully autonomous with human-on-the-loop override | guidance mode / seeker type — TrueView quoted at +/-2 degrees azimuth and elevation accuracy; its detection range is not published | CORROBORATED | L1 | [DroneHunter F700 (Fortem Technologies product page); army-technology DroneHunter project](https://fortemtech.com/products/dronehunter-f700/), 2026-08-24 |
| `effect_mechanism` | tethered net for Group 1 targets with tow-away to a safe landing zone; DrogueNet/DrogueChute for heavier targets so they descend under a parachute | defeat mechanism — maximum payload 5 lb; can tow drones up to 13 lb; non-destructive capture, chosen where debris and collateral risk matter | CORROBORATED | L1 | [DroneHunter F700 (Fortem Technologies product page)](https://fortemtech.com/products/dronehunter-f700/), 2026-08-24 |
| `status.demonstrated_vs_fielded` | FIELDED | operational status — JIATF-401 selected DroneHunter as the first Replicator 2 operational purchase, contract announced 14 January 2026 for two systems with delivery by April 2026. Earlier DoD shipments and more than 4,500 vendor-recorded captures. | CORROBORATED | L1 | [Fortem Technologies Welcomes JIATF-401's Selection of DroneHunter as First Replicator 2 Purchase](https://fortemtech.com/press-releases/2026-01-14-fortem-technologies-welcomes-jiatf-401-s-selection-of-dronehunter-as-first-replicator-2-purchase/), 2026-01-14 |

**Not established by the public record:** Net shots carried per sortie. TrueView R20 detection range against a small UAS. Endurance and altitude ceiling. Maximum interceptable target speed (Fortem claims 'fast fixed-wing' but gives no number). Whether the Replicator 2 configuration differs from the commercial F700. Any independent Pk or capture rate outside the vendor's own statistic.

## Radar

### `lib-sentinela4` Sentinel A4 air defense radar (AN/MPQ-64A4)

- **Manufacturer:** Lockheed Martin Rotary and Mission Systems
- **Country:** US
- **Operators:** US Army
- **Program:** US Army Sentinel A4 program of record (SHORAD / AMD sensor); replaces Sentinel A3
- **Status:** FIELDING
- **Mobility:** mobile
- **UAS groups:** 1, 2, 3

| Field | Value | Range type / condition | Grade | Layer | Source |
| --- | --- | --- | --- | --- | --- |
| `sensor.sectorDeg` | 360 deg (360 deg) | azimuth coverage — 'Azimuth Coverage: 360 degrees'; radar also offers stop-and-stare | MANUFACTURER_CLAIM | L1 | [Sentinel A4 — The Army's Premier Battlefield Radar for the Next 40 Years (product card)](https://www.lockheedmartin.com/content/dam/lockheed-martin/rms/documents/sentinel-a4/2315841_Sentinel_A4_Product_Card_Refresh_v2.pdf), 2024 |
| `sensor.elevationDeg` | -15,90 deg (-15 to Zenith deg) | elevation coverage — 'Elevation Coverage: -15 to Zenith'; zenith read as +90 deg | MANUFACTURER_CLAIM | L1 | [Sentinel A4 product card](https://www.lockheedmartin.com/content/dam/lockheed-martin/rms/documents/sentinel-a4/2315841_Sentinel_A4_Product_Card_Refresh_v2.pdf), 2024 |
| `sensor.detectRangeM` | 15000 m | NONE — no public range of any type against a UAS target — UNKNOWN. Lockheed Martin publishes only relative claims against the Sentinel A3 baseline, never an absolute range and never a UAS-conditioned range. 15000 m is SENSOR_ROLE_DEFAULT_RANGE_M['target-acquisition'] used as a planning factor. | UNKNOWN | REPRESENTATIVE | [RangeBoard SENSOR_ROLE_DEFAULT_RANGE_M (src/model/types.ts) — basis only](https://www.lockheedmartin.com/en-us/products/sentinel-a4.html), 2026-08-24 |
| `architecture` | X-band digital AESA, GaN high-power amplifiers, sub-array digital beamforming, rotating with stop-and-stare | Product card key radar features; LM web page adds '360 degree and stop-and-stare capability, from the ground to zenith, with no cone of silence' | MANUFACTURER_CLAIM | L1 | [Sentinel A4 product card; Lockheed Martin Sentinel A4 product page](https://www.lockheedmartin.com/en-us/products/sentinel-a4.html), 2024 / accessed 2026-08-24 |
| `track_capacity` | hundreds of simultaneous tracks; hundreds of simultaneous fire-control tracks; tens of simultaneous engagements | Not conditioned on target class | MANUFACTURER_CLAIM | L1 | [Sentinel A4 product card](https://www.lockheedmartin.com/content/dam/lockheed-martin/rms/documents/sentinel-a4/2315841_Sentinel_A4_Product_Card_Refresh_v2.pdf), 2024 |
| `mission_set` | detection, classification, identification and reporting against RAM, with capability against CM, UAS, FW and RW | DOT&E FY2023 system description. Direct PDF fetch returned HTTP 403; text read via search-engine extract of the same DOT&E PDF. | VERIFIED | L1 | [DOT&E FY2023 Annual Report: Army — Sentinel A4](https://www.dote.osd.mil/Portals/97/pub/reports/FY2023/army/2023sentinel-a4.pdf), 2024-01 (FY2023 report) |
| `program_status` | Milestone C 2023; LRIP 2 (19 systems) contracted 2023; first LRIP 2 radar delivered 2026-02-02; first phase of IOT&E complete; FRP of 200+ radars planned |  | CORROBORATED | L1 | [Lockheed Martin Delivers First Sentinel A4 from LRIP 2; Sentinel A4 product card timeline](https://news.lockheedmartin.com/2026-02-02-Lockheed-Martin-Delivers-First-Sentinel-A4-from-LRIP-2-Advances-Toward-Full-Rate-Production), 2026-02-02 |

**Not established by the public record:** Detection or track range against any UAS group. No absolute range figure of any type is public for A4. Instrumented range for A4 (the 75 km figure in secondary sources belongs to the legacy AN/MPQ-64 Sentinel, not A4). Rotation rate, range resolution, and minimum range. Whether the '360 degree' figure is a mechanical rotation or an electronic aggregate; LM describes both rotating coverage and stop-and-stare.

**Unresolved source conflict:**
- range improvement over Sentinel A3: Lockheed Martin Sentinel A4 product page (accessed 2026-08-24) gives greater than a 75% increase in range over the legacy system; Lockheed Martin Sentinel A4 product card (2024) gives Extends range by 175% and increases Sensitivity by 225% over Sentinel A3. One figure may be a percentage increase and the other a percentage of the A3 baseline (175% of A3 = +75%). Both are relative to an A3 baseline that is itself not published for UAS targets. Resolution: UNRESOLVED.
- legacy AN/MPQ-64 Sentinel range: GlobalSecurity / Wikipedia secondary reporting gives 40 km range; upgraded version 75 km; Missile Defense Advocacy Alliance gives 75 km instrumented range. Detection range and instrumented range being reported as if interchangeable, across A1/A3 variants. Resolution: UNRESOLVED — not used for any A4 field.

### `lib-gator` AN/TPS-80 G/ATOR multi-mission radar

- **Manufacturer:** Northrop Grumman
- **Country:** US
- **Operators:** US Marine Corps, US Air Force
- **Program:** USMC AN/TPS-80 program of record (Block 1 air defense/surveillance, Block 2 counterfire, Block 4 EASR); sensor for GBAD MRIC
- **Status:** CURRENT
- **Mobility:** expeditionary
- **UAS groups:** 1, 2, 3, 4, 5

| Field | Value | Range type / condition | Grade | Layer | Source |
| --- | --- | --- | --- | --- | --- |
| `sensor.detectRangeM` | 40000 m | NONE — no public range of any type against a UAS target — UNKNOWN. Northrop Grumman publishes no range figure. A '100 miles for aerial targets' claim circulates on low-tier aggregator sites with no primary source and is NOT used. 40000 m is SENSOR_ROLE_DEFAULT_RANGE_M['early-warning'] used as a planning factor. | UNKNOWN | REPRESENTATIVE | [RangeBoard SENSOR_ROLE_DEFAULT_RANGE_M (src/model/types.ts) — basis only](https://www.northropgrumman.com/what-we-do/mission-solutions/radars/an-tps-80-ground-air-task-oriented-radar-g-ator), 2026-08-24 |
| `sensor.sectorDeg` | 360 deg (360 deg) | azimuth coverage — '360-degree total surveillance'; rotating array with electronic scan | MANUFACTURER_CLAIM | L1 | [Northrop Grumman AN/TPS-80 G/ATOR product page](https://www.northropgrumman.com/what-we-do/mission-solutions/radars/an-tps-80-ground-air-task-oriented-radar-g-ator), accessed 2026-08-24 |
| `architecture` | S-band GaN AESA, 4D (range, azimuth, elevation, velocity), fire-control-quality track on a single scan | OEM product page; Wikipedia gives the same band as 2-4 GHz | CORROBORATED | L1 | [Northrop Grumman AN/TPS-80 page; Wikipedia AN/TPS-80](https://en.wikipedia.org/wiki/AN/TPS-80_Ground/Air_Task_Oriented_Radar), accessed 2026-08-24 |
| `role_in_cuas` | MRIC sensor: target detection, acquisition, location, tracking and engagement support for the SkyHunter interceptor against UAS, cruise missiles and other low-flying aircraft | CRS naming MRIC's three components | VERIFIED | L1 | [CRS R48477, Department of Defense Counter Unmanned Aircraft Systems: Background and Issues for Congress](https://www.congress.gov/crs-product/R48477), 2025-03-31 |
| `block_structure` | Block 1 air defense / air surveillance; Block 2 ground weapon locating (counterfire); Block 3 deferred; Block 4 expeditionary airport surveillance | Tertiary source; Northrop's page states the same functions without block labels | REPORTED | L1 | [Wikipedia AN/TPS-80 Ground/Air Task Oriented Radar](https://en.wikipedia.org/wiki/AN/TPS-80_Ground/Air_Task_Oriented_Radar), accessed 2026-08-24 |

**Not established by the public record:** Detection or track range against any UAS group, and instrumented range. Northrop publishes none. Rotation rate, elevation coverage limits, track capacity, range resolution. Whether G/ATOR has any documented FAAD C2 interface (USMC uses CAC2S).

**Unresolved source conflict:**
- aerial detection range: thedefensewatch.com aggregator page gives over 100 miles for aerial targets; Northrop Grumman product page gives no range figure published. Aggregator restating an unsourced figure, possibly an instrumented range for a large-RCS target. Resolution: UNRESOLVED — figure rejected, not used.

### `lib-giraffe1x` Giraffe 1X 3D radar (Saab)

- **Manufacturer:** Saab AB, Saab Inc. (East Syracuse, NY)
- **Country:** Sweden (US production for the Army order)
- **Operators:** US Army (security-cooperation buys), Estonia, Latvia, Lithuania, Belgium, France
- **Program:** US Army security-cooperation C-UAS radar procurement for Baltic partners; Saab Giraffe family
- **Status:** CURRENT
- **Mobility:** mobile
- **UAS groups:** 1, 2, 3

| Field | Value | Range type / condition | Grade | Layer | Source |
| --- | --- | --- | --- | --- | --- |
| `sensor.detectRangeM` | 4000 m (4 km) | detection range — 'can detect a UAV lighter than a milk carton as far as 4 km from the radar' — manufacturer-stated, nano/micro UAS class, no RCS given | MANUFACTURER_CLAIM | L1 | [Saab Giraffe 1X product page](https://www.saab.com/products/giraffe-1x), accessed 2026-08-24 |
| `sensor.sectorDeg` | 360 deg (360 deg) | azimuth coverage — 'covers the entire search volume every second' — 360 deg, 1 s update | MANUFACTURER_CLAIM | L1 | [Saab Giraffe 1X product page](https://www.saab.com/products/giraffe-1x), accessed 2026-08-24 |
| `update_rate` | 1 s full-volume update s (1 s) | Full 360 deg search volume | CORROBORATED | L1 | [Saab Giraffe 1X page; Saab EU/NATO layered-defence page](https://www.saab.com/markets/eu-nato-affairs/layered-defence-against-the-drone-threat), accessed 2026-08-24 |
| `cuas_procurement` | US Army order approx USD 46 M announced 2025-10-28 to provide Giraffe 1X 'in support of security co-operation partners' for C-UAS; USD 23.88 M modification for 10 radars to Estonia, Latvia and Lithuania, total approx USD 70 M, deliveries through Feb 2027 | OEM release plus trade reporting of the contract modification | CORROBORATED | L1 | [Saab press release, US Army order for Giraffe 1X; Army Recognition, 10 Giraffe 1X to the Baltics](https://www.saab.com/newsroom/press-releases/2025/saab-receives-order-for-giraffe-1x-radars-from-u.s.-army), 2025-10-28 (Saab); 2026 (Army Recognition) |
| `mission_set` | simultaneous air surveillance, GBAD target acquisition and RAM sense-and-warn; optional sea-surface surveillance; V-SHORAD main sensor or gap filler |  | MANUFACTURER_CLAIM | L1 | [Saab Giraffe 1X product page](https://www.saab.com/products/giraffe-1x), accessed 2026-08-24 |

**Not established by the public record:** Frequency band. X-band (NATO I) is reported by trade press but not stated on Saab's own pages I could reach. Elevation coverage, altitude ceiling, track capacity, range resolution. Whether the 4 km figure is a detection range or a track range, and at what RCS. Which C2 system the US Army Baltic deliveries connect to.

**Unresolved source conflict:**
- range against very small RCS targets: Saab EU/NATO layered-defence page (accessed 2026-08-24) gives detects targets with radar cross-sections below 0.01 square metres at tactically relevant ranges up to 75 km; Saab Giraffe 1X product page (accessed 2026-08-24) gives can detect a UAV lighter than a milk carton as far as 4 km from the radar. The 75 km phrasing appears to fold the radar's overall instrumented range together with a separate low-RCS sensitivity claim. It is not a 0.01 m2 detection range. Resolution: UNRESOLVED — the 4 km product-page figure is used because it is the only one explicitly conditioned on a small UAS.

### `lib-spexer2000` SPEXER 2000 3D radar (HENSOLDT)

- **Manufacturer:** HENSOLDT Sensors GmbH
- **Country:** Germany
- **Operators:** 8 nations (unnamed by HENSOLDT), German Army (reported)
- **Program:** HENSOLDT SPEXER family, C-UAV and critical asset protection; VSHORAD/GBAD sensor
- **Status:** CURRENT
- **Mobility:** mobile
- **UAS groups:** 1, 2, 3

| Field | Value | Range type / condition | Grade | Layer | Source |
| --- | --- | --- | --- | --- | --- |
| `sensor.detectRangeM` | 6000 m (6 km) | maximum detection range — 'Micro UAV 6 km' from the datasheet's Maximum Detection Ranges table; no RCS given for the micro-UAV line | MANUFACTURER_CLAIM | L1 | [HENSOLDT SPEXER 2000 3D Radar — C-UAV and Critical Asset Protection datasheet, issue 2](https://dam.hensoldt.net/m/59f155d472802b78/original/SPEXER-2000-3D-Radar-Datasheet-English.pdf), 2020-08-25 |
| `detection_range_uav` | 9000 m (9 km) | maximum detection range — 'UAV 9 km' datasheet line; trade reporting attaches 0.2 m2 RCS to this line | MANUFACTURER_CLAIM | L1 | [HENSOLDT SPEXER 2000 3D datasheet; Army Recognition SPEXER 2000 3D MkIII data page](https://www.armyrecognition.com/military-products/army/radars/ground-radars/spexer-2000-3d-mkiii-very-short-range-air-defence-vshorad-c-uas-radar-hensold-data), 2020-08-25 / accessed 2026-08-24 |
| `sensor.sectorDeg` | 120 deg (up to 360 (single antenna 120) deg) | azimuth coverage — MkIII: 'up to 360 deg (single antenna 120 deg)'. MkII is fixed 120 deg. The model represents one antenna face. | MANUFACTURER_CLAIM | L1 | [HENSOLDT SPEXER 2000 3D datasheet technical specification table](https://dam.hensoldt.net/m/59f155d472802b78/original/SPEXER-2000-3D-Radar-Datasheet-English.pdf), 2020-08-25 |
| `sensor.elevationDeg` | 0,90 deg (up to 90 (MkIII); 15 (MkII) deg) | elevation coverage — MkIII 'up to 90 deg'; MkII is 15 deg. Datasheet gives a span, not signed limits; [0,90] is the reading for a ground-based VSHORAD antenna. | MANUFACTURER_CLAIM | L1 | [HENSOLDT SPEXER 2000 3D datasheet](https://dam.hensoldt.net/m/59f155d472802b78/original/SPEXER-2000-3D-Radar-Datasheet-English.pdf), 2020-08-25 |
| `architecture` | Full coherent pulse-Doppler, X-band, AESA multi-panel, spectral micro-Doppler target classification, ECCM, MIL-STD-810/461 qualified |  | MANUFACTURER_CLAIM | L1 | [HENSOLDT SPEXER 2000 3D datasheet](https://dam.hensoldt.net/m/59f155d472802b78/original/SPEXER-2000-3D-Radar-Datasheet-English.pdf), 2020-08-25 |
| `track_capacity` | more than 300 track-while-scan targets (MkIII: per 120 deg) |  | MANUFACTURER_CLAIM | L1 | [HENSOLDT SPEXER 2000 3D datasheet](https://dam.hensoldt.net/m/59f155d472802b78/original/SPEXER-2000-3D-Radar-Datasheet-English.pdf), 2020-08-25 |
| `update_rate` | approximately 0.3 s with 16 beams, up to approximately 7.5 s in slow-scan s | 1 to 16 pencil beams per antenna | REPORTED | L1 | [EDR Magazine / Army Recognition SPEXER 2000 3D MkIII reporting](https://www.armyrecognition.com/military-products/army/radars/ground-radars/spexer-2000-3d-mkiii-very-short-range-air-defence-vshorad-c-uas-radar-hensold-data), accessed 2026-08-24 |

**Not established by the public record:** Which 8 nations operate it, and whether any US unit does. RCS condition on the 6 km micro-UAV line. Classification range, range resolution, minimum range, instrumented range. Whether the MkIII datasheet figures differ from the 2020 MkII/MkIII table.

**Unresolved source conflict:**
- detection range against a UAV: HENSOLDT datasheet 2020 gives UAV 9 km / Micro UAV 6 km, no RCS stated; Army Recognition MkIII data page gives UAV (0.2 m2 RCS) at 9 km; pedestrian (0.5 m2) 18-20 km. Trade page adds RCS conditions the OEM datasheet does not print; the pedestrian figure also differs (18-20 km vs the datasheet's 20 km). Resolution: UNRESOLVED — datasheet values used, RCS treated as unconfirmed.

### `lib-echoguard` EchoGuard 4D radar (Echodyne)

- **Manufacturer:** Echodyne Corp.
- **Country:** US
- **Operators:** US DoD and DHS users (Echodyne states defense and security deployments)
- **Program:** Echodyne commercial; short-range C-UAS and perimeter surveillance
- **Status:** CURRENT
- **Mobility:** fixed
- **UAS groups:** 1

| Field | Value | Range type / condition | Grade | Layer | Source |
| --- | --- | --- | --- | --- | --- |
| `sensor.detectRangeM` | 1000 m (> 1 km) | range (datasheet heading 'Range') — 'sUAV: > 1 km (Phantom 4)'. A DJI Phantom 4 is a Group 1 quadcopter. The datasheet also gives '> 1.4 km (Matrice 600)', a larger Group 1/2 multirotor. | MANUFACTURER_CLAIM | L1 | [Echodyne EchoGuard 4D Surveillance Radar technical specification sheet (rev 6JL)](https://www.echodyne.com/radar-systems/echoguard), 2026 (copyright 2026) |
| `instrumented_range` | 6000 m (6 km) | instrumented range — Datasheet field 'Instrumented Range: 6 km'. This is NOT a detection range against any target. | MANUFACTURER_CLAIM | L1 | [Echodyne EchoGuard technical specification sheet](https://www.echodyne.com/radar-systems/echoguard), 2026 |
| `sensor.sectorDeg` | 120 deg (120 deg) | azimuth field of view — 'Field of View: 120 deg Azimuth x 80 deg Elevation' | MANUFACTURER_CLAIM | L1 | [Echodyne EchoGuard technical specification sheet](https://www.echodyne.com/radar-systems/echoguard), 2026 |
| `sensor.elevationDeg` | -40,40 deg (80 deg) | elevation field of view — Datasheet gives an 80 deg elevation SPAN only. Splitting it symmetrically about boresight is INFERRED, matching how lib-echoshield already models a 90 deg span as [-45,45]. | INFERRED | L1 | [Echodyne EchoGuard technical specification sheet](https://www.echodyne.com/radar-systems/echoguard), 2026 |
| `frequency_band` | K-band 24.45-24.65 GHz (USA); 24.05-24.25 GHz (international) GHz | Officially disclosed on the OEM specification sheet | MANUFACTURER_CLAIM | L1 | [Echodyne EchoGuard technical specification sheet](https://www.echodyne.com/radar-systems/echoguard), 2026 |
| `track_capacity_and_update` | up to 20 simultaneous tracks at a 10 Hz track update rate |  | MANUFACTURER_CLAIM | L1 | [Echodyne EchoGuard technical specification sheet](https://www.echodyne.com/radar-systems/echoguard), 2026 |

**Not established by the public record:** Which DoD programs field EchoGuard, and in what quantity. Classification range; the datasheet gives AI classes (human, vehicle, drone) but no range at which classification holds. Range resolution as a two-target separation figure. The datasheet gives range ACCURACY (<3.25 m), which is not resolution. Whether the 80 deg elevation field of view is centred on boresight.

**Unresolved source conflict:**
- field of view: Echodyne EchoGuard technical specification sheet (2026) gives 120 deg azimuth x 80 deg elevation; Echodyne 'Medium-Range Tactical Radar' page for EchoShield (accessed 2026-08-24) gives EchoShield stated as 120 deg az x 80 deg el on that page, versus 130 x 90 on the EchoShield datasheet. Web copy appears to reuse the EchoGuard field of view for EchoShield. Datasheets are the better source for both. Resolution: UNRESOLVED — datasheet values used for both radars.

### `lib-spyglass` Spyglass short-range radar (Anduril / Numerica)

- **Manufacturer:** Anduril Industries (radar business acquired from Numerica Corporation, Jan 2025)
- **Country:** US
- **Operators:** Demonstrated for the DoD Joint C-sUAS Office (JCO) in SAIC's C-sUAS-as-a-Service
- **Program:** JCO C-sUAS-as-a-Service demonstration, Yuma Proving Ground Sep 2022; now an Anduril product line integrated into Lattice
- **Status:** CURRENT
- **Mobility:** mobile
- **UAS groups:** 1, 2

| Field | Value | Range type / condition | Grade | Layer | Source |
| --- | --- | --- | --- | --- | --- |
| `sensor.detectRangeM` | 3500 m (beyond three and a half km) | detection and track range — 'designed to detect and track small, autonomous, UAS beyond three and a half kilometers'. Manufacturer design goal, not a measured result. No RCS or airframe named. Yuma demonstration described the radar as providing Group 1 and 2 sUAS detection and precision tracking. | MANUFACTURER_CLAIM | L1 | [Numerica announces Spyglass, a new 3D radar for C-UAS and short-range defense missions](https://militaryembedded.com/unmanned/counter-uas/numerica-announces-spyglass-a-new-3d-radar-for-c-uas-short-range-defense-missions), 2021-02-22 |
| `sensor.sectorDeg` | 90 deg | azimuth coverage — UNKNOWN. No azimuth field of view is published by Numerica or Anduril. 90 deg is a planning figure for a fixed short-range phased-array face, chosen to match the per-panel convention already used for lib-rps42. It is INFERRED and must not be promoted. | INFERRED | REPRESENTATIVE | [No published figure; planning value](https://www.anduril.com/spyglass), accessed 2026-08-24 |
| `frequency_band` | Ku-band phased array with simultaneous transmit and receive | Officially disclosed by the manufacturer | CORROBORATED | L1 | [Military Embedded Systems, Feb 2021; PR Newswire, Oct 2022](https://www.prnewswire.com/news-releases/spyglass-short-range-surveillance-radar-a-product-of-numerica-corporation-demonstrated-as-part-of-jco-recommended-counter-uas-as-a-service-solution-301658672.html), 2022-10-25 |
| `jco_demonstration` | Demonstrated in SAIC's Counter-small UAS as a Service at Yuma Proving Ground, Sep 2022; the JCO recommended the offering as one of three solutions. Integrated alongside two Liteye SHIELD C-sUAS platforms, Liteye directional RF defeat and an Aeroguard capture system. | Vendor release describing a government event | REPORTED | L1 | [PR Newswire — Spyglass demonstrated as part of JCO-recommended C-UAS as a Service solution](https://www.prnewswire.com/news-releases/spyglass-short-range-surveillance-radar-a-product-of-numerica-corporation-demonstrated-as-part-of-jco-recommended-counter-uas-as-a-service-solution-301658672.html), 2022-10-25 |
| `ownership` | Anduril acquired Numerica's radar and C2 businesses (Jan 2025) and states Spyglass and Spark radars and Mimir software are being integrated into Lattice; production moves to Arsenal-1 |  | CORROBORATED | L1 | [Military Embedded Systems; Janes; Inside Defense — Anduril acquires Numerica radar and C2 businesses](https://militaryembedded.com/radar-ew/sensors/anduril-acquires-radar-and-commmand-and-control-business-numerica), 2025-01 |

**Not established by the public record:** Azimuth and elevation field of view. Not published by Numerica or Anduril. Track capacity, update rate, range resolution, minimum range, instrumented range. Whether the 3.5 km figure is detection or track, and against what RCS. Whether Spyglass has been procured by any US programme of record, as opposed to demonstrated.

### `lib-a422` Blighter A422 air security radar

- **Manufacturer:** Blighter Surveillance Systems (UK)
- **Country:** United Kingdom
- **Operators:** Ukraine (UK-supplied, 2022), AUDS users
- **Program:** Blighter A400 series; UK-supplied C-UAS radars for Ukraine 2022; AUDS radar
- **Status:** CURRENT
- **Mobility:** dismounted
- **UAS groups:** 1, 2

| Field | Value | Range type / condition | Grade | Layer | Source |
| --- | --- | --- | --- | --- | --- |
| `sensor.detectRangeM` | 2730 m (2.73 km) | detection range, free space — 0.01 m2 RCS target (the A400 datasheet's small-drone case, e.g. DJI Phantom class), free-space conditions. Companion figures: 4.87 km at 0.1 m2, 8.66 km at 1.0 m2, 15.4 km at 10 m2. | MANUFACTURER_CLAIM | L1 | [A400 series air security radars specification (ATRI, JSC — Blighter distributor, reproducing the Blighter A400 datasheet)](https://www.atri.lt/products-solutions/surveilance-radars/a400-series-air-security-radars/), accessed 2026-08-24 |
| `sensor.sectorDeg` | 180 deg (180 deg) | azimuth scan sector — A422 covers a 180 deg azimuth scan sector; two back-to-back A422s give 360 deg; A402 is the 90 deg variant. | CORROBORATED | L1 | [Blighter Ukraine C-UAS radar page; Joint Forces A422 report; ATRI A400 series page](https://blighter.com/ukraine-counter-uas-radar-system-supplied-by-blighter/), 2022-06-07 / 2022-04-13 / accessed 2026-08-24 |
| `sensor.elevationDeg` | 0,30 deg (20-30 deg elevation beamwidth (W20S antennas); 10-15 deg (M10S) deg) | elevation coverage — The published figure is an antenna elevation BEAMWIDTH, not a signed coverage sector. [0,30] is the ground-based reading of 'wide vertical elevation coverage up to 30 deg'. | REPORTED | L1 | [ATRI A400 series page; Joint Forces A422 report](https://www.joint-forces.com/defence-equipment-news/52885-new-blighter-a422-radar-in-rapidly-deployable-configuration), 2022-04-13 / accessed 2026-08-24 |
| `instrumented_range` | 20000 m (20 km) | instrumented range (maximum), minimum range less than 10 m — Blighter's own page states 'detecting and reporting airborne as well as ground targets at up to 20 km'. This is NOT a small-UAS detection range. | MANUFACTURER_CLAIM | L1 | [Blighter — Counter-UAS Radars for Ukraine](https://blighter.com/ukraine-counter-uas-radar-system-supplied-by-blighter/), 2022-06-07 |
| `frequency_band` | Ku-band 15.7-17.2 GHz, E-scan FMCW Doppler GHz | Distributor reproduction of the OEM datasheet; not repeated on Blighter's own public pages I could reach | MANUFACTURER_CLAIM | L1 | [ATRI A400 series air security radars](https://www.atri.lt/products-solutions/surveilance-radars/a400-series-air-security-radars/), accessed 2026-08-24 |
| `scan_rate` | 1.0 s per 90 deg; 0.25 s in Drone Spotlighting Mode s |  | MANUFACTURER_CLAIM | L1 | [ATRI A400 series air security radars](https://www.atri.lt/products-solutions/surveilance-radars/a400-series-air-security-radars/), accessed 2026-08-24 |

**Not established by the public record:** Track capacity and update rate in track mode. Classification range for the machine-learning classifier. Whether any US or NATO unit other than Ukraine operates the A422 in a C-UAS role. Quantity supplied to Ukraine and the funding authority.

**Unresolved source conflict:**
- detection range: Blighter own pages and UK trade reporting, 2022 gives up to 20 km, airborne and ground targets, no RCS condition; ATRI distributor page reproducing the A400 datasheet gives 2.73 km at 0.01 m2 RCS, free space. The 20 km figure is the instrumented maximum against large-RCS targets; the RCS table is the conditioned performance. They are different quantities, not a disagreement. Resolution: UNRESOLVED as a single figure — both recorded, the 0.01 m2 line used for the ring.

### `lib-gm200mmc` Ground Master 200 MM/C radar (Thales)

- **Manufacturer:** Thales
- **Country:** France / Netherlands
- **Operators:** Royal Netherlands Army, Denmark, Lithuania
- **Program:** NATO multi-mission radar procurements (NL COMMIT 2019 and 2024, DK, LT)
- **Status:** CURRENT
- **Mobility:** mobile
- **UAS groups:** 2, 3, 4, 5

| Field | Value | Range type / condition | Grade | Layer | Source |
| --- | --- | --- | --- | --- | --- |
| `sensor.detectRangeM` | 40000 m | NONE — no public range against a UAS target — UNKNOWN. The published figures are INSTRUMENTED ranges (over 400 km air surveillance, up to 100 km weapon locating) against unspecified targets. Neither is a C-UAS detection range and neither may be used as one. 40000 m is SENSOR_ROLE_DEFAULT_RANGE_M['early-warning'] as a planning factor. | UNKNOWN | REPRESENTATIVE | [RangeBoard SENSOR_ROLE_DEFAULT_RANGE_M (src/model/types.ts) — basis only](https://www.thalesgroup.com/en/solutions-catalogue/defence/air/ground-master-200-mm/c), accessed 2026-08-24 |
| `instrumented_range` | 400000 m (400 km) | instrumented range, air surveillance — 'up to 400 km instrumented range for air surveillance and up to 100 km instrumented range for weapon locating'. No target condition given. | MANUFACTURER_CLAIM | L1 | [Thales Ground Master 200 MM/C solutions catalogue entry](https://www.thalesgroup.com/en/solutions-catalogue/defence/air/ground-master-200-mm/c), accessed 2026-08-24 |
| `architecture` | 4D AESA with GaN transmitter and dual-axis multi-beam; rotating on a Scania Gryphus chassis for the Dutch fielding; operational within one minute of arrival | Rotation is implied by the Ground Master family architecture; Thales's page does not state a rotation rate. | CORROBORATED | L1 | [Thales GM200 MM/C page; Army Technology, Thales to provide seven more GM200 MM/C radars for Dutch Army](https://www.army-technology.com/news/thales-gm200mm-radars-dutch-army/), 2024-04-16 |
| `cuas_role` | Thales states simultaneous detection, tracking and classification of aircraft, missiles, helicopters, multiple UAVs and RAM, and markets the radar against 'emerging threats, such as drones' | Marketing description of a simultaneous multi-mission mode, not a measured C-UAS performance statement | MANUFACTURER_CLAIM | L1 | [Thales GM200 MM/C page; Thales press release on the Lithuanian acquisition](https://www.thalesgroup.com/en/worldwide/defence-and-security/press_release/thales-ground-master-200-multi-mission-radar), 2024-01 |

**Not established by the public record:** Any detection range against any UAS class. Rotation rate, elevation coverage, altitude ceiling, track capacity, range resolution. Frequency band. Thales does not disclose it on the pages I could reach. Whether the C-UAS mode runs simultaneously with weapon locating in fielded configurations.

## Passive RF / electronic support

### `lib-corian` CORIAN passive RF array (CACI)

- **Manufacturer:** CACI International Inc
- **Country:** United States
- **Operators:** US DoD (Navy-sponsored JCO interim selection), JIATF-401 Domestic Shield sites
- **Program:** JCO interim C-sUAS fixed/semi-fixed selection (Jun 2020); CACI SkyTracker Technology Suite; CORIAN v3 under the JIATF-401 USD 500m C-UAS IDIQ (Jul 2026)
- **Status:** CURRENT
- **Mobility:** fixed
- **UAS groups:** 1, 2

| Field | Value | Range type / condition | Grade | Layer | Source |
| --- | --- | --- | --- | --- | --- |
| `sensor.detectRangeM` | 5000 m | RF detection range (representative planning figure) — NO public detection range exists for CORIAN. 5000 m is the SENSOR_ROLE_DEFAULT_RANGE_M value for the 'classification' role in src/model/types.ts, cross-checked against published passive-RF peers (Dedrone RF-360 2000 m normal / 5000 m ideal; R&S ARDRONIS Locate Compact >5000 m; MyDefence Wingman 6000 m). Rural/low-clutter EM background assumed. Multi-node TDOA aperture buys geolocation accuracy, not detection range. | INFERRED | REPRESENTATIVE | [RangeBoard SENSOR_ROLE_DEFAULT_RANGE_M + peer passive-RF datasheets](https://www.caci.com/sites/default/files/2025-02/F539_2502_CORIAN.pdf), 2025-02 |
| `sensor.classifyRangeM` | 5000 m | protocol identification range (representative) — Set equal to detect range because protocol/library identification in a passive RF receiver happens at the moment of detection: the signal must be demodulated far enough to match the library entry. No separate classification range is published. | INFERRED | REPRESENTATIVE | [CACI, Fixed Site C-UAS (CORIAN datasheet F539 02/25)](https://www.caci.com/sites/default/files/2025-02/F539_2502_CORIAN.pdf), 2025-02 |
| `sensor.sectorDeg` | 360 deg | azimuth coverage — Datasheet: CORIAN 'utilizes a sensor array' and is 'Modular and scalable for geographically compact or wide-area defense'. A distributed multi-node array has no single boresight, so 360 is the honest encoding. Per-node antenna pattern is not published. | MANUFACTURER_CLAIM | L1 | [CACI, Fixed Site C-UAS (CORIAN datasheet F539 02/25)](https://www.caci.com/sites/default/files/2025-02/F539_2502_CORIAN.pdf), 2025-02 |
| `uas_groups` | 1,2 | target class — Datasheet: 'capable of detection, identification, and interdiction of s-UAS (groups 1 and 2) threats'. | MANUFACTURER_CLAIM | L1 | [CACI, Fixed Site C-UAS (CORIAN datasheet F539 02/25)](https://www.caci.com/sites/default/files/2025-02/F539_2502_CORIAN.pdf), 2025-02 |
| `status/program` | JCO fixed/semi-fixed interim selection, Navy-sponsored | program status — One of three fixed/semi-fixed systems in the Jun 2020 JCO interim C-sUAS set (with FS-LIDS and NINJA), alongside FAAD C2 as the C2 selection. | CORROBORATED | L1 | [C4ISRNET, 'Army selects eight counter-drone systems for the joint force'](https://www.c4isrnet.com/unmanned/2020/06/26/army-selects-eight-counter-drone-systems-for-the-joint-force/), 2020-06-26 |
| `status/program` | CORIAN v3 in the JIATF-401 USD 500m IDIQ | program status — JIATF-401 awarded CACI a three-year IDIQ worth up to USD 500m on 28 Jul 2026; the vehicle covers CORIAN v3, the fixed-site version of the SkyValor RF drone-defeat system, plus BEAM. | CORROBORATED | L1 | [DefenseScoop; Breaking Defense; CACI investor release](https://defensescoop.com/2026/07/31/pentagon-counter-drone-task-force-500m-contract-caci-skyvalor/), 2026-07-31 |

**Not established by the public record:** Detection range, DF range and geolocation range: none published, in any conditions Frequency coverage Number of nodes in a standard array and the minimum for a TDOA fix Simultaneous detection/track capacity Geolocation accuracy (CEP) for airframe and for controller Whether the JCO-selected 2020 configuration equals the 2026 CORIAN v3 configuration Named C2 interface (FAAD C2, SAPIENT, CoT/TAK) — CACI says only 'existing command and control or security systems'

**Unresolved source conflict:**
- range attributed to the CACI RF family: DefenseScoop, 31 Jul 2026 — SkyValor can 'target small and large drones using automated sense and shoot algorithms at more than 40 miles away in some cases' (>64 km) gives more than 40 miles, in some cases; CACI CORIAN datasheet, Feb 2025 — no range figure at all gives null. The 40-mile figure belongs to the trailer-based SkyValor, not to the fixed-site CORIAN, is heavily conditioned ('in some cases'), and mixes sensing with engagement. It is not a CORIAN detection range and must not be used as one. Resolution: UNRESOLVED — excluded from the CORIAN record.

### `lib-wingman` Wingman 103 wearable RF detector (MyDefence)

- **Manufacturer:** MyDefence Communication ApS, MyDefence North America
- **Country:** Denmark
- **Operators:** US Army, Ukraine, Denmark, Norway, Netherlands, Germany
- **Program:** MyDefence Soldier-Kit; USD 26m US Army order for 485 wearable C-UAS units (Jul 2025); Hensoldt Xpeller close-in RF element
- **Status:** CURRENT
- **Mobility:** dismounted
- **UAS groups:** 1, 2

| Field | Value | Range type / condition | Grade | Layer | Source |
| --- | --- | --- | --- | --- | --- |
| `sensor.detectRangeM` | 6000 m (6 km) | RF detection range (emitter detection, drone or controller link) — Datasheet row 'Detection Time / Detection Range: < 10s * / Up to 6 km - 3.73 miles *', footnote '* Depending on the RF environment & line of sight'. This is an UPPER BOUND under favourable conditions, not a guaranteed range. MyDefence publishes NO separate urban figure, so this figure must be read as the low-clutter/line-of-sight case and derated by the app's urban EM factor, not used as an urban number. | MANUFACTURER_CLAIM | L1 | [MyDefence, 'Wingman 103 & 105 RF Detectors' datasheet](https://mydefence.com/wp-content/uploads/2025/08/Wingman_103-105_MyDefence_web.pdf), 2025-08 |
| `sensor.classifyRangeM` | 6000 m | protocol identification range — No separate classification range is published. Datasheet claims an 'EXTENSIVE DRONE LIBRARY - Enables accurate classification and low false positives'; library matching in a passive receiver occurs at detection, so classify range is set equal to detect range. INFERRED, not stated. | INFERRED | REPRESENTATIVE | [MyDefence, 'Wingman 103 & 105 RF Detectors' datasheet](https://mydefence.com/wp-content/uploads/2025/08/Wingman_103-105_MyDefence_web.pdf), 2025-08 |
| `sensor.sectorDeg` | 90 deg (90 deg) | azimuth coverage, as-issued antenna — Datasheet row 'Detection Coverage Angle / Detection Coverage Angle with Wideband Antenna: Horizontal 90 deg - Vertical 90 deg / Omnidirectional 360 deg'. 90 encodes the base unit. With the optional wideband antenna the unit is omnidirectional; a user wanting that configuration should set sectorDeg 360. | MANUFACTURER_CLAIM | L1 | [MyDefence, 'Wingman 103 & 105 RF Detectors' datasheet](https://mydefence.com/wp-content/uploads/2025/08/Wingman_103-105_MyDefence_web.pdf), 2025-08 |
| `sensor.elevationDeg` | null deg (90 deg (vertical beamwidth)) | elevation coverage — Datasheet gives 'Vertical 90 deg' as a beamwidth, not as a min/max elevation pair. Converting it to [-45, 45] would assume a horizontal boresight the datasheet never states, so the field stays null. | UNKNOWN | L3 | [MyDefence, 'Wingman 103 & 105 RF Detectors' datasheet](https://mydefence.com/wp-content/uploads/2025/08/Wingman_103-105_MyDefence_web.pdf), 2025-08 |
| `operators / status` | US Army, 485 wearable C-UAS units, USD 26m  (485 units) | program status — MyDefence announced the USD 26m US Army order on 3 Jul 2025 (largest in company history). The Defense Post reported 485 wearable systems, comprising the Wingman detector and Pitbull jammer as the 'Soldier-Kit', with about 15 systems deployed by EUCOM during joint exercises in Germany. | CORROBORATED | L1 | [MyDefence press release; The Defense Post](https://thedefensepost.com/2025/07/10/counter-drone-us-army/), 2025-07-10 |

**Not established by the public record:** Urban vs rural detection range split — MyDefence publishes one figure and a footnote, not two numbers Simultaneous detection capacity Elevation coverage as a min/max pair Whether the 6 km figure is against a controller uplink, a video downlink, or the best of both Which specific units of the US Army hold the 485 kits

**Unresolved source conflict:**
- frequency coverage: MyDefence Wingman 103/105 datasheet, Aug 2025 gives 2.4, 5.2, 5.8 GHz base; 350-1300 MHz + 2.4 GHz + 5 GHz with the wideband antenna; MyDefence product page / trade press summaries, 2025-2026 gives 200 MHz to 6 GHz. The 200 MHz - 6 GHz figure is the receiver's tunable span or a newer Spectrum Warrior software build; the datasheet lists the bands actually scanned with each antenna. The two are not the same claim. Resolution: UNRESOLVED — the datasheet band list is used; no frequency value is written into the RangeBoard spec (the schema has no field for it).

### `lib-rfpatrol` RfPatrol Mk2 body-worn RF detector (DroneShield)

- **Manufacturer:** DroneShield Ltd
- **Country:** Australia
- **Operators:** US DoD (reported), Australian Defence Force, multiple NATO and allied users (unspecified)
- **Program:** DroneShield dismounted C-UAS line; Immediate Response Kit (RfPatrol Mk2 + DroneGun Mk4); DroneSentry-C2 ecosystem
- **Status:** CURRENT
- **Mobility:** dismounted
- **UAS groups:** 1, 2

| Field | Value | Range type / condition | Grade | Layer | Source |
| --- | --- | --- | --- | --- | --- |
| `sensor.detectRangeM` | 4000 m (4 km) | RF detection range, LOW-RF (rural) background — 'In high RF environment (urban) - up to one kilometre; in low RF environment (rural) - up to four kilometres.' The 4000 m RURAL figure is written to the spec because RangeBoard applies its own urban EM derate (SENSOR_ENV_MODEL.urbanEm.rf = 0.6 in src/analysis/sensorEnv.ts); the spec value must therefore be the clear/rural baseline. The two figures are NOT merged and the urban figure is recorded separately below. | CORROBORATED | L1 | [Defence Connect, 'DroneShield releases Mk II drone detection device'; Army Recognition, 'DroneShield releases handheld RfPatrol Mk II drone detector'](https://www.defenceconnect.com.au/key-enablers/5991-droneshield-releases-mk-ii-drone-detection-device), 2020-04-28 |
| `sensor.detectRangeM (urban condition, NOT written to spec)` | 1000 m (1 km) | RF detection range, HIGH-RF (urban) background — Manufacturer-stated urban figure. Kept separate on purpose. NOTE FOR THE APP: RangeBoard's urban RF factor of 0.6 turns the 4000 m spec into 2400 m in an urban scenario, which OVERSTATES DroneShield's own 1000 m urban number by 1400 m. This is a real modelling mismatch and is filed as a gap. | CORROBORATED | L1 | [Defence Connect, 'DroneShield releases Mk II drone detection device'](https://www.defenceconnect.com.au/key-enablers/5991-droneshield-releases-mk-ii-drone-detection-device), 2020-04-28 |
| `sensor.classifyRangeM` | 4000 m | protocol identification range — No separate classification range published. DroneShield states the device provides 'real-time drone signal detection, identification, and classification' from one receive event, so classify is set equal to the rural detect figure. INFERRED. | INFERRED | REPRESENTATIVE | [DroneShield dismounted products page](https://www.droneshield.com/products-dismounted), 2026-08 (accessed) |
| `sensor.sectorDeg` | 360 deg (360 deg) | azimuth coverage — DroneShield: '360 deg detection of UAS and remote controllers'; the unit carries 'Integrated Antennas: Directional and omni-directional'. The 360 deg figure is the omni path; the directional antenna units serve bearing indication, not extra azimuth cover. | MANUFACTURER_CLAIM | L1 | [DroneShield dismounted products page](https://www.droneshield.com/products-dismounted), 2026-08 (accessed) |

**Not established by the public record:** Frequency coverage as a numeric span Whether the Apr 2020 1 km urban / 4 km rural figures still hold after the Aug 2024 directional-antenna and AI-scanning upgrade — DroneShield has since removed range figures from its product pages Simultaneous detection capacity Named national operators and quantities

**Unresolved source conflict:**
- publication of a detection range at all: Defence Connect / Army Recognition, Apr 2020 gives 1 km urban, 4 km rural; DroneShield product pages, 2026 gives no range published. DroneShield withdrew range claims from public pages, probably because performance is now library- and environment-dependent after the 2024 AI-scanning release. The 2020 numbers remain the only public figures. Resolution: UNRESOLVED — 2020 figures used, dated as such.

### `lib-ardronis` ARDRONIS Locate RF DF system (Rohde & Schwarz)

- **Manufacturer:** Rohde & Schwarz GmbH & Co. KG
- **Country:** Germany
- **Operators:** Bundeswehr (within GUARDION, via ESG), German federal law enforcement, airport and critical-infrastructure operators
- **Program:** R&S ARDRONIS family; GUARDION field-camp protection (ESG TARANIS C2 + R&S ARDRONIS + Diehl HPEM); NATO Technical Interoperability Exercise 2024 and 2026
- **Status:** CURRENT
- **Mobility:** fixed
- **UAS groups:** 1, 2

| Field | Value | Range type / condition | Grade | Layer | Source |
| --- | --- | --- | --- | --- | --- |
| `sensor.detectRangeM` | 5000 m (5 km) | RF detection range against the drone's video downlink — R&S state the ARDRONIS Locate Compact 'can detect threats more than 5 km away' and that the configuration 'rapidly detects and determines the direction of analog and digital video downlink signals from almost any commercial drone'. This is a FLOOR ('more than'), not a ceiling. It applies to the Locate Compact (R&S UMS400 + ADD207 mast-mounted set). No EM background is stated; R&S market the family for 'operation in complex RF environments', so treat the figure as neither a clean-rural best case nor a validated urban figure. | MANUFACTURER_CLAIM | L1 | [Rohde & Schwarz, 'ARDRONIS Locate Compact' solution page](https://www.rohde-schwarz.com/us/solutions/critical-infrastructure/countering-drones/ardronis-locate-compact-solution_256824.html), 2026-08 (accessed) |
| `sensor.classifyRangeM` | 5000 m | protocol identification range — R&S headline the family as 'Detection, classification and identification of drone and remote-control type' from one receive chain ('RF Receiver - reliable signal classification (20 MHz - 6 GHz)'), so classification is not a separate, shorter range. Set equal to detect. INFERRED. | INFERRED | REPRESENTATIVE | [Rohde & Schwarz ARDRONIS Detect page; JED counter-UAS survey table, May 2019](https://www.rohde-schwarz.com/us/products/aerospace-defense-security/radio-frequency-solutions/ardronis-detect_63493-334548.html), 2026-08 (accessed) |
| `sensor.sectorDeg` | 360 deg (360 deg) | azimuth coverage — R&S: '360 deg coverage or sector coverage depending on the antenna'. 360 encodes the DF-antenna configuration (ADD207 compact UHF/SHF DF antenna, or ADD557SR covering 20 MHz - 6 GHz with one antenna). A sector-antenna build would need a smaller sectorDeg. | MANUFACTURER_CLAIM | L1 | [Rohde & Schwarz, 'ARDRONIS Detect' product page](https://www.rohde-schwarz.com/us/products/aerospace-defense-security/radio-frequency-solutions/ardronis-detect_63493-334548.html), 2026-08 (accessed) |
| `program / interoperability` | STANAG aligned, SAPIENT compliant, NATO TIE 2026 | interoperability status — R&S showed ARDRONIS Locate Compact and R&S Probe Observer at NATO Technical Interoperability Exercise 2026 in the Netherlands and state the system 'meets NATO STANAG requirements and fully complies with the SAPIENT standard protocol for joint counter UAS missions'. No STANAG number is given. | MANUFACTURER_CLAIM | L1 | [Rohde & Schwarz news release, NATO TIE 2026](https://www.rohde-schwarz.com/us/about-us/news-press/all-news/rohde-schwarz-showcases-stanag-aligned-ardronis-counter-uas-capability-at-nato-technical-interoperability-exercise-2026_229356-1624006.html), 2026-05-14 |

**Not established by the public record:** DF accuracy in degrees (the DDF 550 is named, its ARDRONIS-configured accuracy is not published) Minimum number of DF stations for a geolocation fix, and the baseline separation Detection range for the Locate Advanced configuration (only Locate Compact carries the >5 km figure) Simultaneous emitter handling capacity Whether the >5 km figure is rural or complex-EM

**Unresolved source conflict:**
- frequency coverage: JED counter-UAS survey table, May 2019 (R&S entry) gives RF receiver, reliable signal classification, 20 MHz - 6 GHz; R&S ARDRONIS Locate Compact page, accessed Aug 2026 gives monitors the 400 MHz to 6 GHz frequency range. Not a contradiction but a configuration difference: the receiver spans 20 MHz - 6 GHz, and the compact ADD207 antenna limits the fielded Locate Compact to 400 MHz - 6 GHz. The ADD557SR antenna restores 20 MHz - 6 GHz from a single antenna. Resolution: RESOLVED_AS_CONFIGURATION_DIFFERENCE — both recorded, neither averaged.

### `lib-titan` Titan C-UAS RF sensor (BlueHalo / AeroVironment)

- **Manufacturer:** BlueHalo LLC, AeroVironment, Inc. (acquired BlueHalo 2025)
- **Country:** United States
- **Operators:** US Army, US allied partner forces via FMS
- **Program:** US Army Titan C-UAS kits (USD 4m order, May 2022); AeroVironment US Army FMS IDIQ, USD 874.26m over five years (Dec 2025), naming Titan C-UAS
- **Status:** CURRENT
- **Mobility:** expeditionary
- **UAS groups:** 1, 2

| Field | Value | Range type / condition | Grade | Layer | Source |
| --- | --- | --- | --- | --- | --- |
| `sensor.detectRangeM` | 3000 m (3 km) | RF detection range, horizontal — Datasheet row 'DETECTION RANGE: Up to 3 km horizontal'. An upper bound. Emitter class not stated; BlueHalo describe 'full-spectrum threat detection of controller, video, telemetry, and Wi-Fi communication links'. EM background not stated, but the brochure claims deployment 'from rural to urban', so the 3 km figure is not qualified as a rural-only best case. | MANUFACTURER_CLAIM | L1 | [BlueHalo, 'TITAN C-UAS Counter-Unmanned Aerial System' brochure (Aug 2023 revision)](https://bssholland.com/wp-content/uploads/2023/11/BlueHalo_Titan_CUAS_202308.pdf), 2023-08 |
| `sensor.classifyRangeM` | 3000 m | protocol identification range — BlueHalo: Titan 'classifies and mitigates multiple threats across five RF bands' and provides 'automated identification and mitigation of threats for all major commercial and hobbyist control protocols and frequency bands'. Classification is inherent to the detect event, so it is set equal to detect range. INFERRED. | INFERRED | REPRESENTATIVE | [BlueHalo Titan brochure; BlueHalo/PRNewswire Army contract release](https://www.prnewswire.com/news-releases/bluehalo-awarded-us-army-contract-for-titan-c-uas-301540340.html), 2022-05-05 |
| `sensor.sectorDeg` | 360 deg | azimuth coverage — NOT PUBLISHED. 360 is inferred from the datasheet quoting a bare 'horizontal' detection range with no sector limit, from Titan being described as 'autonomous, self-contained', and from the unit being sold as a single-box solution rather than as faces. If a user needs a sectored build they must override this. | INFERRED | REPRESENTATIVE | [BlueHalo Titan brochure (Aug 2023)](https://bssholland.com/wp-content/uploads/2023/11/BlueHalo_Titan_CUAS_202308.pdf), 2023-08 |
| `NOT_A_SENSOR_FIELD: defeat range` | 1500 m (1.5 km) | defeat (jam) range, horizontal — recorded for a future effector model, NEVER written into the sensor spec — Datasheet: 'DEFEAT RANGE: Up to 1.5 km horizontal', with 'RF POWER OUTPUT: 433/868/915 MHz: 65W, 1.2 GHz: 60W, 2.4/5.8 GHz: 40W'. RF power output is a transmitter spec and is not a range of any kind. | MANUFACTURER_CLAIM | L1 | [BlueHalo Titan brochure (Aug 2023)](https://bssholland.com/wp-content/uploads/2023/11/BlueHalo_Titan_CUAS_202308.pdf), 2023-08 |
| `program / status` | US Army fielded; in an USD 874.26m FMS IDIQ  (874.26 USD million) | program status — DoD awarded BlueHalo a USD 4m order for Titan C-UAS kits announced 5 May 2022, in support of an elite unit within the conventional US Army. In Dec 2025 US Army Contracting Command awarded AeroVironment a five-year IDIQ worth USD 874.26m covering the Titan C-UAS system plus JUMP 20, P550, Puma and Raven variants for allied partner forces. | CORROBORATED | L1 | [BlueHalo/PRNewswire, May 2022; Unmanned Airspace, Dec 2025](https://www.unmannedairspace.info/counter-uas-systems-and-policies/us-army-awards-uas-and-c-uas-contract-to-aerovironment-to-support-foreign-military-sales/), 2025-12-09 |

**Not established by the public record:** Azimuth sector per unit (the 360 encoding is INFERRED) Direction-finding accuracy in degrees Simultaneous detection/track capacity as a number Whether the Aug 2023 BlueHalo specification still describes the post-AeroVironment 2026 product — the BlueHalo product URLs now redirect to avinc.com and the brochure is only reachable from a reseller mirror Any named C2 protocol (FAAD C2, SAPIENT, CoT/TAK)

**Unresolved source conflict:**
- frequency coverage: BlueHalo Titan brochure (Aug 2023) — datasheet table gives SF unit 2.4 / 5.8 GHz; EF unit 433 / 868 / 915 MHz, 1.2 GHz (five discrete bands); BlueHalo/reseller marketing copy gives 400 MHz to 6 GHz continuous. The marketing span is the envelope the discrete bands sit inside, not continuous coverage. A continuous-span reading would wrongly credit Titan with detecting links between the bands. Resolution: UNRESOLVED — datasheet band list used; no frequency value enters the RangeBoard spec.
