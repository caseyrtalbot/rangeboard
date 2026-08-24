import { useMemo, useState } from 'react'
import type {
  AarSummary,
  EmBackground,
  LightLevel,
  McdaVector,
  Precipitation,
  Roe,
} from '../model/types'
import { newId } from '../model/types'
import { formatRunLabel, scenarioDurationS, useStore } from '../state/store'
import type { AttritionReport } from '../playback/attrition'
import type { ThreatAssessment } from '../playback/sim'
import { formatSpeed } from '../geometry/geo'
import { mcdaParts, mcdaScore, WARNING_FULL_S } from '../analysis/mcda'
import { buildAarSummary } from '../analysis/aar'
import { engagementPicture } from '../analysis/impact'
import { LeakerWarningStrip } from './LeakerWarningStrip'
import {
  aarHeadline,
  effectorExpenditureLine,
  environmentHeadline,
  magazinesHeadline,
  scoreHeadline,
} from './headlines'
import { AarBody } from './analysis/AarSection'
import { Info } from './analysis/Info'
import { KpiTiles } from './analysis/KpiTiles'
import { LiveStrip } from './analysis/LiveStrip'
import { PinCompare } from './analysis/PinCompare'
import { ThreatGroupList } from './analysis/ThreatList'
import { exportRunRecord } from '../io/persist'
import { downloadBoardFrame } from '../te/io/frameCapture'
import { resetAnalysisRun } from '../playback/runSession'

/**
 * Collapsible disclosure in the .subsection / .panel-subtitle idiom. Open
 * state is local UI state only; it resets on mount and is never written to
 * the scenario. `headerExtra` renders always-visible controls on the header
 * row without toggling the section.
 */
function Section({
  title,
  headline,
  defaultOpen = false,
  headerExtra,
  children,
}: {
  title: string
  headline?: string
  defaultOpen?: boolean
  headerExtra?: React.ReactNode
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="subsection">
      <div className="panel-subtitle section-head" onClick={() => setOpen((v) => !v)}>
        <span className={`chevron${open ? ' open' : ''}`}>▸</span>
        <span>{title}</span>
        <span className="section-right">
          {!open && headline ? <span className="section-headline">{headline}</span> : null}
          {headerExtra ? (
            <span className="section-extra" onClick={(e) => e.stopPropagation()}>
              {headerExtra}
            </span>
          ) : null}
        </span>
      </div>
      {open && children}
    </div>
  )
}

/**
 * Explicit boundary around all full-run model output. It is closed by
 * default so future events cannot read as observations at the current play
 * head; opening it is an intentional request to inspect the projection.
 */
