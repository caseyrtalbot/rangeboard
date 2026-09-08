import type { BoardPhase } from '../../../state/runState'

export type AnalysisScreen = 'fragility' | 'inputs' | 'now' | 'outcome' | 'compare'

export const PHASE_SCREENS: Record<BoardPhase, Array<{ v: AnalysisScreen; label: string }>> = {
  prepare: [{ v: 'fragility', label: 'Fragility' }, { v: 'inputs', label: 'Inputs' }],
  execute: [{ v: 'now', label: 'Now' }],
  analyze: [{ v: 'outcome', label: 'Outcome' }, { v: 'compare', label: 'Compare' }],
}
