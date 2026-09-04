import type { SpecModel } from './types'

/**
 * Seed spec library, researched from open sources (government documents,
 * manufacturer releases, DoD public statements, defense trade press).
 *
 * Values are planning figures, not authoritative performance data. Where the
 * public record gives no figure the field is null or the description says the
 * ring is a planning figure; a number is never invented to fill a blank.
 * Per-field provenance lives in docs/inventory/, which also records what is
 * unknown and why.
 *
 * The detect / track / identify / defeat chain is from the DoD Counter-Small
 * Unmanned Aircraft Systems Strategy (Jan 2021, p. 17), which reads detect,
 * track, identify, and, if necessary, deter, deny or defeat. UAS Groups 1-5
 * are from JP 3-30 (25 Jul 2019) Figure III-14.
 */

const SENSORS: SpecModel[] = [
  {
    id: 'lib-rps42',
    name: 'RPS-42 radar panel (RADA MHR)',
    kind: 'sensor',
    description:
      'S-band AESA panel, one 90 deg face; four panels give 360 deg. Nano-UAS acquisition 3.5 km is published; the 8 km mini-UAS figure has no locatable source and is a planning figure.',
    color: '#7da7c4',
    builtin: true,
    sensor: {
      sensorType: 'radar',
      role: 'target-acquisition',
      detectRangeM: 5000, // RADA USA, Breaking Defense 2022: Group 1 out to 5 km
      refRcsM2: 0.01, // nano/mini-UAS class figures
      instrumentedRangeM: 30000, // DRS MHR datasheet: 30 km instrumented
      classifyRangeM: 5000,
      sectorDeg: 90,
      elevationDeg: [-10, 70], // DRS MHR datasheet
      maxAltitudeFt: 30000,
      resolutionM: 50,
    },
    provenance: [
      {
        field: 'detectRangeM',
        value: '5000 m against Group 1 (Raven, WASP, Puma class)',
        source: 'Breaking Defense, RADA sponsored post (2022-10-31)',
        url: 'https://breakingdefense.com/2022/10/why-countering-small-uas-and-swarms-demands-highly-capable-radars/',
        date: '2026-09-04',
        basis: 'reference',
      },
      {
        field: 'instrumentedRangeM',
        value: '30000 m',
        source: 'DRS MHR family datasheet (04-2017)',
        url: 'https://electronics.leonardo.com/documents/16277707/18431169/mhr_datasheet.pdf',
        date: '2026-09-04',
        basis: 'datasheet',
      },
      {
        field: 'elevationDeg',
        value: '-10 to 70 deg',
        source: 'DRS MHR family datasheet (04-2017)',
        url: 'https://electronics.leonardo.com/documents/16277707/18431169/mhr_datasheet.pdf',
        date: '2026-09-04',
        basis: 'datasheet',
      },
      {
        field: 'maxAltitudeFt',
        value: '30000 ft',
        source: 'DRS MHR family datasheet (04-2017)',
        url: 'https://electronics.leonardo.com/documents/16277707/18431169/mhr_datasheet.pdf',
        date: '2026-09-04',
        basis: 'datasheet',
      },
      {
        field: 'sectorDeg',
        value: '90 deg',
        source: 'DRS MHR family datasheet (04-2017)',
        url: 'https://electronics.leonardo.com/documents/16277707/18431169/mhr_datasheet.pdf',
        date: '2026-09-04',
        basis: 'datasheet',
      },
    ],
  },
  {
    id: 'lib-rps62',
    name: 'RPS-62 radar panel (RADA MHR)',
    kind: 'sensor',
    description:
      'Larger S-band MHR-family panel. Northrop names MHR/RPS-42/62/82 among FAAD C2 supported sensors, but no range figure is published for the RPS-62: both rings are planning figures.',
    color: '#89b0c9',
    builtin: true,
    sensor: {
      sensorType: 'radar',
      role: 'surveillance',
      detectRangeM: 3000, // EDR Magazine 2019: RADA nano-UAV maximum range
      classifyRangeM: 8000,
      sectorDeg: 90,
      elevationDeg: [0, 90],
      maxAltitudeFt: 30000,
      resolutionM: 50,
    },
    provenance: [
      {
        field: 'detectRangeM',
        value: '3000 m against nano-UAV (15 km medium UAV, 22 km fighter)',
        source: 'EDR Magazine, DSEI 2019 RADA report',
        url: 'https://www.edrmagazine.eu/dsei-2019-rada-two-new-radars-from-israel',
        date: '2026-09-04',
        basis: 'reference',
      },
      {
        field: 'sectorDeg',
        value: '90 deg',
        source: 'EDR Magazine, DSEI 2019 RADA report',
        url: 'https://www.edrmagazine.eu/dsei-2019-rada-two-new-radars-from-israel',
        date: '2026-09-04',
        basis: 'reference',
      },
    ],
  },
  {
    id: 'lib-kurfs',
    name: 'KuRFS fire-control radar (Raytheon)',
    kind: 'sensor',
    description:
      'Precision 360 deg Ku-band AESA. Fire-control sensor for LIDS and Coyote; detects the smallest UAS class beyond 15 km.',
    color: '#6f9cba',
    builtin: true,
    sensor: {
      sensorType: 'radar',
      role: 'fire-control',
      detectRangeM: 15000,
      classifyRangeM: 10000,
      sectorDeg: 360,
      elevationDeg: null,
      maxAltitudeFt: null,
      resolutionM: 30,
    },
    provenance: [
      {
        field: 'detectRangeM',
        value: '15000 m against the smallest class of drones (beyond 15 km)',
        source: 'Defense News, Raytheon native content (2022-11-24)',
        url: 'https://www.defensenews.com/native/raytheon-missiles-defense/2022/11/22/birds-planes-drones-kurfs-radar-can-spot-them-all/',
        date: '2026-09-04',
        basis: 'reference',
      },
      {
        field: 'sectorDeg',
        value: '360 deg',
        source: 'Raytheon KuRFS product page (rtx.com)',
        url: 'https://www.rtx.com/raytheon/lang/ro/capabilities/products/counter-uas/sensors/kurfs',
        date: '2026-09-04',
        basis: 'datasheet',
      },
    ],
  },
  {
    id: 'lib-echoshield',
    name: 'EchoShield tracking radar (Echodyne)',
    kind: 'sensor',
    description:
      'Ku-band pulse-Doppler ESA panel, 130 x 90 deg field of regard. Group 1 UAS at 3-4 km, larger UAS to 11 km.',
    color: '#93b9d1',
    builtin: true,
    sensor: {
      sensorType: 'radar',
      role: 'tracking',
      detectRangeM: 3000, // Echodyne sheet: Group 1 lower bound of the 3 to 5.3 km band
      refRcsM2: 0.01, // Group 1 UAS line
      classifyRangeM: 2500,
      sectorDeg: 130,
      elevationDeg: [-45, 45],
      maxAltitudeFt: null,
      resolutionM: 30,
    },
    provenance: [
      {
        field: 'detectRangeM',
        value: '3000 m against Group 1 (-20 to -10 dBsm), typical tracking 3 to 5.3 km',
        source: 'Echodyne EchoShield spec sheet (6JL, 2026)',
        url: 'https://cdn.prod.website-files.com/69148cb0d4c3689c365788f0/6a5558f970a01479ae2a92b7_TS-EchoShield-Echodyne_6JL.pdf',
        date: '2026-09-04',
        basis: 'datasheet',
      },
      {
        field: 'sectorDeg',
        value: '130 deg',
        source: 'Echodyne EchoShield spec sheet (6JL, 2026)',
        url: 'https://cdn.prod.website-files.com/69148cb0d4c3689c365788f0/6a5558f970a01479ae2a92b7_TS-EchoShield-Echodyne_6JL.pdf',
        date: '2026-09-04',
        basis: 'datasheet',
      },
    ],
  },
  {
    id: 'lib-lstar',
    name: 'AN/TPQ-50 LSTAR air-surveillance radar (SRC)',
    kind: 'sensor',
    description:
      'L-band 360 deg air-surveillance radar (AN/TPQ-50), the search sensor in the LIDS family. SRC publishes >35 km instrumented in air-surveillance mode and >15 km in counterfire mode, neither conditioned on a UAS class; the 10 km ring is a small-UAS planning figure.',
    color: '#9cc3d6',
    builtin: true,
    sensor: {
      sensorType: 'radar',
      role: 'early-warning',
      rangeBasis: 'planning', // role-table / representative ring, no stated target: no target scaling
      detectRangeM: 10000,
      instrumentedRangeM: 35000, // SRC: >35 km instrumented, air-surveillance mode
      classifyRangeM: null,
      sectorDeg: 360,
      elevationDeg: [0, 30],
      maxAltitudeFt: null,
      resolutionM: null,
    },
    provenance: [
      {
        field: 'detectRangeM',
        value: '10000 m',
        source: 'planning factor',
        url: null,
        date: '2026-09-04',
        basis: 'pf',
      },
      {
        field: 'instrumentedRangeM',
        value: '35000 m',
        source: 'SRC AN/TPQ-50 product sheet (2026)',
        url: 'https://www.srcinc.com/pdf/an-tpq-50-multi-mission-radar.pdf',
        date: '2026-09-04',
        basis: 'datasheet',
      },
      {
        field: 'elevationDeg',
        value: '0 to 30 deg',
        source: 'SRC AN/TPQ-50 product sheet (2026)',
        url: 'https://www.srcinc.com/pdf/an-tpq-50-multi-mission-radar.pdf',
        date: '2026-09-04',
        basis: 'datasheet',
      },
      {
        field: 'sectorDeg',
        value: '360 deg',
        source: 'SRC AN/TPQ-50 product sheet (2026)',
        url: 'https://www.srcinc.com/pdf/an-tpq-50-multi-mission-radar.pdf',
        date: '2026-09-04',
        basis: 'datasheet',
      },
    ],
  },
  {
    id: 'lib-tpq53',
    name: 'AN/TPQ-53 multi-mission radar',
    kind: 'sensor',
    description:
      'S-band counterfire radar with a simultaneous air-surveillance and C-UAS mode, running a 90 deg sector at longer range or 360 deg rotating. Lockheed publishes no range against a UAS class; the ring is a planning figure. Cues LIDS effectors.',
    color: '#86aac2',
    builtin: true,
    sensor: {
      sensorType: 'radar',
      role: 'early-warning',
      rangeBasis: 'planning', // role-table / representative ring, no stated target: no target scaling
      detectRangeM: 15000,
      classifyRangeM: null,
      sectorDeg: 360,
      elevationDeg: null,
      maxAltitudeFt: null,
      resolutionM: null,
    },
    provenance: [
      {
        field: 'detectRangeM',
        value: '15000 m',
        source: 'planning factor',
        url: null,
        date: '2026-09-04',
        basis: 'pf',
      },
      {
        field: 'sectorDeg',
        value: '360 deg',
        source: 'Lockheed Martin TPQ-53 product page',
        url: 'https://www.lockheedmartin.com/en-us/products/tpq-53.html',
        date: '2026-09-04',
        basis: 'datasheet',
      },
    ],
  },
  {
    id: 'lib-iris',
    name: 'IRIS counter-drone radar (Robin)',
    kind: 'sensor',
    description:
      'X-band FMCW 3D radar with micro-Doppler drone/bird classification. 5 km is the instrumented range, not a detection range against a stated target; a 12 km long-range mode is offered.',
    color: '#7395ad',
    builtin: true,
    sensor: {
      sensorType: 'radar',
      role: 'classification',
      detectRangeM: 3100, // Robin IRIS sheet: C1 Micro 0.9 kg class
      instrumentedRangeM: 5000, // 5 km is the instrumented range in this mode
      updateRateS: 1, // Robin IRIS sheet: 30 rpm, one turn per second
      classifyRangeM: 3000,
      sectorDeg: 360,
      elevationDeg: [0, 60],
      maxAltitudeFt: null,
      resolutionM: 50,
    },
    provenance: [
      {
        field: 'detectRangeM',
        value: '3100 m against C1 Micro 0.9 kg (nano 1100, mini 3700, small 7600)',
        source: 'Robin Radar IRIS product sheet (2026-04)',
        url: 'https://www.robinradar.com/hubfs/IRIS%20product%20sheet%20042026.pdf',
        date: '2026-09-04',
        basis: 'datasheet',
      },
      {
        field: 'instrumentedRangeM',
        value: '5000 m',
        source: 'Robin Radar IRIS product sheet (2026-04)',
        url: 'https://www.robinradar.com/hubfs/IRIS%20product%20sheet%20042026.pdf',
        date: '2026-09-04',
        basis: 'datasheet',
      },
      {
        field: 'updateRateS',
        value: '1 s',
        source: 'Robin Radar IRIS product sheet (2026-04)',
        url: 'https://www.robinradar.com/hubfs/IRIS%20product%20sheet%20042026.pdf',
        date: '2026-09-04',
        basis: 'datasheet',
      },
      {
        field: 'sectorDeg',
        value: '360 deg',
        source: 'Robin Radar IRIS product sheet (2026-04)',
        url: 'https://www.robinradar.com/hubfs/IRIS%20product%20sheet%20042026.pdf',
        date: '2026-09-04',
        basis: 'datasheet',
      },
    ],
  },
  {
    id: 'lib-r8ss',
    name: 'Ranger R8SS-3D panel radar (FLIR)',
    kind: 'sensor',
    description:
      'Compact perimeter panel radar; tracks up to 500 targets and cues EO/IR. Micro-UAS to 2-3 km per 120 deg face.',
    color: '#809fb5',
    builtin: true,
    sensor: {
      sensorType: 'radar',
      role: 'surveillance',
      detectRangeM: 1200, // FLIR R8SS-3D specsheet: MicroUAS class
      instrumentedRangeM: 7800, // FLIR R8SS-3D specsheet
      updateRateS: 0.5, // FLIR R8SS-3D specsheet: 2 Hz scan (4 Hz mode also stated)
      classifyRangeM: null,
      sectorDeg: 90, // FLIR R8SS-3D specsheet: 90 deg azimuth per panel
      elevationDeg: [-40, 40],
      maxAltitudeFt: null,
      resolutionM: 50,
    },
    provenance: [
      {
        field: 'detectRangeM',
        value: '1200 m against MicroUAS (MiniUAS 2100, Small UAS 4000)',
        source: 'FLIR R8SS-3D specsheet (2019), cctv-systems.se copy',
        url: 'https://www.cctv-systems.se/sites/default/files/Ranger-R8SS-3D-Datasheet-A4.pdf',
        date: '2026-09-04',
        basis: 'datasheet',
      },
      {
        field: 'instrumentedRangeM',
        value: '7800 m',
        source: 'FLIR R8SS-3D specsheet (2019), cctv-systems.se copy',
        url: 'https://www.cctv-systems.se/sites/default/files/Ranger-R8SS-3D-Datasheet-A4.pdf',
        date: '2026-09-04',
        basis: 'datasheet',
      },
      {
        field: 'updateRateS',
        value: '0.5 s (2 Hz; 4 Hz mode stated)',
        source: 'FLIR R8SS-3D specsheet (2019), cctv-systems.se copy',
        url: 'https://www.cctv-systems.se/sites/default/files/Ranger-R8SS-3D-Datasheet-A4.pdf',
        date: '2026-09-04',
        basis: 'datasheet',
      },
      {
        field: 'sectorDeg',
        value: '90 deg',
        source: 'FLIR R8SS-3D specsheet (2019), cctv-systems.se copy',
        url: 'https://www.cctv-systems.se/sites/default/files/Ranger-R8SS-3D-Datasheet-A4.pdf',
        date: '2026-09-04',
        basis: 'datasheet',
      },
    ],
  },
  {
    id: 'lib-rfone',
    name: 'RfOne Mk2 RF sensor (DroneShield)',
    kind: 'sensor',
    description:
      'Passive, non-emitting RF direction finder for UAS control and video links. Four units give 360 deg; multiple sites triangulate a position. DroneShield publishes no detection range, so the 5 km ring is a planning figure.',
    color: '#cdb079',
    builtin: true,
    sensor: {
      sensorType: 'rf',
      role: 'early-warning',
      rangeBasis: 'planning', // role-table / representative ring, no stated target: no target scaling
      detectRangeM: 5000,
      classifyRangeM: 5000,
      sectorDeg: 90,
      elevationDeg: null,
      maxAltitudeFt: null,
      resolutionM: 100,
    },
  },
  {
    id: 'lib-rf360',
    name: 'RF-360 passive RF sensor (Dedrone)',
    kind: 'sensor',
    description:
      'Omnidirectional passive RF sensor (Dedrone by Axon). Detects, classifies and direction-finds drones and controllers by protocol signature. 2 km is the normal-conditions figure; up to 5 km is claimed in ideal conditions against specific drones. One unit gives angle of arrival only.',
    color: '#d6bf8e',
    builtin: true,
    sensor: {
      sensorType: 'rf',
      role: 'classification',
      detectRangeM: 2000,
      classifyRangeM: 2000,
      sectorDeg: 360,
      elevationDeg: null,
      maxAltitudeFt: null,
      resolutionM: 100,
    },
  },
  {
    id: 'lib-discovair',
    name: 'Discovair G2 acoustic array (Squarehead)',
    kind: 'sensor',
    description:
      'Passive 128-microphone array with ML classification. Tracks Group 1-2 UAS by sound, including RF-silent drones.',
    color: '#7fae94',
    builtin: true,
    sensor: {
      sensorType: 'acoustic',
      role: 'tracking',
      refAcousticDb: 75, // Group 1-2 small UAS source level (signatureFactors.ts tiers), PF
      detectRangeM: 500,
      classifyRangeM: 400,
      sectorDeg: 105,
      elevationDeg: null,
      maxAltitudeFt: null,
      resolutionM: 200,
    },
  },
  {
    id: 'lib-acoustic-picket',
    name: 'Acoustic picket node (representative)',
    kind: 'sensor',
    description:
      'REPRESENTATIVE acoustic picket node, not a named product. Cheap omnidirectional microphone node for a forward picket line. Ranges are planning figures for an engine-noise target; small electric quadcopters are detected at far shorter ranges.',
    color: '#6fa287',
    builtin: true,
    sensor: {
      sensorType: 'acoustic',
      role: 'early-warning',
      refAcousticDb: 95, // engine-noise target (G3 tier), PF
      detectRangeM: 4000,
      classifyRangeM: 2000,
      sectorDeg: 360,
      elevationDeg: null,
      maxAltitudeFt: 10000,
      resolutionM: 500,
    },
  },
  {
    id: 'lib-hdcmr',
    name: 'Ranger HDC MR EO/IR (FLIR)',
    kind: 'sensor',
    description:
      'Mid-range pan-tilt thermal and color imager for visual identification of radar-cued tracks. 360 deg slewable.',
    color: '#a49bc4',
    builtin: true,
    sensor: {
      sensorType: 'eo-ir',
      role: 'classification',
      eoBand: 'dual', // thermal and color imager
      refSpanM: 0.4, // Group 1 span planning factor (signatureFactors.ts); FLIR states no target class
      detectRangeM: 3000,
      classifyRangeM: 1500,
      sectorDeg: 360,
      elevationDeg: [-40, 60],
      maxAltitudeFt: null,
      resolutionM: 20,
    },
  },
  {
    id: 'lib-teleidoscope',
    name: 'Teleidoscope ML auto-track camera',
    kind: 'sensor',
    description:
      'Machine-learning EO/IR auto-track gimbal. The fielded program is the NCR-IADS airspace-warning camera modernization; no source places Teleidoscope in FS-LIDS or M-LIDS, and no source supports a fire-control role. Ranges are planning figures.',
    color: '#b0a8cc',
    builtin: true,
    sensor: {
      sensorType: 'eo-ir',
      role: 'classification',
      eoBand: 'dual',
      rangeBasis: 'planning', // role-table / representative ring, no stated target: no target scaling
      detectRangeM: 2000,
      classifyRangeM: 1500,
      sectorDeg: 360,
      elevationDeg: null,
      maxAltitudeFt: null,
      resolutionM: 15,
    },
  },
  {
    id: 'lib-wisp',
    name: 'Wisp wide-area IR sensor (Anduril)',
    kind: 'sensor',
    description:
      'Passive 360 deg wide-area infrared sensor with on-edge AI. Searches for low, slow, small UAS without a radar cue and feeds Lattice. Detection band 3-10 miles; 4.8 km is the low end.',
    color: '#9b92ba',
    builtin: true,
    sensor: {
      sensorType: 'eo-ir',
      role: 'surveillance',
      eoBand: 'thermal', // wide-area infrared; searches without a cue (surveillance role)
      refSpanM: 0.4, // 'low, slow, small UAS' band: Group 1 span planning factor
      detectRangeM: 4800,
      instrumentedRangeM: 16000, // top of Anduril's stated 3-10 mile detection band
      classifyRangeM: 4800,
      sectorDeg: 360,
      elevationDeg: null,
      maxAltitudeFt: null,
      resolutionM: null,
    },
  },
  {
    id: 'lib-mxgcs',
    name: 'WESCAM MX-GCS EO/IR sight (L3Harris)',
    kind: 'sensor',
    description:
      'Stabilized cooled MWIR and HD colour sight with eyesafe laser rangefinder on SGT Stout M-SHORAD. Slews 360 deg independent of the turret to identify and track air threats for the 30 mm gun. Ranges are planning figures: none are published.',
    color: '#8f86ab',
    builtin: true,
    sensor: {
      sensorType: 'eo-ir',
      role: 'fire-control',
      eoBand: 'dual', // cooled MWIR plus HD colour
      rangeBasis: 'planning', // role-table / representative ring, no stated target: no target scaling
      detectRangeM: 8000,
      classifyRangeM: null,
      sectorDeg: 360,
      elevationDeg: null,
      maxAltitudeFt: null,
      resolutionM: null,
    },
  },
  {
    id: 'lib-spynel',
    name: 'Spynel-S 6000 panoramic IR (HGH)',
    kind: 'sensor',
    description:
      'Passive rotating MWIR sensor that rebuilds a 360 deg thermal panorama every 2 s and cues itself. Wide-area search, no radar needed. UAS ranges are planning figures: HGH publishes DRI for people and vehicles only.',
    color: '#c3bada',
    builtin: true,
    sensor: {
      sensorType: 'eo-ir',
      role: 'surveillance',
      eoBand: 'thermal', // rotating MWIR panorama; self-cueing (surveillance role)
      rangeBasis: 'planning', // role-table / representative ring, no stated target: no target scaling
      detectRangeM: 5000,
      classifyRangeM: null,
      sectorDeg: 360,
      elevationDeg: [-45, 45],
      maxAltitudeFt: null,
      resolutionM: null,
    },
  },
  {
    id: 'lib-zvook',
    name: 'Zvook acoustic station (Ukraine)',
    kind: 'sensor',
    description:
      'Half-metre acoustic mirror over one microphone with edge ML. Tower-mounted at 10-12 m, about 200 deg coverage, 5 km on Shahed-type OWA and 7 km on cruise missiles. Passive: it cannot be jammed or homed on.',
    color: '#5f9880',
    builtin: true,
    sensor: {
      sensorType: 'acoustic',
      role: 'early-warning',
      refAcousticDb: 100, // Shahed-type OWA (MD550 piston), PF
      detectRangeM: 5000,
      classifyRangeM: 5000,
      sectorDeg: 200,
      elevationDeg: null,
      maxAltitudeFt: null,
      resolutionM: null,
    },
  },
  {
    id: 'lib-zvooknw0',
    name: 'Zvook NW0 tactical FPV sensor',
    kind: 'sensor',
    description:
      'Post-mounted 360 deg acoustic sensor for FPV drones, including fibre-optic FPV that emits no RF at all. Declared 150-450 m; the maker advises 400-600 m node spacing. IP67, 15-20 W.',
    color: '#87b89e',
    builtin: true,
    sensor: {
      sensorType: 'acoustic',
      role: 'early-warning',
      refAcousticDb: 75, // FPV quad, PF
      detectRangeM: 150,
      classifyRangeM: null,
      sectorDeg: 360,
      elevationDeg: null,
      maxAltitudeFt: null,
      resolutionM: null,
    },
  },
  {
    id: 'lib-kumrfs-m',
    name: 'KuMRFS-M mobile fire-control radar (Raytheon)',
    kind: 'sensor',
    description:
      'Mobile configuration of KuMRFS-T sized for an M-ATV or JLTV mast. Four independent AESA quadrants give 360 deg upper-hemisphere coverage, with quadrant arrays one quarter the size of the fixed -T. Government brochure: UAS Group 1-3 capability beyond 7 km. Air surveillance and fire control at the short halt, not on the move.',
    color: '#79a3c0',
    builtin: true,
    sensor: {
      sensorType: 'radar',
      role: 'fire-control',
      detectRangeM: 7000,
      classifyRangeM: null,
      sectorDeg: 360,
      elevationDeg: null,
      maxAltitudeFt: null,
      resolutionM: null,
    },
    provenance: [
      {
        field: 'detectRangeM',
        value: '7000 m against UAS Group 1 to 3 (beyond 7 km)',
        source: 'SRC LIDS family brochure',
        url: 'https://www.srcinc.com/pdf/lids-family-of-systems-brochure.pdf',
        date: '2026-09-04',
        basis: 'reference',
      },
      {
        field: 'sectorDeg',
        value: '360 deg',
        source: 'SRC LIDS family brochure',
        url: 'https://www.srcinc.com/pdf/lids-family-of-systems-brochure.pdf',
        date: '2026-09-04',
        basis: 'reference',
      },
    ],
  },
  {
    id: 'lib-xbaeu',
    name: 'XBAEU Ku720-2 mobile sensing radar (Raytheon)',
    kind: 'sensor',
    description:
      'Scaled Ku720-2 distributed mobile sensing radar. CRS records it as the radar on the single-Stryker M-LIDS Increment 2.1, in place of KuMRFS. RTX states 360 deg persistent detection, identification and tracking. NO range figure of any type is published: the ring is a REPRESENTATIVE planning value from the app role-default table, not an XBAEU performance figure.',
    color: '#8fb3cb',
    builtin: true,
    sensor: {
      sensorType: 'radar',
      role: 'fire-control',
      rangeBasis: 'planning', // role-table / representative ring, no stated target: no target scaling
      detectRangeM: 8000,
      classifyRangeM: null,
      sectorDeg: 360,
      elevationDeg: null,
      maxAltitudeFt: null,
      resolutionM: null,
    },
    provenance: [
      {
        field: 'detectRangeM',
        value: '8000 m',
        source: 'planning factor',
        url: null,
        date: '2026-09-04',
        basis: 'pf',
      },
      {
        field: 'sectorDeg',
        value: '360 deg',
        source: 'RTX news release (2024-10-14)',
        url: 'https://www.rtx.com/news/news-center/2024/10/14/rtxs-raytheon-demos-kurfs-and-coyote-performance-against-complex-uas-threats',
        date: '2026-09-04',
        basis: 'datasheet',
      },
    ],
  },
  {
    id: 'lib-cuaews-df',
    name: 'CUAEWS DF passive RF sensor (SRC)',
    kind: 'sensor',
    description:
      'Passive find-and-fix half of the LIDS EW element. Searches the RF environment for signals of interest, direction-finds lines of bearing to both the UAS and its operator, and classifies each contact SUSPECT, NEUTRAL/UNKNOWN or FRIEND before the jammer half fires. No detection range is published: the ring is REPRESENTATIVE. The brochure\'s 8 km is the EW EFFECTS range and belongs to lib-cuaews.',
    color: '#c7a86f',
    builtin: true,
    sensor: {
      sensorType: 'rf',
      role: 'classification',
      rangeBasis: 'planning', // role-table / representative ring, no stated target: no target scaling
      detectRangeM: 6000,
      classifyRangeM: null,
      sectorDeg: 360,
      elevationDeg: null,
      maxAltitudeFt: null,
      resolutionM: null,
    },
  },
  {
    id: 'lib-cm262',
    name: 'CM262 EO/IR/SWIR gimbal (CACI)',
    kind: 'sensor',
    description:
      'Four-sensor 16 kg gimbal on the L-MADIS sensor vehicle: HD EO, HD MWIR, SWIR and a laser rangefinder, 360 deg continuous in azimuth and +90 to -16 deg in elevation, with on-board C-UAS tracking. CACI publishes no detection or identification range against any target, so the ring is REPRESENTATIVE. The datasheet\'s 16 km is the laser rangefinder\'s ranging range, not a detection range.',
    color: '#a99fc6',
    builtin: true,
    sensor: {
      sensorType: 'eo-ir',
      role: 'classification',
      eoBand: 'dual', // HD EO, HD MWIR, SWIR
      rangeBasis: 'planning', // role-table / representative ring, no stated target: no target scaling
      detectRangeM: 5000,
      classifyRangeM: null,
      sectorDeg: 360,
      elevationDeg: [-16, 90],
      maxAltitudeFt: null,
      resolutionM: null,
    },
  },
  {
    id: 'lib-drs-s3',
    name: 'DRS S3 stabilised sight (RIwP turret)',
    kind: 'sensor',
    description:
      'EO/IR sight integrated in the Moog RIwP turret with a built-in auto-tracker. Provides the detect / recognise / identify chain and holds track through kinetic engagements against ground and air targets. The M-LIDS brochure gives the vehicle EO/IR camera gun system a target acquisition range greater than 2 km.',
    color: '#b8b0d4',
    builtin: true,
    sensor: {
      sensorType: 'eo-ir',
      role: 'fire-control',
      eoBand: 'dual',
      refSpanM: 0.4, // brochure '>2 km' names no target class: Group 1 span planning factor
      detectRangeM: 2000,
      classifyRangeM: 1500,
      sectorDeg: 360,
      elevationDeg: null,
      maxAltitudeFt: null,
      resolutionM: null,
    },
  },
  {
    id: 'lib-sentry-lr-fc',
    name: 'Long Range Sentry Tower w/ fire control (Anduril)',
    kind: 'sensor',
    description:
      'Autonomous Lattice-native tower carrying an ultra-high-powered 360 deg radar that Anduril states identifies, classifies and tracks Group 1-3 drones up to 15 km. SIMPLIFICATION: the real tower is a multi-sensor mast that fuses radar, visible and mid-wave IR on board; RangeBoard models one sensor per SpecModel, so only the radar is modelled because the radar is what gives the tower its C-UAS reach.',
    color: '#6b93b3',
    builtin: true,
    sensor: {
      sensorType: 'radar',
      role: 'fire-control',
      detectRangeM: 2000, // Anduril Sentry page: Group 1 lower bound of the 2 to 4 km band
      classifyRangeM: null,
      sectorDeg: 360,
      elevationDeg: null,
      maxAltitudeFt: null,
      resolutionM: null,
    },
    provenance: [
      {
        field: 'detectRangeM',
        value: '2000 m against Group 1 (2 to 4 km; 15 km for Group 3+)',
        source: 'Anduril Sentry product page',
        url: 'https://www.anduril.com/sentry',
        date: '2026-09-04',
        basis: 'datasheet',
      },
      {
        field: 'sectorDeg',
        value: '360 deg',
        source: 'Anduril Sentry product page',
        url: 'https://www.anduril.com/sentry',
        date: '2026-09-04',
        basis: 'datasheet',
      },
    ],
  },
  {
    id: 'lib-sentinela4',
    name: 'Sentinel A4 air defense radar (AN/MPQ-64A4)',
    kind: 'sensor',
    description:
      'X-band digital AESA (GaN), 360 deg with stop-and-stare, -15 deg to zenith. Army SHORAD acquisition radar against FW/RW/CM/RAM and UAS. No public small-UAS detection range; ring is a role planning factor.',
    color: '#6d92ab',
    builtin: true,
    sensor: {
      sensorType: 'radar',
      role: 'target-acquisition',
      rangeBasis: 'planning', // role-table / representative ring, no stated target: no target scaling
      detectRangeM: 15000,
      classifyRangeM: null,
      sectorDeg: 360,
      elevationDeg: [-15, 90],
      maxAltitudeFt: null,
      resolutionM: null,
    },
    provenance: [
      {
        field: 'detectRangeM',
        value: '15000 m',
        source: 'planning factor',
        url: null,
        date: '2026-09-04',
        basis: 'pf',
      },
      {
        field: 'elevationDeg',
        value: '-15 to 90 deg',
        source: 'Lockheed Martin Sentinel A4 product card (2024)',
        url: 'https://www.lockheedmartin.com/content/dam/lockheed-martin/rms/documents/sentinel-a4/2315841_Sentinel_A4_Product_Card_Refresh_v2.pdf',
        date: '2026-09-04',
        basis: 'datasheet',
      },
      {
        field: 'sectorDeg',
        value: '360 deg',
        source: 'Lockheed Martin Sentinel A4 product card (2024)',
        url: 'https://www.lockheedmartin.com/content/dam/lockheed-martin/rms/documents/sentinel-a4/2315841_Sentinel_A4_Product_Card_Refresh_v2.pdf',
        date: '2026-09-04',
        basis: 'datasheet',
      },
    ],
  },
  {
    id: 'lib-gator',
    name: 'AN/TPS-80 G/ATOR multi-mission radar',
    kind: 'sensor',
    description:
      'S-band GaN AESA expeditionary multi-mission radar, 360 deg. USMC air surveillance and air defense (Block 1) plus counterfire (Block 2); the sensor for MRIC. No public small-UAS range; ring is a role planning factor.',
    color: '#5f87a2',
    builtin: true,
    sensor: {
      sensorType: 'radar',
      role: 'early-warning',
      rangeBasis: 'planning', // role-table / representative ring, no stated target: no target scaling
      detectRangeM: 40000,
      classifyRangeM: null,
      sectorDeg: 360,
      elevationDeg: null,
      maxAltitudeFt: null,
      resolutionM: null,
    },
    provenance: [
      {
        field: 'detectRangeM',
        value: '40000 m',
        source: 'planning factor',
        url: null,
        date: '2026-09-04',
        basis: 'pf',
      },
      {
        field: 'sectorDeg',
        value: '360 deg',
        source: 'Northrop Grumman G/ATOR product page',
        url: 'https://www.northropgrumman.com/what-we-do/mission-solutions/radars/an-tps-80-ground-air-task-oriented-radar-g-ator',
        date: '2026-09-04',
        basis: 'datasheet',
      },
    ],
  },
  {
    id: 'lib-giraffe1x',
    name: 'Giraffe 1X 3D radar (Saab)',
    kind: 'sensor',
    description:
      'Compact 3D air surveillance radar; full search volume updated every second. Drone Tracker mode separates mini-UAV from birds. Saab states a UAV lighter than a milk carton at 4 km. Bought by the US Army-contracted for Estonia, Latvia and Lithuania.',
    color: '#7fa8c0',
    builtin: true,
    sensor: {
      sensorType: 'radar',
      role: 'surveillance',
      detectRangeM: 4000,
      refRcsM2: 0.01, // 'lighter than a milk carton' nano/micro class
      instrumentedRangeM: 75000, // Saab 2014 leaflet: instrumented range 75 km
      updateRateS: 1,
      classifyRangeM: null,
      sectorDeg: 360,
      elevationDeg: [0, 70], // Saab Giraffe 1X leaflet (2014)
      maxAltitudeFt: null,
      resolutionM: null,
    },
    provenance: [
      {
        field: 'detectRangeM',
        value: '4000 m against a UAV lighter than a milk carton',
        source: 'Saab Giraffe 1X product page',
        url: 'https://www.saab.com/products/giraffe-1x',
        date: '2026-09-04',
        basis: 'datasheet',
      },
      {
        field: 'instrumentedRangeM',
        value: '75000 m',
        source: 'Saab Giraffe 1X leaflet (2014), radartutorial.eu copy',
        url: 'https://www.radartutorial.eu/19.kartei/04.battle/pubs/giraffe_1x.pdf',
        date: '2026-09-04',
        basis: 'datasheet',
      },
      {
        field: 'updateRateS',
        value: '1 s',
        source: 'Saab Giraffe 1X product page',
        url: 'https://www.saab.com/products/giraffe-1x',
        date: '2026-09-04',
        basis: 'datasheet',
      },
      {
        field: 'elevationDeg',
        value: '0 to 70 deg',
        source: 'Saab Giraffe 1X leaflet (2014), radartutorial.eu copy',
        url: 'https://www.radartutorial.eu/19.kartei/04.battle/pubs/giraffe_1x.pdf',
        date: '2026-09-04',
        basis: 'datasheet',
      },
      {
        field: 'sectorDeg',
        value: '360 deg',
        source: 'Saab layered-defence page',
        url: 'https://www.saab.com/markets/eu-nato-affairs/layered-defence-against-the-drone-threat',
        date: '2026-09-04',
        basis: 'datasheet',
      },
    ],
  },
  {
    id: 'lib-spexer2000',
    name: 'SPEXER 2000 3D radar (HENSOLDT)',
    kind: 'sensor',
    description:
      'X-band pulse-Doppler AESA, 120 deg per antenna (MkIII builds to 360 deg with more antennas), elevation to 90 deg. Datasheet maxima: UAV 9 km, micro-UAV 6 km. Over 300 tracks per 120 deg sector.',
    color: '#8fb4cb',
    builtin: true,
    sensor: {
      sensorType: 'radar',
      role: 'target-acquisition',
      detectRangeM: 6000,
      refRcsM2: 0.04, // back-solved: 9 km at 0.2 m2 (trade reporting) scales to 6 km at 0.04 m2
      instrumentedRangeM: 40000, // EDR Magazine 2020: 40 km instrumented
      classifyRangeM: null,
      sectorDeg: 120,
      elevationDeg: null,
      maxAltitudeFt: null,
      resolutionM: null,
    },
    provenance: [
      {
        field: 'detectRangeM',
        value: '6000 m against Micro UAV (UAV 9 km)',
        source: 'HENSOLDT SPEXER 2000 datasheet (2020)',
        url: 'https://dam.hensoldt.net/m/59f155d472802b78/original/SPEXER-2000-3D-Radar-Datasheet-English.pdf',
        date: '2026-09-04',
        basis: 'datasheet',
      },
      {
        field: 'instrumentedRangeM',
        value: '40000 m',
        source: 'EDR Magazine, SPEXER 2000 3rd Gen (2020-06-22)',
        url: 'https://www.edrmagazine.eu/hensoldt-unveils-its-new-spexer-2000-3rd-gen-radar-for-c-uas-and-not-only',
        date: '2026-09-04',
        basis: 'reference',
      },
      {
        field: 'sectorDeg',
        value: '120 deg',
        source: 'HENSOLDT SPEXER 2000 datasheet (2020)',
        url: 'https://dam.hensoldt.net/m/59f155d472802b78/original/SPEXER-2000-3D-Radar-Datasheet-English.pdf',
        date: '2026-09-04',
        basis: 'datasheet',
      },
    ],
  },
  {
    id: 'lib-echoguard',
    name: 'EchoGuard 4D radar (Echodyne)',
    kind: 'sensor',
    description:
      'K-band MESA ESA panel, 120 x 80 deg field of view, 6 km instrumented. Datasheet: sUAV over 1 km (Phantom 4), over 1.4 km (Matrice 600), vehicle 3.5 km. Up to 20 tracks at 10 Hz.',
    color: '#a3c3d8',
    builtin: true,
    sensor: {
      sensorType: 'radar',
      role: 'tracking',
      detectRangeM: 1000,
      refRcsM2: 0.01, // Phantom 4 line
      instrumentedRangeM: 6000, // datasheet instrumented range
      classifyRangeM: null,
      sectorDeg: 120,
      elevationDeg: [-40, 40],
      maxAltitudeFt: null,
      resolutionM: null,
    },
    provenance: [
      {
        field: 'detectRangeM',
        value: '1000 m against sUAV Phantom 4 (Matrice 600 1400 m)',
        source: 'Echodyne EchoGuard spec sheet (6JL, 2026)',
        url: 'https://cdn.prod.website-files.com/69148cb0d4c3689c365788f0/6a55591add6872e68b75655d_TS-EchoGuard-Echodyne_6JL.pdf',
        date: '2026-09-04',
        basis: 'datasheet',
      },
      {
        field: 'instrumentedRangeM',
        value: '6000 m',
        source: 'Echodyne EchoGuard spec sheet (6JL, 2026)',
        url: 'https://cdn.prod.website-files.com/69148cb0d4c3689c365788f0/6a55591add6872e68b75655d_TS-EchoGuard-Echodyne_6JL.pdf',
        date: '2026-09-04',
        basis: 'datasheet',
      },
      {
        field: 'sectorDeg',
        value: '120 deg',
        source: 'Echodyne EchoGuard spec sheet (6JL, 2026)',
        url: 'https://cdn.prod.website-files.com/69148cb0d4c3689c365788f0/6a55591add6872e68b75655d_TS-EchoGuard-Echodyne_6JL.pdf',
        date: '2026-09-04',
        basis: 'datasheet',
      },
    ],
  },
  {
    id: 'lib-spyglass',
    name: 'Spyglass short-range radar (Anduril / Numerica)',
    kind: 'sensor',
    description:
      'Ku-band phased array with simultaneous transmit and receive. Numerica states detection and track of small autonomous UAS beyond 3.5 km. Demonstrated in the JCO-recommended SAIC C-sUAS-as-a-Service at Yuma, Sep 2022. Now an Anduril product in Lattice.',
    color: '#7ea3bd',
    builtin: true,
    sensor: {
      sensorType: 'radar',
      role: 'surveillance',
      detectRangeM: 6000, // Anduril Spyglass page: Group 1 UAS
      classifyRangeM: null,
      sectorDeg: 90,
      elevationDeg: null,
      maxAltitudeFt: null,
      resolutionM: null,
    },
    provenance: [
      {
        field: 'detectRangeM',
        value: '6000 m against Group 1 UAS (Group 3 12 km)',
        source: 'Anduril Spyglass product page',
        url: 'https://www.anduril.com/spyglass',
        date: '2026-09-04',
        basis: 'datasheet',
      },
      {
        field: 'sectorDeg',
        value: '90 deg',
        source: 'Anduril Spyglass product page',
        url: 'https://www.anduril.com/spyglass',
        date: '2026-09-04',
        basis: 'datasheet',
      },
    ],
  },
  {
    id: 'lib-a422',
    name: 'Blighter A422 air security radar',
    kind: 'sensor',
    description:
      'Ku-band FMCW e-scan radar, 180 deg per unit, elevation to 30 deg with W20S antennas, 20 km instrumented. Free-space detection 2.73 km at 0.01 m2 RCS, 4.87 km at 0.1 m2. UK-supplied to Ukraine in 2022.',
    color: '#94b7cd',
    builtin: true,
    sensor: {
      sensorType: 'radar',
      role: 'surveillance',
      detectRangeM: 2730,
      refRcsM2: 0.01, // datasheet condition for the 2.73 km line
      instrumentedRangeM: 20000, // datasheet instrumented range
      classifyRangeM: null,
      sectorDeg: 180,
      elevationDeg: [0, 30],
      maxAltitudeFt: null,
      resolutionM: null,
    },
    provenance: [
      {
        field: 'detectRangeM',
        value: '2730 m at 0.01 m2 RCS, free space, M10S antennas',
        source: 'Blighter A400 series datasheet (BSS-1311, 2025)',
        url: 'https://blighter.com/wp-content/uploads/2025/10/blighter-a400-series-radars-datasheet-bss-1311.pdf',
        date: '2026-09-04',
        basis: 'datasheet',
      },
      {
        field: 'refRcsM2',
        value: '0.01 m2',
        source: 'Blighter A400 series datasheet (BSS-1311, 2025)',
        url: 'https://blighter.com/wp-content/uploads/2025/10/blighter-a400-series-radars-datasheet-bss-1311.pdf',
        date: '2026-09-04',
        basis: 'datasheet',
      },
      {
        field: 'instrumentedRangeM',
        value: '20000 m',
        source: 'Blighter A400 series datasheet (BSS-1311, 2025)',
        url: 'https://blighter.com/wp-content/uploads/2025/10/blighter-a400-series-radars-datasheet-bss-1311.pdf',
        date: '2026-09-04',
        basis: 'datasheet',
      },
      {
        field: 'sectorDeg',
        value: '180 deg',
        source: 'Blighter A400 series datasheet (BSS-1311, 2025)',
        url: 'https://blighter.com/wp-content/uploads/2025/10/blighter-a400-series-radars-datasheet-bss-1311.pdf',
        date: '2026-09-04',
        basis: 'datasheet',
      },
    ],
  },
  {
    id: 'lib-gm200mmc',
    name: 'Ground Master 200 MM/C radar (Thales)',
    kind: 'sensor',
    description:
      '4D AESA multi-mission radar on a tactical truck; over 400 km instrumented for air surveillance and up to 100 km for weapon locating. NATO users NL, DK, LT. Thales claims drone detection but publishes no small-UAS range; ring is a role planning factor.',
    color: '#6b8fa8',
    builtin: true,
    sensor: {
      sensorType: 'radar',
      role: 'early-warning',
      rangeBasis: 'planning', // role-table / representative ring, no stated target: no target scaling
      detectRangeM: 40000,
      instrumentedRangeM: 400000, // Thales: over 400 km instrumented
      classifyRangeM: null,
      sectorDeg: 360,
      elevationDeg: null,
      maxAltitudeFt: 100000, // Army Recognition 2025: ceiling 100000 ft
      resolutionM: null,
    },
    provenance: [
      {
        field: 'detectRangeM',
        value: '40000 m',
        source: 'planning factor',
        url: null,
        date: '2026-09-04',
        basis: 'pf',
      },
      {
        field: 'instrumentedRangeM',
        value: '400000 m',
        source: 'Army Recognition, GM200 MM/C Sweden (2025-04-08)',
        url: 'https://www.armyrecognition.com/news/army-news/2025/sweden-becomes-fifth-nato-country-to-procure-the-french-thales-gm200-mm-c-radar',
        date: '2026-09-04',
        basis: 'reference',
      },
      {
        field: 'maxAltitudeFt',
        value: '100000 ft',
        source: 'Army Recognition, GM200 MM/C Sweden (2025-04-08)',
        url: 'https://www.armyrecognition.com/news/army-news/2025/sweden-becomes-fifth-nato-country-to-procure-the-french-thales-gm200-mm-c-radar',
        date: '2026-09-04',
        basis: 'reference',
      },
    ],
  },
  {
    id: 'lib-corian',
    name: 'CORIAN passive RF array (CACI)',
    kind: 'sensor',
    description:
      'Fixed-site networked passive RF sensor array. TDOA multilateration across nodes geolocates the Group 1-2 sUAS AND its ground operator; positive ID by an unclassified signal library. JCO fixed/semi-fixed interim selection. Range is a planning figure, not a published one.',
    color: '#b99a5f',
    builtin: true,
    sensor: {
      sensorType: 'rf',
      role: 'classification',
      rangeBasis: 'planning', // role-table / representative ring, no stated target: no target scaling
      detectRangeM: 5000,
      classifyRangeM: null,
      sectorDeg: 360,
      elevationDeg: null,
      maxAltitudeFt: null,
      resolutionM: null,
    },
  },
  {
    id: 'lib-wingman',
    name: 'Wingman 103 wearable RF detector (MyDefence)',
    kind: 'sensor',
    description:
      'Body-worn passive RF detector for dismounted troops. Up to 6 km on the drone or controller link, direction finding to within 30 deg, alert in under 10 s. 90 deg face as issued; omnidirectional with the wideband antenna. ATAK compatible.',
    color: '#dcc79c',
    builtin: true,
    sensor: {
      sensorType: 'rf',
      role: 'early-warning',
      detectRangeM: 6000,
      classifyRangeM: null,
      sectorDeg: 90,
      elevationDeg: null,
      maxAltitudeFt: null,
      resolutionM: null,
    },
  },
  {
    id: 'lib-rfpatrol',
    name: 'RfPatrol Mk2 body-worn RF detector (DroneShield)',
    kind: 'sensor',
    description:
      'Body-worn, strictly non-emitting RF detector. 4 km in a low-RF (rural) background but only 1 km in a high-RF (urban) background. Directional and omnidirectional antennas give 360 deg cover. Alerts by sound, light and haptic.',
    color: '#c4a56b',
    builtin: true,
    sensor: {
      sensorType: 'rf',
      role: 'early-warning',
      urbanRangeM: 1000, // DroneShield: 1 km in a high-RF (urban) background
      detectRangeM: 4000,
      classifyRangeM: 4000,
      sectorDeg: 360,
      elevationDeg: null,
      maxAltitudeFt: null,
      resolutionM: null,
    },
  },
  {
    id: 'lib-ardronis',
    name: 'ARDRONIS Locate RF DF system (Rohde & Schwarz)',
    kind: 'sensor',
    description:
      'Receive-only RF monitoring and direction finding on the control uplink, telemetry and video downlink. Locate Compact states more than 5 km. Warns while the drone is still on the ground. STANAG aligned and SAPIENT compliant.',
    color: '#e0cfab',
    builtin: true,
    sensor: {
      sensorType: 'rf',
      role: 'classification',
      detectRangeM: 5000,
      classifyRangeM: null,
      sectorDeg: 360,
      elevationDeg: null,
      maxAltitudeFt: null,
      resolutionM: null,
    },
  },
  {
    id: 'lib-titan',
    name: 'Titan C-UAS RF sensor (BlueHalo / AeroVironment)',
    kind: 'sensor',
    description:
      'Self-contained RF detection and direction-finding unit, up to 3 km horizontal across five bands from 433 MHz to 5.8 GHz. NOT receive-only: the same 20 lb unit jams to 1.5 km, which belongs in a separate effector record. US Army fielded.',
    color: '#bfa877',
    builtin: true,
    sensor: {
      sensorType: 'rf',
      role: 'classification',
      rfBands: ['uhf-433', 'ism-915', 'ism-2400', 'ism-5800'], // '433 MHz to 5.8 GHz': every non-GNSS link band in the model
      detectRangeM: 3000,
      classifyRangeM: null,
      sectorDeg: 360,
      elevationDeg: null,
      maxAltitudeFt: null,
      resolutionM: null,
    },
  },

]

