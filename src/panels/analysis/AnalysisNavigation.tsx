import { memo } from 'react'
import type { BoardPhase } from '../../state/runState'
import { Seg } from '../../ui/kit'
import { RunControl } from './RunControl'
import { PHASE_SCREENS } from './screens/navigation'
import type { AnalysisScreen } from './screens/navigation'

interface AnalysisNavigationProps {
  phase: BoardPhase
  screen: AnalysisScreen
  onNavigate: (screen: AnalysisScreen) => void
}

export const AnalysisNavigation = memo(function AnalysisNavigation({
  phase,
  screen,
  onNavigate,
}: AnalysisNavigationProps) {
  return (
    <nav className="lens" aria-label="Analysis navigation">
      <Seg
        value={screen}
        options={PHASE_SCREENS[phase]}
        onChange={onNavigate}
        label="Analysis screens"
      />
      {/* Analyze reads a finished ensemble, so the Run control sits beside its screens.
          Prepare carries its own in the forecast header; Execute is playback, not a run. */}
      {phase === 'analyze' && <RunControl />}
    </nav>
  )
})
