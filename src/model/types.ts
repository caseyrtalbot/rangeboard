/**
 * RangeBoard domain model.
 * World coordinates are meters. +x is east, +y is south (screen-down).
 * Headings are degrees clockwise from north (up).
 */

import type { IntegrationConfidence, LinkMedium } from './integration'

export interface Vec2 {
  x: number
  y: number
}

export type EntityKind = 'sensor' | 'effector' | 'c2' | 'uas' | 'asset' | 'marker'

export type SensorType = 'radar' | 'eo-ir' | 'acoustic' | 'rf'

/** C-UAS sensor role in the detect/track/identify chain. */
export type SensorRole =
  | 'early-warning'
  | 'surveillance'
  | 'target-acquisition'
  | 'tracking'
  | 'fire-control'
  | 'classification'

export interface SensorSpec {
  sensorType: SensorType
  /** Absent on saves made before roles existed; defaultSensorRole fills in. */
  role?: SensorRole
  detectRangeM: number
  /** Range at which classification/track quality is assumed usable. */
  classifyRangeM: number | null
  /** 360 for omnidirectional. */
  sectorDeg: number
  /** [min, max] elevation coverage in degrees, null when unknown. */
  elevationDeg?: [number, number] | null
  /** Altitude coverage ceiling, feet. Null when unknown. */
  maxAltitudeFt?: number | null
  /** Minimum target separation the sensor splits into two tracks, meters. Null when unknown. */
  resolutionM?: number | null
}

/** Representative detect ranges by role, used when a system's WEZ is unknown. */
export const SENSOR_ROLE_DEFAULT_RANGE_M: Record<SensorRole, number> = {
  'early-warning': 40000,
  surveillance: 20000,
  'target-acquisition': 15000,
  tracking: 10000,
  'fire-control': 8000,
  classification: 5000,
}

export function defaultSensorRole(spec: SensorSpec): SensorRole {
  if (spec.role) return spec.role
  // Acoustic effective range is short (COURAGEOUS: ~100-300 m typical), so it
  // defaults to a close-in tracking role, not early warning.
  if (spec.sensorType === 'acoustic') return 'tracking'
  if (spec.sensorType === 'rf') return 'surveillance'
  if (spec.sensorType === 'eo-ir') return 'classification'
  return spec.detectRangeM >= 30000 ? 'early-warning' : 'tracking'
}

export type UasGroup = 1 | 2 | 3 | 4 | 5

/** How a threat responds to a successful jam (EW soft kill). */
export type JamBehavior = 'drift' | 'return-home' | 'continue'

export interface UasSpec {
  group: UasGroup
  airframe: 'quad' | 'fixed-wing' | 'vtol' | 'one-way-attack' | 'fpv'
  cruiseSpeedMps: number
  maxSpeedMps: number
  enduranceMin: number
  altBandFt: [number, number]
  /** 'fiber' = wire-guided: no RF emissions and immune to jamming. */
  navMode: 'gps' | 'inertial' | 'rf-manual' | 'optical' | 'fiber' | 'mixed'
  emissionsNote: string
  /** Operator control-link range, meters. Null when autonomous. */
  controlLinkRangeM?: number | null
  /** Typical mission radius from launch, meters. */
  operatingRadiusM?: number | null
  /** Combat-observed employment radius in calm air, meters. Outranks operatingRadiusM. */
  combatRadiusM?: number | null
  /** True when flown one-way (no return leg budgeted). Defaults by airframe. */
  oneWay?: boolean
  /** Observed range-affecting combat modifications (batteries, relays, fiber spools). */
  rangeNote?: string
  /** Response to a successful jam. Absent on old saves; defaultJamBehavior fills in. */
  jamBehavior?: JamBehavior
  /**
   * Warhead mass, kg, from the threat study (docs/threat). Null when the study
   * gives no public figure. Never invented to fill the blank.
   */
  warheadKg?: number | null
  /**
   * PLANNING FACTOR effect radius, meters, for T&E laydown work. The study
   * explicitly declines to compute lethal blast radii or fragmentation fans
   * (section 18.1), so this is a representative tier value from
   * weaponFactors.ts, not study-derived lethality data. Null when unknown.
   */
  effectRadiusM?: number | null
  /**
   * Munition-release standoff from the target, meters, for platforms that
   * release weapons and return (UCAV, bomber). Null when no number is
   * supported.
   */
  standoffRangeM?: number | null
  /**
   * Drives the WEZ kind: 'impact' = OWA/kamikaze effect circle at the impact
   * point, 'standoff' = release ring around the platform, 'none' = ISR/decoy
   * (no weapon zone). Absent on old saves; defaultWeaponProfile fills in.
   */
  weaponProfile?: 'impact' | 'standoff' | 'none'
}

