import { useMemo } from 'react'
import { detectionsAt } from '../../playback/sim'
import { scenarioDurationS, formatRunLabel, useStore } from '../../state/store'
import { engagementPicture } from '../../analysis/impact'
import { buildLiveTimeline, liveKpisAt } from '../../analysis/liveStats'
import { formatTime } from '../../geometry/geo'
import { resetAnalysisRun } from '../../playback/runSession'

/**
 * Run-scoped kill-chain state. Only rAF playback advances the observed
 * horizon; dragging either timeline creates a clearly labeled preview/replay
 * and can never complete a run or promote future events into live telemetry.
 */
export function LiveStrip() {
  const scenario = useStore((s) => s.scenario)
  const phase = useStore((s) => s.playback.phase)
  const runId = useStore((s) => s.playback.runId)
  const runSeq = useStore((s) => s.playback.runSeq)
  const observedThroughS = useStore((s) => s.playback.observedThroughS)
  const completedAtMs = useStore((s) => s.playback.completedAtMs)
  const resetReason = useStore((s) => s.playback.resetReason)
  const qt = useStore((s) => Math.round(s.playback.simTimeS * 2) / 2)

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
  const k = untouched
    ? {
        detected: 0,
        classified: 0,
        targetable: 0,
        engaged: 0,
        kineticShots: 0,
        jamSalvos: 0,
        expectedKills: 0,
        arrivedTracks: 0,
        leakerShips: 0,
      }
    : liveKpisAt(tl, t)
  const hits = untouched ? null : detectionsAt(scenario, t)
  const tracking = untouched ? 0 : tl.trackIds.filter((id) => hits!.has(id)).length
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
  const leakCls = k.leakerShips >= 1 ? ' bad' : k.leakerShips > 0.05 ? ' warn' : ''

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
        <span className="live-state">{state}</span>
        <button
          className="mini run-reset"
          onClick={cleanReset}
          title="New run id; empty observed horizon; recompute analysis"
        >
          Clean reset
        </button>
      </div>
      <div className="live-cells">
        <div className="live-cell" title="Threats first detected by the current cursor time">
          <span className="live-label">Detect</span>
          <span className="live-value">
            {k.detected}<span className="live-of">/{tl.trackCount}</span>
          </span>
        </div>
        <div
          className="live-cell"
          title="Threats currently held by one or more enabled sensors at the cursor time"
        >
          <span className="live-label">Track now</span>
          <span className="live-value">
            {tracking}<span className="live-of">/{tl.trackCount}</span>
          </span>
        </div>
        <div
          className="live-cell"
          title="Threats promoted to hostile by the modeled classification ladder"
        >
          <span className="live-label">ID / class</span>
          <span className="live-value">
            {k.classified}<span className="live-of">/{tl.trackCount}</span>
          </span>
        </div>
        <div
          className="live-cell"
          title="Threats inside a usable ROE-gated effector window right now"
        >
          <span className="live-label">Target now</span>
          <span className="live-value">
            {k.targetable}<span className="live-of">/{tl.trackCount}</span>
          </span>
        </div>
        <div
          className="live-cell"
          title="Threats with at least one kinetic or EW salvo assigned by now"
        >
          <span className="live-label">Engaged</span>
          <span className="live-value">
            {k.engaged}<span className="live-of">/{tl.trackCount}</span>
          </span>
        </div>
        <div
          className="live-cell"
          title="Kinetic shots and EW jam salvos committed by assignment time"
        >
          <span className="live-label">Salvos</span>
          <span className="live-value">
            {k.kineticShots}
            {k.jamSalvos > 0 && <span className="live-jam"> · {k.jamSalvos}j</span>}
          </span>
        </div>
        <div
          className="live-cell"
          title="Expected kill mass after modeled effects land"
        >
          <span className="live-label">Kill E[k]</span>
          <span className="live-value">{k.expectedKills.toFixed(1)}</span>
        </div>
        <div
          className="live-cell"
          title="Expected surviving ship mass after passing the defended asset"
        >
          <span className="live-label">Leak E[n]</span>
          <span className={`live-value${leakCls}`}>{k.leakerShips.toFixed(1)}</span>
        </div>
      </div>
      <div className="live-basis">
        <span>SIM MODEL</span>
        <span>deterministic</span>
        <span>0.5 s cadence</span>
      </div>
    </div>
  )
}
