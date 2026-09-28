import { useMemo } from 'react'
import { useStore } from '../../state/store'
import type { TrialResultView } from '../../analysis/trialResult'
import { trialResultOf, trialSnapshotAt } from '../../analysis/trialResult'
import { formatTime } from '../../geometry/geo'
import { State } from '../../ui/kit'
import { EmptyRow } from './notes'
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

/** One label and one mono value in the run monitor card. */
function LiveRow({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="live-row" title={title}>
      <span>{label}</span>
      <span className="live-value">{value}</span>
    </div>
  )
}

/**
 * The run monitor card for the whole Execute screen: the clock at the observed
 * horizon, a bar for that horizon, then the trial's replicate, seed, speed and
 * the counts at the cursor.
 */
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
  const speed = useStore((state) => state.playback.speedMult)
  const counts = useMemo(
    () => (view ? trialSnapshotAt(view, horizon).counts : undefined),
    [view, horizon],
  )
  if (!view || !counts) {
    // PlayPrompt holds a control, so it stays a line; every other placeholder is a status.
    if (execute && selection.status !== 'error' && selection.status !== 'preparing')
      return (
        <p className="muted small" role="status">
          <PlayPrompt />
        </p>
      )
    return (
      <div role="status">
        <EmptyRow>
          {selection.status === 'error'
            ? selection.message
            : selection.status === 'preparing'
              ? 'Preparing trial'
              : 'No trial yet. Press Play in Execute to run one.'}
        </EmptyRow>
      </div>
    )
  }
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
  const duration = view.durationS
  const observed = Math.max(0, Math.min(horizon, duration))
  const share = duration > 0 ? Math.round((observed / duration) * 1000) / 10 : 0

  return (
    <section className="live-card" aria-label="Simulated trial">
      <div className="live-head">
        <span className="live-clock">
          T+{formatTime(horizon)} / {formatTime(duration)}
        </span>
        <State tone={phase === 'running' ? 'nominal' : 'inactive'} role="status">
          {word}
        </State>
      </div>
      <div
        className="live-bar"
        role="progressbar"
        aria-label="Observed horizon"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={observed}
        aria-valuetext={`Simulated trial · observed through T+${formatTime(horizon)} of ${formatTime(duration)}`}
      >
        <div className="live-bar-fill" style={{ width: `${share}%` }} />
      </div>
      <LiveRow
        label="Replicate"
        value={String(view.manifest.replicateIndex)}
        title="Replicate index of this trial's draw"
      />
      <LiveRow label="Seed" value={String(view.manifest.seed)} />
      <LiveRow label="Speed" value={`${speed}x`} />
      <LiveRow label="Tracks" value={`${counts.detectedTracks}/${counts.totalTracks}`} />
      <LiveRow label="Engaged" value={`${counts.engagedTracks}/${counts.totalTracks} tracks`} />
      <LiveRow
        label="Defeated"
        value={`${defeated}/${counts.activeAtHorizon + defeated} members`}
      />
    </section>
  )
}
