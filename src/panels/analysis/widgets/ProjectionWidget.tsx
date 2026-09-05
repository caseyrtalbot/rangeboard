import { useMemo } from 'react'
import { DEFAULT_REQUIREMENT_THRESHOLDS } from '../../../model/types'
import { DT } from '../../../playback/sim'
import { threatPictureAt } from '../../../analysis/threatAggregation'
import { useStore } from '../../../state/store'
import { residualSectionHeadline } from '../../headlines'
import { AnalysisSection } from '../AnalysisSection'
import { Info } from '../Info'
import { OutcomeSummary } from '../OutcomeSummary'
import { ThreatPicture } from '../ThreatPicture'
import { useEngagement } from './controls'
import { currentSummary } from './mc'
import type { WidgetProps } from './registry'
import { WidgetFrame } from './WidgetFrame'

/** Methodology note for the full-run projection. */
export function AboutProjection() {
  const scenario = useStore((s) => s.scenario)
  const residual = { ...DEFAULT_REQUIREMENT_THRESHOLDS, ...scenario.requirements }.maxResidualPerTrack
  return (
    <Info label="About the projection">
      <p>
        This widget computes the entire configured run. The live widgets use only the
        current playback horizon.
      </p>
      <p>
        Hold analyzes without engagement. With doctrine on, tight and free both require a stable
        track, hostile declaration and a release-ready shooter. With doctrine off, tight requires
        hostile classification and free engages on first detection.
      </p>
      <p>
        Track is evaluated at the first shot, target-window opening, or asset arrival. Effect
        uses the test-defined residual limit of {Number((residual * 100).toFixed(1))}% per track.
        These gates evaluate the deterministic planning envelope; MC means and mean confidence
        intervals do not estimate probability of passing a gate.
        A fully typed fire-control uplink route needs a routed fire-control sensor; a blocked
        route has geometry only and assigns no shot.
      </p>
      <p>Detection and track state are sampled at {DT}-second intervals.</p>
    </Info>
  )
}

/**
 * The full-run projection: the whole configured run, not the observed
 * horizon. Kept apart from the live widgets so a future event never reads
 * as observed data.
 */
export function ProjectionWidget({ id, params, collapsed, customize, index, count }: WidgetProps) {
  void params
  const scenario = useStore((s) => s.scenario)
  const runId = useStore((s) => s.playback.runId)
  const mc = useStore((s) => s.mc)
  const summary = currentSummary(mc, runId)
  const { assessments, report } = useEngagement(scenario, runId)
  const projectionGroups = useMemo(
    () => threatPictureAt(scenario, assessments, report, Number.POSITIVE_INFINITY, new Map()),
    [scenario, assessments, report],
  )
  const threats = assessments.filter((a) => a.status !== 'no-path').length

  return (
    <WidgetFrame
      id={id}
      type="projection"
      title="Full-run projection"
      meta="not live · conditional"
      headerExtra={<AboutProjection />}
      collapsed={collapsed}
      customize={customize}
      index={index}
      count={count}
    >
      {threats === 0 ? (
        <p className="muted small">No threats with flight paths.</p>
      ) : (
        <>
          <OutcomeSummary
            scenario={scenario}
            assessments={assessments}
            report={report}
            mc={summary}
          />
          <AnalysisSection
            title="Projected threat outcome · planning envelope"
            headline={residualSectionHeadline(report.totals)}
          >
            <ThreatPicture groups={projectionGroups} mode="projected" />
          </AnalysisSection>
        </>
      )}
    </WidgetFrame>
  )
}
