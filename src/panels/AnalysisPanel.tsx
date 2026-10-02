import { useMemo } from 'react'
import { engagementPicture } from '../analysis/impact'
import { assessRunValidity } from '../analysis/runValidity'
import type { RunValidityAssessment } from '../analysis/runValidity'
import { trialForecast, trialResultOf } from '../analysis/trialResult'
import type { BoardPhase } from '../state/runState'
import { selectRunComplete } from '../state/selectors'
import { useStore } from '../state/store'
import { selectTrialHorizon, selectTrialSelection } from '../state/trialSelectors'
import type { TrialSelection } from '../state/trialSelectors'
import { BoardPreparation } from './BoardPreparation'
import { ValidityLine } from './analysis/ValidityLine'
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

interface TrialValidity {
  assessment: RunValidityAssessment | null
  source: 'forecast' | 'trial'
}

/** The selection outside Analyze: a constant, so the hook subscribes to no change. */
const NO_SELECTION: TrialSelection = { status: 'idle', runId: '' }

/**
 * The completed trial's assessment, or null before the trial completes. A trial
 * without a captured assessment reads its forecast, as the Outcome record does.
 * Outside Analyze it reads nothing, so a playback tick does not re-render it.
 */
function useTrialValidity(enabled: boolean): TrialValidity {
  const selection = useStore((s) => (enabled ? selectTrialSelection(s) : NO_SELECTION))
  const started = useStore((s) => enabled && s.playback.startedAtMs != null)
  const complete = useStore((s) => enabled && selectRunComplete(s))
  const horizon = useStore((s) =>
    enabled ? selectTrialHorizon(s, s.playback.observedThroughS) : 0,
  )
  return useMemo(() => {
    if (!enabled || selection.status !== 'ready' || !started || !complete)
      return { assessment: null, source: 'trial' }
    const view = trialResultOf(selection.scenario, selection.result.manifest, selection.result)
    if (horizon < view.durationS) return { assessment: null, source: 'trial' }
    return view.validity
      ? { assessment: view.validity, source: 'trial' }
      : {
          assessment: assessRunValidity(view.scenario, trialForecast(view).assessments),
          source: 'forecast',
        }
  }, [enabled, selection, started, complete, horizon])
}

/**
 * D1: the Validity line for a phase. Prepare and Execute read the forecast picture,
 * as the status bar counts it; Analyze reads the completed trial, else PENDING.
 */
export function PanelValidity({ phase }: { phase: BoardPhase }) {
  const scenario = useStore((s) => s.scenario)
  // Execute shows the line only while the status bar holds it open (D10).
  const shown = useStore((s) => phase !== 'execute' || s.ui.validityOpen)
  const forecast = useMemo(
    () =>
      phase === 'analyze' || !shown
        ? null
        : assessRunValidity(scenario, engagementPicture(scenario).assessments),
    [phase, shown, scenario],
  )
  const trial = useTrialValidity(phase === 'analyze')
  if (!shown) return null
  return (
    <ValidityLine
      phase={phase}
      assessment={forecast ?? trial.assessment}
      source={forecast ? 'forecast' : trial.source}
      entities={scenario.entities}
    />
  )
}

export function AnalysisPanel({ phase = 'execute', screen }: AnalysisPanelProps) {
  const active =
    PHASE_SCREENS[phase].find((option) => option.v === screen)?.v ?? PHASE_SCREENS[phase][0].v
  // The line sits above the scrolling body, so it stays under the tab row.
  if (active === 'inputs')
    return (
      <>
        <PanelValidity phase={phase} />
        <BoardPreparation />
      </>
    )

  return (
    <>
      <PanelValidity phase={phase} />
      <div className="inspector-body analysis-panel">
        {active === 'fragility' && <FragilityScreen />}
        {active === 'placement' && <PlacementScreen />}
        {active === 'now' && <NowScreen />}
        {active === 'outcome' && <OutcomeScreen />}
        {active === 'compare' && <CompareScreen />}
      </div>
    </>
  )
}
