/**
 * RangeBoard domain model.
 * World coordinates are meters. +x is east, +y is south (screen-down).
 * Headings are degrees clockwise from north (up).
 */

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
  if (spec.sensorType === 'acoustic') return 'early-warning'
  if (spec.sensorType === 'rf') return 'surveillance'
  if (spec.sensorType === 'eo-ir') return 'classification'
  return spec.detectRangeM >= 30000 ? 'early-warning' : 'tracking'
}

export type UasGroup = 1 | 2 | 3 | 4 | 5

export interface UasSpec {
  group: UasGroup
  airframe: 'quad' | 'fixed-wing' | 'vtol' | 'one-way-attack' | 'fpv'
  cruiseSpeedMps: number
  maxSpeedMps: number
  enduranceMin: number
  altBandFt: [number, number]
  navMode: 'gps' | 'inertial' | 'rf-manual' | 'optical' | 'mixed'
  emissionsNote: string
  /** Operator control-link range, meters. Null when autonomous. */
  controlLinkRangeM?: number | null
  /** Typical mission radius from launch, meters. */
  operatingRadiusM?: number | null
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

export interface Scenario {
  schemaVersion: 1
  name: string
  library: SpecModel[]
  systemPresets: SystemPreset[]
  entities: Entity[]
  connections: Connection[]
  boundaries: Boundary[]
  paths: FlightPath[]
  testCards: TestCard[]
  frames: FrameSnap[]
  underlay: Underlay
}

let counter = 0

/** Unique id: timestamp + counter, safe for local single-user use. */
export function newId(prefix: string): string {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`
}
