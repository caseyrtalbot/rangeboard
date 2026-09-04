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
  /** Antenna phase-center height above ground, meters. Absent: MOUNT_HEIGHT_M (PF). */
  mountHeightM?: number | null
  /** Minimum target separation the sensor splits into two tracks, meters. Null when unknown. */
  resolutionM?: number | null
  /**
   * Radar only: the target RCS, m2, at which detectRangeM is quoted. Absent
   * means RADAR_REF_RCS_M2 (the Group 1 small-UAS planning factor) in
   * src/model/rcsFactors.ts. Detection range against another target scales
   * with the fourth root of the RCS ratio (radar range equation).
   */
  refRcsM2?: number | null
  /**
   * Maximum reported range, meters: a radar's instrumented range, or the
   * top of a vendor's stated detection band for any other type. Caps the
   * target-scaled detect range: no target is reported beyond it however
   * large or loud it is. Null when the public record gives no figure (no cap).
   */
  instrumentedRangeM?: number | null
  /** Radar only: Pd at which detectRangeM is quoted against refRcsM2. Absent: PLACARD_PD (PF). */
  placardPd?: number | null
  /** Radar only: false-alarm probability the placard assumes. Absent: PLACARD_PFA (PF). */
  pfa?: number | null
  /**
   * Doctrine: continuous hold this sensor needs to initiate a stable track
   * file, seconds. Absent: the TRACK_INIT_S role table in doctrineFactors.ts.
   */
  trackInitS?: number
  /**
   * Radar only: scan or frame period, seconds. Present and positive: track
   * initiation and drop follow the scan model (M-of-N over scans, coast on
   * a miss). Absent or null: the TRACK_INIT_S role table governs initiation
   * and the sensor holds per sample.
   */
  updateRateS?: number | null
  /** M-of-N track initiation, scans that must detect. Absent: TRACK_INIT_M (PF). */
  trackInitM?: number
  /** M-of-N track initiation, scans in the window. Absent: TRACK_INIT_N (PF). */
  trackInitN?: number
  /** Consecutive missed scans before a coasting track drops. Absent: TRACK_DROP_MISSES (PF). */
  trackDropMisses?: number
  /**
   * EO/IR only: the target characteristic dimension, meters, at which
   * detectRangeM is quoted. Absent means SPAN_PLANNING_M[1] (Group 1) in
   * src/model/signatureFactors.ts. Range against another target scales
   * linearly with the span ratio (Johnson criteria).
   */
  refSpanM?: number | null
  /** EO/IR only: imaging band. Absent means 'dual' (visible by day, thermal at night). */
  eoBand?: EoBand
  /**
   * Acoustic only: the broadband source level, dB re 20 uPa at 1 m, that
   * detectRangeM is quoted against. Absent means ACOUSTIC_PLANNING_DB[1].
   */
  refAcousticDb?: number | null
  /** RF only: link bands the receiver covers. Absent means every band. */
  rfBands?: JamBand[]
  /**
   * RF only: a vendor-published urban-background detect range, meters. When
   * set and the environment is urban it replaces detectRangeM times the
   * generic urban multiplier for this sensor. Null when not published.
   */
  urbanRangeM?: number | null
  /**
   * Where detectRangeM comes from. 'sourced' (default): a datasheet figure
   * conditioned on a reference target, so target scaling (RCS, span, source
   * level) applies. 'planning': a role-table or representative figure with no
   * stated target, so no physics runs on it and target scaling returns 1.
   */
  rangeBasis?: RangeBasis
}

/** EO/IR imaging band. */
export type EoBand = 'visible' | 'thermal' | 'dual'

/** Detect-range provenance; see SensorSpec.rangeBasis. */
export type RangeBasis = 'sourced' | 'planning'

/**
 * Radar target fluctuation model (Swerling, 1960): 0 = non-fluctuating,
 * 1 = many equal scatterers, scan-to-scan decorrelated (chi-square, 2 dof),
 * 3 = one dominant scatterer plus small ones (chi-square, 4 dof). Cases 2
 * and 4 are pulse-to-pulse variants that a single-scan Pd does not separate.
 */
