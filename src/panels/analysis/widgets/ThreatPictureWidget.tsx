import { reached } from '../../../analysis/horizon'
import { useMemo } from 'react'
import { threatPictureAt } from '../../../analysis/threatAggregation'
import { formatTime } from '../../../geometry/geo'
import { detectionsAt } from '../../../playback/detection'
import { selectEffectiveLayers, selectObservedThroughStep } from '../../../state/selectors'
import { useStore } from '../../../state/store'
import { ThreatPicture } from '../ThreatPicture'
import { useEngagement, useRunCursor } from './controls'
import type { WidgetProps } from './registry'
import { WidgetFrame } from './WidgetFrame'

function WezCheck() {
  const threatWez = useStore((s) => selectEffectiveLayers(s).threatWez)
  const setLayer = useStore((s) => s.setLayer)
  return (
    <label className="adv-toggle" title="Draw threat weapon engagement zones on the canvas">
      <input
        type="checkbox"
        checked={threatWez}
        onChange={(event) => setLayer('threatWez', event.target.checked)}
      />
      WEZ
    </label>
  )
}

/** The live threat picture at the cursor: one chip ladder per group, members on demand. */
export function ThreatPictureWidget({ id, params, collapsed, customize, index, count, horizon }: WidgetProps) {
  const scenario = useStore((s) => s.scenario)
  const runId = useStore((s) => s.playback.runId)
  const observedThroughS = useStore(selectObservedThroughStep)
  const completedAtMs = useStore((s) => s.playback.completedAtMs)
  const { assessments, report } = useEngagement(scenario, runId)
  const { t, phase, untouched } = useRunCursor(scenario)
  const expanded = params.expanded === true
  const empty = horizon.scoped && !reached(0, horizon)
  const tS = untouched || empty ? null : horizon.scoped ? Math.min(t, horizon.horizonS) : t
  const preview = !horizon.scoped && phase === 'review' && completedAtMs == null && t > observedThroughS + 0.25
  const runTrackIds = useMemo(
    () => new Set(assessments.filter((a) => a.status !== 'no-path').map((a) => a.uasId)),
    [assessments],
  )
  const hits = useMemo(
    () =>
      tS == null
        ? new Map()
        : new Map([...detectionsAt(scenario, tS)].filter(([uasId]) => runTrackIds.has(uasId))),
    [scenario, tS, runTrackIds],
  )
  const groups = useMemo(
    () => threatPictureAt(scenario, assessments, report, tS, hits),
    [scenario, assessments, report, tS, hits],
  )
  const tracks = groups.reduce((sum, group) => sum + group.tracks, 0)
  const detected = groups.reduce((sum, group) => sum + group.detected, 0)
  const timeLabel = tS == null ? 'ready' : `${preview ? 'preview ' : 'T+'}${formatTime(tS)}`

  return (
    <WidgetFrame
      id={id}
      horizon={horizon}
      type="threat-picture"
      title={preview ? 'Threats at preview cursor' : 'Live threat picture'}
      metaWithinHorizon
      meta={`planning envelope · ${timeLabel} · ${detected}/${tracks} detected`}
      headerExtra={<WezCheck />}
      collapsed={collapsed}
      customize={customize}
      index={index}
      count={count}
    >
      {empty ? <p className="muted small">No threat telemetry yet.</p> : <ThreatPicture groups={groups} mode="live" membersOpen={expanded} />}
    </WidgetFrame>
  )
}
