/**
 * Threat-tactic library, distilled from the public-source UAS/C-UAS threat
 * study (docs/threat/UAS_CUAS_Threat_Study_Public_Source_2026-08-22.md).
 * Each tactic keeps its study code as id and cites the study section in
 * sourceRef. Pure data + pure helpers: no store imports.
 *
 * Geometry semantics:
 * - defaultShipCount: total UAS ship entities the tactic places by default.
 * - shipsPerWave: ships per launch wave; extra ships open follow-on waves.
 * - waveSpacingS: seconds between wave launches (0 = one simultaneous wave).
 * - defaultShipCount / shipsPerWave / waveSpacingS carry study numbers only
 *   where the study reports a raid composition (e.g. HOU-TAC-01, IRN-TAC-01,
 *   SYR-TAC-01); elsewhere they are representative planning values. The study
 *   warns against deriving one permanent raid size (17.1).
 * - axes / axisSpreadDeg: ingress axes fanned across the total spread around
 *   defaultBearingDeg (spread 0 when axes = 1). Use fanAxes to expand.
 * - standoffM: planning-factor spawn distance from the defended point. The
 *   study rarely states launch distances, so these are representative values
 *   for canvas-scale laydown work.
 * - formation: suggested per-wave FormationSpec (count = shipsPerWave,
 *   spacing = study in-trail spacing); null = independent singleton ships.
 *   Where the study finds no formation shape, the shape is a canvas
 *   representation, not an observed geometry (study 3.4 finding).
 * - decoy: interleave the named decoy platform as every Nth ship. Precise
 *   decoy-to-strike ratios are a study data gap (section 25, gap #7), so
 *   everyNth is a stated representative value, not study-derived.
 *
 * This library supersedes the six retired RAID_BUILDERS patterns (raid.ts):
 * stream -> RUS-LR-01, multi-axis -> RUS-LR-02, decoy mix -> RUS-LR-04,
 * FPV wave -> RUS-TAC-02 / UKR-TAC-01, FPV multi-axis -> UKR-TAC-05,
 * recon-cued pair -> UKR-TAC-04.
 */
import type { FormationSpec, SpecModel } from '../model/types'

export interface ThreatTactic {
  id: string
  name: string
  description: string
  /** Study section the tactic is drawn from. */
  sourceRef: string
  /** Seed-library designators (names); empty = generic, builder picks the platform. */
  platforms: Array<{ designator: string }>
  defaultShipCount: number
  shipsPerWave: number
  waveSpacingS: number
  axes: number
  axisSpreadDeg: number
  defaultBearingDeg: number
  standoffM: number
  formation?: FormationSpec | null
  decoy?: { designator: string; everyNth: number }
}

const SHAHED = 'Red air: Shahed-136 / Geran-2 OWA (G3)'
const GERBERA = 'Red air: Gerbera decoy / light OWA (G2)'
const FPV = 'Red air: FPV 7-inch OWA (G1)'
const FIBER_FPV = 'Red air: fiber-optic FPV (G1, jam-immune)'
const ORLAN = 'Red air: Orlan-10 class ISR (G3 fixed-wing)'
const CW15 = 'Red air: CW-15 class VTOL ISR (G2)'
const LANCET = 'Red air: Lancet-3 loitering munition (G2)'
const BOMBER = 'Red air: heavy multirotor bomber (G2)'
const MAVIC = 'Red air: DJI Mavic 3 (G1 quad)'
const MINI = 'Red air: DJI Mini class (G1 sub-250 g)'
const MUGIN = 'Red air: Mugin-5 converted strike (G3)'
const TB2 = 'Red air: Bayraktar TB2 UCAV (G4)'

