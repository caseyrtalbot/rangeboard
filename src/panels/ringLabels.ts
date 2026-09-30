/**
 * Ring names and control hints. The View menu, the right-click Rings flyout, the
 * Inspector Rings section, the command palette and the ring readout read this table.
 */

import type { RingKey } from '../state/rings'

/** Short name of each ring. Every ring control and the ring readout show this text. */
export const RING_LABELS: Record<RingKey, string> = {
  sensorPlacard: 'Placard ring',
  sensorEnvelope: 'Envelope band',
  sensorPdContours: 'Pd contours',
  classifyRings: 'Classify rings',
  effectorMaxRange: 'MIR',
  effectorMinRange: 'Min range',
  effectorDoctrinal: 'MRIR',
}

/** Hover hint of each ring control in the View menu and the Inspector. The board shows none. */
export const RING_HINTS: Record<RingKey, string> = {
  sensorPlacard: 'The detection range at the reference condition.',
  sensorEnvelope:
    'The band between the shortest and the longest detection range against the threats on the board.',
  sensorPdContours:
    'The range at the test detect Pd (solid) and at Pd 0.9 (dashed) against the selected threat, ground projected.',
  classifyRings: 'The classification range.',
  effectorMaxRange: 'Max intercept range',
  effectorMinRange: 'Minimum range',
  effectorDoctrinal: 'Max recommended intercept range (doctrinal range)',
}

/** Readout names of individual edges whose meaning is more specific than the visibility control. */
export const EXTRA_RING_LABELS = {
  defendedArea: 'Defended area',
  envelopeInner: 'Envelope band inner edge',
  envelopeOuter: 'Envelope band outer edge',
  pdLow: 'Test Pd contour',
  pdHigh: 'Pd 0.9 contour',
} as const

export type ExtraRingKey = keyof typeof EXTRA_RING_LABELS
