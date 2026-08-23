import type { IntegrationProfile } from './integration'

/**
 * Integration profiles for the seed spec library, translated from open-source
 * research (manufacturer releases, DoD statements, defense trade press).
 * Only researched pairings appear: 'documented'/'probable' research entries
 * became pairs, 'unlikely'/'no' entries became denials. Protocol slugs keep
 * open standards only ('faad-c2', 'lattice', 'sapient', 'cot-tak', 'link-16');
 * closed vendor interfaces carry no slug because they do not interoperate
 * across vendors. Media and notes follow each system's published interfaces.
 */

export const INTEGRATION_PROFILES: IntegrationProfile[] = [
  // USMC LMADIS / MADIS Mk2. GlobalSecurity; Armada International 2024; army.mil Jun 2020.
  {
    specId: 'lib-rps42',
    program: 'USMC LMADIS / MADIS Mk2 (RADA MHR family)',
    protocols: ['faad-c2'],
    media: ['cable'],
    standalone: true,
    pairs: [
      {
        withSpecId: 'lib-modi',
        role: 'cue',
        confidence: 'documented',
        note: 'LMADIS pairs the RPS-42 radar with the Modi EW jammer as its defeat effector.',
        source: 'GlobalSecurity LMADIS; Armada International 2024',
      },
      {
        withSpecId: 'lib-xm914',
        role: 'cue',
        confidence: 'documented',
        note: 'MADIS Mk2 RPS-42-family radar cues the Mk1 XM914E1 30mm gun.',
        source: 'Army Recognition 2025; MDAA MADIS page',
      },
      {
        withSpecId: 'lib-faadc2',
        role: 'track-data',
        confidence: 'documented',
        note: 'JCO interim C-sUAS selections including L-MADIS were required to integrate with FAAD C2.',
        source: 'army.mil, June 2020',
      },
      {
        withSpecId: 'lib-lattice',
        role: 'track-data',
        confidence: 'probable',
        note: 'Lattice as enterprise C-UAS C2 is contracted to integrate legacy fielded sensors over Ethernet track APIs.',
        source: 'DefenseScoop, Mar 2026',
      },
    ],
    denied: [
      {
        withSpecId: 'lib-coyote',
        reason:
          'Coyote Block 2 fire control requires a Ku-band uplink radar, which the S-band MHR does not provide.',
      },
    ],
  },
  // RADA MHR/eCHR family, no named US program of record. DefenseScoop Mar 2026.
  {
    specId: 'lib-rps62',
    program: 'RADA MHR/eCHR radar family',
    protocols: [],
    media: ['cable'],
    standalone: true,
    pairs: [
      {
        withSpecId: 'lib-faadc2',
        role: 'track-data',
        confidence: 'probable',
        note: 'Sibling MHR-family radars already feed the FAAD C2 ecosystem via the JCO interim standard and M-SHORAD.',
        source: 'army.mil 2020; Leonardo DRS M-SHORAD',
      },
      {
        withSpecId: 'lib-lattice',
        role: 'track-data',
        confidence: 'probable',
        note: 'Lattice enterprise C2 mandate covers legacy fielded C-UAS radars integrating over standard Ethernet.',
        source: 'DefenseScoop, Mar 2026',
      },
    ],
    denied: [
      {
        withSpecId: 'lib-coyote',
        reason: 'Cannot serve as Coyote Block 2 fire control; that requires the Ku-band KuRFS uplink.',
      },
    ],
  },
  // Army LIDS / FS-LIDS; Howler. RTX pages; Breaking Defense Aug 2023.
  {
    specId: 'lib-kurfs',
    program: 'Army LIDS / FS-LIDS program of record; Howler',
    protocols: ['faad-c2'],
    media: ['cable', 'proprietary-rf'],
    standalone: true,
    pairs: [
      {
        withSpecId: 'lib-coyote',
        role: 'fc-uplink',
        confidence: 'documented',
        medium: 'proprietary-rf',
        note: 'KuRFS is the designed fire-control source for Coyote Block 2 and provides the Ku-band guidance uplink.',
        source: 'RTX Coyote/KuRFS pages; Howler IOC release 2019',
      },
      {
        withSpecId: 'lib-faadc2',
        role: 'track-data',
        confidence: 'documented',
        note: 'In FS-LIDS all KuRFS sensor data is consolidated through FAAD C2, which issues engagement options.',
        source: 'Breaking Defense, Aug 2023',
      },
      {
        withSpecId: 'lib-lpws',
        role: 'cue',
        confidence: 'documented',
        note: 'RTX states KuRFS works with the Land-based Phalanx Weapon System.',
        source: 'rtx.com KuRFS page',
      },
      {
        withSpecId: 'lib-xm914',
        role: 'cue',
        confidence: 'documented',
        note: 'RTX states KuRFS works with 30mm cannons; the M-LIDS mast-mounted Ku-band radar cues the turret.',
        source: 'rtx.com KuRFS page; TWZ M-LIDS',
      },
      {
        withSpecId: 'lib-demshorad',
        role: 'track-data',
        confidence: 'documented',
        note: 'DE M-SHORAD onboard Ku720 360-degree radar is a scaled mobile KuRFS derivative.',
        source: 'optics.org, 2022',
      },
      {
        withSpecId: 'lib-lstar',
        role: 'c2-interop',
        confidence: 'documented',
        note: 'KuRFS (fire control) and AN/TPQ-50 (surveillance) are complementary co-deployed FS-LIDS sensors.',
        source: 'Defense Update FS-LIDS 2025; SRC LIDS brochure',
      },
      {
        withSpecId: 'lib-lattice',
        role: 'track-data',
        confidence: 'probable',
        note: 'Lattice replacing FAAD C2 as Army C-UAS fire control will need to ingest LIDS sensors including KuRFS.',
        source: 'Breaking Defense Oct 2025; DefenseScoop Mar 2026',
      },
    ],
  },
  // Army LIDS interceptor; Howler; CENTCOM combat use. RTX; Breaking Defense Aug 2023.
  {
    specId: 'lib-coyote',
    program: 'Army LIDS (FS-LIDS / M-LIDS); Howler',
    protocols: ['faad-c2'],
    media: ['proprietary-rf', 'cable'],
    standalone: false,
    guidance: 'fc-uplink',
    fcSources: ['lib-kurfs', 'lib-tpq53'],
    // Lattice qualifies because it is replacing FAAD C2 as Army C-UAS fire
    // control (Breaking Defense, Oct 2025) — matches the pair offered below.
    requiredC2: ['lib-faadc2', 'lib-lattice'],
    pairs: [
      {
        withSpecId: 'lib-kurfs',
        role: 'fc-uplink',
        confidence: 'documented',
        medium: 'proprietary-rf',
        note: 'KuRFS provides the fire-control track and in-flight guidance uplink (Howler / LIDS).',
        source: 'RTX Coyote page; Howler release 2019',
      },
      {
        withSpecId: 'lib-faadc2',
        role: 'engage-order',
        confidence: 'documented',
        note: 'FAAD C2 is the C2 layer that authorizes and cues Coyote engagements in LIDS.',
        source: 'Breaking Defense LIDS, Aug 2023',
      },
      {
        withSpecId: 'lib-tpq53',
        role: 'cue',
        confidence: 'documented',
        note: 'AN/TPQ-53 served as primary fire-control source for a Coyote Block 2 engagement via FAAD C2 at Yuma, Oct 2022.',
        source: 'Lockheed Martin release, Oct 27 2022',
      },
      {
        withSpecId: 'lib-lstar',
        role: 'cue',
        confidence: 'documented',
        note: 'AN/TPQ-50 provides surveillance cueing in FS-LIDS before KuRFS takes the fire-control track.',
        source: 'SRC LIDS brochure; Defense Update 2025',
      },
      {
        withSpecId: 'lib-xm914',
        role: 'c2-interop',
        confidence: 'documented',
        note: 'Co-mounted on the same M-LIDS turret with the XM914 30mm for layered defeat under one C2.',
        source: 'TWZ M-LIDS; army-technology',
      },
      {
        withSpecId: 'lib-lattice',
        role: 'engage-order',
        confidence: 'probable',
        note: 'Lattice, replacing FAAD C2 as Army C-UAS fire control, is expected to command legacy LIDS effectors.',
        source: 'Breaking Defense, Oct 2025',
      },
    ],
    denied: [
      {
        withSpecId: 'lib-rps42',
        reason: 'S-band MHR cannot provide the Ku-band fire-control uplink Coyote needs.',
      },
    ],
  },
  // Army SHORAD/C-RAM C2 of record; JCO interim C2 standard. NG data sheet; Breaking Defense.
  {
    specId: 'lib-faadc2',
    program: 'Army SHORAD/C-RAM C2 program of record; JCO interim C-sUAS C2 standard',
    protocols: ['faad-c2', 'link-16'],
    media: ['cable', 'mesh-radio'],
    standalone: false,
    pairs: [
      {
        withSpecId: 'lib-kurfs',
        role: 'track-data',
        confidence: 'documented',
        note: 'KuRFS feeds FAAD C2 in FS-LIDS.',
        source: 'Breaking Defense LIDS, Aug 2023',
      },
      {
        withSpecId: 'lib-lstar',
        role: 'track-data',
        confidence: 'documented',
        note: 'AN/TPQ-50 is digitally interoperable with FAAD C2 and provides C-RAM sense-and-warn data.',
        source: 'GlobalSecurity AN/TPQ-50; FAS LCMR handbook',
      },
      {
        withSpecId: 'lib-tpq53',
        role: 'track-data',
        confidence: 'documented',
        note: 'Q-53 integrated with FAAD C2 and served as fire-control source for C-UAS defeat at Yuma 2022.',
        source: 'Lockheed Martin, Oct 2022',
      },
      {
        withSpecId: 'lib-coyote',
        role: 'engage-order',
        confidence: 'documented',
        note: 'FAAD C2 cues and authorizes Coyote engagements in LIDS.',
        source: 'Breaking Defense LIDS, Aug 2023',
      },
      {
        withSpecId: 'lib-lpws',
        role: 'engage-order',
        confidence: 'documented',
        note: 'LPWS is a C-RAM system-of-systems component commanded through FAAD C2.',
        source: 'C-RAM component list; NG FAAD/C-RAM C2 data sheet',
      },
      {
        withSpecId: 'lib-xm914',
        role: 'engage-order',
        confidence: 'documented',
        note: 'NG documents the FAAD/C-RAM C2 kill chain including Bushmaster chain guns; M-LIDS operates under FAAD C2.',
        source: 'NG FAAD/C-RAM C2 data sheet; army-technology M-LIDS',
      },
      {
        withSpecId: 'lib-demshorad',
        role: 'engage-order',
        confidence: 'documented',
        medium: 'mesh-radio',
        note: 'DE M-SHORAD is interoperable with the FAAD C2 air-defense network; NG lists directed energy in the kill chain.',
        source: 'Army Recognition DE M-SHORAD; NG FAAD/C-RAM C2 data sheet',
      },
      {
        withSpecId: 'lib-phel',
        role: 'cue',
        confidence: 'documented',
        note: 'BlueHalo states LOCUST (P-HEL) supports FAAD C2 and other systems through cueing.',
        source: 'bluehalo.com C2 Tracking and Sensing',
      },
      {
        withSpecId: 'lib-leonidas',
        role: 'c2-interop',
        confidence: 'documented',
        note: 'IFPC-HPM (Leonidas) government acceptance testing included FAAD C2 interoperability evaluation.',
        source: 'Epirus press release, Nov 2023',
      },
      {
        withSpecId: 'lib-rps42',
        role: 'track-data',
        confidence: 'documented',
        note: 'JCO interim C-sUAS selections including L-MADIS (RPS-42) were required to integrate with FAAD C2.',
        source: 'army.mil, June 2020',
      },
      {
        withSpecId: 'lib-medusa',
        role: 'c2-interop',
        confidence: 'documented',
        note: 'USAF MEDUSA C2 is interoperable with FAAD C2 under the DoD joint C-sUAS C2 approach.',
        source: 'Air & Space Forces Magazine; DTIC AD1200505',
      },
      {
        withSpecId: 'lib-lattice',
        role: 'c2-interop',
        confidence: 'documented',
        note: 'Lattice was selected as enterprise C-UAS C2 to replace FAAD C2, integrating legacy FAAD-connected systems during transition.',
        source: 'Breaking Defense Oct 2025; DefenseScoop Mar 2026',
      },
    ],
    denied: [
      {
        withSpecId: 'lib-modi',
        reason:
          'Modi II is carried as a dismounted effector; no networked FAAD C2 data interface is documented.',
      },
      {
        withSpecId: 'lib-dronebuster',
        reason: 'Handheld point-and-shoot jammer with no C2 data interface; operator-employed only.',
      },
      {
        withSpecId: 'lib-smash',
        reason:
          'SMASH 2000L is a self-contained optical rifle fire-control sight; no documented FAAD C2 interface.',
      },
    ],
  },
  // M-LIDS gun vehicle; MADIS Mk1; M-SHORAD Inc 1. NG data sheet; Army Recognition 2025.
  {
    specId: 'lib-xm914',
    program: 'M-LIDS gun vehicle; USMC MADIS Mk1; M-SHORAD Inc 1',
    protocols: ['faad-c2'],
    media: ['cable', 'operator-manual'],
    standalone: true,
    guidance: 'c2-cue',
    pairs: [
      {
        withSpecId: 'lib-faadc2',
        role: 'engage-order',
        confidence: 'documented',
        note: 'The FAAD/C-RAM C2 kill chain explicitly includes Bushmaster chain guns with proximity ammunition.',
        source: 'NG FAAD/C-RAM C2 data sheet; army-technology M-LIDS',
      },
      {
        withSpecId: 'lib-kurfs',
        role: 'cue',
        confidence: 'documented',
        note: 'RTX states KuRFS works with 30mm cannons; the M-LIDS mast-mounted radar cues the turret.',
        source: 'rtx.com KuRFS page; TWZ M-LIDS',
      },
      {
        withSpecId: 'lib-coyote',
        role: 'c2-interop',
        confidence: 'documented',
        note: 'Shares the M-LIDS RIwP turret with the 2-round Coyote launcher for layered defeat.',
        source: 'TWZ; army-technology M-LIDS',
      },
      {
        withSpecId: 'lib-rps42',
        role: 'cue',
        confidence: 'documented',
        note: 'MADIS Mk2 RPS-42-family radar cues the Mk1 XM914E1; M-SHORAD uses the same RADA family.',
        source: 'Army Recognition MADIS 2025; Leonardo DRS M-SHORAD',
      },
      {
        withSpecId: 'lib-lattice',
        role: 'engage-order',
        confidence: 'probable',
        note: 'Lattice as replacement Army C-UAS fire control is expected to cue legacy gun effectors now under FAAD C2.',
        source: 'Breaking Defense, Oct 2025',
      },
    ],
  },
  // C-RAM program of record; land-based Phalanx. C-RAM component list; rtx.com.
  {
    specId: 'lib-lpws',
    program: 'C-RAM program of record (land-based Phalanx Block 1B)',
    protocols: ['faad-c2'],
    media: ['cable', 'operator-manual'],
    standalone: true,
    guidance: 'self',
    pairs: [
      {
        withSpecId: 'lib-faadc2',
        role: 'engage-order',
        confidence: 'documented',
        note: 'LPWS is a listed C-RAM system-of-systems component integrated by FAAD C2 with sense-and-warn sensor data.',
        source: 'C-RAM component list; US Army C-RAM LOR checklist',
      },
      {
        withSpecId: 'lib-kurfs',
        role: 'cue',
        confidence: 'documented',
        note: 'RTX states KuRFS works with the Land-based Phalanx Weapon System.',
        source: 'rtx.com KuRFS page',
      },
      {
        withSpecId: 'lib-lstar',
        role: 'cue',
        confidence: 'documented',
        note: 'AN/TPQ-50 LCMR sense-and-warn data flows through FAAD C2 to cue LPWS engagements in the C-RAM construct.',
        source: 'GlobalSecurity AN/TPQ-50; C-RAM component list',
      },
      {
        withSpecId: 'lib-tpq53',
        role: 'cue',
        confidence: 'probable',
        note: 'Q-53 is the Firefinder successor and a FAAD C2 sensor, so a Q-53-to-LPWS cue via FAAD C2 is near-certain.',
        source: 'C-RAM component list; Lockheed Martin Oct 2022',
      },
      {
        withSpecId: 'lib-lattice',
        role: 'engage-order',
        confidence: 'probable',
        note: 'Enterprise Lattice C2 replacing FAAD C2 would need to coordinate legacy C-RAM effectors.',
        source: 'DefenseScoop, Mar 2026',
      },
    ],
  },
  // Army RCCTO DE M-SHORAD prototype. Army Recognition fact sheet; optics.org 2022.
  {
    specId: 'lib-demshorad',
    program: 'Army RCCTO DE M-SHORAD prototype (50 kW HEL Stryker)',
    protocols: ['faad-c2'],
    media: ['mesh-radio', 'cable'],
    standalone: true,
    guidance: 'self',
    pairs: [
      {
        withSpecId: 'lib-faadc2',
        role: 'engage-order',
        confidence: 'documented',
        medium: 'mesh-radio',
        note: 'Integrated and interoperable with FAAD C2, enabling external cueing while maneuvering.',
        source: 'Army Recognition DE M-SHORAD; NG FAAD/C-RAM C2 data sheet',
      },
      {
        withSpecId: 'lib-kurfs',
        role: 'track-data',
        confidence: 'documented',
        note: 'The onboard Ku720 multi-mission radar is a scaled mobile KuRFS derivative and the organic acquisition radar.',
        source: 'optics.org, 2022',
      },
      {
        withSpecId: 'lib-lattice',
        role: 'c2-interop',
        confidence: 'probable',
        note: 'Falls under the Army enterprise C-UAS C2 transition from FAAD C2 to Lattice.',
        source: 'DefenseScoop, Mar 2026',
      },
    ],
  },
  // Army counterfire radar of record with C-UAS mode. Lockheed Martin Oct 2022.
  {
    specId: 'lib-tpq53',
    program: 'Army counterfire radar program of record (multi-mission C-UAS mode)',
    protocols: ['faad-c2'],
    media: ['cable'],
    standalone: true,
    pairs: [
      {
        withSpecId: 'lib-faadc2',
        role: 'track-data',
        confidence: 'documented',
        note: 'Q-53 integrated with FAAD C2 at Yuma Proving Ground, Oct 2022, feeding the C-UAS kill chain.',
        source: 'Lockheed Martin release, Oct 27 2022',
      },
      {
        withSpecId: 'lib-coyote',
        role: 'cue',
        confidence: 'documented',
        note: 'Served as the primary fire-control source for a Coyote Block 2 launch via FAAD C2 in the 2022 demonstration.',
        source: 'Lockheed Martin release, Oct 27 2022',
      },
      {
        withSpecId: 'lib-lpws',
        role: 'cue',
        confidence: 'probable',
        note: 'As Firefinder successor and FAAD C2 sensor, Q-53 sense-and-warn data can cue C-RAM LPWS batteries.',
        source: 'C-RAM component list; Lockheed Oct 2022',
      },
      {
        withSpecId: 'lib-lattice',
        role: 'track-data',
        confidence: 'probable',
        note: 'Legacy program-of-record radar within scope of the Lattice enterprise C2 integration mandate.',
        source: 'DefenseScoop, Mar 2026',
      },
    ],
  },
  // SRC AN/TPQ-50 with LSTAR software; FS-LIDS sensor. GlobalSecurity; SRC brochure.
  {
    specId: 'lib-lstar',
    program: 'AN/TPQ-50 (LCMR program of record) running LSTAR; FS-LIDS sensor',
    protocols: ['faad-c2'],
    media: ['cable'],
    standalone: true,
    pairs: [
      {
        withSpecId: 'lib-faadc2',
        role: 'track-data',
        confidence: 'documented',
        note: 'Provides air surveillance and RAM sense-and-warn data to FAAD C2; digitally interoperable with AFATDS too.',
        source: 'GlobalSecurity AN/TPQ-50; FAS LCMR handbook',
      },
      {
        withSpecId: 'lib-coyote',
        role: 'cue',
        confidence: 'documented',
        note: 'In FS-LIDS the TPQ-50 provides 360-degree surveillance cueing ahead of the KuRFS fire-control track.',
        source: 'SRC LIDS brochure; Defense Update 2025',
      },
      {
        withSpecId: 'lib-kurfs',
        role: 'c2-interop',
        confidence: 'documented',
        note: 'Complementary co-deployed FS-LIDS sensors fused in FAAD C2.',
        source: 'Defense Update 2025; Breaking Defense LIDS 2023',
      },
      {
        withSpecId: 'lib-lpws',
        role: 'cue',
        confidence: 'documented',
        note: 'LCMR sense-and-warn is a listed C-RAM component; its warnings cue LPWS engagements through FAAD C2.',
        source: 'C-RAM component list; GlobalSecurity AN/TPQ-50',
      },
      {
        withSpecId: 'lib-lattice',
        role: 'track-data',
        confidence: 'probable',
        note: 'Legacy LIDS sensor within scope of the Lattice enterprise C-UAS C2 transition.',
        source: 'Breaking Defense, Oct 2025',
      },
    ],
  },
  // Anduril CUxS hub; JIATF-401 enterprise C2. Anduril/Epirus 2023; DefenseScoop 2026.
  {
    specId: 'lib-lattice',
    program: 'Anduril CUxS; JIATF-401 enterprise C-UAS C2; Army IBCS-M',
    protocols: ['lattice', 'cot-tak'],
    media: ['cable', 'mesh-radio'],
    standalone: false,
    pairs: [
      {
        withSpecId: 'lib-leonidas',
        role: 'cue',
        confidence: 'documented',
        note: 'Lattice ingests radar track data and cues Leonidas HPM to lock, track, and defeat targets.',
        source: 'Anduril/Epirus press release, Aug 2023',
      },
      {
        withSpecId: 'lib-anvil',
        role: 'engage-order',
        confidence: 'documented',
        note: 'Anvil is cued and tasked through Lattice; demonstrated end-to-end at Falcon Peak 25.2.',
        source: 'The Defense Post, Oct 2025; Anduril Falcon Peak 25.2',
      },
      {
        withSpecId: 'lib-roadrunner',
        role: 'engage-order',
        confidence: 'documented',
        note: 'Roadrunner-M is managed through Lattice C2, one operator handling multiple interceptors.',
        source: 'TWZ Dec 2023; Breaking Defense Jun 2026',
      },
      {
        withSpecId: 'lib-picogrid',
        role: 'c2-interop',
        confidence: 'documented',
        note: 'Picogrid LAPIS/Legion names Lattice among the C2 networks it feeds.',
        source: 'Picogrid press via sUAS News, Jun 2026',
      },
      {
        withSpecId: 'lib-echoshield',
        role: 'track-data',
        confidence: 'probable',
        note: 'Anduril adopted Echodyne radars for Sentry towers; same-vendor radar ingestion into Lattice is established.',
        source: 'Defense News, Jul 2026',
      },
      {
        withSpecId: 'lib-coyote',
        role: 'engage-order',
        confidence: 'probable',
        note: 'Lattice-Coyote fire control is the planned IBCS-M architecture, not yet publicly demonstrated.',
        source: 'DefenseScoop, Nov 2025',
      },
      {
        withSpecId: 'lib-faadc2',
        role: 'c2-interop',
        confidence: 'probable',
        note: 'Lattice is fielded as the FAAD C2 successor, but a direct bidirectional link is not explicitly documented.',
        source: 'DefenseScoop Mar 2026; Breaking Defense Jun 2020',
      },
      {
        withSpecId: 'lib-merops',
        role: 'cue',
        confidence: 'probable',
        note: 'CENTCOM reporting describes Merops integrated through FAAD C2 and increasingly Anduril Lattice.',
        source: 'flightbrief.news 2026; Picogrid/sUAS News Jun 2026',
      },
    ],
    denied: [
      {
        withSpecId: 'lib-medusa',
        reason:
          'Competing enterprise C-UAS C2 platforms; each interoperates with FAAD C2 instead of each other.',
      },
    ],
  },
  // Anduril CUxS interceptor; Falcon Peak 25.2. Anduril; The Defense Post Oct 2025.
  {
    specId: 'lib-anvil',
    program: 'Anduril CUxS; USMC I-CsUAS; Falcon Peak 25.2',
    protocols: ['lattice'],
    media: ['proprietary-rf', 'cable'],
    standalone: false,
    guidance: 'c2-cue',
    requiredC2: ['lib-lattice'],
    pairs: [
      {
        withSpecId: 'lib-lattice',
        role: 'fc-uplink',
        confidence: 'documented',
        note: 'Anvil is cued by Lattice from tower and radar tracks, then uses onboard computer-vision terminal guidance.',
        source: 'Anduril Anvil page; The Defense Post Oct 2025',
      },
      {
        withSpecId: 'lib-roadrunner',
        role: 'c2-interop',
        confidence: 'documented',
        note: 'Co-deployed layered kinetic pair under one Lattice network in USMC and Kuwait FMS configurations.',
        source: 'Breaking Defense Jun 2026; The Defense Post Mar 2025',
      },
      {
        withSpecId: 'lib-leonidas',
        role: 'c2-interop',
        confidence: 'probable',
        note: 'Both are documented Lattice-integrated effectors, so coexistence in one Lattice network is near-certain.',
        source: 'Anduril/Epirus press Aug 2023',
      },
      {
        withSpecId: 'lib-echoshield',
        role: 'cue',
        confidence: 'probable',
        note: 'Echodyne radars anchor Anduril sentry towers whose tracks cue Anvil via Lattice, never radar-direct.',
        source: 'Defense News Jul 2026; Anduril Anvil page',
      },
    ],
    denied: [
      {
        withSpecId: 'lib-faadc2',
        reason:
          'No published FAAD C2 integration kit for Anvil; all documented employments task it through Lattice.',
      },
    ],
  },
  // Anduril CUxS reusable interceptor; CENTCOM. TWZ Dec 2023; Breaking Defense Jun 2026.
  {
    specId: 'lib-roadrunner',
    program: 'Anduril CUxS; CENTCOM combat evaluation; Kuwait FMS 2026',
    protocols: ['lattice'],
    media: ['proprietary-rf', 'cable'],
    standalone: false,
    guidance: 'c2-cue',
    requiredC2: ['lib-lattice'],
    pairs: [
      {
        withSpecId: 'lib-lattice',
        role: 'fc-uplink',
        confidence: 'documented',
        note: 'Integrated with Lattice C2; a single operator manages multiple Roadrunner-M rounds.',
        source: 'TWZ Dec 2023; Anduril product material',
      },
      {
        withSpecId: 'lib-anvil',
        role: 'c2-interop',
        confidence: 'documented',
        note: 'Layered with Anvil-Kinetic under one Lattice counter-UAS network.',
        source: 'Breaking Defense Jun 2026',
      },
      {
        withSpecId: 'lib-echoshield',
        role: 'cue',
        confidence: 'probable',
        note: 'Sentry-tower radar tracks cue Roadrunner-M via Lattice in the standard Anduril configuration.',
        source: 'Defense News Jul 2026; Anduril CUxS material',
      },
    ],
    denied: [
      {
        withSpecId: 'lib-faadc2',
        reason:
          'No public FAAD C2 integration of Roadrunner-M is documented; CENTCOM employment ran under Lattice.',
      },
      {
        withSpecId: 'lib-coyote',
        reason: 'Direct competitor to Coyote Block 2 in the same threat class; no cross-integration exists.',
      },
    ],
  },
  // Picogrid Legion edge C2; LAPIS. Picogrid newsroom / sUAS News Jun 2026.
  {
    specId: 'lib-picogrid',
    program: 'Picogrid Legion expeditionary edge C2; LAPIS',
    protocols: ['cot-tak', 'faad-c2', 'lattice'],
    media: ['mesh-radio', 'cable'],
    standalone: false,
    pairs: [
      {
        withSpecId: 'lib-merops',
        role: 'cue',
        confidence: 'documented',
        note: 'Picogrid is the documented integration layer bridging Merops interceptors into the US expeditionary air-defense network.',
        source: 'Picogrid newsroom, Jun 2026; Tectonic Defense',
      },
      {
        withSpecId: 'lib-faadc2',
        role: 'c2-interop',
        confidence: 'documented',
        note: 'Edge sensor data is pushed into FAAD C2 classified networks through Picogrid cross-domain solution.',
        source: 'Picogrid newsroom Jun 2026; sUAS News Jun 2026',
      },
      {
        withSpecId: 'lib-lattice',
        role: 'c2-interop',
        confidence: 'documented',
        note: 'LAPIS supports direct integration with Lattice alongside TAK, NGC2, and Maven.',
        source: 'Picogrid/sUAS News, Jun 2026',
      },
      {
        withSpecId: 'lib-acoustic-picket',
        role: 'track-data',
        confidence: 'probable',
        note: 'LAPIS is built to ingest low-altitude passive sensors on the Ukraine model via Legion open APIs.',
        source: 'Picogrid LAPIS material, 2026',
      },
      {
        withSpecId: 'lib-rps42',
        role: 'track-data',
        confidence: 'probable',
        note: 'Legion is radar-agnostic and fuses radar tracks locally, though a Picogrid-RPS-42 pairing is not named directly.',
        source: 'Picogrid Jun 2026; Militarnyi Nov 2025',
      },
    ],
    denied: [
      {
        withSpecId: 'lib-medusa',
        reason: 'No documented Picogrid link to USAF MEDUSA; the published network list is Army-centric.',
      },
    ],
  },
  // USAF counter-sUAS enterprise C2. Breaking Defense 2020-21; Air & Space Forces Magazine.
  {
    specId: 'lib-medusa',
    program: 'USAF counter-sUAS enterprise C2; AFCENT air-base defense',
    protocols: ['faad-c2'],
    media: ['cable', 'fiber'],
    standalone: false,
    pairs: [
      {
        withSpecId: 'lib-faadc2',
        role: 'c2-interop',
        confidence: 'documented',
        note: 'JCO reporting states MEDUSA is fully interoperable with FAAD C2 under the single standard architecture.',
        source: 'Breaking Defense Jun 2020 and Feb 2021',
      },
    ],
    denied: [
      {
        withSpecId: 'lib-lattice',
        reason: 'No documented MEDUSA-Lattice interoperability; both claim FAAD C2 compatibility instead.',
      },
      {
        withSpecId: 'lib-dronebuster',
        reason:
          'Handheld point-and-shoot jammer with no network data interface; it cannot be tasked by or report into MEDUSA.',
      },
      {
        withSpecId: 'lib-thor',
        reason: 'No public reporting shows THOR netted into MEDUSA; AFRL ran THOR with its own operator console.',
      },
      {
        withSpecId: 'lib-coyote',
        reason:
          'Coyote is fired by Army LIDS batteries under FAAD C2/KuRFS; MEDUSA involvement would be air-picture sharing only.',
      },
    ],
  },
  // Perennial Autonomy Merops; Ukraine and CENTCOM employment. Militarnyi Nov 2025; Picogrid Jun 2026.
  {
    specId: 'lib-merops',
    program: 'Perennial Autonomy Merops; Ukraine counter-Shahed; CENTCOM base defense',
    protocols: [],
    media: ['proprietary-rf', 'operator-manual', 'cable'],
    standalone: true,
    guidance: 'self',
    pairs: [
      {
        withSpecId: 'lib-rps42',
        role: 'cue',
        confidence: 'documented',
        note: 'US Army integrated Merops with the RADA RPS-42 radar during Operation Eastern Sentry demonstrations in Poland.',
        source: 'Militarnyi, Nov 2025',
      },
      {
        withSpecId: 'lib-picogrid',
        role: 'c2-interop',
        confidence: 'documented',
        note: 'Picogrid Legion/ECNs fuse radar tracks at the edge and cue Merops in automated detect-to-engage workflows.',
        source: 'Picogrid newsroom, Jun 2026; Tectonic Defense',
      },
      {
        withSpecId: 'lib-faadc2',
        role: 'track-data',
        confidence: 'documented',
        note: 'Merops edge data reaches FAAD C2 classified networks through Picogrid cross-domain solution.',
        source: 'Picogrid newsroom, Jun 2026',
      },
      {
        withSpecId: 'lib-lattice',
        role: 'cue',
        confidence: 'probable',
        note: 'CENTCOM layered-defense reporting describes Merops integration through FAAD C2 and increasingly Lattice.',
        source: 'flightbrief.news 2026; Picogrid/sUAS News Jun 2026',
      },
      {
        withSpecId: 'lib-acoustic-picket',
        role: 'alert',
        confidence: 'probable',
        note: 'Ukrainian counter-Shahed interceptor operations are cued by nationwide acoustic sensor networks.',
        source: 'TWZ Ukraine reporting; FPRI Mar 2026',
      },
      {
        withSpecId: 'lib-kurfs',
        role: 'c2-interop',
        confidence: 'probable',
        note: 'In the CENTCOM architecture Merops sits beside the KuRFS+Coyote layer, sharing the picture through FAAD C2.',
        source: 'flightbrief.news 2026',
      },
      {
        withSpecId: 'lib-coyote',
        role: 'c2-interop',
        confidence: 'probable',
        note: 'Coexists with Coyote as a cheaper counter-Shahed layer at the same sites, deconflicted via FAAD C2.',
        source: 'Defense News Apr 2026; TWZ 2026',
      },
    ],
  },
  // DIU prototype -> NCR-IADS ERSA camera modernization. DIU 2023; GovConWire 2023.
  {
    specId: 'lib-teleidoscope',
    program: 'NCR-IADS ERSA camera modernization (JADOC)',
    protocols: [],
    media: ['fiber', 'operator-manual'],
    standalone: true,
    pairs: [],
    denied: [
      {
        withSpecId: 'lib-faadc2',
        reason:
          'No published FAAD C2 integration; the fielded system reports into the NCR-IADS/JADOC architecture.',
      },
      { withSpecId: 'lib-lattice', reason: 'No documented Teleidoscope-Lattice integration.' },
      {
        withSpecId: 'lib-kurfs',
        reason: 'Open sources do not confirm Teleidoscope cameras in the FS-LIDS/KuRFS stack.',
      },
    ],
  },
  // USMC L-MADIS / MADIS Mk2 EW. TWZ 2019; GlobalSecurity L-MADIS.
  {
    specId: 'lib-modi',
    program: 'USMC L-MADIS / MADIS Mk2 mounted EW; dismounted CREW jammer',
    protocols: [],
    media: ['cable', 'operator-manual'],
    standalone: true,
    guidance: 'operator',
    pairs: [
      {
        withSpecId: 'lib-rps42',
        role: 'cue',
        confidence: 'documented',
        note: 'RPS-42 detects and cues the operator, who engages with Modi II on the same vehicle.',
        source: 'TWZ 2019; GlobalSecurity L-MADIS',
      },
      {
        withSpecId: 'lib-faadc2',
        role: 'c2-interop',
        confidence: 'probable',
        note: 'The Army selected L-MADIS (with Modi) as interim mounted C-sUAS and mandated FAAD C2 as common interim C2.',
        source: 'army.mil 2020',
      },
    ],
    denied: [
      {
        withSpecId: 'lib-lattice',
        reason: 'No public documentation of a Modi-Lattice integration; the MADIS C2 path is CAC2S/MACCS.',
      },
      {
        withSpecId: 'lib-dronebuster',
        reason: 'Both are jammers; no machine-to-machine integration exists or is needed.',
      },
    ],
  },
  // JCO-approved handheld EA. Flex Force datasheet; airforce-technology profile.
  {
    specId: 'lib-dronebuster',
    program: 'JCO-approved handheld EA (Block 3B)',
    protocols: [],
    media: ['operator-manual'],
    standalone: true,
    guidance: 'operator',
    pairs: [],
    denied: [
      {
        withSpecId: 'lib-faadc2',
        reason:
          'Block 3B has no network interface; cueing is procedural voice/radio to the operator.',
      },
      {
        withSpecId: 'lib-rfone',
        reason: 'An RF sensor can alert the sentry only by voice/procedure; there is no technical integration.',
      },
      {
        withSpecId: 'lib-rf360',
        reason: 'Human-in-the-loop procedural cue only; no machine interface on the handheld.',
      },
      { withSpecId: 'lib-modi', reason: 'No integration between the two jammers.' },
    ],
  },
  // D-Fend EnforceAir; JCO installation-defense recommendation. Unmanned Airspace 2022.
  {
    specId: 'lib-enforceair',
    program: 'JCO installation-defense recommendation (via SAIC C2)',
    protocols: ['cot-tak'],
    media: ['cable', 'mesh-radio'],
    standalone: true,
    guidance: 'self',
    pairs: [],
    denied: [
      {
        withSpecId: 'lib-faadc2',
        reason: 'No public FAAD C2 integration kit; the documented DoD fielding path is via SAIC C2.',
      },
      {
        withSpecId: 'lib-rf360',
        reason: 'Dedrone is a direct competitor with its own RF-cyber stack; no documented interoperability.',
      },
      {
        withSpecId: 'lib-medusa',
        reason: 'No public documentation of EnforceAir on the USAF MEDUSA network.',
      },
      {
        withSpecId: 'lib-lattice',
        reason: 'No documented EnforceAir-Lattice integration as of mid-2026.',
      },
    ],
  },
  // Smart Shooter SMASH 2000L. Army Recognition 2026; Smart Shooter documentation.
  {
    specId: 'lib-smash',
    program: 'Army Individual C-sUAS; USMC squad-level C-UAS',
    protocols: [],
    media: ['operator-manual', 'cable'],
    standalone: true,
    guidance: 'operator',
    pairs: [],
    denied: [
      {
        withSpecId: 'lib-faadc2',
        reason: 'No documented FAAD C2 integration; the 2000LE advertises BMS connectivity but no public FAAD C2 kit exists.',
      },
      {
        withSpecId: 'lib-rps42',
        reason: 'No documented machine cue from air-surveillance radars to the rifle optic; cueing is procedural.',
      },
      {
        withSpecId: 'lib-dronebuster',
        reason: 'Both are last-line individual weapons; no integration between them.',
      },
    ],
  },
  // Army RCCTO P-HEL (BlueHalo LOCUST). BlueHalo/PRNewswire 2024; military.com 2024.
  {
    specId: 'lib-phel',
    program: 'Army RCCTO P-HEL (BlueHalo LOCUST LWS)',
    protocols: ['faad-c2'],
    media: ['cable', 'operator-manual'],
    standalone: true,
    guidance: 'self',
    pairs: [
      {
        withSpecId: 'lib-faadc2',
        role: 'engage-order',
        confidence: 'documented',
        note: 'BlueHalo states systems employing LOCUST LWS are fully integrated with the Army FAAD C2 network.',
        source: 'BlueHalo/PRNewswire 2024; military.com 2024',
      },
      {
        withSpecId: 'lib-kurfs',
        role: 'cue',
        confidence: 'probable',
        note: 'At fixed CENTCOM sites KuRFS feeds FAAD C2, which can cue P-HEL through track correlation.',
        source: 'RTX LIDS 2024; military.com 2024',
      },
      {
        withSpecId: 'lib-lstar',
        role: 'cue',
        confidence: 'probable',
        note: 'AN/TPQ-50 is a standard FAAD C2-fed C-sUAS radar whose tracks can cue P-HEL through the shared network.',
      },
      {
        withSpecId: 'lib-tpq53',
        role: 'cue',
        confidence: 'probable',
        note: 'AN/TPQ-53 in air-surveillance mode reports into FAAD C2 and can cue P-HEL indirectly through it.',
      },
      {
        withSpecId: 'lib-coyote',
        role: 'c2-interop',
        confidence: 'probable',
        note: 'P-HEL and LIDS/Coyote batteries share the FAAD C2 network at protected sites for layered defense.',
      },
    ],
  },
  // Epirus IFPC-HPM. Epirus press 2023; army-technology Leonidas profile.
  {
    specId: 'lib-leonidas',
    program: 'Army RCCTO IFPC-HPM (Epirus Leonidas)',
    protocols: ['faad-c2', 'lattice'],
    media: ['cable'],
    standalone: false,
    guidance: 'c2-cue',
    pairs: [
      {
        withSpecId: 'lib-lattice',
        role: 'engage-order',
        confidence: 'documented',
        note: 'Leonidas ingests timing, radar track data, and commands through Lattice to lock and track designated targets.',
        source: 'Epirus press release 2023; Defense Advancement 2023',
      },
      {
        withSpecId: 'lib-faadc2',
        role: 'engage-order',
        confidence: 'documented',
        note: 'Leonidas open architecture integrates with FAAD C2 so existing air-defense sensors cue the HPM.',
        source: 'army-technology.com Leonidas profile',
      },
      {
        withSpecId: 'lib-kurfs',
        role: 'cue',
        confidence: 'probable',
        note: 'IFPC-HPM emplacements on FAAD C2 sites can take KuRFS tracks as cue through FAAD C2.',
      },
      {
        withSpecId: 'lib-anvil',
        role: 'c2-interop',
        confidence: 'probable',
        note: 'Both are Lattice-controlled effectors, so layered HPM-plus-kinetic engagement under one picture is near-certain.',
      },
      {
        withSpecId: 'lib-roadrunner',
        role: 'c2-interop',
        confidence: 'probable',
        note: 'Shared-C2 layered defense with Lattice-integrated Roadrunner-M is near-certain, though not demonstrated together.',
      },
    ],
    denied: [
      {
        withSpecId: 'lib-lpws',
        reason:
          'No documented Leonidas-C-RAM integration; intercept deconfliction with an HPM field is unaddressed publicly.',
      },
    ],
  },
  // AFRL experimental HPM. Shephard Media; JED 2023; AFRL releases.
  {
    specId: 'lib-thor',
    program: 'AFRL experimental HPM for air-base defense',
    protocols: ['faad-c2'],
    media: ['cable', 'operator-manual'],
    standalone: true,
    guidance: 'self',
    pairs: [
      {
        withSpecId: 'lib-faadc2',
        role: 'cue',
        confidence: 'documented',
        note: 'In AFRL evaluation a C-UAS radar chain exported tracks to FAAD C2 to cue THOR, which neutralized multiple UAS.',
        source: 'Shephard Media; JED 2023',
      },
    ],
    denied: [
      {
        withSpecId: 'lib-medusa',
        reason: 'No public reporting shows THOR on the USAF MEDUSA C-sUAS network.',
      },
      {
        withSpecId: 'lib-leonidas',
        reason: 'Competing HPM approaches; no integration between them.',
      },
    ],
  },
  // Echodyne EchoShield; USAF SUADS; Red Sands 2025. Defense Advancement 2025.
  {
    specId: 'lib-echoshield',
    program: 'Echodyne commercial; USAF SUADS; Red Sands 2025',
    protocols: ['faad-c2', 'sapient'],
    media: ['cable'],
    standalone: true,
    pairs: [
      {
        withSpecId: 'lib-faadc2',
        role: 'track-data',
        confidence: 'documented',
        note: 'At Red Sands 2025 EchoShield track data was pushed to FAAD C2 and used to slew-to-cue optics.',
        source: 'Defense Advancement, 2025',
      },
      {
        withSpecId: 'lib-rfone',
        role: 'c2-interop',
        confidence: 'documented',
        note: 'Rapid-deploy DroneSentry configs pair EchoShield radars with DroneShield RF sensors under SensorFusionAI.',
        source: 'UASweekly, Mar 2025',
      },
      {
        withSpecId: 'lib-rf360',
        role: 'c2-interop',
        confidence: 'documented',
        note: 'Echodyne radar is fused with Dedrone RF sensors in DedroneTracker.AI (DedroneTower configuration).',
        source: 'dedrone.com technology partners',
      },
      {
        withSpecId: 'lib-leonidas',
        role: 'cue',
        confidence: 'documented',
        note: 'DroneSentry-C2 integrates Echodyne radars alongside the Leonidas HPM effector; radar tracks cue the HPM.',
        source: 'UASweekly, Mar 2025',
      },
      {
        withSpecId: 'lib-lattice',
        role: 'track-data',
        confidence: 'probable',
        note: 'Anduril Sentry towers historically used Echodyne radars; an EchoShield-specific integration is not published.',
        source: 'Defense News, Jul 2026',
      },
    ],
    denied: [
      {
        withSpecId: 'lib-coyote',
        reason:
          'Cannot substitute for KuRFS: Coyote guidance depends on the Ku-band fire-control uplink, which EchoShield does not provide.',
      },
    ],
  },
  // Robin Radar IRIS; Ukraine at scale; NATO TIE23. robinradar.com 2023.
  {
    specId: 'lib-iris',
    program: 'Robin Radar commercial; Ukraine employment; NATO TIE23',
    protocols: ['sapient'],
    media: ['cable'],
    standalone: true,
    pairs: [
      {
        withSpecId: 'lib-rf360',
        role: 'track-data',
        confidence: 'documented',
        note: 'IRIS radar tracks feed the DedroneTracker fusion engine, fusing with Dedrone RF sensors.',
        source: 'robinradar.com NATO TIE23, 2023',
      },
      {
        withSpecId: 'lib-rfone',
        role: 'c2-interop',
        confidence: 'documented',
        note: 'The Robin Radar-DroneShield partnership makes IRIS a supported radar in DroneSentry-C2.',
        source: 'Robin Radar / DroneShield press, Mar 2026',
      },
      {
        withSpecId: 'lib-discovair',
        role: 'c2-interop',
        confidence: 'probable',
        note: 'Both vendors publish SAPIENT support and both integrate in DroneSentry-C2, so plug-level interop is near-certain.',
        source: 'robinradar.com TIE23; sqhead.com',
      },
      {
        withSpecId: 'lib-acoustic-picket',
        role: 'c2-interop',
        confidence: 'probable',
        note: 'Both feed Ukraine national air picture; fusion happens at the C2 layer, not sensor-to-sensor.',
        source: 'The Defense Post Sep 2025; Defense One Jul 2024',
      },
    ],
    denied: [
      {
        withSpecId: 'lib-coyote',
        reason: 'Provides surveillance/cue-grade 3D tracks only; no Coyote fire-control datalink.',
      },
    ],
  },
  // Teledyne FLIR R8SS-3D; Swedish critical-infrastructure install. Unmanned Airspace 2022.
  {
    specId: 'lib-r8ss',
    program: 'Teledyne FLIR commercial; Cameleon C2 ecosystem',
    protocols: [],
    media: ['cable'],
    standalone: true,
    pairs: [
      {
        withSpecId: 'lib-hdcmr',
        role: 'cue',
        confidence: 'documented',
        note: 'The R8SS-3D radar automatically slews-to-cue the Ranger HDC MR thermal camera under FLIR Cameleon C2.',
        source: 'Unmanned Airspace, 2022',
      },
      {
        withSpecId: 'lib-rfone',
        role: 'c2-interop',
        confidence: 'probable',
        note: 'Teledyne FLIR is a listed detection partner in the DroneSentry-C2 ecosystem.',
        source: 'UASweekly, Mar 2025',
      },
    ],
  },
  // DroneShield RfOne; DroneSentry-C2 ecosystem. UASweekly Mar 2025; DroneShield press.
  {
    specId: 'lib-rfone',
    program: 'DroneShield commercial; DroneSentry-C2 ecosystem',
    protocols: ['sapient', 'cot-tak'],
    media: ['cable'],
    standalone: true,
    pairs: [
      {
        withSpecId: 'lib-echoshield',
        role: 'c2-interop',
        confidence: 'documented',
        note: 'EchoShield radars fuse with DroneShield RF sensors in DroneSentry-C2 rapid-deploy configurations.',
        source: 'UASweekly, Mar 2025',
      },
      {
        withSpecId: 'lib-iris',
        role: 'c2-interop',
        confidence: 'documented',
        note: 'Robin Radar IRIS was added to the DroneSentry-C2 SensorFusionAI marketplace; RF cues fuse with radar tracks.',
        source: 'DroneShield / Robin Radar press, Mar 2026',
      },
      {
        withSpecId: 'lib-discovair',
        role: 'c2-interop',
        confidence: 'documented',
        note: 'The Discovair G2 acoustic array is integrated with DroneShield products in DroneSentry-C2.',
        source: 'DroneShield-Squarehead PR; HSToday',
      },
      {
        withSpecId: 'lib-leonidas',
        role: 'cue',
        confidence: 'documented',
        note: 'Leonidas HPM is integrated as an effector in DroneSentry-C2; RF and radar detections cue the engagement.',
        source: 'UASweekly, Mar 2025',
      },
      {
        withSpecId: 'lib-hdcmr',
        role: 'c2-interop',
        confidence: 'probable',
        note: 'Teledyne FLIR is a listed DroneSentry-C2 detection partner; the HDC MR-specific pairing is not published.',
        source: 'UASweekly, Mar 2025',
      },
    ],
    denied: [
      {
        withSpecId: 'lib-dronebuster',
        reason: 'Any cue from RfOne detections reaches the jammer operator only verbally, not as a machine link.',
      },
      {
        withSpecId: 'lib-coyote',
        reason: 'Passive RF direction-finding yields bearing, not a fire-control track; cannot support Coyote guidance.',
      },
    ],
  },
  // Dedrone RF-360 (Axon). dedrone.com partners; robinradar.com TIE23.
  {
    specId: 'lib-rf360',
    program: 'Dedrone by Axon commercial; Ukraine family employment',
    protocols: [],
    media: ['cable', 'mesh-radio'],
    standalone: false,
    pairs: [
      {
        withSpecId: 'lib-echoshield',
        role: 'c2-interop',
        confidence: 'documented',
        note: 'RF-360 detections fuse with Echodyne radar tracks in DedroneTracker.AI (DedroneTower).',
        source: 'dedrone.com technology partners',
      },
      {
        withSpecId: 'lib-iris',
        role: 'track-data',
        confidence: 'documented',
        note: 'Robin Radar IRIS feeds the DedroneTracker fusion engine, fusing with Dedrone RF sensors.',
        source: 'robinradar.com NATO TIE23, 2023',
      },
    ],
    denied: [
      {
        withSpecId: 'lib-faadc2',
        reason: 'No public FAAD C2 integration for DedroneTracker/RF-360.',
      },
    ],
  },
  // Squarehead Discovair G2. DroneShield-Squarehead PR; HSToday.
  {
    specId: 'lib-discovair',
    program: 'Squarehead commercial; US DoD test with DroneShield',
    protocols: ['sapient'],
    media: ['cable'],
    standalone: true,
    pairs: [
      {
        withSpecId: 'lib-rfone',
        role: 'c2-interop',
        confidence: 'documented',
        note: 'Discovair G2 is integrated with DroneShield RF, radar, and camera products in DroneSentry-C2.',
        source: 'DroneShield-Squarehead PR; HSToday',
      },
      {
        withSpecId: 'lib-iris',
        role: 'c2-interop',
        confidence: 'probable',
        note: 'Both are SAPIENT-supporting sensors integrated with DroneSentry-C2, so standards-level interop is near-certain.',
        source: 'sqhead.com; robinradar.com TIE23',
      },
    ],
    denied: [
      {
        withSpecId: 'lib-coyote',
        reason: 'Acoustic direction-finding cannot generate a fire-control-grade track or datalink.',
      },
    ],
  },
  // Ukraine Sky Fortress class acoustic picket. Defense One Jul 2024; The Defense Post Sep 2025.
  {
    specId: 'lib-acoustic-picket',
    program: 'Ukraine national air defense (Sky Fortress class)',
    protocols: [],
    media: ['mesh-radio'],
    standalone: false,
    pairs: [
      {
        withSpecId: 'lib-iris',
        role: 'c2-interop',
        confidence: 'probable',
        note: 'Acoustic tracks and IRIS radar tracks both feed the Ukrainian national air picture at the C2 layer.',
        source: 'Defense One Jul 2024; The Defense Post Sep 2025',
      },
    ],
    denied: [
      {
        withSpecId: 'lib-faadc2',
        reason:
          'No public evidence Sky Fortress was integrated into FAAD C2; it delivers its picture via its own cloud application.',
      },
      {
        withSpecId: 'lib-merops',
        reason: 'No published link between acoustic picket cueing and Merops interceptor employment.',
      },
    ],
  },
  // Teledyne FLIR Ranger HDC MR. Unmanned Airspace 2022; UASweekly Mar 2025.
  {
    specId: 'lib-hdcmr',
    program: 'Teledyne FLIR commercial; Cameleon C2 ecosystem',
    protocols: [],
    media: ['cable'],
    standalone: true,
    pairs: [
      {
        withSpecId: 'lib-r8ss',
        role: 'cue',
        confidence: 'documented',
        note: 'Receives automatic slew-to-cue from the R8SS-3D radar under FLIR Cameleon C2.',
        source: 'Unmanned Airspace, 2022',
      },
      {
        withSpecId: 'lib-rfone',
        role: 'c2-interop',
        confidence: 'probable',
        note: 'Teledyne FLIR is a listed detection partner in DroneSentry-C2.',
        source: 'UASweekly, Mar 2025',
      },
      {
        withSpecId: 'lib-echoshield',
        role: 'cue',
        confidence: 'probable',
        note: 'Both are integrated members of the DroneSentry-C2 ecosystem, so radar-cue-to-camera pairing is near-certain.',
      },
    ],
  },
]