export const THREAT_TACTICS: ThreatTactic[] = [
  // ---- Russia, long-range strike campaign (study 5.3) ----
  {
    id: 'RUS-LR-01',
    name: 'Multi-wave OWA attack',
    description:
      'Geran strike drones and Gerbera false targets arrive in repeated waves, not as isolated aircraft. The stressor is sustained track generation and engagement across many waves.',
    sourceRef: '5.3 RUS-LR-01',
    platforms: [{ designator: SHAHED }, { designator: GERBERA }],
    defaultShipCount: 24,
    shipsPerWave: 12,
    waveSpacingS: 600,
    axes: 1,
    axisSpreadDeg: 0,
    defaultBearingDeg: 0,
    standoffM: 60000,
    formation: { count: 12, shape: 'column', spacingM: 3000 },
    decoy: { designator: GERBERA, everyNth: 4 },
  },
  {
    id: 'RUS-LR-02',
    name: 'Multi-azimuth / path-diverse ingress',
    description:
      'Later raids approach the defended area from several directions with overlapping tracks and staggered arrivals. Convergence on one target from different bearings is the defining feature.',
    sourceRef: '5.3 RUS-LR-02',
    platforms: [{ designator: SHAHED }, { designator: GERBERA }],
    defaultShipCount: 24,
    shipsPerWave: 12,
    waveSpacingS: 300,
    axes: 3,
    axisSpreadDeg: 90,
    defaultBearingDeg: 0,
    standoffM: 60000,
    formation: { count: 12, shape: 'echelon', spacingM: 3000 },
    decoy: { designator: GERBERA, everyNth: 4 },
  },
  {
    id: 'RUS-LR-03',
    name: 'Altitude adaptation',
    description:
      'Geran-class OWA flies both low and at several thousand feet on the same corridor, raising the cost of short-range interception. Do not limit the model to nap-of-earth flight.',
    sourceRef: '5.3 RUS-LR-03',
    platforms: [{ designator: SHAHED }],
    defaultShipCount: 12,
    shipsPerWave: 12,
    waveSpacingS: 600,
    axes: 1,
    axisSpreadDeg: 0,
    defaultBearingDeg: 0,
    standoffM: 60000,
    formation: { count: 12, shape: 'column', spacingM: 3000 },
  },
  {
    id: 'RUS-LR-04',
    name: 'Decoy / false-target integration',
    description:
      'Gerbera false targets are interleaved inside the strike stream to soak classification and interceptor allocation. Not every track in the wave carries the same lethality.',
    sourceRef: '5.3 RUS-LR-04',
    platforms: [{ designator: SHAHED }, { designator: GERBERA }],
    defaultShipCount: 10,
    shipsPerWave: 10,
    waveSpacingS: 300,
    axes: 1,
    axisSpreadDeg: 0,
    defaultBearingDeg: 0,
    standoffM: 60000,
    formation: { count: 10, shape: 'column', spacingM: 2000 },
    decoy: { designator: GERBERA, everyNth: 3 },
  },
  // ---- Russia, tactical reconnaissance-strike and FPV (study 5.4) ----
  {
    id: 'RUS-TAC-01',
    name: 'Persistent ISR orbit + strike handoff',
    description:
      'An ISR aircraft holds an observation orbit and hands targets to FPV or Lancet strike systems. The aircraft the defender sees first is the sensor, not the weapon.',
    sourceRef: '5.4 RUS-TAC-01',
    platforms: [{ designator: ORLAN }, { designator: LANCET }, { designator: FPV }],
    defaultShipCount: 3,
    shipsPerWave: 1,
    waveSpacingS: 300,
    axes: 1,
    axisSpreadDeg: 0,
    defaultBearingDeg: 0,
    standoffM: 30000,
    formation: null,
  },
  {
    id: 'RUS-TAC-02',
    name: 'FPV direct attack and serial reattack',
    description:
      'FPV drones attack in pairs or small numbers with terrain masking, then reattack the same target set in series. Serial arrivals stress one defended point over minutes.',
    sourceRef: '5.4 RUS-TAC-02',
    platforms: [{ designator: FPV }],
    defaultShipCount: 8,
    shipsPerWave: 2,
    waveSpacingS: 120,
    axes: 1,
    axisSpreadDeg: 0,
    defaultBearingDeg: 0,
    standoffM: 8000,
    formation: { count: 2, shape: 'line', spacingM: 75 },
  },
  {
    id: 'RUS-TAC-03',
    name: 'Fiber-optic FPV in contested EW',
    description:
      'Fiber-optic FPV drones carry command and video on a physical fiber, so RF jamming does not sever operator control. RF detection or jamming success must not score as defeat.',
    sourceRef: '5.4 RUS-TAC-03 / 6.3 UKR-TAC-02',
    platforms: [{ designator: FIBER_FPV }],
    defaultShipCount: 5,
    shipsPerWave: 5,
    waveSpacingS: 120,
    axes: 1,
    axisSpreadDeg: 0,
    defaultBearingDeg: 0,
    standoffM: 15000,
    formation: { count: 5, shape: 'cluster', spacingM: 300 },
  },
  // ---- Ukraine, tactical systems (study 6.3) ----
  {
    id: 'UKR-TAC-01',
    name: 'RF FPV wave',
    description:
      'Low-cost RF FPV quadcopters carry small warheads with operator-in-the-loop terminal control. High sortie density and terminal dive, not a geometric shape, are the test drivers.',
    sourceRef: '6.3 UKR-TAC-01',
    platforms: [{ designator: FPV }],
    defaultShipCount: 8,
    shipsPerWave: 8,
    waveSpacingS: 60,
    axes: 1,
    axisSpreadDeg: 0,
    defaultBearingDeg: 0,
    standoffM: 8000,
    formation: { count: 8, shape: 'line', spacingM: 75 },
  },
  {
    id: 'UKR-TAC-03',
    name: 'Heavy night bomber',
    description:
      'Heavy multirotor bombers are slow, hover-capable, and used strongly at night. They drop munitions repeatedly rather than fly one-way.',
    sourceRef: '6.3 UKR-TAC-03 / TC-04',
    platforms: [{ designator: BOMBER }],
    defaultShipCount: 2,
    shipsPerWave: 2,
    waveSpacingS: 600,
    axes: 1,
    axisSpreadDeg: 0,
    defaultBearingDeg: 0,
    standoffM: 10000,
    formation: { count: 2, shape: 'column', spacingM: 1000 },
  },
  {
    id: 'UKR-TAC-04',
    name: 'ISR-to-strike hunter-killer team',
    description:
      'One reconnaissance UAS finds the target and a separate strike UAS is launched against it, with ISR staying on station for battle-damage assessment. The defender must correlate two tracks with different missions.',
    sourceRef: '6.3 UKR-TAC-04 / 3.4 pair',
    platforms: [
      { designator: ORLAN },
      { designator: CW15 },
      { designator: LANCET },
      { designator: FPV },
    ],
    defaultShipCount: 2,
    shipsPerWave: 1,
    waveSpacingS: 90,
    axes: 1,
    axisSpreadDeg: 0,
    defaultBearingDeg: 0,
    standoffM: 30000,
    formation: null,
  },
  {
    id: 'UKR-TAC-05',
    name: 'Direct-action multi-UAS attack',
    description:
      'Several near-concurrent strike drones attack one defended problem from different bearings to defeat C-UAS. The source gives no universal count, spacing, or shape.',
    sourceRef: '6.3 UKR-TAC-05 / T14',
    platforms: [{ designator: FPV }, { designator: FIBER_FPV }],
    defaultShipCount: 5,
    shipsPerWave: 5,
    waveSpacingS: 30,
    axes: 3,
    axisSpreadDeg: 120,
    defaultBearingDeg: 0,
    standoffM: 8000,
    formation: { count: 5, shape: 'cluster', spacingM: 300 },
  },
  // ---- Houthi, maritime (study 8.2) ----
  {
    id: 'HOU-TAC-01',
    name: 'Complex maritime mixed salvo',
    description:
      'On 9 January 2024, 18 one-way attack drones flew with 2 anti-ship cruise missiles and 1 anti-ship ballistic missile against Red Sea shipping. Build the 18 drone tracks and treat the missiles as concurrent fast contacts.',
    sourceRef: '8.2 HOU-TAC-01 / 17.3',
    platforms: [{ designator: SHAHED }],
    defaultShipCount: 18,
    shipsPerWave: 18,
    waveSpacingS: 300,
    axes: 2,
    axisSpreadDeg: 60,
    defaultBearingDeg: 0,
    standoffM: 60000,
    formation: { count: 18, shape: 'echelon', spacingM: 3000 },
  },
  // ---- Iran (study 7.3) ----
  {
    id: 'IRN-TAC-01',
    name: 'National-scale mixed salvo (Operation True Promise)',
    description:
      'On 13-14 April 2024 Iran launched more than 150 OWA drones with more than 140 cruise and ballistic missiles. Model a representative drone subset on multiple axes and treat the missiles as separate high-speed classes.',
    sourceRef: '7.3 / 17.2 / TC-11',
    platforms: [{ designator: SHAHED }],
    defaultShipCount: 20,
    shipsPerWave: 20,
    waveSpacingS: 300,
    axes: 3,
    axisSpreadDeg: 120,
    defaultBearingDeg: 0,
    standoffM: 80000,
    formation: { count: 20, shape: 'echelon', spacingM: 3000 },
  },
  // ---- Israel, close-in launch (study 12) ----
  {
    id: 'ISR-TAC-01',
    name: 'Close-in / internal launch against air defenses',
    description:
      'Small explosive UAS positioned inside or near the defended area strike air-defense radars and command nodes first. Perimeter range does not equal warning time.',
    sourceRef: '12 / TC-12',
    platforms: [{ designator: FPV }],
    defaultShipCount: 4,
    shipsPerWave: 4,
    waveSpacingS: 30,
    axes: 1,
    axisSpreadDeg: 0,
    defaultBearingDeg: 0,
    standoffM: 2000,
    formation: { count: 4, shape: 'cluster', spacingM: 500 },
  },
  // ---- Hamas / PIJ (study 10) ----
  {
    id: 'HAM-TAC-01',
    name: 'COTS drop attack on sensors and C2',
    description:
      'Commercial quadcopters drop munitions on observation towers, remote weapon stations, and communications nodes from close launch points. The threat is a mission kill against enabling nodes, with very short warning.',
    sourceRef: '10.1 / 10.2',
    platforms: [{ designator: MAVIC }, { designator: MINI }],
    defaultShipCount: 6,
    shipsPerWave: 6,
    waveSpacingS: 60,
    axes: 1,
    axisSpreadDeg: 0,
    defaultBearingDeg: 0,
    standoffM: 3000,
    formation: { count: 6, shape: 'line', spacingM: 300 },
  },
  // ---- Syria 2018 (study 15A) ----
  {
    id: 'SYR-TAC-01',
    name: 'Improvised preprogrammed multi-UAS base attack',
    description:
      'Thirteen rudimentary GPS-guided UAS flew more than 50 km on programmed paths in two groups against Russian bases in 2018. A low-cost coordinated raid, not collaborative autonomy.',
    sourceRef: '15A / TC-18',
    platforms: [{ designator: MUGIN }],
    defaultShipCount: 13,
    shipsPerWave: 13,
    waveSpacingS: 300,
    axes: 2,
    axisSpreadDeg: 40,
    defaultBearingDeg: 0,
    standoffM: 50000,
    formation: { count: 13, shape: 'echelon', spacingM: 2000 },
  },
  // ---- Saudi Arabia 2019 (study 15C) ----
  {
    id: 'SAU-TAC-01',
    name: 'Low-altitude mixed UAV and cruise-missile raid',
    description:
      'The 2019 Abqaiq and Khurais attack used at least 18 weaponized UAVs plus 7 cruise missiles against fixed oil infrastructure. Low-flying precision weapons exposed radar-horizon and 360-degree surveillance gaps.',
    sourceRef: '15C / TC-19',
    platforms: [{ designator: SHAHED }],
    defaultShipCount: 18,
    shipsPerWave: 18,
    waveSpacingS: 300,
    axes: 2,
    axisSpreadDeg: 60,
    defaultBearingDeg: 0,
    standoffM: 60000,
    formation: { count: 18, shape: 'echelon', spacingM: 3000 },
  },
  // ---- Turkiye 2020 (study 15B) ----
  {
    id: 'TUR-TAC-01',
    name: 'UCAV + EW + fires SEAD package',
    description:
      'Medium-altitude UCAVs integrate with electronic warfare and surface fires to suppress air defenses, as in Operation Spring Shield. Test the aircraft as part of a system of systems, not as an isolated track.',
    sourceRef: '15B / TC-17',
    platforms: [{ designator: TB2 }],
    defaultShipCount: 2,
    shipsPerWave: 2,
    waveSpacingS: 600,
    axes: 1,
    axisSpreadDeg: 0,
    defaultBearingDeg: 0,
    standoffM: 30000,
    formation: { count: 2, shape: 'column', spacingM: 3000 },
  },
  // ---- Generic geometry constructs (study 3.4 taxonomy) ----
  {
    id: 'GEN-SINGLETON',
    name: 'Singleton',
    description:
      'One UAS on an independent attack or reconnaissance mission. The baseline single-track case for any platform.',
    sourceRef: '3.4 singleton',
    platforms: [],
    defaultShipCount: 1,
    shipsPerWave: 1,
    waveSpacingS: 0,
    axes: 1,
    axisSpreadDeg: 0,
    defaultBearingDeg: 0,
    standoffM: 20000,
    formation: null,
  },
  {
    id: 'GEN-SERIAL',
    name: 'Small serial group',
    description:
      'Two or more UAS attack the same defended area sequentially. Repeated single arrivals stress reload, reattack handling, and crew endurance.',
    sourceRef: '3.4 small serial group',
    platforms: [],
    defaultShipCount: 3,
    shipsPerWave: 1,
    waveSpacingS: 120,
    axes: 1,
    axisSpreadDeg: 0,
    defaultBearingDeg: 0,
    standoffM: 15000,
    formation: null,
  },
  {
    id: 'GEN-WAVE',
    name: 'Single wave',
    description:
      'Multiple UAS arrive within one bounded attack interval. One compressed group tests simultaneous track capacity and weapons allocation.',
    sourceRef: '3.4 single wave',
    platforms: [],
    defaultShipCount: 8,
    shipsPerWave: 8,
    waveSpacingS: 0,
    axes: 1,
    axisSpreadDeg: 0,
    defaultBearingDeg: 0,
    standoffM: 30000,
    formation: null,
  },
  {
    id: 'GEN-STREAM',
    name: 'Multi-wave stream',
    description:
      'Several groups separated in time on one corridor, potentially changing route or altitude between waves. Sustained pressure rather than one salvo.',
    sourceRef: '3.4 multi-wave raid',
    platforms: [],
    defaultShipCount: 12,
    shipsPerWave: 4,
    waveSpacingS: 300,
    axes: 1,
    axisSpreadDeg: 0,
    defaultBearingDeg: 0,
    standoffM: 40000,
    formation: null,
  },
  {
    id: 'GEN-MULTI-AXIS',
    name: 'Multi-azimuth converging raid',
    description:
      'Tracks approach the defended area from different directions rather than one common axis. Tests sector coverage and directional-defense limits.',
    sourceRef: '3.4 multi-azimuth / converging raid',
    platforms: [],
    defaultShipCount: 6,
    shipsPerWave: 6,
    waveSpacingS: 0,
    axes: 3,
    axisSpreadDeg: 120,
    defaultBearingDeg: 0,
    standoffM: 40000,
    formation: null,
  },
  {
    id: 'GEN-STAGGERED',
    name: 'Staggered mass raid',
    description:
      'Tracks overlap in space but arrivals are deliberately distributed in time, extending the alert period. Timing, not shape, is the defining variable.',
    sourceRef: '3.4 overlapping-track / staggered raid',
    platforms: [],
    defaultShipCount: 20,
    shipsPerWave: 10,
    waveSpacingS: 180,
    axes: 2,
    axisSpreadDeg: 60,
    defaultBearingDeg: 0,
    standoffM: 60000,
    formation: { count: 10, shape: 'echelon', spacingM: 3000 },
  },
]

