import type { BoardPhase } from '../state/runState'
import { BoardPreparation } from './BoardPreparation'
import { CompareScreen } from './analysis/screens/CompareScreen'
import { FragilityScreen } from './analysis/screens/FragilityScreen'
import { NowScreen } from './analysis/screens/NowScreen'
import { OutcomeScreen } from './analysis/screens/OutcomeScreen'
import { PlacementScreen } from './analysis/screens/PlacementScreen'
import { PHASE_SCREENS } from './analysis/screens/navigation'
import type { AnalysisScreen } from './analysis/screens/navigation'

interface AnalysisPanelProps {
  phase?: BoardPhase
  screen?: AnalysisScreen
}

export function AnalysisPanel({ phase = 'execute', screen }: AnalysisPanelProps) {
  const active = PHASE_SCREENS[phase].find(option => option.v === screen)?.v ?? PHASE_SCREENS[phase][0].v
  if (active === 'inputs') return <BoardPreparation />

  return (
    <div className="inspector-body analysis-panel">
      {active === 'fragility' && <FragilityScreen />}
      {active === 'placement' && <PlacementScreen />}
      {active === 'now' && <NowScreen />}
      {active === 'outcome' && <OutcomeScreen />}
      {active === 'compare' && <CompareScreen />}
    </div>
  )
}
