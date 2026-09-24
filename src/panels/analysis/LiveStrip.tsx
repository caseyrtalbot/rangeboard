import { useMemo } from 'react'
import { useStore } from '../../state/store'
import type { TrialResultView } from '../../analysis/trialResult'
import { trialResultOf, trialSnapshotAt } from '../../analysis/trialResult'
import { formatTime } from '../../geometry/geo'
import { State } from '../../ui/kit'
import { toggleAnalysisRun } from '../../playback/runSession'
import { selectTrialHorizon, selectTrialSelection } from '../../state/trialSelectors'

/** The pre-Play line inside Execute: the Play control sits in the line itself. */
export function PlayPrompt() {
  return (
    <>
      {'No trial yet. Press '}
      <button className="mini" onClick={toggleAnalysisRun}>
        Play
      </button>
      {' to run one.'}
    </>
  )
}

/** One simulated-trial basis and one cursor bound for the whole Execute screen. */
export function LiveStrip({
  view: suppliedView,
  horizon: suppliedHorizon,
}: {
  view?: TrialResultView
  horizon?: number
} = {}) {
  const selection = useStore(selectTrialSelection)
  const started = useStore((state) => state.playback.startedAtMs != null)
  const cursor = useStore(
    (state) => suppliedHorizon ?? selectTrialHorizon(state, state.playback.simTimeS),
  )
  const view = useMemo(
    () =>
      suppliedView ??
      (selection.status === 'ready' && started
        ? trialResultOf(selection.scenario, selection.result.manifest, selection.result)
        : undefined),
    [suppliedView, selection, started],
  )
  const horizon = suppliedHorizon ?? cursor
  const phase = useStore((state) => state.playback.phase)
  const execute = useStore((state) => state.ui.boardPhase === 'execute')
  const completed = useStore((state) => state.playback.completedAtMs != null)
  const counts = useMemo(
    () => (view ? trialSnapshotAt(view, horizon).counts : undefined),
    [view, horizon],
  )
  if (!view || !counts)
    return (
      <p className="muted small" role="status">
        {selection.status === 'error' ? (
          selection.message
        ) : selection.status === 'preparing' ? (
          'Preparing trial'
        ) : execute ? (
          <PlayPrompt />
        ) : (
          'No trial yet. Press Play in Execute to run one.'
        )}
      </p>
    )
  const defeated =
    counts.preArrivalHardKills +
    counts.preArrivalSoftKills +
    counts.lateHardKills +
    counts.lateSoftKills
  const word =
    phase === 'complete'
      ? 'Complete'
      : completed
        ? 'Replay'
        : phase === 'running'
          ? 'Running'
          : 'Paused'

  return (
    <p className="analysis-scope" role="status">
      <State tone={phase === 'running' ? 'nominal' : 'inactive'}>{word}</State>
      {' · Simulated trial · observed through T+'}
      {formatTime(horizon)} of {formatTime(view.durationS)}
      {' · tracks '}
      {counts.detectedTracks}/{counts.totalTracks}
      {' · engaged '}
      {counts.engagedTracks}/{counts.totalTracks} tracks
      {' · defeated '}
      {defeated}/{counts.activeAtHorizon + defeated} members
    </p>
  )
}