function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360
}

function resolveDesignator(designator: string, library: SpecModel[]): SpecModel | null {
  const d = designator.trim().toLowerCase()
  if (!d) return null
  const uasModels = library.filter((m) => m.kind === 'uas')
  // Seed id or exact name first.
  const exact = uasModels.find((m) => m.id.toLowerCase() === d || m.name.toLowerCase() === d)
  if (exact) return exact
  // Substring / family match in either direction.
  return uasModels.find((m) => {
    const n = m.name.toLowerCase()
    return n.includes(d) || d.includes(n)
  }) ?? null
}

/**
 * Resolve the tactic's primary platform against a spec library: the first
 * platform designator that matches a UAS model by seed id or exact name,
 * then by substring/family. Null for generic tactics or when nothing matches.
 */
export function resolvePlatform(t: ThreatTactic, library: SpecModel[]): SpecModel | null {
  for (const p of t.platforms) {
    const found = resolveDesignator(p.designator, library)
    if (found) return found
  }
  return null
}

/**
 * Fan `axes` ingress bearings symmetrically around `bearingDeg` across a
 * total spread of `spreadDeg`, each normalized to [0, 360). One axis returns
 * the bearing itself.
 */
export function fanAxes(bearingDeg: number, axes: number, spreadDeg: number): number[] {
  const n = Math.max(1, Math.floor(axes))
  if (n === 1) return [normalizeDeg(bearingDeg)]
  const step = spreadDeg / (n - 1)
  const start = bearingDeg - spreadDeg / 2
  return Array.from({ length: n }, (_, i) => normalizeDeg(start + i * step))
}