export type SwerlingCase = 0 | 1 | 3

/** Pd at which a radar placard range is quoted when the source states none. PF. */
export const PLACARD_PD = 0.5

/** False-alarm probability a radar placard assumes when the source states none. PF. */
export const PLACARD_PFA = 1e-6

/** Fluctuation case of the placard's reference target (a Group 1 multirotor), PF until slice 9 verifies a datasheet. */
export const PLACARD_SWERLING: SwerlingCase = 1

/** Scans that must detect inside the M-of-N window to initiate a track. PF. */
export const TRACK_INIT_M = 3

/** Scans in the M-of-N track initiation window. PF. */
export const TRACK_INIT_N = 5

/** Consecutive missed scans after which a coasting track drops. PF. */
export const TRACK_DROP_MISSES = 5

/** Thermal contrast class of a threat airframe; see UasSpec.irSignature. */
export type IrSignature = 'low' | 'medium' | 'high'

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

/**
 * RF bands the EW model reasons about. GNSS is the navigation band; the rest
 * are the common sUAS control/video link bands. Coarse by design: this is a
 * planning-factor model, not a spectrum survey.
 */
export type JamBand = 'gnss' | 'uhf-433' | 'ism-915' | 'ism-2400' | 'ism-5800'

export const JAM_BANDS: JamBand[] = ['gnss', 'uhf-433', 'ism-915', 'ism-2400', 'ism-5800']

export const JAM_BAND_LABEL: Record<JamBand, string> = {
  gnss: 'GNSS',
  'uhf-433': '433 MHz',
  'ism-915': '915 MHz',
  'ism-2400': '2.4 GHz',
  'ism-5800': '5.8 GHz',
}

