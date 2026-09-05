/** A ring one sensor or effector entity can draw. Every ring key is also a layer key. */
export type RingKey =
  | 'sensorPlacard'
  | 'sensorEnvelope'
  | 'sensorPdContours'
  | 'classifyRings'
  | 'effectorMaxRange'
  | 'effectorMinRange'
  | 'effectorDoctrinal'

/** Ring keys that apply to a sensor entity, in display order. */
export const SENSOR_RING_KEYS: readonly RingKey[] = [
  'sensorPlacard',
  'sensorEnvelope',
  'sensorPdContours',
  'classifyRings',
]

/** Ring keys that apply to an effector entity, in display order. */
export const EFFECTOR_RING_KEYS: readonly RingKey[] = [
  'effectorMaxRange',
  'effectorMinRange',
  'effectorDoctrinal',
]

/** The seven ring keys in display order. */
export const RING_KEYS: readonly RingKey[] = [...SENSOR_RING_KEYS, ...EFFECTOR_RING_KEYS]

/** Per-entity ring overrides. An absent key falls through to ui.layers. */
export type RingOverrides = Record<string, Partial<Record<RingKey, boolean>>>
