import { memo } from 'react'
import type { BoardPhase } from '../../state/runState'
import { PHASE_SCREENS, SCREEN_ORDER } from './screens/navigation'
import type { AnalysisScreen } from './screens/navigation'

interface AnalysisNavigationProps {
  phase: BoardPhase
  screen: AnalysisScreen
  /** True while the analysis view holds the panel, so the current screen reads selected. */
  selected: boolean
  onNavigate: (screen: AnalysisScreen) => void
}

/**
 * The phase's screen tabs, one group inside the right-panel tab row. The current
 * screen carries `insp-tab-analysis`, so the panel body and Back to overview name
 * it. Execute has one screen, so it draws one tab and no segmented control.
 */
export const AnalysisNavigation = memo(function AnalysisNavigation({
  phase,
  screen,
  selected,
  onNavigate,
}: AnalysisNavigationProps) {
  const options = [...PHASE_SCREENS[phase]].sort(
    (a, b) => SCREEN_ORDER.indexOf(a.v) - SCREEN_ORDER.indexOf(b.v),
  )
  return (
    <div className="insp-tab-group">
      {options.map((o) => {
        const current = o.v === screen
        const on = selected && current
        return (
          <button
            key={o.v}
            id={current ? 'insp-tab-analysis' : `insp-tab-screen-${o.v}`}
            type="button"
            role="tab"
            aria-selected={on}
            aria-controls="insp-tabpanel"
            tabIndex={on ? 0 : -1}
            className={on ? 'active' : ''}
            onClick={() => onNavigate(o.v)}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
})
