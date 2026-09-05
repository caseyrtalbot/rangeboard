import { useMemo } from 'react'
import type { AarSummary, Scenario } from '../../model/types'
import type { AttritionReport } from '../../playback/attrition'
import type { McSummary, SensitivitySummary } from '../../playback/mcRun'
import type { ThreatAssessment } from '../../playback/sim'
import { detectionsAt } from '../../playback/sim'
import { buildRequirementGateReport } from '../../analysis/requirements'
import type { RunValidityAssessment } from '../../analysis/runValidity'
import { assessRunValidity } from '../../analysis/runValidity'
import { systemTelemetryAt } from '../../analysis/systemTelemetry'
import { threatPictureAt } from '../../analysis/threatAggregation'
import { formatRunLabel, useStore } from '../../state/store'
import { formatTime } from '../../geometry/geo'
import { exportRunRecord } from '../../io/persist'
import { downloadBoardFrame } from '../../te/io/frameCapture'
import { resetAnalysisRun } from '../../playback/runSession'
import { residualSectionHeadline, totalSalvos } from '../headlines'
import { AnalysisSection } from './AnalysisSection'
import { OutcomeSummary } from './OutcomeSummary'
import { RequirementGates } from './RequirementGates'
import { SystemStatus } from './SystemStatus'
import { ThreatPicture } from './ThreatPicture'
import { EventLedgerList } from './widgets/EventLedgerWidget'
import { currentSensitivity, currentSummary } from './widgets/mc'
import { SEVERITY_PILL, VALIDITY_TEXT } from './widgets/RunValidityWidget'

function RunActions({
  scenario,
  assessments,
  report,
  aar,
  durationS,
  mc,
  sensitivity,
}: {
  scenario: Scenario
  assessments: ThreatAssessment[]
  report: AttritionReport
  aar: AarSummary
  durationS: number
  mc: McSummary | null
  sensitivity: SensitivitySummary | null
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
        onClick={() =>
          exportRunRecord(scenario, runMeta, assessments, report, aar, mc, sensitivity)
        }
      >
        Export debrief JSON
      </button>
      <button onClick={captureFinal}>Capture final PNG</button>
      <button onClick={() => resetAnalysisRun('manual')}>New clean run</button>
    </div>
  )
}

/**
 * Run-validity banner for the evidence record. A run the test cannot support
 * is not a pass and not a fail, so the record states the validity before it
 * states any result, and lists every finding with the gates it bears on.
 * Findings come from the one assessRunValidity call the record already made,
 * which is also the call the gates read, so the two can never disagree.
 */
function RunValidityBanner({ assessment }: { assessment: RunValidityAssessment }) {
  const text = VALIDITY_TEXT[assessment.validity]
  return (
    <div className={`run-validity validity-${assessment.validity}`}>
      <div className="debrief-header">
        <div>
          <span className="debrief-kicker">RUN VALIDITY</span>
          <strong>{text.line}</strong>
        </div>
        <span className={`status ${text.cls}`}>{text.pill}</span>
      </div>
      {assessment.findings.map((finding) => (
        <div className="validity-finding" key={finding.id}>
          <span className={`status ${SEVERITY_PILL[finding.severity].cls}`}>
            {SEVERITY_PILL[finding.severity].text}
          </span>
          <span>
            {finding.message}
            <small> Gates: {finding.gates.join(', ')}.</small>
          </span>
        </div>
      ))}
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
  const runId = useStore((state) => state.playback.runId)
  const mcState = useStore((state) => state.mc)
  const mc = currentSummary(mcState, runId)
  const sensitivity = currentSensitivity(mcState, runId)
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
  // One sweep for the whole record: the banner, the gate populations, and
  // the gate caveats all read this single assessment, so they cannot disagree
  // and the spawn-in-ring scan runs once instead of once per consumer.
  const validity = useMemo(
    () => assessRunValidity(scenario, assessments),
    [scenario, assessments],
  )
  const requirements = useMemo(
    () => buildRequirementGateReport(scenario, assessments, report, validity),
    [scenario, assessments, report, validity],
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
        planning envelope · {formatTime(durationS)} observed · {trackCount} tracks · {componentCount} components · {report.events.length} events
      </div>
      <RunValidityBanner assessment={validity} />
      <RunActions
        scenario={scenario}
        assessments={assessments}
        report={report}
        aar={aar}
        durationS={durationS}
        mc={mc}
        sensitivity={sensitivity}
      />
      <OutcomeSummary scenario={scenario} assessments={assessments} report={report} mc={mc} />
      <AnalysisSection
        title="Requirement record · planning envelope"
        headline={`${requirements.met}/${requirements.required} met`}
        defaultOpen
      >
        <RequirementGates report={requirements} />
      </AnalysisSection>
      <AnalysisSection
        title="System and component record · planning envelope"
        headline={`${componentCount} components · ${totalSalvos(report.totals)} salvos`}
        defaultOpen
      >
        <SystemStatus groups={systems} expanded endOfRun />
      </AnalysisSection>
      <AnalysisSection
        title="Threat record · planning envelope"
        headline={`${trackCount} tracks · ${residualSectionHeadline(report.totals)}${
          report.totals.expectedLateKills > 0.005
            ? ` · ${report.totals.expectedLateKills.toFixed(2)} late E[k]`
            : ''
        }`}
        defaultOpen
      >
        <ThreatPicture groups={threats} mode="debrief" />
      </AnalysisSection>
      <AnalysisSection
        title="Engagement event ledger · planning envelope"
        headline={`${report.events.length} events`}
      >
        <EventLedgerList scenario={scenario} report={report} />
      </AnalysisSection>
    </div>
  )
}