/**
 * Jam response when the spec does not set one. Mixed-nav threats fall back to
 * an unjammed mode and press on; GNSS- or link-reliant threats lose guidance
 * and drift off the approach. Only meaningful for jammable nav modes.
 */
export function defaultJamBehavior(uas: UasSpec): JamBehavior {
  if (uas.jamBehavior) return uas.jamBehavior
  return uas.navMode === 'mixed' ? 'continue' : 'drift'
}

export interface EffectorSpec {
  effectorType: 'interceptor' | 'jammer' | 'gun' | 'de' | 'hpm' | 'net'
  minRangeM: number
  maxRangeM: number
  /** Engagement altitude ceiling, feet. Null when unknown. */
  maxAltitudeFt?: number | null
  /** Azimuth coverage in degrees. Absent means 360 (omni/trainable). */
  sectorDeg?: number
  /** Seconds from assignment to effect at a target inside the envelope. */
  engageTimeS: number
  /** Single-shot probability of kill, 0..1. Absent on old saves; attrition uses a type baseline. */
  pk?: number
  /** Rounds or interceptors carried. Absent means unlimited (jammers, DE, HPM). */
  magazineSize?: number
  /** Seconds between salvos at the same or the next target. Absent: type baseline. */
  salvoCooldownS?: number
}

/** Threat employment intent, carried by threat/UAS models for cards and playback. */
export interface ThreatProfile {
  designator: string
  routeIntent: string
  altitudeFt: number
  speedMps: number
  count: number
}

/** A library model. Exactly one of sensor/uas/effector is set (c2/asset/marker have none). */
export interface SpecModel {
  id: string
  name: string
  kind: EntityKind
  description: string
  color: string
  builtin: boolean
  sensor?: SensorSpec
  uas?: UasSpec
  effector?: EffectorSpec
  threatProfile?: ThreatProfile
}

export type FormationShape = 'line' | 'wedge' | 'column' | 'echelon' | 'cluster'

/** Multi-ship formation carried by one UAS entity. The entity is the lead ship. */
export interface FormationSpec {
  count: number
  shape: FormationShape
  spacingM: number
}

export interface Entity {
  id: string
  name: string
  kind: EntityKind
  specId: string | null
  pos: Vec2
  headingDeg: number
  color: string | null
  notes: string
  /** False excludes the entity from detection and kill-chain analysis. Absent means true. */
  enabled?: boolean
  /** Placement group id shared by components placed from one system preset. */
  systemId?: string | null
  /** UAS only: swarm/formation configuration. */
  formation?: FormationSpec | null
  /** UAS only: draw the wind-adjusted range ring for this drone. */
  showRange?: boolean
  /**
   * Asset only: protected-boundary radius, meters. A threat inside it counts
   * as ARRIVED at the asset (`ThreatAssessment.arrivalS` in sim.ts), which is
   * what separates a defeat that protected the asset from one that landed too
   * late. Absent or null means the DEFAULT_DEFENDED_RADIUS_M planning factor.
   */
  defendedRadiusM?: number | null
}

/** True unless the entity was explicitly disabled. */
export function entityActive(e: Entity): boolean {
  return e.enabled !== false
}

export interface Connection {
  id: string
  fromId: string
  toId: string
  label: string
  // Typed-integration fields. All absent on old saves and hand-drawn links.
  medium?: LinkMedium | null
  confidence?: IntegrationConfidence | null
  note?: string
  /** Per-hop latency planning factor, seconds. Absent means 0. */
  latencyS?: number
}

export type BoundaryType = 'range' | 'restricted' | 'asset' | 'corridor'

export interface Boundary {
  id: string
  name: string
  type: BoundaryType
  points: Vec2[]
  closed: boolean
  /** Airspace floor/ceiling labels, shown in airspace mode. */
  altBandFt: [number, number] | null
}

