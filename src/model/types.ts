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

export interface SensorSpec {
  sensorType: SensorType
  detectRangeM: number
  /** Range at which classification/track quality is assumed usable. */
  classifyRangeM: number | null
  /** 360 for omnidirectional. */
  sectorDeg: number
}

export type UasGroup = 1 | 2 | 3 | 4 | 5

export interface UasSpec {
  group: UasGroup
  airframe: 'quad' | 'fixed-wing' | 'vtol' | 'one-way-attack'
  cruiseSpeedMps: number
  maxSpeedMps: number
  enduranceMin: number
  altBandFt: [number, number]
  navMode: 'gps' | 'inertial' | 'rf-manual' | 'optical' | 'mixed'
  emissionsNote: string
}

export interface EffectorSpec {
  effectorType: 'interceptor' | 'jammer' | 'gun' | 'de'
  minRangeM: number
  maxRangeM: number
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

export interface Entity {
  id: string
  name: string
  kind: EntityKind
  specId: string | null
  pos: Vec2
  headingDeg: number
  color: string | null
  notes: string
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

export interface Scenario {
  schemaVersion: 1
  name: string
  library: SpecModel[]
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
