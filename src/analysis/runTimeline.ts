/**
 * Run timeline model: one run's rows by side then kind (sensors, C2, tracks,
 * effectors, threats), each with spans and marks, censored at the observed
 * horizon. Pure: no React, no DOM. The contract is docs/timeline/SPEC.md
 * section 2.2.
 */

export type RunTimelineSide = 'blue' | 'red'
export type RunTimelineKind = 'sensor' | 'c2' | 'track' | 'effector' | 'threat'

export interface RunTimelineSpan {
  kind:
    | 'hold'
    | 'coast'
    | 'classify'
    | 'window'
    | 'prep'
    | 'flight'
    | 'burst'
    | 'dwell'
    | 'undetected'
    | 'ghost'
  startS: number
  endS: number
  /** Track estimate quality 0..1 for hold chunks; classification band for classify. */
  level?: number | 'unknown' | 'suspected' | 'hostile'
  label?: string
}

export interface RunTimelineMark {
  kind:
    | 'detect'
    | 'init'
    | 'firm'
    | 'drop'
    | 'assign'
    | 'release'
    | 'shot'
    | 'hard-kill'
    | 'mission-kill'
    | 'miss'
    | 'jam-decision'
    | 'arrival'
    | 'cpa'
  tS: number
  text?: string
  /** Rounds left after a release, or pk at an effect, as display text. */
  after?: string
}

export interface RunTimelineRow {
  key: string
  kind: RunTimelineKind
  label: string
  meta: string
  /** The board entity a click selects; null for a false track. */
  entityId: string | null
  spans: RunTimelineSpan[]
  marks: RunTimelineMark[]
  /** Sensor rows only: one per held track. */
  subLanes?: RunTimelineRow[]
}

export interface RunTimelineGroup {
  key: RunTimelineKind
  side: RunTimelineSide
  label: string
  rows: RunTimelineRow[]
}

export interface RunTimelineModel {
  durationS: number
  horizonS: number
  groups: RunTimelineGroup[]
}