export interface FlightPath {
  id: string
  entityId: string
  points: Vec2[]
  /** Overrides the UAS spec cruise speed when set. */
  speedMps: number | null
  startDelayS: number
}

export type RunValidity = 'valid' | 'valid-limited' | 'invalid' | 'pending'

export interface RunLogEntry {
  id: string
  runId: string
  validity: RunValidity
  result: string
  deviations: string
}

export interface TestCard {
  id: string
  cardId: string
  version: string
  campaign: string
  questionIds: string
  customerQuestion: string
  purpose: string
  hypothesis: string
  configuration: string
  threatProfile: string
  independentVars: string
  controlledVars: string
  covariates: string
  measures: string[]
  procedure: string[]
  thresholds: string
  abortCriteria: string
  expectedResults: string
  linkedEntityIds: string[]
  runs: RunLogEntry[]
}

export type BasemapMode = 'canvas' | 'sat' | 'airspace'

export interface FrameSnap {
  id: string
  name: string
  camera: { x: number; y: number; scale: number }
  simTimeS: number
  basemap: BasemapMode
}

/** Geographic anchor of the world origin for the satellite tile basemap. */
export interface GeoRef {
  lat: number
  lon: number
}

export interface Underlay {
  dataUrl: string | null
  /** World position of the image top-left corner, meters. */
  pos: Vec2
  /** World width of the image, meters (height follows aspect ratio). */
  widthM: number
  naturalW: number
  naturalH: number
  opacity: number
}

/** One placed component of a system preset. */
export interface SystemComponent {
  specId: string
  /** Offset from the system drop point, world meters. */
  offsetM: Vec2
  headingDeg: number
  /** Role of this component inside the system, for the inspector and tooltips. */
  purpose: string
}

/**
 * A composable IADS / C-UAS system: dropping it places every component as an
 * entity (sharing one systemId) and creates the kill-chain connections in
 * `links` (index pairs into `components`).
 */
export interface SystemPreset {
  id: string
  name: string
  description: string
  builtin: boolean
  components: SystemComponent[]
  links: Array<[number, number]>
}

export type Precipitation = 'clear' | 'rain' | 'fog'
export type LightLevel = 'day' | 'night'
export type EmBackground = 'rural' | 'urban'

/** Scenario-wide covariates that modify UAS range estimates and sensor performance. */
export interface EnvironmentSpec {
  windSpeedMps: number
  /** Direction the wind blows FROM, degrees true. */
  windFromDeg: number
  temperatureC: number
  fieldElevationFt: number
  /** Absent on old saves; treat as 'clear'. Derates radar, EO/IR, and acoustic. */
  precipitation?: Precipitation
  /** Absent on old saves; treat as 'day'. Night derates EO/IR detection. */
  light?: LightLevel
  /** Absent on old saves; treat as 'rural'. Urban EM clutter derates RF and radar. */
  emBackground?: EmBackground
  /** When false, all rings and analysis use calm standard-day performance. */
  apply: boolean
}

/**
 * Legacy track-quality gate, replaced by `Roe`. Kept only so old saves parse;
 * persist migration maps 'detected' -> 'free' and 'confirmed' -> 'tight'.
 */
export type EngagePolicy = 'detected' | 'confirmed'

/**
 * Rules of engagement posture.
 * 'hold' = analysis only, no engagement windows.
 * 'tight' = engage tracks classified hostile.
 * 'free' = engage on first detection.
 */
export type Roe = 'hold' | 'tight' | 'free'

/** Weights (0-5) and normalized scores (0-1) share this shape. */
export interface McdaVector {
  warning: number
  coverage: number
  confirm: number
  engage: number
  /** Attrition part: expected kill fraction of the raid. Absent on old saves and old pins. */
  attrition?: number
}

/** One raid wave: UAS entities that launch together after a shared delay. */
export interface RaidWave {
  startDelayS: number
  entityIds: string[]
}

/** Raid schedule: ordered waves with per-wave launch delays. */
export interface RaidPlan {
  waves: RaidWave[]
}

/**
 * Compact per-threat AAR outcome label, derived from the expected-value math:
 * 'not-engaged' = no salvo of any expenditure channel (kinetic, directed
 * energy, or EW); 'leaker' = engaged but more likely than not to arrive;
 * otherwise the dominant kill channel ('hard-kill' vs 'soft-kill').
 */
