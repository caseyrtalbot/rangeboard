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

export const AnalysisNavigation = memo(function AnalysisNavigation({
  phase,
  screen,
  onNavigate,
}: AnalysisNavigationProps) {
  const options = PHASE_SCREENS[phase]
  // Analyze reads a finished ensemble, so the Run control sits beside its screens.
  // Prepare carries its own in the forecast header; Execute is playback, not a run.
  const run = phase === 'analyze'
  // A phase with one screen has nothing to choose, so it draws no navigation.
  if (options.length < 2 && !run) return null
  return (
    <nav className="lens" aria-label="Analysis navigation">
      {options.length > 1 && (
        <Seg value={screen} options={options} onChange={onNavigate} label="Analysis screens" />
      )}
    </nav>
  )
})
