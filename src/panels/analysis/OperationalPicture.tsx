import { useMemo } from 'react'
import { detectionsAt } from '../../playback/sim'
import type { AttritionReport } from '../../playback/attrition'
import type { ThreatAssessment } from '../../playback/sim'
import { scenarioDurationS, useStore } from '../../state/store'
import { formatTime } from '../../geometry/geo'
import { systemTelemetryAt } from '../../analysis/systemTelemetry'
import { threatPictureAt } from '../../analysis/threatAggregation'
import { AnalysisSection } from './AnalysisSection'
import { SystemStatus } from './SystemStatus'
import { ThreatPicture } from './ThreatPicture'

export function OperationalPicture({
  assessments,
  report,
}: {
  assessments: ThreatAssessment[]
  report: AttritionReport
}) {
  const scenario = useStore((state) => state.scenario)
  const phase = useStore((state) => state.playback.phase)
  const observedThroughS = useStore((state) => state.playback.observedThroughS)
  const qt = useStore((state) => Math.round(state.playback.simTimeS * 2) / 2)
  const durationS = useMemo(() => scenarioDurationS(scenario), [scenario])
  const observed = phase !== 'ready'
  const tS = observed ? Math.min(qt, durationS) : null
  const preview = phase === 'review' && tS != null && tS > observedThroughS + 0.25
  const runTrackIds = useMemo(
    () => new Set(assessments.filter((assessment) => assessment.status !== 'no-path').map((assessment) => assessment.uasId)),
    [assessments],
  )
  const hits = useMemo(
    () =>
      tS == null
        ? new Map()
        : new Map(
            [...detectionsAt(scenario, tS)].filter(([uasId]) => runTrackIds.has(uasId)),
          ),
    [scenario, tS, runTrackIds],
  )
  const systems = useMemo(
    () => systemTelemetryAt(scenario, assessments, report, tS ?? Number.NEGATIVE_INFINITY, hits),
    [scenario, assessments, report, tS, hits],
  )
  const threats = useMemo(
    () => threatPictureAt(scenario, assessments, report, tS, hits),
    [scenario, assessments, report, tS, hits],
  )
  const online = systems.reduce((sum, group) => sum + group.activeComponents, 0)
  const components = systems.reduce((sum, group) => sum + group.componentCount, 0)
  const salvos = systems.reduce((sum, group) => sum + group.salvosAssigned, 0)
  const tracks = threats.reduce((sum, group) => sum + group.tracks, 0)
  const detected = threats.reduce((sum, group) => sum + group.detected, 0)
  const timeLabel = tS == null ? 'ready' : `${preview ? 'preview' : 'T+'}${formatTime(tS)}`

  return (
    <div className="operational-picture">
      <AnalysisSection
        title={preview ? 'Systems at preview cursor' : 'Live systems'}
        headline={`${online}/${components} online · ${hits.size} tracks · ${salvos} salvos`}
        defaultOpen
      >
        <div className="data-horizon-label">{timeLabel}</div>
        <SystemStatus groups={systems} />
      </AnalysisSection>
      <AnalysisSection
        title={preview ? 'Threats at preview cursor' : 'Live threat picture'}
        headline={`${detected}/${tracks} detected · ${hits.size} held`}
        defaultOpen
      >
        <div className="data-horizon-label">{timeLabel} · tactic / wave / platform grouping</div>
        <ThreatPicture groups={threats} mode="live" />
      </AnalysisSection>
    </div>
  )
}