export type AarOutcome = 'hard-kill' | 'soft-kill' | 'leaker' | 'not-engaged'

/**
 * Leaker engagement-potential tier (I&W). Canonical thresholds and the
 * derivation live in src/analysis/impact.ts, which re-exports this type.
 */
export type ImpactSeverity = 'low' | 'moderate' | 'severe'

/** One threat's timeline row in the AAR: detect, classify, engage, outcome. */
export interface AarThreatRow {
  uasId: string
  /** Name at summary time; the entity may be gone when a pin is compared. */
  name: string
  shipCount: number
  detectS: number | null
  detectSensorName: string | null
  /** Derived classification ladder timestamps (null = never reached). */
  unknownAtS: number | null
  suspectedAtS: number | null
  hostileAtS: number | null
  /** First salvo of any expenditure channel at this threat; null when never engaged. */
  engageS: number | null
  /** Kinetic salvos (interceptor, gun, net) at this threat. */
  shotsFired: number
  /**
   * Directed-energy bursts (DE, HPM) at this threat. Absent on pins made
   * before the three-way expenditure split; read it as `deSalvos ?? 0`.
   */
  deSalvos?: number
  /** EW salvos (jammer) at this threat. Absent on pins made before the split. */
  jamSalvos?: number
  expectedHardKills: number
  expectedSoftKills: number
  leakProbability: number
  outcome: AarOutcome
  /** Dominant killer's name at summary time; null when no kills. */
  killedByName: string | null
  // Engagement-potential (I&W) fields. All optional: pinned scorecards made
  // before they existed still parse and render, no storage key bump.
  /** Defended asset name at summary time; null when no asset is placed. */
  assetName?: string | null
  /** Arrival (closest approach) at the defended asset, sim seconds. */
  arrivalS?: number | null
  /** True when the asset sits inside the threat's WEZ at arrival. */
  assetInWez?: boolean
  /** shipCount * leakProbability: expected ships arriving. */
  expectedShipsArriving?: number
  /** expectedShipsArriving * warheadKg; 0 when the warhead mass is unknown. */
  expectedWarheadKg?: number
  /** I&W severity tier; null when nothing warns. */
  impactSeverity?: ImpactSeverity | null
}

/**
 * One effector's expenditure ledger in the AAR. Expenditure splits three ways
 * by effector class, independently of the kill channel: kinetic rounds
 * (interceptor, gun, net), directed-energy bursts (DE, HPM), and EW salvos
 * (jammer). A DE or HPM burst is a hard kill that fires no round, so it never
 * belongs in shotsFired.
 */
export interface AarEffectorShots {
  effectorId: string
  name: string
  effectorType: EffectorSpec['effectorType'] | null
  /** Kinetic salvos; 0 for DE, HPM, and jammers (see deSalvos, jamSalvos). */
  shotsFired: number
  /**
   * Directed-energy bursts; 0 for every other effector class. Absent on pins
   * made before the three-way split; read it as `deSalvos ?? 0`.
   */
  deSalvos?: number
  /** EW salvos (jammer). Absent on pins made before the expenditure split. */
  jamSalvos?: number
  /** Null = unlimited magazine (jammers, DE, HPM). */
  expectedRoundsRemaining: number | null
  magazineSize: number | null
}

/**
 * Derived after-action summary of one configuration against the raid.
 * Self-contained (names captured, no entity references needed) and small, so
 * a pinned scorecard can store it and render it after the laydown changes.
 */