const EFFECTORS: SpecModel[] = [
  {
    id: 'lib-coyote',
    name: 'Coyote Block 2 interceptor',
    kind: 'effector',
    description:
      'Rocket-boosted turbojet kinetic interceptor with a tungsten fragmentation warhead, fired from a 4-pack palletized launcher. The RF seeker belongs to Block 1B, not Block 2. Reach is reported at about 15 km.',
    color: '#c47f5c',
    builtin: true,
    effector: {
      effectorType: 'interceptor',
      minRangeM: 500,
      maxRangeM: 15000,
      maxAltitudeFt: 20000,
      engageTimeS: 60,
      pk: 0.85,
      magazineSize: 4,
      salvoCooldownS: 30,
    },
  },
  {
    id: 'lib-roadrunner',
    name: 'Roadrunner-M interceptor (Anduril)',
    kind: 'effector',
    description:
      'Twin-turbojet reusable interceptor launched from a ground nest and managed through Lattice. Anduril publishes no range, speed, altitude or endurance figure: every number here is a planning figure.',
    color: '#c98a68',
    builtin: true,
    effector: {
      effectorType: 'interceptor',
      minRangeM: 500,
      maxRangeM: 15000,
      maxAltitudeFt: 20000,
      engageTimeS: 45,
      pk: 0.85,
      magazineSize: 4,
      salvoCooldownS: 30,
    },
  },
  {
    id: 'lib-anvil',
    name: 'Anvil interceptor (Anduril)',
    kind: 'effector',
    description:
      'Rotary-wing collision interceptor for Group 1-2 with low collateral effects. ~4 km planning value.',
    color: '#cd9674',
    builtin: true,
    effector: {
      effectorType: 'interceptor',
      minRangeM: 100,
      maxRangeM: 4000,
      maxAltitudeFt: 5000,
      engageTimeS: 60,
      pk: 0.75,
      magazineSize: 2,
      salvoCooldownS: 60,
    },
  },
  {
    id: 'lib-merops',
    name: 'MEROPS fixed-wing interceptor',
    kind: 'effector',
    description:
      'Fast fixed-wing interceptor with fragmentation warhead; Ukraine-proven vs Shahed-class OWA. 5-20 km envelope.',
    color: '#bd7350',
    builtin: true,
    effector: {
      effectorType: 'interceptor',
      minRangeM: 1000,
      maxRangeM: 20000,
      maxAltitudeFt: 16000,
      engageTimeS: 120,
      pk: 0.8,
      magazineSize: 4,
      salvoCooldownS: 60,
    },
  },
  {
    id: 'lib-xm914',
    name: 'XM914 30mm gun (M-LIDS)',
    kind: 'effector',
    description:
      '30x113mm chain gun on RIwP turret firing XM1223 proximity-airburst rounds. Group 1-2 out to ~2 km.',
    color: '#c9a05a',
    builtin: true,
    effector: {
      effectorType: 'gun',
      minRangeM: 50,
      maxRangeM: 2000,
      maxAltitudeFt: 5000,
      engageTimeS: 10,
      pk: 0.75,
      magazineSize: 30,
      salvoCooldownS: 10,
    },
  },
  {
    id: 'lib-lpws',
    name: 'LPWS 20mm (land Phalanx)',
    kind: 'effector',
    description:
      'Land-based Phalanx 20mm gun with radar-directed burst fire, cued by KuRFS. Point defense to ~1.5 km.',
    color: '#cfa96a',
    builtin: true,
    effector: {
      effectorType: 'gun',
      minRangeM: 100,
      maxRangeM: 1500,
      maxAltitudeFt: 5000,
      engageTimeS: 5,
      pk: 0.7,
      magazineSize: 20,
      salvoCooldownS: 5,
    },
  },
  {
    id: 'lib-smash',
    name: 'SMASH 2000L rifle fire control',
    kind: 'effector',
    description:
      'Computerized rifle sight for dismounted counter-drone fire. Group 1 quads inside 250 m.',
    color: '#b8934e',
    builtin: true,
    effector: {
      effectorType: 'gun',
      minRangeM: 10,
      maxRangeM: 250,
      maxAltitudeFt: 800,
      engageTimeS: 8,
      pk: 0.7,
      magazineSize: 24,
      salvoCooldownS: 10,
    },
  },
  {
    id: 'lib-phel',
    name: 'P-HEL 20 kW laser (AV LOCUST)',
    kind: 'effector',
    description:
      'Palletized 20 kW-class high-energy laser (AeroVironment LOCUST), fielded for base defense. No engagement range has ever been published: the 3 km ring is a planning figure.',
    color: '#b87a8c',
    builtin: true,
    effector: {
      effectorType: 'de',
      minRangeM: 100,
      maxRangeM: 3000,
      maxAltitudeFt: 8000,
      engageTimeS: 15,
      salvoCooldownS: 15,
    },
  },
  {
    id: 'lib-demshorad',
    name: 'DE M-SHORAD 50 kW laser',
    kind: 'effector',
    description:
      'Stryker-mounted 50 kW-class laser prototype. GAO found the prototype not mature enough to transition; production slipped to FY2027 and the enduring path is now E-HEL. Four prototypes deployed to CENTCOM. No engagement range is published: the ring is a planning figure.',
    color: '#c08698',
    builtin: true,
    effector: {
      effectorType: 'de',
      minRangeM: 100,
      maxRangeM: 5000,
      maxAltitudeFt: 10000,
      engageTimeS: 15,
      salvoCooldownS: 10,
    },
  },
  {
    id: 'lib-leonidas',
    name: 'Leonidas HPM (Epirus)',
    kind: 'effector',
    description:
      'Software-defined high-power microwave array; defeats swarms in a sector. ~1 km planning value, 120 deg beam.',
    color: '#a48ac4',
    builtin: true,
    effector: {
      effectorType: 'hpm',
      minRangeM: 0,
      maxRangeM: 1000,
      maxAltitudeFt: 3000,
      sectorDeg: 120,
      engageTimeS: 3,
      pk: 0.7,
      salvoCooldownS: 5,
    },
  },
  {
    id: 'lib-thor',
    name: 'THOR HPM (AFRL)',
    kind: 'effector',
    description:
      'AFRL high-power microwave counter-swarm demonstrator in a shipping container. AFRL has never published an engagement range or a dwell time; both the ring and the engage time are planning figures.',
    color: '#ae96ce',
    builtin: true,
    effector: {
      effectorType: 'hpm',
      minRangeM: 0,
      maxRangeM: 800,
      maxAltitudeFt: 3000,
      engageTimeS: 2,
      pk: 0.7,
      salvoCooldownS: 5,
    },
  },
  {
    id: 'lib-dronebuster',
    name: 'Dronebuster Block 3B jammer',
    kind: 'effector',
    description:
      'Handheld directional GNSS and control-link jammer. Group 1 inside ~1 km, 60 deg beam.',
    color: '#cdb079',
    builtin: true,
    effector: {
      effectorType: 'jammer',
      minRangeM: 0,
      maxRangeM: 1000,
      maxAltitudeFt: null,
      sectorDeg: 60,
      engageTimeS: 5,
      pk: 0.6,
      salvoCooldownS: 5,
      // "GNSS and control-link jammer".
      jamBands: ['gnss', 'ism-2400', 'ism-5800'],
    },
  },
  {
    id: 'lib-modi',
    name: 'Modi II EW jammer',
    kind: 'effector',
    description:
      'Dismounted/vehicle EW system disrupting UAS communications and control links. Public sources describe control-link disruption, not GNSS denial. No range is published: the 2 km ring is a planning figure.',
    color: '#d2b884',
    builtin: true,
    effector: {
      effectorType: 'jammer',
      minRangeM: 0,
      maxRangeM: 2000,
      maxAltitudeFt: null,
      engageTimeS: 5,
      pk: 0.65,
      salvoCooldownS: 5,
      // Public sources describe control-link disruption, not GNSS denial.
      jamBands: ['uhf-433', 'ism-915', 'ism-2400', 'ism-5800'],
    },
  },
  {
    id: 'lib-enforceair',
    name: 'EnforceAir2 RF takeover (D-Fend)',
    kind: 'effector',
    description:
      'RF cyber-takeover system: assumes control of the drone and lands it. No broadband jamming. ~3.5 km on supported protocols.',
    color: '#d8c19a',
    builtin: true,
    effector: {
      effectorType: 'jammer',
      minRangeM: 0,
      maxRangeM: 3500,
      maxAltitudeFt: null,
      engageTimeS: 20,
      pk: 0.7,
      salvoCooldownS: 20,
      // Takeover rides the drone's own control protocol, not GNSS.
      jamBands: ['ism-2400', 'ism-5800'],
    },
  },
  {
    id: 'lib-amphel',
    name: 'AMP-HEL 20 kW laser (LOCUST on ISV)',
    kind: 'effector',
    description:
      'Army RCCTO prototype: 20 kW-class LOCUST laser on an Infantry Squad Vehicle for maneuver-force C-UAS. Two ISV sets delivered Aug 2025; two JLTV sets with radar and C2 followed. Single-target hard kill by dwell. The engagement range is NOT published: this ring is a planning value, not a performance claim. Heavily degraded by fog, rain and dust.',
    color: '#ca90a2',
    builtin: true,
    effector: {
      effectorType: 'de',
      minRangeM: 100,
      maxRangeM: 3000,
      maxAltitudeFt: null,
      engageTimeS: 15,
    },
  },
  {
    id: 'lib-helios',
    name: 'HELIOS 60 kW shipboard laser',
    kind: 'effector',
    description:
      'US Navy Mk 5 Mod 0 HELIOS: 60 kW-class laser plus optical dazzler, hosted by the Aegis Combat System, installed on USS Preble since 2022 and the only such installation. Engaged four UAS in one at-sea counter-UAS demonstration. Single target per engagement. Magazine is bounded by ship power and cooling, not by rounds. Engagement range and the deckhouse-restricted firing arcs are NOT published.',
    color: '#ac6e80',
    builtin: true,
    effector: {
      effectorType: 'de',
      minRangeM: 100,
      maxRangeM: 3000,
      maxAltitudeFt: null,
      engageTimeS: 15,
    },
  },
  {
    id: 'lib-ironbeam',
    name: 'Iron Beam 100 kW laser (Rafael)',
    kind: 'effector',
    description:
      'Rafael Iron Beam (\'Or Eitan\'), 100 kW-class laser handed to the Israeli Air Force 28 Dec 2025: the first high-energy laser air-defence system declared operationally mature. Reported to burn rockets, mortars and UAS at about 10 km in clear air; interception takes seconds. Fires from a static emplacement and degrades badly in cloud, fog and low visibility, which is why Iron Dome remains the all-weather layer.',
    color: '#9e6274',
    builtin: true,
    effector: { effectorType: 'de', minRangeM: 100, maxRangeM: 7000, maxAltitudeFt: null, engageTimeS: 5 },
  },
  {
    id: 'lib-cuaews',
    name: 'CUAEWS DF (SRC, LIDS EW)',
    kind: 'effector',
    description:
      'LIDS/M-LIDS electronic-attack element. Passively searches RF, direction-finds both aircraft and operator, then applies tailored non-kinetic defeat plus a NAVWAR effect against waypoint-guided threats. SRC states EW effects to 8 km. Man-in-the-loop fires; re-tasking is near instantaneous and indefinite.',
    color: '#c9ab72',
    builtin: true,
    effector: {
      effectorType: 'jammer',
      minRangeM: 0,
      maxRangeM: 8000,
      maxAltitudeFt: null,
      sectorDeg: 360,
      engageTimeS: 5,
      pk: 0.65,
      salvoCooldownS: 5,
      // Tailored link defeat plus a NAVWAR (GNSS) effect.
      jamBands: ['gnss', 'uhf-433', 'ism-915', 'ism-2400', 'ism-5800'],
    },
  },
  {
    id: 'lib-ninja',
    name: 'NINJA RF-cyber defeat (AFRL)',
    kind: 'effector',
    description:
      'Air Force fixed-site RF-cyber C-sUAS. Software-defined radios intercept the drone-operator link and take control of or disable Group 1-2 UAS without the indiscriminate interference of broadband jamming; friendly drones can be whitelisted. NO PUBLIC DEFEAT RANGE: the 2 km ring is a representative planning figure.',
    color: '#c4a069',
    builtin: true,
    effector: {
      effectorType: 'jammer',
      minRangeM: 0,
      maxRangeM: 2000,
      maxAltitudeFt: null,
      sectorDeg: 360,
      engageTimeS: 20,
      pk: 0.6,
      salvoCooldownS: 20,
      // Intercepts the drone-operator link; no broadband or GNSS jamming.
      jamBands: ['ism-2400', 'ism-5800'],
    },
  },
  {
    id: 'lib-pulsar',
    name: 'Pulsar EW node (Anduril)',
    kind: 'effector',
    description:
      'Software-defined EW node: passive RF sense, classify and direction-find, then directed electronic attack on the control link. One panel covers a 90 deg sector; two panels make 360. Placard effective range 2 km against Group 1. Selectable bands and directional transmit to limit friendly interference. Lattice-managed.',
    color: '#bb9a62',
    builtin: true,
    effector: {
      effectorType: 'jammer',
      minRangeM: 0,
      maxRangeM: 2000,
      maxAltitudeFt: null,
      sectorDeg: 90,
      engageTimeS: 5,
      pk: 0.6,
      salvoCooldownS: 5,
      // Software-defined, selectable bands: control links and GNSS.
      jamBands: ['gnss', 'ism-915', 'ism-2400', 'ism-5800'],
    },
  },
  {
    id: 'lib-pitbull',
    name: 'Pitbull 101 wearable jammer (MyDefence)',
    kind: 'effector',
    description:
      'Vest-worn 1.33 kg directional jammer, 60 deg beam, up to 1 km. Denies control, video and GNSS links. Manual (human-in-the-loop) or automatic, fired on a detection from the paired Wingman sensor. Jammed drones land or return to the controller or launch point.',
    color: '#d0b686',
    builtin: true,
    effector: {
      effectorType: 'jammer',
      minRangeM: 0,
      maxRangeM: 1000,
      maxAltitudeFt: null,
      sectorDeg: 60,
      engageTimeS: 5,
      pk: 0.6,
      salvoCooldownS: 5,
      // "Denies control, video and GNSS links".
      jamBands: ['gnss', 'ism-2400', 'ism-5800'],
    },
  },
  {
    id: 'lib-stinger',
    name: 'FIM-92 Stinger (M-SHORAD / MADIS)',
    kind: 'effector',
    description:
      'IR-homing SHORAD missile on the M-SHORAD RIwP and MADIS Mk1 turrets. FIM-92J/K proximity fuze added for small UAS. 4.8 km weapon max; 4-round pod.',
    color: '#b06a4a',
    builtin: true,
    effector: {
      effectorType: 'interceptor',
      minRangeM: 200,
      maxRangeM: 4800,
      maxAltitudeFt: 12500,
      engageTimeS: 15,
      pk: 0.7,
      magazineSize: 4,
      salvoCooldownS: 10,
    },
  },
  {
    id: 'lib-eagls',
    name: 'EAGLS 70 mm APKWS launcher',
    kind: 'effector',
    description:
      'Four-round 70 mm APKWS II launcher on a CROWS II mount with organic RPS-40 radar and EO/IR laser designator. Fielded to CENTCOM base defence 2026.',
    color: '#d9a888',
    builtin: true,
    effector: {
      effectorType: 'interceptor',
      minRangeM: 500,
      maxRangeM: 5000,
      maxAltitudeFt: null,
      sectorDeg: 360,
      engageTimeS: 15,
      pk: 0.7,
      magazineSize: 4,
      salvoCooldownS: 5,
    },
  },
  {
    id: 'lib-skyranger30',
    name: 'Skyranger 30 (Rheinmetall)',
    kind: 'effector',
    description:
      '30x173 mm KCE-ABM revolver cannon with AHEAD programmable airburst on a 360-degree turret with organic AESA radar and EO/IR. Effective to 3 km. NATO mobile C-UAS.',
    color: '#d7b87e',
    builtin: true,
    effector: {
      effectorType: 'gun',
      minRangeM: 200,
      maxRangeM: 3000,
      maxAltitudeFt: null,
      sectorDeg: 360,
      engageTimeS: 8,
      pk: 0.8,
      magazineSize: 12,
      salvoCooldownS: 5,
    },
  },
  {
    id: 'lib-dronehunter',
    name: 'DroneHunter F700 net interceptor',
    kind: 'effector',
    description:
      'Reusable radar-guided multirotor interceptor that captures Group 1-2 UAS with a tethered net or DrogueChute. First Replicator 2 purchase, Jan 2026. 5 km air-vehicle range.',
    color: '#6fb3a0',
    builtin: true,
    effector: {
      effectorType: 'net',
      minRangeM: 100,
      maxRangeM: 5000,
      maxAltitudeFt: null,
      sectorDeg: 360,
      engageTimeS: 150,
      pk: 0.85,
      salvoCooldownS: 180,
    },
  },

]

