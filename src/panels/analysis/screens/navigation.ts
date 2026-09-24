import type { BoardPhase } from '../../../state/runState'

export type AnalysisScreen = 'fragility' | 'inputs' | 'placement' | 'now' | 'outcome' | 'compare'

/** Each phase's screens. The first entry is the phase's default screen. */
export const PHASE_SCREENS: Record<BoardPhase, Array<{ v: AnalysisScreen; label: string }>> = {
  prepare: [
    { v: 'fragility', label: 'Fragility' },
    { v: 'inputs', label: 'Inputs' },
    { v: 'placement', label: 'Placement' },
  ],
  execute: [{ v: 'now', label: 'Run monitor' }],
  analyze: [
    { v: 'outcome', label: 'Outcome' },
    { v: 'compare', label: 'Compare' },
  ],
}

/** Tab order in the panel row. Prepare reads Inputs, Fragility, Placement. */
export const SCREEN_ORDER: AnalysisScreen[] = [
  'inputs',
  'fragility',
  'placement',
  'now',
  'outcome',
  'compare',
]