export interface AarSummary {
  roe: Roe
  raidSize: number
  /** Pre-arrival hard-kill mass: destruction that defended the asset. */
  expectedHardKills: number
  /** Pre-arrival soft-kill (jam) mass: mission kills that ended the approach. */
  expectedSoftKills: number
  /** DEFEATS: expectedHardKills + expectedSoftKills. */
  expectedKills: number
  /**
   * UNDEFEATED ships: the ships the defence did not defeat before arrival.
   * It is the leaker bucket plus the never-arrived bucket, because this
   * pinned shape has always carried one combined figure. It claims only "not
   * defeated", never "reached an asset". expectedNoArrival splits the second
   * bucket out; AttritionTotals.reportedLeakers is the measurable leaker
   * count. Absent on no pin: the field predates the split.
   */
  expectedLeakers: number
  /**
   * Ships neither defeated nor arrived: a fly-by that turned away short, or a
   * run with no defended asset placed at all. Part of expectedLeakers, so
   * expectedLeakers minus this is the arrived-undefeated mass. Absent on pins
   * made before the arrival split; read it as `expectedNoArrival ?? null`.
   */
  expectedNoArrival?: number
  /**
   * Kill mass whose effect landed strictly after the threat was already over
   * the defended asset. Real destruction that did not protect the asset, so
   * it is NEVER a defeat: it is a sub-measure of the undefeated mass, not a
   * deduction from it. Absent on pins made before the arrival split.
   */
  expectedLateKills?: number
  /** Mean per-ship undefeated fraction over the raid; null when the raid is empty. */
  leakProbability: number | null
  /** Earliest detection of any threat, sim seconds; null = never. */
  firstDetectS: number | null
  /** Earliest salvo of any channel at any threat, sim seconds; null = never. */
  firstShotS: number | null
  /** Kinetic salvos (interceptor, gun, net) only. */
  shotsFired: number
  /**
   * Directed-energy bursts (DE, HPM). Absent on pins made before the
   * three-way expenditure split; read it as `deSalvos ?? 0`.
   */
  deSalvos?: number
  /** EW salvos (jammer). Absent on pins made before the expenditure split. */
  jamSalvos?: number
  effectors: AarEffectorShots[]
  threats: AarThreatRow[]
}

/** A pinned scorecard result for comparing IADS configurations. */
export interface ScorecardSnap {
  id: string
  name: string
  /** Weighted 0-100 total at pin time. */
  score: number
  parts: McdaVector
  /** Full AAR summary at pin time. Absent on pins made before WS5. */
  aar?: AarSummary
}

/**
 * Test-defined pass criteria for the requirement gates. These are the numbers
 * the test asks the system to meet, so they belong to the scenario, not to the
 * engine. A gate threshold must never be an engine constant: the attrition
 * model stops firing at SHIP_DEAD_BELOW, so a requirement set to that same
 * value passes itself by construction.
 */
export interface RequirementThresholds {
  /**
   * Largest residual (per-ship survival at arrival) a track may hold and still
   * pass the Effect gate. 0..1. Read as "no more than this share of any one
   * track survives".
   */
  maxResidualPerTrack: number
  /**
   * Smallest acceptable early-warning time, seconds: first detection to
   * arrival at the defended asset. Null means the test sets no warning
   * requirement, so the Detect gate scores detection only.
   */
  minWarningS: number | null
}

/**
 * Default requirement thresholds for a new scenario. maxResidualPerTrack is
 * deliberately NOT the engine's SHIP_DEAD_BELOW cutoff.
 */
export const DEFAULT_REQUIREMENT_THRESHOLDS: RequirementThresholds = {
  maxResidualPerTrack: 0.1,
  minWarningS: null,
}

export interface Scenario {
  schemaVersion: 1
  name: string
  library: SpecModel[]
  systemPresets: SystemPreset[]
  environment: EnvironmentSpec
  /** Legacy field; persist migration maps it to `roe`. Never written anymore. */
  engageOn?: EngagePolicy
  /** Absent on old saves; migrated from engageOn on load, default 'tight'. */
  roe?: Roe
  /** MCDA scorecard weights, 0-5 each. Absent on old saves. */
  mcdaWeights?: McdaVector
  /** Pinned scorecard results. Absent on old saves. */
  scorecards?: ScorecardSnap[]
  /** Raid wave schedule. Absent on old saves; treat as no waves. */
  raid?: RaidPlan
  /** Requirement pass criteria. Filled from the defaults on old saves. */
  requirements: RequirementThresholds
  entities: Entity[]
  connections: Connection[]
  boundaries: Boundary[]
  paths: FlightPath[]
  testCards: TestCard[]
  frames: FrameSnap[]
  underlay: Underlay
  /** Lat/lon of world (0,0) for satellite tiles. Null until the user sets one. */
  geoRef: GeoRef | null
}

let counter = 0

/** Unique id: timestamp + counter, safe for local single-user use. */
export function newId(prefix: string): string {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`
}
