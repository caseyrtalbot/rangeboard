import type { BoardPhase } from '../../../state/runState'

export type AnalysisScreen = 'fragility' | 'inputs' | 'placement' | 'now' | 'outcome' | 'compare'

export const PHASE_SCREENS: Record<BoardPhase, Array<{ v: AnalysisScreen; label: string }>> = {
  prepare: [
    { v: 'fragility', label: 'Fragility' },
    { v: 'inputs', label: 'Inputs' },
    { v: 'placement', label: 'Where to put it' },
  ],
  execute: [{ v: 'now', label: 'Now' }],
  analyze: [
    { v: 'outcome', label: 'Outcome' },
    { v: 'compare', label: 'Compare' },
  ],
}
