import { memo } from 'react'
import type { BoardPhase } from '../../state/runState'
import { Seg } from '../../ui/kit'
import { PHASE_SCREENS } from './screens/navigation'
import type { AnalysisScreen } from './screens/navigation'

interface AnalysisNavigationProps {
  phase: BoardPhase
  screen: AnalysisScreen
  onNavigate: (screen: AnalysisScreen) => void
}

export const AnalysisNavigation = memo(function AnalysisNavigation({ phase, screen, onNavigate }: AnalysisNavigationProps) {
  return (
    <nav className="lens" aria-label="Analysis navigation">
      <Seg value={screen} options={PHASE_SCREENS[phase]} onChange={onNavigate} label="Analysis screens" />
    </nav>
  )
})
