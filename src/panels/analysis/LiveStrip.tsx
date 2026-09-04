import { useMemo } from 'react'
import { scenarioDurationS, formatRunLabel, useStore } from '../../state/store'
import { engagementPicture } from '../../analysis/impact'
import { buildLiveTimeline } from '../../analysis/liveStats'
import { formatTime } from '../../geometry/geo'
import { resetAnalysisRun } from '../../playback/runSession'
import { useSimTimeStep } from './widgets/controls'

/**
 * Run header: run id, cursor time, phase, mode chip and the clean reset.
 * Only rAF playback advances the observed horizon; dragging either timeline
 * creates a clearly labeled preview/replay and can never complete a run or
 * promote future events into live telemetry.
 */
export function LiveStrip() {
  const scenario = useStore((s) => s.scenario)
  const phase = useStore((s) => s.playback.phase)
  const runId = useStore((s) => s.playback.runId)
  const runSeq = useStore((s) => s.playback.runSeq)
  const observedThroughS = useStore((s) => s.playback.observedThroughS)
  const completedAtMs = useStore((s) => s.playback.completedAtMs)
  const resetReason = useStore((s) => s.playback.resetReason)
  const qt = useSimTimeStep()

  // A reset changes runId and explicitly clears engagementPicture's cache,
  // so an unchanged scenario is rebuilt for each clean run.
  const tl = useMemo(() => {
    void runId
    const { assessments, report } = engagementPicture(scenario)
    return buildLiveTimeline(assessments, report)
  }, [scenario, runId])
  const durationS = useMemo(() => scenarioDurationS(scenario), [scenario])

  if (tl.trackCount === 0) return null

  const t = Math.min(qt, durationS)
  const untouched = phase === 'ready'
  const preview =
    phase === 'review' && completedAtMs == null && t > observedThroughS + 0.25
  const tag = untouched
    ? 'Ready'
    : phase === 'running'
      ? 'Live'
      : phase === 'paused'
        ? 'Paused'
        : phase === 'complete'
          ? 'Complete'
          : preview
            ? 'Preview'
            : 'Replay'
  const state = untouched
    ? resetReason === 'configuration-changed'
      ? 'buffer clean · configuration changed'
      : 'buffer clean · no prior-run telemetry'
    : phase === 'running'
      ? `observed through ${formatTime(observedThroughS)}`
      : preview
        ? `cursor only · observed through ${formatTime(observedThroughS)}`
        : completedAtMs != null
          ? 'full run observed'
          : `observed through ${formatTime(observedThroughS)}`

  function cleanReset() {
    if (
      completedAtMs == null &&
      observedThroughS > 0 &&
      !window.confirm('Discard this in-progress run and start with a clean telemetry buffer?')
    ) {
      return
    }
    resetAnalysisRun('manual')
  }

  return (
    <div className={`live-strip run-${tag.toLowerCase()}`} aria-live="polite">
      <div className="live-head">
        <span className="live-tag">{tag}</span>
        <span className="live-time">
          {formatRunLabel(runSeq)} · {untouched ? 'T+0:00' : `T+${formatTime(t)}`}
        </span>
        <span className="chip det" title="Deterministic expected-value run">
          DET
        </span>
        <span className="live-state">{state}</span>
        <button
          className="mini run-reset"
          onClick={cleanReset}
          title="New run id; empty observed horizon; recompute analysis"
        >
          Clean reset
        </button>
      </div>
    </div>
  )
}
