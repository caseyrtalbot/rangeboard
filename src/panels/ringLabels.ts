/**
 * Ring names and hints. The View menu, the right-click Rings flyout, the Inspector
 * Rings section and the command palette all read this table.
 */

import type { RingKey } from '../state/rings'

/** Short name of each ring. Every ring control shows this text. */
export const RING_LABELS: Record<RingKey, string> = {
  sensorPlacard: 'Placard ring',
  sensorEnvelope: 'Envelope band',
  sensorPdContours: 'Pd contours',
  classifyRings: 'Classify rings',
  effectorMaxRange: 'Max range',
  effectorMinRange: 'Min range',
  effectorDoctrinal: 'Doctrinal rings',
}

/** What each ring shows. The hover hint in the View menu and the Inspector. */
export const RING_HINTS: Record<RingKey, string> = {
  sensorPlacard: 'The detection range at the reference condition.',
  sensorEnvelope:
    'The band between the shortest and the longest detection range against the threats on the board.',
  sensorPdContours:
    'The range at the test detect Pd (solid) and at Pd 0.9 (dashed) against the selected threat, ground projected.',
  classifyRings: 'The classification range.',
  effectorMaxRange: 'The weapon maximum range, ground projected for the selected threat.',
  effectorMinRange: 'The weapon minimum range.',
  effectorDoctrinal:
    'The release range and the commit Pk range for the selected threat under the fire doctrine.',
}

/** Individual edges whose meaning is more specific than the visibility control. */
export const EXTRA_RING_HINTS = {
  defendedArea: 'The boundary used to score arrival at the defended asset.',
  jammerEffective: 'The effective jamming range against the selected threat.',
  jammerMin: 'The minimum jamming range.',
  envelopeInner: 'The shortest detection range against threats on the board.',
  envelopeOuter: 'The longest detection range against threats on the board.',
  pdLow: 'The detection range at the test detect Pd against the selected threat.',
  pdHigh: 'The detection range at Pd 0.9 against the selected threat.',
  release: 'The doctrinal release range for the selected threat.',
  commitPk: 'The range meeting the doctrinal commit Pk for the selected threat.',
}

export const EXTRA_RING_LABELS: Record<keyof typeof EXTRA_RING_HINTS, string> = {
  defendedArea: 'Defended area',
  jammerEffective: 'Jammer effective range',
  jammerMin: 'Jammer minimum range',
  envelopeInner: 'Envelope band inner edge',
  envelopeOuter: 'Envelope band outer edge',
  pdLow: 'Test Pd contour',
  pdHigh: 'Pd 0.9 contour',
  release: 'Release ring',
  commitPk: 'Commit-Pk ring',
}
