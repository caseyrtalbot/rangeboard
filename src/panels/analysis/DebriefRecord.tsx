import { useMemo, useState } from 'react'
import type { AarSummary, Scenario } from '../../model/types'
import type { AttritionReport } from '../../playback/attritionReport'
import type { McSummary, SensitivitySummary } from '../../playback/mcRun'
import type { ThreatAssessment } from '../../playback/sim'
import { trialResultOf, trialSnapshotAt, type TrialResultView } from '../../analysis/trialResult'
import { selectTrialSelection } from '../../state/trialSelectors'
import { selectRunComplete } from '../../state/selectors'
import { useTrialResult, trialStateText } from './controls'
import { buildRequirementGateReport } from '../../analysis/requirements'
import type { RunValidityAssessment } from '../../analysis/runValidity'
import { assessRunValidity } from '../../analysis/runValidity'
import { trialSystemTelemetryAt } from '../../analysis/systemTelemetry'
import { trialThreatPictureAt } from '../../analysis/threatAggregation'
import { useStore } from '../../state/store'
import { formatRunLabel } from '../../state/labels'
import { formatTime } from '../../geometry/geo'
import { exportRunRecord } from '../../io/persist'
import { downloadBoardFrame } from '../../canvas/frameCapture'
import { resetAnalysisRun } from '../../playback/runSession'
import { RequirementGates } from './RequirementGates'
import { SystemStatus } from './SystemStatus'
import { ThreatPicture } from './ThreatPicture'
import { currentSensitivity, currentSummary } from './mc'
import { SEVERITY_PILL, VALIDITY_TEXT } from './runValidityText'
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
  const [captureError, setCaptureError] = useState<string | null>(null)
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
        try {
          setCaptureError(
            downloadBoardFrame(`${scenario.name}-${label}-final`)
              ? null
              : 'Could not capture the board canvas.',
          )
        } catch (error) {
          setCaptureError(
            error instanceof Error ? error.message : 'Could not capture the board canvas.',
          )
        }
      }),
    )
  }

  return (
    <div className="debrief-actions">
      <button
        className="primary"
        onClick={() => {
          const state = useStore.getState()
          const selection = selectTrialSelection(state)
          const view =
            selection.status === 'ready' &&
            selection.runId === runId &&
            state.scenario === scenario &&
            state.playback.startedAtMs != null &&
            selectRunComplete(state)
              ? trialResultOf(selection.scenario, selection.result.manifest, selection.result)
              : null
          const trial = view && view.observedThroughS >= view.durationS ? view : null
          exportRunRecord(scenario, runMeta, assessments, report, aar, mc, sensitivity, trial)
        }}
      >
        Export debrief JSON
      </button>
      <button onClick={captureFinal}>Capture final PNG</button>
      <button onClick={() => resetAnalysisRun('manual')}>New clean run</button>
      {captureError && (
        <State tone="critical" role="status">
          {captureError}
        </State>
      )}
    </div>
  )
}

/**
 * Run-validity banner for the evidence record: the validity, then every finding
 * with the gates it bears on. Findings come from the one `assessRunValidity` call
 * the record already made, which is also the call the gates read.
 */
export function RunValidityBanner({ assessment }: { assessment: RunValidityAssessment }) {
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
  showTrialRecords = true,
}: {
  scenario: Scenario
  assessments: ThreatAssessment[]
  report: AttritionReport
  aar: AarSummary
  durationS: number
  /** A lens with the validity widget already exposes the full finding record. */
  showValidity?: boolean
  /** Outcome owns these disclosures when the record is mounted there. */
  showTrialRecords?: boolean
}) {
  const completedAtMs = useStore((state) => state.playback.completedAtMs)
  const startedAtMs = useStore((state) => state.playback.startedAtMs)
  const observedThroughS = useStore((state) => state.playback.observedThroughS)
  const runSeq = useStore((state) => state.playback.runSeq)
  const runId = useStore((state) => state.playback.runId)
  const currentScenario = useStore((state) => state.scenario)
  const mcState = useStore((state) => state.mc)
  const mc = currentSummary(mcState, runId)
  const sensitivity = currentSensitivity(mcState, runId)
  const complete =
    completedAtMs != null && startedAtMs != null && durationS > 0 && observedThroughS >= durationS
  const trial = useTrialResult()
  const selection = trial.selection
  const view =
    complete &&
    selection.status === 'ready' &&
    selection.runId === runId &&
    scenario === currentScenario
      ? trialResultOf(selection.scenario, selection.result.manifest, selection.result)
      : null
  const completedTrial = view && view.observedThroughS >= view.durationS ? view : null
  // Forecast validity and gates share an assessment; neither adjudicates the trial.
  const validity = useMemo(() => assessRunValidity(scenario, assessments), [scenario, assessments])
  const requirements = useMemo(
    () => buildRequirementGateReport(scenario, assessments, report, validity),
    [scenario, assessments, report, validity],
  )
  const systems = useMemo(
    () => (completedTrial ? trialSystemTelemetryAt(completedTrial, completedTrial.durationS) : []),
    [completedTrial],
  )
  const threats = useMemo(
    () => (completedTrial ? trialThreatPictureAt(completedTrial, completedTrial.durationS) : []),
    [completedTrial],
  )
  if (!complete || completedAtMs == null || startedAtMs == null) return null
  const componentCount = systems.reduce((sum, group) => sum + group.componentCount, 0)
  return (
    <details className="debrief-record evidence-products" open>
      <summary className="debrief-header" role="status">
        <strong>Evidence products</strong>
        <span>{formatRunLabel(runSeq)} · Complete</span>
      </summary>
      {showTrialRecords &&
        (completedTrial ? (
          <section aria-label="Completed simulated trial record">
            <p className="debrief-kicker">Completed simulated trial record</p>
            <details className="analysis-disclosure">
              <summary>Trial manifest</summary>
              <TrialManifestRecord view={completedTrial} />
            </details>
            <details className="analysis-disclosure">
              <summary>Trial system and component record · {componentCount} components</summary>
              <SystemStatus groups={systems} expanded endOfRun />
            </details>
            <details className="analysis-disclosure">
              <summary>Trial threat record</summary>
              <ThreatPicture groups={threats} mode="debrief" />
            </details>
            <details className="analysis-disclosure">
              <summary>
                Trial engagement event ledger · {completedTrial.attrition.events.length} events
              </summary>
              <TrialEventLedger view={completedTrial} />
            </details>
          </section>
        ) : (
          <p className="muted small">
            {trialStateText(selection)} · completed trial record unavailable
          </p>
        ))}
      <RunActions
        scenario={scenario}
        assessments={assessments}
        report={report}
        aar={aar}
        durationS={durationS}
        mc={mc}
        sensitivity={sensitivity}
      />
      <details className="analysis-disclosure" aria-label="Forecast requirements">
        <summary>
          Forecast · requirement record · {requirements.met}/{requirements.required} met
        </summary>
        <p className="muted small">
          Deterministic planning envelope · these gates do not adjudicate the simulated trial.
        </p>
        {showValidity && <RunValidityBanner assessment={validity} />}
        <RequirementGates report={requirements} />
      </details>
    </details>
  )
}

