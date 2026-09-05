/**
 * Ring names and hints.
 *
 * Four controls name the same seven rings: the View menu, the right-click
 * Rings flyout, the Inspector Rings section and the command palette. This is
 * the one table they read, so a ring name is written once.
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