export function FullRunProjection({ children }: { children: React.ReactNode }) {
  return (
    <Section
      title="Full-run projection"
      headline="not live"
      headerExtra={<AboutInfo />}
    >
      {children}
    </Section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

/** Segmented control: one active option, no typing. */
function Seg<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: Array<{ v: T; label: string }>
  onChange: (v: T) => void
}) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button
          key={o.v}
          className={value === o.v ? 'active' : ''}
          onClick={() => onChange(o.v)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

/** Applies-effects checkbox, always visible on the Environment header row. */
function ApplyEffectsCheck() {
  const apply = useStore((s) => s.scenario.environment.apply)
  const updateEnvironment = useStore((s) => s.updateEnvironment)
  return (
    <label className="apply-check" title="Apply environment effects to sensors and threats">
      <input
        type="checkbox"
        checked={apply}
        onChange={(e) => updateEnvironment({ apply: e.target.checked })}
      />
      apply
    </label>
  )
}

/** Scenario covariates. Feed UAS range rings and sensor footprints. */
function EnvironmentBody() {
  const env = useStore((s) => s.scenario.environment)
  const units = useStore((s) => s.ui.units)
  const updateEnvironment = useStore((s) => s.updateEnvironment)
  const cardinal = CARDINALS[Math.round(env.windFromDeg / 45) % 8]
  return (
    <>
      <div className="field-row">
        <Field label="Sky">
          <Seg
            value={env.precipitation ?? 'clear'}
            options={[
              { v: 'clear' as Precipitation, label: 'Clear' },
              { v: 'rain' as Precipitation, label: 'Rain' },
              { v: 'fog' as Precipitation, label: 'Fog' },
            ]}
            onChange={(v) => updateEnvironment({ precipitation: v })}
          />
        </Field>
        <Field label="Light">
          <Seg
            value={env.light ?? 'day'}
            options={[
              { v: 'day' as LightLevel, label: 'Day' },
              { v: 'night' as LightLevel, label: 'Night' },
            ]}
            onChange={(v) => updateEnvironment({ light: v })}
          />
        </Field>
      </div>
      <Field label="EM clutter">
        <Seg
          value={env.emBackground ?? 'rural'}
          options={[
            { v: 'rural' as EmBackground, label: 'Rural (quiet)' },
            { v: 'urban' as EmBackground, label: 'Urban (dense)' },
          ]}
          onChange={(v) => updateEnvironment({ emBackground: v })}
        />
      </Field>
      <div className="field-row">
        <Field label={`Wind ${formatSpeed(env.windSpeedMps, units)}`}>
          <input
            type="range"
            min={0}
            max={25}
            value={env.windSpeedMps}
            onChange={(e) => updateEnvironment({ windSpeedMps: Number(e.target.value) })}
          />
        </Field>
        <Field label={`From ${env.windFromDeg} deg (${cardinal})`}>
          <input
            type="range"
            min={0}
            max={355}
            step={5}
            value={env.windFromDeg}
            onChange={(e) => updateEnvironment({ windFromDeg: Number(e.target.value) })}
          />
        </Field>
      </div>
      <div className="field-row">
        <Field label={`Temperature ${env.temperatureC} C`}>
          <input
            type="range"
            min={-30}
            max={50}
            value={env.temperatureC}
            onChange={(e) => updateEnvironment({ temperatureC: Number(e.target.value) })}
          />
        </Field>
        <Field label="Field elevation (ft)">
          <input
            type="number"
            step={500}
            value={env.fieldElevationFt}
            onChange={(e) => updateEnvironment({ fieldElevationFt: Number(e.target.value) })}
          />
        </Field>
      </div>
    </>
  )
}

/** Environment methodology note, out of the flow. */
function EnvironmentInfo() {
  return (
    <Info label="About environment effects">
      <p>Rain, fog, night, and EM clutter shrink sensor rings by technology.</p>
      <p>Cold, altitude, and wind reshape UAS reach.</p>
      <p>Factors follow the COURAGEOUS C-UAS study. Planning values.</p>
    </Info>
  )
}

/** Per-effector expected magazine use from the attrition sweep. */
function EffectorBody({
  report,
  mode = 'actual',
}: {
  report: AttritionReport
  mode?: 'actual' | 'projected'
}) {
  const scenario = useStore((s) => s.scenario)
  const projected = mode === 'projected'
  return (
    <table className="threat-table">
      <tbody>
        {report.effectors.map((e) => {
          const ent = scenario.entities.find((x) => x.id === e.effectorId)
          const spec = scenario.library.find((m) => m.id === ent?.specId)?.effector
          const remaining =
            e.expectedRoundsRemaining != null
              ? projected
                ? `${e.expectedRoundsRemaining}${
                    spec?.magazineSize != null ? ` of ${spec.magazineSize}` : ''
                  } after run${e.expectedRoundsRemaining <= 0 ? ' · empty' : ''}`
                : `${e.expectedRoundsRemaining}${
                    spec?.magazineSize != null ? ` of ${spec.magazineSize}` : ''
                  } left${e.expectedRoundsRemaining <= 0 ? ' · empty' : ''}`
              : projected
                ? 'unlimited capacity'
                : 'unlimited'
          const fired = effectorExpenditureLine(
            {
              effectorType: spec?.effectorType ?? null,
              shotsFired: e.shotsFired,
              jamSalvos: e.jamSalvos,
            },
            mode,
          )
          return (
            <tr key={e.effectorId}>
              <td>{ent?.name ?? '—'}</td>
              <td>
                {fired} · {remaining}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/** A scrub to the end is not completion: the observed horizon must reach it. */
function CompletedAar({ aar, durationS }: { aar: AarSummary; durationS: number }) {
  const completedAtMs = useStore((s) => s.playback.completedAtMs)
  const observedThroughS = useStore.getState().playback.observedThroughS
  if (durationS <= 0 || completedAtMs == null || observedThroughS < durationS) return null
  return (
    <Section title="AAR · completed simulation run" headline={aarHeadline(aar)}>
      <AarBody aar={aar} />
    </Section>
  )
}

/** Post-run offer: save the complete event/configuration package or capture the final board. */
function CompletedRunActions({
  assessments,
  report,
  aar,
  durationS,
}: {
  assessments: ThreatAssessment[]
  report: AttritionReport
  aar: AarSummary
  durationS: number
}) {
  const scenario = useStore((s) => s.scenario)
  const completedAtMs = useStore((s) => s.playback.completedAtMs)
  const startedAtMs = useStore((s) => s.playback.startedAtMs)
  const runId = useStore((s) => s.playback.runId)
  const runSeq = useStore((s) => s.playback.runSeq)
  const playback = useStore.getState().playback
  if (
    durationS <= 0 ||
    completedAtMs == null ||
    startedAtMs == null ||
    playback.observedThroughS < durationS
  ) {
    return null
  }
  const label = formatRunLabel(runSeq)
  const runMeta = {
    id: runId,
    label,
    sequence: runSeq,
    startedAt: new Date(startedAtMs).toISOString(),
    completedAt: new Date(completedAtMs).toISOString(),
    durationS,
    observedThroughS: playback.observedThroughS,
  }

  function captureFinal() {
    useStore.getState().scrubTo(durationS)
    // Let React and Konva render the final playhead before reading the stage.
    window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() => {
        if (!downloadBoardFrame(`${scenario.name}-${label}-final`)) {
          window.alert('Could not capture the board canvas.')
        }
      }),
    )
  }

  return (
    <div className="run-complete-card" role="status">
      <div>
        <strong>{label} complete</strong>
        <span> · {durationS.toFixed(0)} s observed · run buffer sealed</span>
      </div>
      <p>
        Save now: the run package includes configuration, stage times, salvo/effect ledger, and
        AAR.
      </p>
      <div className="inspector-actions">
        <button
          className="primary"
          onClick={() => exportRunRecord(scenario, runMeta, assessments, report, aar)}
        >
          Export run data
        </button>
        <button onClick={captureFinal}>Capture final PNG</button>
        <button onClick={() => resetAnalysisRun('manual')}>New clean run</button>
      </div>
    </div>
  )
}

const WEIGHT_LABELS: Array<{ key: keyof McdaVector; label: string }> = [
  { key: 'warning', label: 'Warning time' },
  { key: 'coverage', label: 'Detection coverage' },
  { key: 'confirm', label: 'Confirmed tracks' },
  { key: 'engage', label: 'Engageable threats' },
  { key: 'attrition', label: 'Attrition (expected kills)' },
]

/** Old saves have no attrition weight; default it without touching the save. */
function fullWeights(w?: McdaVector): Required<McdaVector> {
  return {
    warning: w?.warning ?? 3,
    coverage: w?.coverage ?? 3,
    confirm: w?.confirm ?? 2,
    engage: w?.engage ?? 3,
    attrition: w?.attrition ?? 3,
  }
}

/** Weighted configuration score (COURAGEOUS eq. 1) with pinned comparisons. */
function ScorecardBody({
  parts,
  score,
  weights,
  aar,
}: {
  parts: ReturnType<typeof mcdaParts>
  score: number | null
  weights: Required<McdaVector>
  aar: AarSummary
}) {
  const scenario = useStore((s) => s.scenario)
  const patchScenario = useStore((s) => s.patchScenario)
  const units = useStore((s) => s.ui.units)
  const pinned = scenario.scorecards ?? []

  return (
    <>
      {WEIGHT_LABELS.map(({ key, label }) => (
        <div className="field-row" key={key}>
          <Field label={`${label} · weight ${weights[key]}`}>
            <input
              type="range"
              min={0}
              max={5}
              value={weights[key]}
              onChange={(e) =>
                patchScenario({ mcdaWeights: { ...weights, [key]: Number(e.target.value) } })
              }
            />
          </Field>
          <div className="score-part">
            {parts?.[key] != null ? Math.round(parts[key]! * 100) : '—'}
          </div>
        </div>
      ))}
      {score != null && (
        <div className="score-total">
          <span>Weighted score</span>
          <strong>{score} / 100</strong>
          <button
            className="mini"
            onClick={() =>
              patchScenario({
                scorecards: [
                  ...pinned,
                  {
                    id: newId('scc'),
                    name: `${scenario.roe ?? 'tight'} · ${environmentHeadline(scenario.environment, units)} · ${score}`,
                    score,
                    parts: parts!,
                    aar,
                  },
                ],
              })
            }
          >
            Pin for comparison
          </button>
        </div>
      )}
      {pinned.map((p) => (
        <div className="score-pin" key={p.id}>
          <input
            value={p.name}
            onChange={(e) =>
              patchScenario({
                scorecards: pinned.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)),
              })
            }
          />
          <strong>{p.score}</strong>
          <button
            className="mini"
            onClick={() => patchScenario({ scorecards: pinned.filter((x) => x.id !== p.id) })}
          >
            ×
          </button>
        </div>
      ))}
      <PinCompare pins={pinned} current={aar} currentScore={score} />
    </>
  )
}

/** Scorecard methodology note, out of the flow. */
function ScoreInfo() {
  return (
    <Info label="About the configuration score">
      <p>Each part scores 0-100 over threats with paths.</p>
      <p>Warning time scores full at {WARNING_FULL_S} s.</p>
      <p>Pin the score, change the laydown or environment, and compare pins row by row.</p>
    </Info>
  )
}

/**
 * Computed engagement picture for every threat with a flight path. Compact by
 * default: KPI tiles, one line per threat group, collapsed sections with
 * headline numbers.
 * Every datum the full cards showed stays reachable within two clicks (expand
 * a row or section; flip Advanced telemetry for the deep rows). All
 * expansion state is local and resets per mount.
 */
export function AnalysisPanel() {
  const scenario = useStore((s) => s.scenario)
  const runId = useStore((s) => s.playback.runId)
  const patchScenario = useStore((s) => s.patchScenario)
  const showThreatWez = useStore((s) => s.ui.showThreatWez)
  const setShowThreatWez = useStore((s) => s.setShowThreatWez)
  const displayUnits = useStore((s) => s.ui.units)
  const [advanced, setAdvanced] = useState(false)
  // One shared computation per scenario with the canvas WEZ layer
  // (module-level WeakMap in impact.ts), so the sweep never runs twice.
  const { assessments, report, impacts } = useMemo(
    () => {
      void runId
      return engagementPicture(scenario)
    },
    [scenario, runId],
  )
  const aar = useMemo(
    () => buildAarSummary(scenario, assessments, report, impacts),
    [scenario, assessments, report, impacts],
  )
  const threats = assessments.filter((a) => a.status !== 'no-path')
  const noPath = assessments.length - threats.length
  const weights = fullWeights(scenario.mcdaWeights)
  const parts = useMemo(() => mcdaParts(assessments, report), [assessments, report])
  const score = parts ? mcdaScore(parts, weights) : null
  const pinned = scenario.scorecards ?? []
  const durationS = useMemo(() => scenarioDurationS(scenario), [scenario])
  const showMagazines =
    threats.length > 0 && report.effectors.length > 0 && report.totals.raidSize > 0

  return (
    <div className="inspector-body">
      <div className="analysis-header">
        <span className="roe-label">ROE</span>
        <Seg
          value={scenario.roe ?? 'tight'}
          options={[
            { v: 'hold' as Roe, label: 'Hold' },
            { v: 'tight' as Roe, label: 'Tight' },
            { v: 'free' as Roe, label: 'Free' },
          ]}
          onChange={(v) => patchScenario({ roe: v })}
        />
        <label className="adv-toggle" title="Draw threat weapon engagement zones on the canvas">
          <input
            type="checkbox"
            checked={showThreatWez}
            onChange={(e) => setShowThreatWez(e.target.checked)}
          />
          WEZ
        </label>
        <label className="adv-toggle" title="Reveal the deep telemetry rows in expanded threats">
          <input
            type="checkbox"
            checked={advanced}
            onChange={(e) => setAdvanced(e.target.checked)}
          />
          Advanced telemetry
        </label>
      </div>
      {/* LIVE: battle state at the playback instant. All simTimeS subscriptions
          stay inside LiveStrip so playback re-renders only this subtree. */}
      <LiveStrip />
      <Section
        title="Environment"
        headline={environmentHeadline(scenario.environment, displayUnits)}
        headerExtra={
          <>
            <ApplyEffectsCheck />
            <EnvironmentInfo />
          </>
        }
      >
        <EnvironmentBody />
      </Section>
      {assessments.length === 0 && (
        <p className="muted">Place a UAS threat on the canvas to analyze it.</p>
      )}
      {noPath > 0 && (
        <p className="muted">
          {noPath} UAS without a flight path. Draw a path with the Path tool to include them.
        </p>
      )}
      {/* Every datum below is a modeled full-run result, not current telemetry.
          Keep it behind an explicit, closed-by-default horizon boundary. */}
      <FullRunProjection>
        {threats.length > 0 && <KpiTiles threats={threats} report={report} score={score} />}
        <LeakerWarningStrip impacts={impacts} />
        {threats.length > 0 && (
          <div className="panel-subtitle">Projected threats · {threats.length}</div>
        )}
        <ThreatGroupList
          threats={threats}
          report={report}
          impacts={impacts}
          advanced={advanced}
          mode="projected"
        />
        {showMagazines && (
          <Section
            title="Projected expenditure"
            headline={magazinesHeadline(aar, 'projected')}
          >
            <EffectorBody report={report} mode="projected" />
          </Section>
        )}
        {aar.threats.length > 0 && (
          <Section title="Projected outcome" headline={aarHeadline(aar)}>
            <AarBody aar={aar} mode="projected" />
          </Section>
        )}
        {(parts != null || pinned.length > 0) && (
          <Section
            title="Projected configuration score"
            headline={scoreHeadline(score)}
            headerExtra={<ScoreInfo />}
          >
            <ScorecardBody parts={parts} score={score} weights={weights} aar={aar} />
          </Section>
        )}
      </FullRunProjection>
      <CompletedRunActions
        assessments={assessments}
        report={report}
        aar={aar}
        durationS={durationS}
      />
      <CompletedAar aar={aar} durationS={durationS} />
    </div>
  )
}

/**
 * Panel-level methodology popover on the Forecast head row. Replaces the old
 * inline "About these numbers" section.
 */
function AboutInfo() {
  return (
    <Info label="About these numbers">
      <p>
        This section is a deterministic full-run projection. It can include future detections,
        engagements, expenditure, and outcomes; it is not live telemetry. The live strip above
        reports only events at or before the play head.
      </p>
      <p>
        ROE · Hold: analyze only, no engagement. Tight: engage tracks classified hostile. Free:
        engage on first detection.
      </p>
      <p>
        Warning time = arrival at the defended asset minus first detection. Engagement windows
        open when the ROE gate is met.
      </p>
      <p>
        RF sensors do not hear RF-silent threats. EO/IR needs a cue from another technology.
        Radar sees larger airframes farther than the drawn Group 1 ring.
      </p>
      <p>
        PF = planning factor. WEZ effect radii and standoff ranges marked PF are tiered by
        warhead class, not measured lethality.
      </p>
      <p>Computed at 0.5 s steps. Planning figures, not test evidence.</p>
    </Info>
  )
}