/** Achieved observation for Analyze; the completed record supplies the final horizon. */
export function TrialOutcomeSummary({
  view,
  horizonS,
}: {
  view: TrialResultView
  horizonS: number
}) {
  const snapshot = trialSnapshotAt(view, horizonS)
  const t = snapshot.observedThroughS
  const counts = snapshot.counts
  const first = (values: Array<number | null>) => {
    const reached = values.filter((value): value is number => value != null && value <= t)
    return reached.length ? formatTime(Math.min(...reached)) : '—'
  }
  const warnings = view.assessments.filter(
    (a) => a.arrivalS != null && a.arrivalS <= t && a.warningS != null,
  )
  const metrics: Array<[string, string | number]> = [
    ['Pre-arrival hard kills', counts.preArrivalHardKills],
    ['Pre-arrival mission kills', counts.preArrivalSoftKills],
    ['Late hard kills', counts.lateHardKills],
    ['Late mission kills', counts.lateSoftKills],
    ['Arrived undefeated', snapshot.reportedLeakers ?? '—'],
    ['Active at horizon', counts.activeAtHorizon],
    ['First detect', first(view.assessments.map((a) => a.firstDetectS))],
    [
      'First effect',
      first(view.attrition.events.filter((e) => e.killDelta === 1).map((e) => e.tEffectS)),
    ],
    [
      'Min warning',
      view.hasActiveAsset && warnings.length
        ? formatTime(Math.min(...warnings.map((a) => a.warningS!)))
        : '—',
    ],
  ]
  return (
    <div className="trial-summary">
      <p className="analysis-scope">
        Simulated trial · {snapshot.summary ? 'complete' : 'bounded observation'} · T+
        {formatTime(t)} observed
      </p>
      <div className="outcome-grid">
        {metrics.map(([label, value]) => (
          <div className="outcome-metric" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>
              {value === '—'
                ? 'unavailable or not reached'
                : typeof value === 'number'
                  ? 'trial count'
                  : 'reached trial milestone'}
            </small>
          </div>
        ))}
      </div>
      {!view.hasActiveAsset && (
        <p className="muted small">No defended asset · arrival and warning measures unavailable.</p>
      )}
    </div>
  )
}

export function TrialManifestRecord({ view }: { view: TrialResultView }) {
  return (
    <dl style={{ overflowWrap: 'anywhere' }}>
      {Object.entries(view.manifest).map(([key, value]) => (
        <div key={key}>
          <dt>{key}</dt>
          <dd>
            {Array.isArray(value) ? (
              value.length === 0 ? (
                'none'
              ) : (
                <code>{JSON.stringify(value)}</code>
              )
            ) : (
              (value ?? 'Build revision unavailable')
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function TrialEventLedger({ view }: { view: TrialResultView }) {
  const [visible, setVisible] = useState(20)
  const name = (id: string) => view.scenario.entities.find((entity) => entity.id === id)?.name ?? id
  return (
    <div className="event-ledger">
      {view.attrition.events.slice(0, visible).map((event, index) => {
        const jam =
          event.channel === 'jam'
            ? view.jamDecisions.find(
                (decision) =>
                  decision.effectorId === event.effectorId &&
                  decision.uasId === event.uasId &&
                  decision.tEffectS === event.tEffectS,
              )
            : null
        return (
          <div className="event-row" key={index}>
            <span className="event-time">
              {formatTime(event.tS)} → {formatTime(event.tEffectS)}
            </span>
            <span className="event-route">
              <strong>{name(event.effectorId)}</strong>
              <small>
                {name(event.uasId)} · ship {event.shipIdx + 1}
              </small>
            </span>
            <span className="event-effect">
              {event.killDelta} {event.softShot ? 'mission kills' : 'hard kills'}
              <small>
                {jam
                  ? `Jam ${jam.outcome === 1 ? 'succeeded' : 'failed'}`
                  : event.lateEffect
                    ? 'late effect'
                    : 'pre-arrival effect'}
              </small>
            </span>
          </div>
        )
      })}
      {view.attrition.events.length === 0 && (
        <p className="muted small">No engagement events recorded.</p>
      )}
      {visible < view.attrition.events.length && (
        <button onClick={() => setVisible((count) => count + 20)}>Show next events</button>
      )}
    </div>
  )
}
