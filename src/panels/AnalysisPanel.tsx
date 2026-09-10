import type { BoardPhase } from '../state/runState'
import { CompareScreen } from './analysis/screens/CompareScreen'
import { FragilityScreen } from './analysis/screens/FragilityScreen'
import { NowScreen } from './analysis/screens/NowScreen'
import { OutcomeScreen } from './analysis/screens/OutcomeScreen'
import { PHASE_SCREENS } from './analysis/screens/navigation'
import type { AnalysisScreen } from './analysis/screens/navigation'

interface AnalysisPanelProps {
  phase?: BoardPhase
  screen?: AnalysisScreen
}

export function AnalysisPanel({ phase = 'execute', screen }: AnalysisPanelProps) {
  const requested = PHASE_SCREENS[phase].find(option => option.v === screen)?.v ?? PHASE_SCREENS[phase][0].v
  const active = requested === 'inputs' ? 'fragility' : requested

  return (
    <div className="inspector-body analysis-panel">
      {active === 'fragility' && <FragilityScreen />}
      {active === 'now' && <NowScreen />}
      {active === 'outcome' && <OutcomeScreen />}
      {active === 'compare' && <CompareScreen />}
    </div>
  )
}
