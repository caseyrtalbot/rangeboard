import type { RingKey, RingOverrides } from './rings'

/** Canvas layer visibility. View state only: not undoable, not in the scenario. */
export interface LayerVisibility {
  grid: boolean
  boundaries: boolean
  /** Thin ring at the sensor placard detect range. */
  sensorPlacard: boolean
  /** Band between the smallest and largest effective detect range over the placed threats. */
  sensorEnvelope: boolean
  /** Pd contours for the selected threat. */
  sensorPdContours: boolean
  classifyRings: boolean
  /** Effector max-range ring. */
  effectorMaxRange: boolean
  /** Effector min-range ring. */
  effectorMinRange: boolean
  /** Release and commit-Pk rings for the selected threat. */
  effectorDoctrinal: boolean
  /** Defended-area ring around every asset (Entity.defendedRadiusM, else the 500 m default). */
  defendedAreas: boolean
  threatWez: boolean
  flightPaths: boolean
  connections: boolean
  rangeRings: boolean
  engagements: boolean
  labels: boolean
  trackTelemetry: boolean
}

/** Name of a single canvas layer toggle. */
export type LayerKey = keyof LayerVisibility

/** Named declutter set applied to every layer at once. */
export type LayerPreset = 'full' | 'planning' | 'engagement' | 'clean'

/** The two ui fields a ring visibility read needs; `UiState` satisfies it. */
interface RingView {
  layers: LayerVisibility
  ringOverrides: RingOverrides
}

/**
 * Layer state a first run starts from and the fallback for a save that lacks a
 * key. Two rings only: the sensor placard and the effector max range. The other
 * five rings answer a narrower question, so the board opens uncluttered.
 */
export const DEFAULT_LAYERS: LayerVisibility = {
  grid: true,
  boundaries: true,
  sensorPlacard: true,
  sensorEnvelope: false,
  sensorPdContours: false,
  classifyRings: false,
  effectorMaxRange: true,
  effectorMinRange: false,
  effectorDoctrinal: false,
  defendedAreas: true,
  threatWez: false,
  flightPaths: true,
  connections: true,
  rangeRings: true,
  engagements: true,
  labels: true,
  trackTelemetry: true,
}

/** Declutter sets. None of them is the default layer state; that is DEFAULT_LAYERS. */
export const LAYER_PRESETS: Record<LayerPreset, LayerVisibility> = {
  full: {
    grid: true,
    boundaries: true,
    sensorPlacard: true,
    sensorEnvelope: true,
    sensorPdContours: true,
    classifyRings: true,
    effectorMaxRange: true,
    effectorMinRange: true,
    effectorDoctrinal: true,
    defendedAreas: true,
    threatWez: false,
    flightPaths: true,
    connections: true,
    rangeRings: true,
    engagements: true,
    labels: true,
    trackTelemetry: true,
  },
  planning: {
    grid: true,
    boundaries: true,
    sensorPlacard: true,
    sensorEnvelope: true,
    sensorPdContours: false,
    classifyRings: false,
    effectorMaxRange: true,
    effectorMinRange: true,
    effectorDoctrinal: false,
    defendedAreas: true,
    threatWez: false,
    flightPaths: true,
    connections: true,
    rangeRings: true,
    engagements: false,
    labels: true,
    trackTelemetry: true,
  },
  engagement: {
    grid: true,
    boundaries: true,
    sensorPlacard: true,
    sensorEnvelope: false,
    sensorPdContours: false,
    classifyRings: false,
    effectorMaxRange: true,
    effectorMinRange: false,
    effectorDoctrinal: true,
    defendedAreas: true,
    threatWez: false,
    flightPaths: true,
    connections: false,
    rangeRings: false,
    engagements: true,
    labels: true,
    trackTelemetry: true,
  },
  clean: {
    grid: true,
    boundaries: false,
    sensorPlacard: false,
    sensorEnvelope: false,
    sensorPdContours: false,
    classifyRings: false,
    effectorMaxRange: false,
    effectorMinRange: false,
    effectorDoctrinal: false,
    defendedAreas: false,
    threatWez: false,
    flightPaths: false,
    connections: false,
    rangeRings: false,
    engagements: false,
    labels: true,
    trackTelemetry: true,
  },
}

/** Execute starts in engagement view, with a session-only override. */
export const EXECUTE_DEFAULT_LAYERS: LayerVisibility = { ...LAYER_PRESETS.engagement }

/** Exact layer match; an individually adjusted view has no active preset. */
export function activeLayerPreset(layers: LayerVisibility): LayerPreset | null {
  return (
    (Object.keys(LAYER_PRESETS) as LayerPreset[]).find((name) => {
      const preset = LAYER_PRESETS[name]
      return (Object.keys(preset) as LayerKey[]).every((key) => layers[key] === preset[key])
    }) ?? null
  )
}

/** Effective visibility of one ring for one entity: the override, else the layer flag. */
export function ringVisible(ui: RingView, entityId: string, key: RingKey): boolean {
  return ui.ringOverrides[entityId]?.[key] ?? ui.layers[key]
}
