import { useMemo, useState } from 'react'
import type { AarSummary, Scenario } from '../../model/types'
import type { AttritionReport } from '../../playback/attrition'
import type { ThreatAssessment } from '../../playback/sim'
import { detectionsAt } from '../../playback/sim'
import { buildRequirementGateReport } from '../../analysis/requirements'
import { systemTelemetryAt } from '../../analysis/systemTelemetry'
import { threatPictureAt } from '../../analysis/threatAggregation'
import { formatRunLabel, useStore } from '../../state/store'
import { formatTime } from '../../geometry/geo'
import { exportRunRecord } from '../../io/persist'
import { downloadBoardFrame } from '../../te/io/frameCapture'
import { resetAnalysisRun } from '../../playback/runSession'
import { AnalysisSection } from './AnalysisSection'
import { OutcomeSummary } from './OutcomeSummary'
import { RequirementGates } from './RequirementGates'
import { SystemStatus } from './SystemStatus'
import { ThreatPicture } from './ThreatPicture'

const EVENT_PAGE = 20

function RunActions({
  scenario,
  assessments,
  report,
  aar,
  durationS,
}: {
  scenario: Scenario
  assessments: ThreatAssessment[]
  report: AttritionReport
  aar: AarSummary
  durationS: number
}) {
  const startedAtMs = useStore((state) => state.playback.startedAtMs)!
  const completedAtMs = useStore((state) => state.playback.completedAtMs)!
  const runId = useStore((state) => state.playback.runId)
  const runSeq = useStore((state) => state.playback.runSeq)
  const observedThroughS = useStore((state) => state.playback.observedThroughS)
  const label = formatRunLabel(runSeq)
  const runMeta = {
    id: runId,
    label,
    sequence: runSeq,
    startedAt: new Date(startedAtMs).toISOString(),
    completedAt: new Date(completedAtMs).toISOString(),
    durationS,
    observedThroughS,
  }

  function captureFinal() {
    useStore.getState().scrubTo(durationS)
    window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() => {
        if (!downloadBoardFrame(`${scenario.name}-${label}-final`)) {
          window.alert('Could not capture the board canvas.')
        }
      }),
    )
  }

  return (
    <div className="debrief-actions">
      <button
        className="primary"
        onClick={() => exportRunRecord(scenario, runMeta, assessments, report, aar)}
      >
        Export debrief JSON
      </button>
      <button onClick={captureFinal}>Capture final PNG</button>
      <button onClick={() => resetAnalysisRun('manual')}>New clean run</button>
    </div>
  )
}

function EventLedger({ scenario, report }: { scenario: Scenario; report: AttritionReport }) {
  const [visible, setVisible] = useState(EVENT_PAGE)
  const name = (id: string) => scenario.entities.find((entity) => entity.id === id)?.name ?? id
  if (report.events.length === 0) return <p className="muted small">No engagement events recorded.</p>
  return (
    <div className="event-ledger">
      {report.events.slice(0, visible).map((event, index) => (
        <div className="event-row" key={`${event.effectorId}:${event.uasId}:${event.tS}:${index}`}>
          <span className="event-time">
            {formatTime(event.tS)} → {formatTime(event.tEffectS)}
          </span>
          <span className="event-route">
            <strong>{name(event.effectorId)}</strong>
            <small>
              {name(event.uasId)} · ship {event.shipIdx + 1} · {event.softShot ? 'EW' : 'kinetic'}
            </small>
          </span>
          <span className="event-effect">
            P {`${(event.pk * 100).toFixed(1)}%`}
            <small>ΔE[k] {event.killDelta.toFixed(3)}</small>
          </span>
        </div>
      ))}
      {visible < report.events.length && (
        <button className="load-more" onClick={() => setVisible((count) => count + EVENT_PAGE)}>
          Show next {Math.min(EVENT_PAGE, report.events.length - visible)} · {report.events.length - visible} remaining
        </button>
      )}
    </div>
  )
}

export function DebriefRecord({
  scenario,
  assessments,
  report,
  aar,
  durationS,
}: {
  scenario: Scenario
  assessments: ThreatAssessment[]
  report: AttritionReport
  aar: AarSummary
  durationS: number
}) {
  const completedAtMs = useStore((state) => state.playback.completedAtMs)
  const startedAtMs = useStore((state) => state.playback.startedAtMs)
  const observedThroughS = useStore((state) => state.playback.observedThroughS)
  const runSeq = useStore((state) => state.playback.runSeq)
  const complete =
    completedAtMs != null &&
    startedAtMs != null &&
    durationS > 0 &&
    observedThroughS >= durationS
  const runTrackIds = useMemo(
    () => new Set(assessments.filter((assessment) => assessment.status !== 'no-path').map((assessment) => assessment.uasId)),
    [assessments],
  )
  const hits = useMemo(
    () =>
      complete
        ? new Map(
            [...detectionsAt(scenario, durationS)].filter(([uasId]) => runTrackIds.has(uasId)),
          )
        : new Map(),
    [complete, scenario, durationS, runTrackIds],
  )
  const requirements = useMemo(
    () => buildRequirementGateReport(scenario, assessments, report),
    [scenario, assessments, report],
  )
  const systems = useMemo(
    () => systemTelemetryAt(scenario, assessments, report, durationS, hits),
    [scenario, assessments, report, durationS, hits],
  )
  const threats = useMemo(
    () => threatPictureAt(scenario, assessments, report, durationS, hits),
    [scenario, assessments, report, durationS, hits],
  )
  if (!complete || completedAtMs == null || startedAtMs == null) return null
  const trackCount = threats.reduce((sum, group) => sum + group.tracks, 0)
  const componentCount = systems.reduce((sum, group) => sum + group.componentCount, 0)
  const requirementLabel =
    requirements.overall === 'pass'
      ? 'ALL GATES MET'
      : requirements.overall === 'fail'
        ? 'REQUIREMENTS NOT MET'
        : 'REQUIREMENTS NOT RUN'
  return (
    <div className="debrief-record" role="status">
      <div className="debrief-header">
        <div>
          <span className="debrief-kicker">RUN EVIDENCE RECORD</span>
          <strong>{formatRunLabel(runSeq)} · COMPLETE</strong>
        </div>
        <span className={`status ${requirements.overall === 'pass' ? 'good' : 'bad'}`}>
          {requirementLabel}
        </span>
      </div>
      <div className="debrief-meta">
        {formatTime(durationS)} observed · {trackCount} tracks · {componentCount} components · {report.events.length} events
      </div>
      <RunActions
        scenario={scenario}
        assessments={assessments}
        report={report}
        aar={aar}
        durationS={durationS}
      />
      <OutcomeSummary scenario={scenario} assessments={assessments} report={report} />
      <AnalysisSection
        title="Requirement record"
        headline={`${requirements.met}/${requirements.required} met`}
        defaultOpen
      >
        <RequirementGates report={requirements} />
      </AnalysisSection>
      <AnalysisSection
        title="System and component record"
        headline={`${componentCount} components · ${report.totals.shotsFired + report.totals.jamSalvos} salvos`}
        defaultOpen
      >
        <SystemStatus groups={systems} expanded />
      </AnalysisSection>
      <AnalysisSection
        title="Threat record"
        headline={`${trackCount} tracks · ${report.totals.expectedLeakers.toFixed(2)} residual`}
        defaultOpen
      >
        <ThreatPicture groups={threats} mode="debrief" />
      </AnalysisSection>
      <AnalysisSection
        title="Engagement event ledger"
        headline={`${report.events.length} events`}
      >
        <EventLedger scenario={scenario} report={report} />
      </AnalysisSection>
    </div>
  )
}
