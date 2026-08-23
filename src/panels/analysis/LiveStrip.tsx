import { useMemo } from 'react'
import { scenarioDurationS, useStore } from '../../state/store'
import { engagementPicture } from '../../analysis/impact'
import { buildLiveTimeline, liveKpisAt } from '../../analysis/liveStats'
import { formatTime } from '../../geometry/geo'

/**
 * Battle state at the current playback instant, from prefix aggregation over
 * the engagement ledger (see analysis/liveStats.ts). Expenditure counts at
 * assignment time; kills at effect time; leakers as tracks past arrival with
 * their surviving expected mass. This subtree is the only part of the panel
 * that subscribes to simTimeS; the subscription is quantized to the engine's
 * 0.5 s sample step so 60 fps playback re-renders it at most twice per sim
 * second.
 */
export function LiveStrip() {
  const scenario = useStore((s) => s.scenario)
  const playing = useStore((s) => s.playback.playing)
  const qt = useStore((s) => Math.round(s.playback.simTimeS * 2) / 2)

  // Sorted prefix structures, once per scenario object. engagementPicture is
  // itself WeakMap-cached, so this never re-runs the sweep.
  const tl = useMemo(() => {
    const { assessments, report } = engagementPicture(scenario)
    return buildLiveTimeline(assessments, report)
  }, [scenario])
  const durationS = useMemo(() => scenarioDurationS(scenario), [scenario])

  if (tl.trackCount === 0) return null

  const t = Math.min(qt, durationS)
  const k = liveKpisAt(tl, t)
  const atLaunch = t === 0 && !playing
  const leakCls = k.leakerShips >= 1 ? ' bad' : k.leakerShips > 0.05 ? ' warn' : ''

  return (
    <div className="live-strip">
      <div className="live-head">
        <span className="live-tag">Live</span>
        <span className="live-time">{atLaunch ? 'At launch' : `T+${formatTime(t)}`}</span>
        {!atLaunch && !playing && <span className="live-state">paused</span>}
        {atLaunch && <span className="live-state">press play or scrub</span>}
      </div>
      <div className="live-cells">
        <div className="live-cell" title="Threat tracks first detected by now">
          <span className="live-label">Detected</span>
          <span className="live-value">
            {k.detected}
            <span className="live-of">/{tl.trackCount}</span>
          </span>
        </div>
        <div
          className="live-cell"
          title="Kinetic shots and jam salvos committed by now (assignment time)"
        >
          <span className="live-label">Shots</span>
          <span className="live-value">
            {k.kineticShots}
            {k.jamSalvos > 0 && <span className="live-jam"> · {k.jamSalvos}j</span>}
          </span>
        </div>
        <div className="live-cell" title="Expected kills applied by now (effect time)">
          <span className="live-label">Exp kills</span>
          <span className="live-value">{k.expectedKills.toFixed(1)}</span>
        </div>
        <div
          className="live-cell"
          title="Surviving expected ships past the defended asset by now"
        >
          <span className="live-label">Leakers</span>
          <span className={`live-value${leakCls}`}>{k.leakerShips.toFixed(1)}</span>
        </div>
      </div>
    </div>
  )
}