const C2: SpecModel[] = [
  {
    id: 'lib-faadc2',
    name: 'FAAD C2 (Northrop Grumman)',
    kind: 'c2',
    description:
      'DoD-designated C2 for C-sUAS. Fuses sensor tracks, correlates the air picture, and manages engagements.',
    color: '#d6d9d2',
    builtin: true,
  },
  {
    id: 'lib-lattice',
    name: 'Lattice C2 (Anduril)',
    kind: 'c2',
    description:
      'AI sensor-fusion and C2 platform. Autonomously detects, classifies, and tracks; cues Anvil and Roadrunner.',
    color: '#cdd1c9',
    builtin: true,
  },
  {
    id: 'lib-picogrid',
    name: 'Picogrid Legion edge node',
    kind: 'c2',
    description:
      'Vendor-neutral edge integration node (Legion with Helios/Portal hardware). Fuses local sensors into one picture.',
    color: '#c4c9c0',
    builtin: true,
  },
  {
    id: 'lib-medusa',
    name: 'MEDUSA C2 (USAF)',
    kind: 'c2',
    description:
      'Air Force base-defense counter-sUAS C2, developed by Kongsberg Geospatial. Neither government ownership nor open standards is supported by any public source; its FAAD C2 interoperability is stated conditionally in the sources that mention it.',
    color: '#bcc1b8',
    builtin: true,
  },
  {
    id: 'lib-ibcs',
    name: 'IBCS battle command (Northrop Grumman)',
    kind: 'c2',
    description:
      'Army IAMD battle command. Fuses distributed sensor data into fire-control-quality tracks on the Integrated Fire Control Network; \'plug-and-fight\' kits adapt sensors and weapons. Set to replace Patriot, THAAD and FAAD C2 C2 systems.',
    color: '#b4baaf',
    builtin: true,
  },
  {
    id: 'lib-adsi',
    name: 'ADSI data link gateway (Ultra)',
    kind: 'c2',
    description:
      'Joint-certified tactical data link forwarding and control gateway. Correlates and forwards tracks across Link 16, Link 11, JREAP, the FAAD data link and Cursor-on-Target. It bridges pictures rather than running a C-UAS engagement itself.',
    color: '#acb2a7',
    builtin: true,
  },
  {
    id: 'lib-tak',
    name: 'TAK / CoT node (Team Awareness Kit)',
    kind: 'c2',
    description:
      'Government-owned situational-awareness and C2 client family built on the Cursor-on-Target message standard. It forwards and displays C-UAS detections and alerts to dismounted teams and operations centres. It is not a track-fusion or fire-control system and carries no engagement authority.',
    color: '#a4ab9f',
    builtin: true,
  },
  {
    id: 'lib-dronesentryc2',
    name: 'DroneSentry-C2 (DroneShield)',
    kind: 'c2',
    description:
      'Commercial C-UAS C2 built on the SensorFusionAI 3D fusion engine. Fuses RF, radar, optical and ADS-B inputs from DroneShield and third-party sensors, drives DroneShield and partner effectors, and speaks SAPIENT and Cursor-on-Target.',
    color: '#9ca397',
    builtin: true,
  },
  {
    id: 'lib-dedronetracker',
    name: 'DedroneTracker.AI C2 (Dedrone by Axon)',
    kind: 'c2',
    description:
      'Commercial airspace-security C2. Fuses RF, radar, camera, acoustic and Remote ID inputs into one risk-ranked track picture and runs jamming, cyber-takeover or kinetic mitigation from the same interface, where legally authorised.',
    color: '#949b8f',
    builtin: true,
  },
  {
    id: 'lib-cac2s',
    name: 'CAC2S (USMC aviation C2)',
    kind: 'c2',
    description:
      'Marine Corps aviation command and control. Fuses expeditionary radar, weapon-system, UAS and ISR inputs into one MAGTF air picture and hosts the engage / do-not-engage decision. Named by CRS as the C2 element of the Marine MRIC air-defence system alongside G/ATOR.',
    color: '#c0c5bc',
    builtin: true,
  },
]

