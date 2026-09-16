import { useMemo } from 'react'
import { useStore } from './store'
import { selectTrialHorizon, selectTrialSelection } from './trialSelectors'
import type { TrialSelection } from './trialSelectors'
import { trialResultOf, trialSnapshotAt } from '../analysis/trialResult'
import type { TrialSnapshot } from '../analysis/trialResult'
import { trialSeriesOf } from '../analysis/trialSeries'
import type { TrialSeriesSet } from '../analysis/trialSeries'

export function useTrialResult(): {
  selection: TrialSelection
  horizon: number
  snapshot?: TrialSnapshot
  series?: TrialSeriesSet
} {
  const selection = useStore(selectTrialSelection)
  const horizon = useStore((s) => selectTrialHorizon(s, s.playback.simTimeS))
  const started = useStore((s) => s.playback.startedAtMs != null)
  return useMemo(() => {
    // A numeric T0 cannot distinguish pre-Play from a reached T0 scan.
    if (selection.status !== 'ready' || !started) return { selection, horizon }
    const view = trialResultOf(selection.scenario, selection.result.manifest, selection.result)
    return {
      selection,
      horizon,
      snapshot: trialSnapshotAt(view, horizon),
      series: trialSeriesOf(view, horizon),
    }
  }, [selection, horizon, started])
}
