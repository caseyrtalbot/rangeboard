import { useMemo } from 'react'
import type { AarSummary, Scenario } from '../../model/types'
import type { AttritionReport } from '../../playback/attritionReport'
import type { McSummary, SensitivitySummary } from '../../playback/mcRun'
import type { ThreatAssessment } from '../../playback/sim'
import { detectionsAt } from '../../playback/detection'
import { buildRequirementGateReport } from '../../analysis/requirements'
import type { RunValidityAssessment } from '../../analysis/runValidity'
import { assessRunValidity } from '../../analysis/runValidity'
import { systemTelemetryAt } from '../../analysis/systemTelemetry'
import { threatPictureAt } from '../../analysis/threatAggregation'
import { useStore } from '../../state/store'
import { formatRunLabel } from '../../state/labels'
import { formatTime } from '../../geometry/geo'
import { exportRunRecord } from '../../io/persist'
import { downloadBoardFrame } from '../../te/io/frameCapture'
import { resetAnalysisRun } from '../../playback/runSession'
import { residualSectionHeadline, totalSalvos } from '../headlines'
import { RequirementGates } from './RequirementGates'
import { SystemStatus } from './SystemStatus'
import { ThreatPicture } from './ThreatPicture'
import { EventLedgerList } from './widgets/EventLedgerWidget'
import { currentSensitivity, currentSummary } from './widgets/mc'
import { SEVERITY_PILL, VALIDITY_TEXT } from './widgets/RunValidityWidget'
import { State } from '../../ui/kit'

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
          <span className="debrief-kicker">Run validity</span>
          <strong>{text.line}</strong>
        </div>
        <State tone={text.tone}>{text.pill}</State>
      </div>
      {assessment.findings.map((finding) => (
        <div className="validity-finding" key={finding.id}>
          <State tone={SEVERITY_PILL[finding.severity].tone}>
            {SEVERITY_PILL[finding.severity].text}
          </State>
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
  showValidity = true,
}: {
  scenario: Scenario
  assessments: ThreatAssessment[]
  report: AttritionReport
  aar: AarSummary
  durationS: number
  /** A lens with the validity widget already exposes the full finding record. */
  showValidity?: boolean
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
    <details className="debrief-record evidence-products">
      <summary className="debrief-header">
        <strong>Evidence products</strong>
        <span>{formatRunLabel(runSeq)} · COMPLETE</span>
        <State tone={VALIDITY_TEXT[validity.validity].tone}>
          {VALIDITY_TEXT[validity.validity].pill}
        </State>
      </summary>
      <div className="debrief-header">
        <span className="debrief-kicker">Full-run requirement record</span>
        <State tone={requirements.overall === 'pass' ? 'nominal' : 'critical'}>
          {requirementLabel}
        </State>
      </div>
      <div className="debrief-meta">
        full run · planning envelope · {formatTime(durationS)} observed · {trackCount} tracks · {componentCount} components · {report.events.length} events
      </div>
      {showValidity && (
        <details className="analysis-disclosure">
          <summary>Full-run validity · {VALIDITY_TEXT[validity.validity].pill}</summary>
          <RunValidityBanner assessment={validity} />
        </details>
      )}
      <RunActions
        scenario={scenario}
        assessments={assessments}
        report={report}
        aar={aar}
        durationS={durationS}
        mc={mc}
        sensitivity={sensitivity}
      />
      <details className="analysis-disclosure">
        <summary>Full-run requirement record · {requirements.met}/{requirements.required} met</summary>
        <RequirementGates report={requirements} />
      </details>
      <details className="analysis-disclosure">
        <summary>Full-run system and component record · {componentCount} components · {totalSalvos(report.totals)} salvos</summary>
        <SystemStatus groups={systems} expanded endOfRun />
      </details>
      <details className="analysis-disclosure">
        <summary>Full-run threat record · {`${trackCount} tracks · ${residualSectionHeadline(report.totals)}${
          report.totals.expectedLateKills > 0.005
            ? ` · ${report.totals.expectedLateKills.toFixed(2)} late E[k]`
            : ''
        }`}</summary>
        <ThreatPicture groups={threats} mode="debrief" />
      </details>
      <details className="analysis-disclosure">
        <summary>Full-run engagement event ledger · {report.events.length} events</summary>
        <EventLedgerList scenario={scenario} report={report} />
      </details>
    </details>
  )
}