export interface UasSpec {
  group: UasGroup
  /**
   * PLANNING FACTOR radar cross section, m2 (X/Ku-band, nose-on class
   * value). The threat study lists RCS by aspect and frequency as a data gap
   * (section 18), so this is a representative tier value from
   * src/model/rcsFactors.ts or a sourced datasheet class, never measured
   * signature data. Absent means the group tier.
   */
  rcsM2?: number | null
  /** Fluctuation model. Absent: SWERLING_BY_AIRFRAME[airframe] (PF). */
  swerling?: SwerlingCase | null
  /**
   * PLANNING FACTOR characteristic dimension, meters: wingspan, or the
   * motor-to-motor diagonal for a multirotor. Sets each EO/IR sensor's range
   * against this threat by the Johnson criteria (linear in the span ratio).
   * Absent means the group tier in src/model/signatureFactors.ts.
   */
  spanM?: number | null
  /**
   * Thermal contrast class. Absent means the airframe default in
   * src/model/signatureFactors.ts: electric multirotor/FPV/VTOL low,
   * fixed-wing and one-way-attack (engine) high.
   */
  irSignature?: IrSignature
  /**
   * PLANNING FACTOR broadband acoustic source level, dB re 20 uPa at 1 m.
   * Sets each acoustic sensor's range against this threat by spherical
   * spreading plus atmospheric absorption. Absent means the group tier.
   */
  acousticDb?: number | null
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
   * RF bands this threat depends on (navigation and control/video links).
   * Absent means the nav-mode default in src/analysis/ewPhysics.ts.
   */
  linkBands?: JamBand[]
  /**
   * Extra J/S margin, dB, a jammer must overcome against this threat
   * (frequency hopping, directional link antennas). Absent means 0.
   */
  jamResistDb?: number
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

/**
 * Fluctuation case by airframe when the model states none. PF: a multirotor
 * or a small body returns many comparable scatterers (Swerling 1); a fixed
 * wing carries one dominant scatterer, the fuselage or engine (Swerling 3).
 */
export const SWERLING_BY_AIRFRAME: Record<UasSpec['airframe'], SwerlingCase> = {
  quad: 1,
  vtol: 1,
  'one-way-attack': 1,
  fpv: 1,
  'fixed-wing': 3,
}

export interface EffectorSpec {
  effectorType: 'interceptor' | 'jammer' | 'gun' | 'de' | 'hpm' | 'net'
  minRangeM: number
  maxRangeM: number
  /** Engagement altitude ceiling, feet. Null when unknown. */
  maxAltitudeFt?: number | null
  /** Launcher or emitter height above ground, meters. Absent: MOUNT_HEIGHT_M (PF). */
  mountHeightM?: number | null
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
  /** Jammer only: bands the transmitter covers. Absent means every band (legacy). */
  jamBands?: JamBand[]
  /** Jammer only: transmit EIRP, watts. Absent means rated power (no derate). */
  eirpW?: number
  /**
   * Jammer only: the EIRP at which maxRangeM (the placard range) holds.
   * eirpW below this shrinks the effective jam range by sqrt(eirpW/ratedEirpW)
   * (free-space inverse square). Absent means eirpW is the rated power.
   */
  ratedEirpW?: number
  /**
   * Doctrine: battle-damage-assessment dwell after this effector's salvo
   * takes effect, seconds. Absent: the BDA_S type table in doctrineFactors.ts.
   */
  bdaS?: number
  /**
   * Doctrine: hold fire until predicted per-shot Pk reaches this. Absent:
   * the PK_COMMIT type table in doctrineFactors.ts.
   */
  commitPk?: number
  /**
   * Doctrine: weapon assignment and firing-solution dwell (the TARGET step)
   * from engagement authority to release-ready, seconds. Absent: the
   * TARGET_S type table in doctrineFactors.ts.
   */
  targetS?: number
  /** Kinetic only: average interceptor or round speed to the target, m/s. Absent: no flyout term. */
  flyoutSpeedMps?: number | null
}

/**
 * Height of a sensor phase center or an effector launcher above ground,
 * meters, when the model does not state one. Planning factor: a vehicle or
 * short-mast C-UAS system sits about this high. Override per model with
 * SensorSpec.mountHeightM or EffectorSpec.mountHeightM.
 */
export const MOUNT_HEIGHT_M = 4

/** Phase-center or launcher height of one spec, meters: the recorded value, else MOUNT_HEIGHT_M. */
export function mountHeightOf(spec: { mountHeightM?: number | null }): number {
  const h = spec.mountHeightM
  return h != null && Number.isFinite(h) && h >= 0 ? h : MOUNT_HEIGHT_M
}

/** Threat employment intent, carried by threat/UAS models for cards and playback. */
export interface ThreatProfile {
  designator: string
  routeIntent: string
  altitudeFt: number
  speedMps: number
  count: number
}

/**
 * Epistemic spread of one planning factor around its nominal value. Lognormal
 * for multiplicative quantities (RCS, ranges, power), triangular for additive
 * bounds (latencies, dwells), beta for a probability stated as successes over
 * trials (Pk, placard Pd).
 */
export type Spread =
  | { kind: 'lognormal'; sigmaDb: number }
  | { kind: 'triangular'; lo: number; hi: number }
  | { kind: 'beta'; successes: number; trials: number }

/** One provenance row. `field` is the SensorSpec / UasSpec / EffectorSpec key it covers. */
export interface Provenance {
  field: string
  value: string
  source: string
  url?: string | null
  /** ISO date the source was read. */
  date: string
  basis: 'datasheet' | 'reference' | 'pf'
  /** Spread of the value. Absent: the PF spread table by field. Null: fixed (pinned). */
  spread?: Spread | null
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
  /** Where each placard value comes from. A field with no row is a planning factor. */
  provenance?: Provenance[]
}

/** Basis for one field: the provenance row, else 'pf'. */
export function basisFor(model: SpecModel, field: string): Provenance['basis'] {
  return model.provenance?.find((row) => row.field === field)?.basis ?? 'pf'
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
  /** UAS only: flight altitude, feet AGL, constant along the path. Absent: seeded on placement. */
  altitudeFt?: number | null
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
  /**
   * Meteorological visibility, meters. Caps EO/IR range (Koschmieder: the
   * range where a high-contrast target falls to the 2 percent contrast
   * threshold). Null derives it from precipitation (VISIBILITY_BY_PRECIP).
   */
  visibilityM?: number | null
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

/**
 * Launch-point policy: WHERE in the effector envelope a shot is released once
 * the doctrinal sequence has authorized it. Every policy still requires a
 * positive predicted Pk, and every policy fires no later than the deadline
 * that preserves `opportunities` engagement cycles before arrival (a closing
 * in-range window is its own deadline). Test-and-evaluation use of each:
 *   'max-range'      release at the first in-envelope opportunity. Exercises
 *                    the maximum engagement range; Pk pays the full falloff.
 *   'range-fraction' release once the intercept point is inside
 *                    launchRangeFraction x max range (planning default 2/3,
 *                    the effective-range rule of thumb). Exercises a
 *                    mid-envelope shot with margin for a re-attack.
 *   'pk-commit'      release once predicted per-shot Pk reaches the
 *                    effector's commit Pk (doctrineFactors PK_COMMIT, spec
 *                    override commitPk). Quality firing solution first.
 *   'latest'         hold to the deadline itself: the last launch that still
 *                    preserves the re-engagement depth. Exercises the
 *                    minimum-range / last-chance shot.
 */
export type LaunchPolicy = 'max-range' | 'range-fraction' | 'pk-commit' | 'latest'

/**
 * Doctrinal fire-control settings: detect -> track -> identify -> target ->
 * engage -> assess. Enabled (the default), the engine runs the sequence:
 *   TRACK. A shot needs a STABLE FIRE-CONTROL TRACK (a radar or EO/IR sensor
 *   holding the track continuously for its track initiation time; RF and
 *   acoustic hits cue but cannot build a firing solution).
 *   IDENTIFY. Hostile identification on the classification ladder, then a
 *   declareHostileS operator dwell after both. ROE 'free' vs 'tight' no longer
 *   changes the gate (both require the declaration); 'hold' still blocks.
 *   TARGET. The declared track is routed to a shooter (kill-chain hop
 *   latency) and that shooter needs its weapon assignment and firing
 *   solution dwell (targetS; per type in doctrineFactors TARGET_S, spec
 *   override EffectorSpec.targetS). The effector is release-ready only then.
 *   ENGAGE. Shoot-look-shoot: one kill salvo in flight per ship, and among
 *   effectors able to shoot the best predicted per-shot Pk wins. The
 *   launchPolicy decides where in the envelope the shot is released; the
 *   deadline that preserves `opportunities` full engagement cycles (engage
 *   time + BDA) before arrival forces the shot regardless of policy.
 *   ASSESS. A bdaS battle-damage-assessment dwell after each effect before
 *   anyone re-engages that ship.
 * Disabled = legacy instant release: the ROE gate alone opens the window and
 * every ready effector volleys until the target is expected dead. Keep it for
 * regression comparison, not for planning.
 * All values are planning factors, editable per scenario. trackFirmS,
 * targetS, bdaS and pkCommit are the UNIFORM fallbacks: with doctrine
 * enabled the engine derives per-system values instead (spec override, else
 * the role/type tables in src/analysis/doctrineFactors.ts, else these), and
 * links with no latencyS are charged the doctrineFactors default hop latency.
 */
export interface FireDoctrine {
  enabled: boolean
  /** Continuous radar / EO-IR hold needed for a stable track file, seconds. */
  trackFirmS: number
  /** Operator dwell from hostile ID (with firm track) to weapons release, s. */
  declareHostileS: number
  /** Weapon assignment + firing-solution dwell (TARGET step) fallback, seconds. */
  targetS: number
  /** Battle-damage-assessment dwell after a salvo's effect, seconds. */
  bdaS: number
  /** Hold fire until predicted per-shot Pk reaches this, deadline permitting. */
  pkCommit: number
  /** Engagement cycles to preserve before arrival (shoot-look-shoot depth). */
  opportunities: number
  /** Where in the envelope a shot is released once authorized. */
  launchPolicy: LaunchPolicy
  /** 'range-fraction' policy: release inside this fraction of max range (0-1). */
  launchRangeFraction: number
}

export const DEFAULT_FIRE_DOCTRINE: FireDoctrine = {
  enabled: true,
  trackFirmS: 5,
  declareHostileS: 10,
  targetS: 5,
  bdaS: 10,
  pkCommit: 0.35,
  opportunities: 2,
  launchPolicy: 'pk-commit',
  launchRangeFraction: 2 / 3,
}

/** Scenario doctrine with defaults filled for fields older saves lack. */
export function effectiveDoctrine(scenario: { doctrine?: FireDoctrine }): FireDoctrine {
  return { ...DEFAULT_FIRE_DOCTRINE, ...scenario.doctrine }
}

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
  /** Lens preset the run was observed under; absent on pins made before slice 6. */
  observedPresetId?: string | null
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
  /** Single-scan Pd at which a radar contact counts as DETECT. */
  pdDetect: number
  /** M-of-N cumulative probability at which a radar contact counts as TRACK. */
  pdTrackCumulative: number
}

/**
 * Default requirement thresholds for a new scenario. maxResidualPerTrack is
 * deliberately NOT the engine's SHIP_DEAD_BELOW cutoff.
 */
export const DEFAULT_REQUIREMENT_THRESHOLDS: RequirementThresholds = {
  maxResidualPerTrack: 0.1,
  minWarningS: null,
  pdDetect: 0.5,
  pdTrackCumulative: 0.9,
}

/** Engine run mode: expected-value arithmetic, or seeded replicate draws. */
export type RunMode = 'deterministic' | 'monte-carlo'

/** Seed of a fresh scenario. Fixed so an old save refilled by fillScenario keeps one seed. */
export const DEFAULT_SEED = 4821

/** Replicate count of a fresh scenario. */
export const DEFAULT_REPLICATES = 100

export interface Scenario {
  schemaVersion: 1
  name: string
  library: SpecModel[]
  systemPresets: SystemPreset[]
  /**
   * Builtin model and preset ids the user deleted. The load-time seed merge
   * skips them, so a deleted seed stays deleted. Absent on old saves = none.
   */
  deletedSeedIds?: string[]
  /** Lens preset id active when the current run was reset or started. Null before any run. */
  observedPresetId?: string | null
  /** Run mode. Absent on old saves = deterministic. */
  runMode?: RunMode
  /** Monte Carlo base seed; replicate i uses seed + i. Absent on old saves = DEFAULT_SEED. */
  seed?: number
  /** Replicate count. Absent on old saves = DEFAULT_REPLICATES. */
  replicates?: number
  /**
   * Stop the replicate loop when the 95 percent half-width of the end-of-run leaker mean
   * is under this. Null or absent: run every replicate.
   */
  targetHalfWidth?: number | null
  environment: EnvironmentSpec
  /** Legacy field; persist migration maps it to `roe`. Never written anymore. */

  engageOn?: EngagePolicy
  /** Absent on old saves; migrated from engageOn on load, default 'tight'. */
  roe?: Roe
  /** Doctrinal fire-control settings. Absent on old saves = disabled. */
  doctrine?: FireDoctrine
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

/** The one reader of the three run fields with their defaults applied. */
export function runSettings(s: Scenario): {
  runMode: RunMode
  seed: number
  replicates: number
  targetHalfWidth: number | null
} {
  const seed = s.seed
  const reps = s.replicates
  const half = s.targetHalfWidth
  return {
    runMode: s.runMode ?? 'deterministic',
    seed: Number.isInteger(seed) ? (seed as number) : DEFAULT_SEED,
    replicates:
      Number.isInteger(reps) && (reps as number) >= 1 ? (reps as number) : DEFAULT_REPLICATES,
    targetHalfWidth: typeof half === 'number' && Number.isFinite(half) && half > 0 ? half : null,
  }
}

let counter = 0

/** Unique id: timestamp + counter, safe for local single-user use. */
export function newId(prefix: string): string {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`
}
