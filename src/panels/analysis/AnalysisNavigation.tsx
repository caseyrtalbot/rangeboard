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
  // A phase with one screen has nothing to choose, so it draws no navigation.
  if (options.length < 2) return null
  return (
    <nav className="lens" aria-label="Analysis navigation">
      {options.length > 1 && (
        <Seg value={screen} options={options} onChange={onNavigate} label="Analysis screens" />
      )}
    </nav>
  )
})
