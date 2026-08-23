import { useMemo } from 'react'
import { scenarioDurationS, useStore } from '../../state/store'
import { detectionsAt, liveTracks } from '../../playback/sim'
import { engagementPicture, SEVERITY_RANK } from '../../analysis/impact'
import { entityActive } from '../../model/types'
import { formatTime } from '../../geometry/geo'

/**
 * Board state at the current playback instant. Every count derives from what
 * the engine computes per time t (liveTracks, detectionsAt, the cached sweep
 * timeline). Attrition kills are run-total expected values with no per-t
 * timeline, so this strip never shows "kills so far".
 */
export function LiveStrip() {
  const scenario = useStore((s) => s.scenario)
  const playing = useStore((s) => s.playback.playing)
  // Quantized to the engine's 0.5 s sample step, so 60 fps playback
  // re-renders this strip at most twice per sim second.
  const qt = useStore((s) => Math.round(s.playback.simTimeS * 2) / 2)

  const live = useMemo(() => {
    const t = Math.min(qt, scenarioDurationS(scenario))
    const { assessments, impacts } = engagementPicture(scenario)
    const uasIds = new Set(
      scenario.entities.filter((e) => e.kind === 'uas' && entityActive(e)).map((e) => e.id),
    )
    let airborne = 0
    for (const tr of liveTracks(scenario, t).values()) {
      if (tr.flying && uasIds.has(tr.entityId)) airborne++
    }
    const detected = detectionsAt(scenario, t).size
    let hostile = 0
    let windows = 0
    const arrivedIds = new Set<string>()
    for (const a of assessments) {
      if (a.status === 'no-path') continue
      const h = a.classificationAtS.hostileAtS
      if (h != null && h <= t) hostile++
      if (a.windowS && a.windowS[0] <= t && t <= a.windowS[1]) windows++
      if (a.arrivalS != null && a.arrivalS <= t) arrivedIds.add(a.uasId)
    }
    let worstArrived = 0
    for (const imp of impacts) {
      if (imp.severity != null && arrivedIds.has(imp.uasId)) {
        worstArrived = Math.max(worstArrived, SEVERITY_RANK[imp.severity])
      }
    }
    return { t, airborne, detected, hostile, windows, arrived: arrivedIds.size, worstArrived }
  }, [scenario, qt])

  if (qt === 0 && !playing) return null

  const arrivedCls =
    live.arrived > 0 && live.worstArrived >= SEVERITY_RANK.severe
      ? ' danger'
      : live.arrived > 0 && live.worstArrived > 0
        ? ' warn'
        : ''
  return (
    <div className="live-strip">
      <div className="live-head">
        LIVE · T+{formatTime(live.t)}
        {!playing && <span className="live-sweep">planning sweep</span>}
      </div>
      <div className="live-chips">
        <span className="live-chip" title="Threats launched (past start delay) and not yet at path end at this time">
          {live.airborne} airborne
        </span>
        <span className="live-chip" title="Threats held by at least one sensor at this time">
          {live.detected} detected
        </span>
        <span
          className={`live-chip${live.hostile > 0 ? ' warn' : ''}`}
          title="Tracks that reached hostile classification by this time"
        >
          {live.hostile} hostile
        </span>
        <span
          className="live-chip"
          title="Threats inside their usable engagement window at this time"
        >
          {live.windows} windows open
        </span>
        <span
          className={`live-chip${arrivedCls}`}
          title="Threats past closest approach to the defended asset by this time; color is the worst arrived leaker impact severity"
        >
          {live.arrived} arrived
        </span>
      </div>
    </div>
  )
}