const THREATS: SpecModel[] = [
  {
    id: 'lib-mavic3',
    name: 'Red air: DJI Mavic 3 (G1 quad)',
    kind: 'uas',
    description:
      'COTS quadcopter for recce and improvised drops. Launched 2-10 km out; ingress 100-400 ft AGL.',
    color: '#c98577',
    builtin: true,
    uas: {
      group: 1,
      rcsM2: 0.01, // planning factor (rcsFactors.ts): G1 tier; Phantom/Mavic class is the Blighter A400 datasheet's 0.01 m2 small-drone case
      spanM: 0.38, // public dimension: DJI Mavic 3 diagonal 380 mm
      acousticDb: 68, // PF: small electric quad class
      airframe: 'quad',
      cruiseSpeedMps: 12,
      maxSpeedMps: 21,
      enduranceMin: 45,
      altBandFt: [50, 1200],
      navMode: 'mixed',
      emissionsNote: 'OcuSync 2.4/5.8 GHz link and video',
      controlLinkRangeM: 15000,
      operatingRadiusM: 10000,
      combatRadiusM: 8000,
      oneWay: false,
      rangeNote: 'Combat recon radius 5-10 km under EW; repeaters and directional antennas push toward 10-15 km.',
      // Threat study: ISR/dropper class, dropped munition mass small and variable, so no weapon numbers.
      warheadKg: null,
      effectRadiusM: null,
      standoffRangeM: null,
      weaponProfile: 'none',
      jamBehavior: 'return-home', // planning assumption for reusable COTS class (study silent on lost-link behavior); default for mixed nav is 'continue'
    },
    threatProfile: {
      designator: 'THR-G1-Q-01',
      routeIntent: 'Low overwatch orbit, then drop or spot for fires',
      altitudeFt: 300,
      speedMps: 12,
      count: 1,
    },
  },
  {
    id: 'lib-mini4',
    name: 'Red air: DJI Mini class (G1 sub-250 g)',
    kind: 'uas',
    description:
      'Sub-250 g quad for short-range recce. Low and slow, 30-300 ft AGL, frequent hovers; hard radar target.',
    color: '#cc9083',
    builtin: true,
    uas: {
      group: 1,
      rcsM2: 0.005, // planning factor (rcsFactors.ts): half the G1 tier: sub-250 g airframe
      spanM: 0.25, // public dimension: DJI Mini 4 Pro diagonal 247 mm
      acousticDb: 60, // PF: sub-250 g quad
      airframe: 'quad',
      cruiseSpeedMps: 10,
      maxSpeedMps: 16,
      enduranceMin: 34,
      altBandFt: [30, 800],
      navMode: 'mixed',
      emissionsNote: 'OcuSync 2.4/5.8 GHz, low power',
      controlLinkRangeM: 10000,
      operatingRadiusM: 5000,
      combatRadiusM: 4000,
      oneWay: false,
      rangeNote: 'Practical radius 3-5 km under EW; occasionally paired with repeaters.',
      // Threat study: recce only in this class; no weapon numbers.
      warheadKg: null,
      effectRadiusM: null,
      standoffRangeM: null,
      weaponProfile: 'none',
      jamBehavior: 'return-home', // planning assumption for reusable COTS class (study silent on lost-link behavior); default for mixed nav is 'continue'
    },
    threatProfile: {
      designator: 'THR-G1-Q-02',
      routeIntent: 'Short standoff recce, 1-5 km launch distance',
      altitudeFt: 200,
      speedMps: 10,
      count: 1,
    },
  },
  {
    id: 'lib-fpv7',
    name: 'Red air: FPV 7-inch OWA (G1)',
    kind: 'uas',
    description:
      'Racing-style FPV one-way-attack quad, 1-2 kg payload. Terrain-masked ingress at 10-100 ft AGL; terminal dive.',
    color: '#c46a5a',
    builtin: true,
    uas: {
      group: 1,
      rcsM2: 0.01, // planning factor (rcsFactors.ts): G1 tier; study 5.x: low RCS is the FPV's main survivability trait
      spanM: 0.3, // public dimension: 7-inch FPV frame, ~300 mm wheelbase
      acousticDb: 75, // PF: 7-inch FPV at speed
      airframe: 'fpv',
      cruiseSpeedMps: 25,
      maxSpeedMps: 45,
      enduranceMin: 15,
      altBandFt: [10, 400],
      navMode: 'rf-manual',
      emissionsNote: 'Analog 5.8 GHz video, ELRS 900 MHz control',
      controlLinkRangeM: 10000,
      operatingRadiusM: 8000,
      combatRadiusM: 10000,
      oneWay: true,
      rangeNote: 'Strikes 5-15 km; relay drones and high-gain video links push 20-30 km. Extended packs and wing kits reported.',
      // Threat study [R13]: Bumerang-E class benchmark, up to 4 kg target load; class match, typical fills lighter.
      warheadKg: 4,
      effectRadiusM: 30, // = defaultEffectRadiusM(4); planning factor, not study-derived lethality (study 18.1)
      standoffRangeM: null,
      weaponProfile: 'impact',
    },
    threatProfile: {
      designator: 'THR-G1-FPV-01',
      routeIntent: 'Terrain-masked attack along roads and treelines, 3-8 km launch',
      altitudeFt: 80,
      speedMps: 25,
      count: 1,
    },
  },
  {
    id: 'lib-fpv-fiber',
    name: 'Red air: fiber-optic FPV (G1, jam-immune)',
    kind: 'uas',
    description:
      'FPV quad steered over a fiber-optic spool. No RF emissions; immune to jamming. Slower due to spool drag.',
    color: '#c87b6d',
    builtin: true,
    uas: {
      group: 1,
      rcsM2: 0.01, // planning factor (rcsFactors.ts): G1 tier; the fiber spool adds no radar return of note
      spanM: 0.3, // public dimension: 7-inch FPV frame class
      acousticDb: 75, // PF: 7-inch FPV class
      airframe: 'fpv',
      cruiseSpeedMps: 15,
      maxSpeedMps: 25,
      enduranceMin: 20,
      altBandFt: [10, 300],
      navMode: 'fiber',
      emissionsNote: 'None: fiber-optic control and video',
      controlLinkRangeM: 20000,
      operatingRadiusM: 15000,
      combatRadiusM: 15000,
      oneWay: true,
      rangeNote: 'Fielded fiber spools of 10, 15, and 20 km confirmed in combat; 41-50 km spools demonstrated on larger frames.',
      // Threat study: payload model-dependent and not quantified, so no warhead mass or effect radius.
      warheadKg: null,
      effectRadiusM: null,
      standoffRangeM: null,
      weaponProfile: 'impact',
      jamBehavior: 'continue', // fiber control is immune to RF jamming (study RUS-TAC-03); default for fiber would be 'drift'
    },
    threatProfile: {
      designator: 'THR-G1-FPV-02',
      routeIntent: 'Terrain-hugging attack on rear-area targets, 5-20 km out',
      altitudeFt: 60,
      speedMps: 15,
      count: 1,
    },
  },
  {
    id: 'lib-m350',
    name: 'Red air: DJI M350 class (G2 quad)',
    kind: 'uas',
    description:
      'Industrial quad with thermal payload. Standoff ISR orbits 5-15 km out at 500-3000 ft; also a light bomber.',
    color: '#c06e60',
    builtin: true,
    uas: {
      group: 2,
      rcsM2: 0.05, // planning factor (rcsFactors.ts): G2 tier; EchoGuard sees a Matrice 600 ~4x the Phantom energy (1.4 km vs 1 km)
      spanM: 0.9, // public dimension: DJI M350 RTK diagonal wheelbase 895 mm
      acousticDb: 78, // PF: industrial quad
      airframe: 'quad',
      cruiseSpeedMps: 15,
      maxSpeedMps: 23,
      enduranceMin: 55,
      altBandFt: [100, 3500],
      navMode: 'mixed',
      emissionsNote: 'OcuSync 3 Enterprise, 2.4/5.8 GHz',
      controlLinkRangeM: 20000,
      operatingRadiusM: 15000,
      combatRadiusM: 10000,
      oneWay: false,
      rangeNote: 'Employed 8-12 km where EW permits; repeaters and elevated antennas hold the link.',
      // Threat study: DJI-class ISR/dropper archetype; dropped munition mass small and variable.
      warheadKg: null,
      effectRadiusM: null,
      standoffRangeM: null,
      weaponProfile: 'none',
      jamBehavior: 'return-home', // planning assumption for reusable COTS class (study silent on lost-link behavior); default for mixed nav is 'continue'
    },
    threatProfile: {
      designator: 'THR-G2-Q-01',
      routeIntent: 'Night ISR orbit with thermal payload',
      altitudeFt: 1500,
      speedMps: 15,
      count: 1,
    },
  },
  {
    id: 'lib-babayaga',
    name: 'Red air: heavy multirotor bomber (G2)',
    kind: 'uas',
    description:
      'Baba Yaga class agricultural conversion. Night bombing from 5-12 km standoff; drops several munitions and returns.',
    color: '#b95e4d',
    builtin: true,
    uas: {
      group: 2,
      rcsM2: 0.1, // planning factor (rcsFactors.ts): above the G2 tier: heavy multirotor frame with exposed payload
      spanM: 1.5, // public dimension: agricultural hexacopter class, ~1.5 m motor-to-motor
      acousticDb: 85, // PF: heavy multirotor
      airframe: 'quad',
      cruiseSpeedMps: 12,
      maxSpeedMps: 20,
      enduranceMin: 40,
      altBandFt: [100, 1500],
      navMode: 'mixed',
      emissionsNote: 'Custom links, often 700-900 MHz with repeater',
      controlLinkRangeM: 15000,
      operatingRadiusM: 12000,
      combatRadiusM: 10000,
      oneWay: false,
      rangeNote: 'Night sorties 10-20 km with ~15 kg payload; Starlink-relay control reported on some airframes.',
      // Threat study (UKR-TAC-03): drops up to 40 kg of ordnance overhead, but fixes no single warhead
      // mass or release standoff, so no WEZ is drawn for the class.
      warheadKg: null,
      effectRadiusM: null,
      standoffRangeM: null,
      weaponProfile: 'none',
      jamBehavior: 'return-home', // planning assumption for the reusable heavy-bomber family (study silent); default for mixed nav is 'continue'
    },
    threatProfile: {
      designator: 'THR-G2-HB-01',
      routeIntent: 'Repeat night sorties, 300-1000 ft ingress',
      altitudeFt: 600,
      speedMps: 12,
      count: 1,
    },
  },
  {
    id: 'lib-cw15',
    name: 'Red air: CW-15 class VTOL ISR (G2)',
    kind: 'uas',
    description:
      'VTOL fixed-wing ISR. Launches from any clearing 20-50 km out; long racetrack orbits at 1500-5000 ft.',
    color: '#bd6355',
    builtin: true,
    uas: {
      group: 2,
      rcsM2: 0.05, // planning factor (rcsFactors.ts): G2 tier
      spanM: 3.5, // public dimension: JOUAV CW-15 wingspan 3.5 m
      acousticDb: 80, // PF: electric VTOL fixed-wing
      irSignature: 'low', // electric VTOL; same as the airframe default, stated for the record
      airframe: 'vtol',
      cruiseSpeedMps: 17,
      maxSpeedMps: 25,
      enduranceMin: 180,
      altBandFt: [1000, 6000],
      navMode: 'mixed',
      emissionsNote: 'Digital datalink, directional antenna',
      controlLinkRangeM: 50000,
      operatingRadiusM: 50000,
      combatRadiusM: 50000,
      oneWay: false,
      rangeNote: 'Legs beyond 100 km reported for the class; combat ISR bounded by ~50 km datalink.',
      // ISR only; no weapon numbers in the threat study.
      warheadKg: null,
      effectRadiusM: null,
      standoffRangeM: null,
      weaponProfile: 'none',
    },
    threatProfile: {
      designator: 'THR-G2-V-01',
      routeIntent: 'Persistent standoff ISR racetrack',
      altitudeFt: 3000,
      speedMps: 17,
      count: 1,
    },
  },
  {
    id: 'lib-lancet3',
    name: 'Red air: Lancet-3 loitering munition (G2)',
    kind: 'uas',
    description:
      'Rail-launched loitering munition cued by an ISR drone. Transits at 5000-15000 ft; fast terminal dive, up to 83 m/s.',
    color: '#b85a4a',
    builtin: true,
    uas: {
      group: 2,
      rcsM2: 0.05, // planning factor (rcsFactors.ts): G2 tier; small composite airframe
      spanM: 1.65, // public dimension: Lancet-3 wingspan ~1.65 m
      acousticDb: 75, // PF: electric pusher
      irSignature: 'low', // electric pusher: no engine exhaust; the one-way-attack default is high
      airframe: 'one-way-attack',
      cruiseSpeedMps: 28,
      maxSpeedMps: 83,
      enduranceMin: 40,
      altBandFt: [1000, 15000],
      navMode: 'mixed',
      emissionsNote: 'Video downlink until terminal; some variants autonomous',
      controlLinkRangeM: 50000,
      operatingRadiusM: 40000,
      combatRadiusM: 40000,
      oneWay: true,
      rangeNote: 'Strikes documented at 40 km; Izdeliye-51 variants hit 65 km; paired relay drones push toward 100 km.',
      // Threat study [R08][R17]: 5 kg fragmentation/cumulative warhead.
      warheadKg: 5,
      effectRadiusM: 30, // = defaultEffectRadiusM(5); planning factor, not study-derived lethality (study 18.1)
      standoffRangeM: null,
      weaponProfile: 'impact',
    },
    threatProfile: {
      designator: 'THR-G2-LM-01',
      routeIntent: 'ISR-cued strike, 20-40 km launch distance',
      altitudeFt: 8000,
      speedMps: 28,
      count: 1,
    },
  },
  {
    id: 'lib-orlan10',
    name: 'Red air: Orlan-10 class ISR (G3 fixed-wing)',
    kind: 'uas',
    description:
      'Catapult-launched ISR from 50-120 km behind the line. Orbits 3000-15000 ft for hours; cues artillery.',
    color: '#b35143',
    builtin: true,
    uas: {
      group: 3,
      rcsM2: 0.1, // planning factor (rcsFactors.ts): below the G3 tier: 3 m composite airframe, piston engine
      spanM: 3.1, // public dimension: Orlan-10 wingspan 3.1 m
      acousticDb: 90, // PF: small piston engine
      airframe: 'fixed-wing',
      cruiseSpeedMps: 30,
      maxSpeedMps: 42,
      enduranceMin: 960,
      altBandFt: [3000, 16000],
      navMode: 'mixed',
      emissionsNote: 'C2 and video links; multi-ship relay employment',
      controlLinkRangeM: 120000,
      operatingRadiusM: 120000,
      combatRadiusM: 120000,
      oneWay: false,
      rangeNote: 'Routinely operates 110-150 km from its ground station on 14-16 hour sorties.',
      // ISR only; cues fires but does not itself strike (threat study [R11]).
      warheadKg: null,
      effectRadiusM: null,
      standoffRangeM: null,
      weaponProfile: 'none',
      jamBehavior: 'return-home', // planning assumption for reusable ISR class (study silent) [R11 profile]; default for mixed nav is 'continue'
    },
    threatProfile: {
      designator: 'THR-G3-ISR-01',
      routeIntent: 'High orbit over target area, artillery cueing',
      altitudeFt: 10000,
      speedMps: 30,
      count: 1,
    },
  },
  {
    id: 'lib-shahed136',
    name: 'Red air: Shahed-136 / Geran-2 OWA (G3)',
    kind: 'uas',
    description:
      'Delta-wing one-way-attack, launched in salvos hundreds of km out. Low river-valley ingress or 10-16 kft cruise with terminal dive.',
    color: '#ab4c3e',
    builtin: true,
    uas: {
      group: 3,
      rcsM2: 0.2, // planning factor (rcsFactors.ts): G3 tier; delta wing, composite skin
      spanM: 2.5, // public dimension: Shahed-136 wingspan 2.5 m
      acousticDb: 100, // PF: MD550 piston engine
      airframe: 'one-way-attack',
      cruiseSpeedMps: 50,
      maxSpeedMps: 64,
      enduranceMin: 600,
      altBandFt: [200, 16000],
      navMode: 'inertial',
      emissionsNote: 'RF silent en route; some variants add SATCOM or cellular',
      controlLinkRangeM: null,
      operatingRadiusM: 1000000,
      combatRadiusM: 900000,
      oneWay: true,
      rangeNote: 'Strike routes 600-900+ km with evasive doglegs; Kometa anti-jam GNSS and jet-powered variants reported.',
      // Threat study 5.2.1 [R15][R16]: ~40 kg warhead per UN technical report; variants differ.
      warheadKg: 40,
      effectRadiusM: 80, // = defaultEffectRadiusM(40); planning factor, not study-derived lethality (study 18.1)
      standoffRangeM: null,
      weaponProfile: 'impact',
      jamBehavior: 'continue', // hardened GNSS-INS / anti-jam variants press on (study 5.2.1); default for inertial is 'drift'
    },
    threatProfile: {
      designator: 'THR-G3-OWA-01',
      routeIntent: 'Stream raid along a corridor, minutes apart',
      altitudeFt: 2000,
      speedMps: 50,
      count: 1,
    },
  },
  {
    id: 'lib-gerbera',
    name: 'Red air: Gerbera decoy / light OWA (G2)',
    kind: 'uas',
    description:
      'Cheap foam decoy flown inside Shahed streams to saturate defenses. Same corridors and altitudes as the OWA it mimics.',
    color: '#c2705f',
    builtin: true,
    uas: {
      group: 2,
      rcsM2: 0.2, // planning factor (rcsFactors.ts): G3 tier, not G2: a decoy built to present a Shahed-class radar return
      spanM: 2.5, // public dimension: Gerbera wingspan ~2.5 m (Shahed-form decoy)
      acousticDb: 90, // PF: small piston engine
      airframe: 'one-way-attack',
      cruiseSpeedMps: 33,
      maxSpeedMps: 44,
      enduranceMin: 240,
      altBandFt: [500, 10000],
      navMode: 'gps',
      emissionsNote: 'Some carry emitters to mimic Shahed signatures',
      controlLinkRangeM: null,
      operatingRadiusM: 300000,
      combatRadiusM: 300000,
      oneWay: true,
      rangeNote: 'About 300 km with a combat payload; unarmed decoy flights reported to 600 km.',
      // Threat study [R02]: cataloged as false target / barrage / recon; warhead role not fixed, so decoy WEZ is null.
      warheadKg: null,
      effectRadiusM: null,
      standoffRangeM: null,
      weaponProfile: 'none',
      jamBehavior: 'continue', // GNSS/IMU nav recovered in exploitation (study [R02]); default for gps is 'drift'
    },
    threatProfile: {
      designator: 'THR-G2-DEC-01',
      routeIntent: 'Interleaved in OWA stream as decoy',
      altitudeFt: 4000,
      speedMps: 33,
      count: 1,
    },
  },
  {
    id: 'lib-mugin5',
    name: 'Red air: Mugin-5 converted strike (G3)',
    kind: 'uas',
    description:
      'COTS fixed-wing conversion launched from improvised strips 200-400 km out. Autonomous GNSS waypoint ingress.',
    color: '#a54737',
    builtin: true,
    uas: {
      group: 3,
      rcsM2: 0.2, // planning factor (rcsFactors.ts): G3 tier
      spanM: 5.0, // public dimension: Mugin-5 wingspan 5.0 m
      acousticDb: 95, // PF: gasoline engine
      airframe: 'one-way-attack',
      cruiseSpeedMps: 32,
      maxSpeedMps: 40,
      enduranceMin: 360,
      altBandFt: [1000, 12000],
      navMode: 'gps',
      emissionsNote: 'RF silent on ingress',
      controlLinkRangeM: null,
      operatingRadiusM: 400000,
      combatRadiusM: 400000,
      oneWay: true,
      rangeNote: 'Early conversions flew about 500 km with 25 kg of explosives; MICH 2000 derivative extends the class.',
      // Threat study 15A gives no warhead mass for the improvised class, so no effect radius is drawn.
      warheadKg: null,
      effectRadiusM: null,
      standoffRangeM: null,
      weaponProfile: 'impact',
    },
    threatProfile: {
      designator: 'THR-G3-OWA-02',
      routeIntent: 'Autonomous waypoint attack at 1000-8000 ft',
      altitudeFt: 4000,
      speedMps: 32,
      count: 1,
    },
  },
  {
    id: 'lib-mohajer6',
    name: 'Red air: Mohajer-6 ISR/strike (G4)',
    kind: 'uas',
    description:
      'Runway-launched MALE-lite. Cruises 10000-18000 ft inside ~200 km line-of-sight C2; releases small PGMs.',
    color: '#9e4a44',
    builtin: true,
    uas: {
      group: 4,
      rcsM2: 1, // planning factor (rcsFactors.ts): G4 tier; light-aircraft class
      spanM: 10, // public dimension: Mohajer-6 wingspan 10 m
      acousticDb: 100, // PF: Rotax-class piston
      airframe: 'fixed-wing',
      cruiseSpeedMps: 40,
      maxSpeedMps: 56,
      enduranceMin: 720,
      altBandFt: [8000, 18000],
      navMode: 'mixed',
      emissionsNote: 'Line-of-sight C2 and video, ~200 km',
      controlLinkRangeM: 200000,
      operatingRadiusM: 200000,
      combatRadiusM: 200000,
      oneWay: false,
      rangeNote: 'Bounded by line-of-sight datalink, about 200 km from the control station; up to 500 km claimed.',
      // Threat study [I02]: PGM release platform, but munition-release range and warhead are not published.
      warheadKg: null,
      effectRadiusM: null,
      standoffRangeM: 8000, // PLANNING FACTOR for T&E laydown: the study gives no release range; not study data
      weaponProfile: 'standoff',
      jamBehavior: 'return-home', // planning assumption for the recoverable UCAV class (study silent); default for mixed nav is 'continue'
    },
    threatProfile: {
      designator: 'THR-G4-MALE-01',
      routeIntent: 'High ISR orbit with PGM release',
      altitudeFt: 14000,
      speedMps: 40,
      count: 1,
    },
  },
  {
    id: 'lib-geran4',
    name: 'Red air: Geran-4 jet OWA (G3)',
    kind: 'uas',
    description:
      'Turbojet one-way-attack from the Geran-3/4/5 jet family, per threat study 5.2.1 [R03]: 450 kg MTOW, 89 m/s (320 km/h) cruise, 770 km range, thermobaric or HE-frag warhead types identified. The study fixes no Geran-3 numbers, so the exploited Geran-4 carries the jet-OWA class.',
    color: '#9c3f31',
    builtin: true,
    uas: {
      group: 3,
      rcsM2: 0.2, // planning factor (rcsFactors.ts): G3 tier; jet variant keeps the Shahed airframe class
      spanM: 2.5, // public dimension: Shahed airframe class, wingspan 2.5 m
      acousticDb: 105, // PF: turbojet
      airframe: 'one-way-attack',
      cruiseSpeedMps: 89,
      maxSpeedMps: 97,
      // Study 5.2.1 [R03]: published endurance 2.2 h.
      enduranceMin: 132,
      altBandFt: [500, 13123],
      navMode: 'mixed',
      emissionsNote: 'SADRA INS + 16-element CRPA anti-jam satnav, camera, mesh modem (study [R03])',
      controlLinkRangeM: null,
      operatingRadiusM: 770000,
      combatRadiusM: null,
      oneWay: true,
      rangeNote: 'Declared range 770 km, ceiling 4000 m (study 5.2.1 [R03]).',
      // Threat study 5.2.1 [R03]: 50 kg warhead.
      warheadKg: 50,
      effectRadiusM: 80, // = defaultEffectRadiusM(50); planning factor, not study-derived lethality (study 18.1)
      standoffRangeM: null,
      weaponProfile: 'impact',
      jamBehavior: 'continue', // anti-jam satnav plus INS presses on (study [R03])
    },
    threatProfile: {
      designator: 'THR-G3-JET-01',
      routeIntent: 'High-speed deep strike; compressed detect-to-engage timeline',
      altitudeFt: 6000,
      speedMps: 89,
      count: 1,
    },
  },
  {
    id: 'lib-tb2',
    name: 'Red air: Bayraktar TB2 UCAV (G4)',
    kind: 'uas',
    description:
      'MALE UCAV per threat study 15B [TUR02]: 700 kg MTOW, 150 kg payload, 46 m/s (90 kt) cruise, 16000 ft operational altitude, 20+ h endurance. Releases laser-, INS/GPS-, or IR-guided munitions and mini cruise missiles at standoff; the study publishes no release range, so the standoff value is a planning factor.',
    color: '#93483f',
    builtin: true,
    uas: {
      group: 4,
      rcsM2: 1, // planning factor (rcsFactors.ts): G4 tier; light-aircraft class
      spanM: 12, // public dimension: Bayraktar TB2 wingspan 12 m
      acousticDb: 100, // PF: Rotax 912 piston
      airframe: 'fixed-wing',
      cruiseSpeedMps: 46,
      maxSpeedMps: 57,
      enduranceMin: 1200,
      altBandFt: [16000, 22000],
      navMode: 'mixed',
      emissionsNote: 'LOS and BLOS datalinks; EO/IR/laser designator or surveillance radar (study [TUR02])',
      controlLinkRangeM: null,
      operatingRadiusM: null,
      combatRadiusM: null,
      oneWay: false,
      rangeNote: 'LOS and BLOS communications per the 2026 Baykar sheet; no public radius figure used.',
      // Threat study 15B [TUR02]: munition-release range and warhead mass not published.
      warheadKg: null,
      effectRadiusM: null,
      standoffRangeM: 8000, // PLANNING FACTOR for T&E laydown: the study gives no release range; not study data
      weaponProfile: 'standoff',
      jamBehavior: 'return-home',
    },
    threatProfile: {
      designator: 'THR-G4-UCAV-01',
      routeIntent: 'Persistent medium-altitude ISR/strike orbit with standoff munition release',
      altitudeFt: 16000,
      speedMps: 46,
      count: 1,
    },
  },
]

const SUPPORT: SpecModel[] = [
  {
    id: 'lib-asset',
    name: 'Defended asset',
    kind: 'asset',
    description: 'Protected point. Warning time is measured to this location.',
    color: '#8fae7a',
    builtin: true,
  },
  {
    id: 'lib-marker',
    name: 'Marker',
    kind: 'marker',
    description: 'General annotation point.',
    color: '#b7bdb2',
    builtin: true,
  },
]

export const SEED_LIBRARY: SpecModel[] = [...SENSORS, ...EFFECTORS, ...C2, ...THREATS, ...SUPPORT]
