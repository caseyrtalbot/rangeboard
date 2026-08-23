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
import { useStore } from '../state/store'
import type { AttritionReport } from '../playback/attrition'
import { formatSpeed } from '../geometry/geo'
import { mcdaParts, mcdaScore, WARNING_FULL_S } from '../analysis/mcda'
import { buildAarSummary } from '../analysis/aar'
import { engagementPicture } from '../analysis/impact'
import { LeakerWarningStrip } from './LeakerWarningStrip'
import {
  aarHeadline,
  environmentHeadline,
  magazinesHeadline,
  scoreHeadline,
} from './headlines'
import { AarBody, AarThreatLines, AarTotals } from './analysis/AarSection'
import { KpiTiles } from './analysis/KpiTiles'
import { LiveStrip } from './analysis/LiveStrip'
import { ThreatGroupList } from './analysis/ThreatList'

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
      <p className="muted small">
        Rain, fog, night, and EM clutter shrink sensor rings by technology. Cold, altitude, and
        wind reshape drone reach. Factors follow the COURAGEOUS C-UAS study; planning values.
      </p>
    </>
  )
}

/** Per-effector expected magazine use from the attrition sweep. */
function EffectorBody({ report }: { report: AttritionReport }) {
  const scenario = useStore((s) => s.scenario)
  return (
    <>
      <table className="threat-table">
        <tbody>
          {report.effectors.map((e) => {
            const ent = scenario.entities.find((x) => x.id === e.effectorId)
            const spec = scenario.library.find((m) => m.id === ent?.specId)?.effector
            const remaining =
              e.expectedRoundsRemaining != null
                ? `${e.expectedRoundsRemaining}${
                    spec?.magazineSize != null ? ` of ${spec.magazineSize}` : ''
                  } left${e.expectedRoundsRemaining <= 0 ? ' · empty' : ''}`
                : 'unlimited'
            return (
              <tr key={e.effectorId}>
                <td>{ent?.name ?? '—'}</td>
                <td>
                  {e.shotsFired} fired · {remaining}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="muted small">
        Expected raid outcome: {report.totals.expectedKills.toFixed(1)} of{' '}
        {report.totals.raidSize} ships killed ({report.totals.expectedHardKills.toFixed(1)} hard,{' '}
        {report.totals.expectedSoftKills.toFixed(1)} soft),{' '}
        {report.totals.expectedLeakers.toFixed(1)} leak through, {report.totals.shotsFired} shots.
      </p>
    </>
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
      {pinned.some((p) => p.aar) && (
        <div className="aar-compare">
          {pinned
            .filter((p) => p.aar)
            .map((p) => (
              <div className="aar-col" key={p.id}>
                <div className="aar-col-title">
                  {p.name} · {p.score}
                </div>
                <AarTotals aar={p.aar!} />
                <AarThreatLines aar={p.aar!} />
              </div>
            ))}
          {aar.threats.length > 0 && (
            <div className="aar-col">
              <div className="aar-col-title">Current{score != null ? ` · ${score}` : ''}</div>
              <AarTotals aar={aar} />
              <AarThreatLines aar={aar} />
            </div>
          )}
        </div>
      )}
      <p className="muted small">
        Parts are 0-100 over threats with paths; warning time scores full at {WARNING_FULL_S} s.
        Pin the score, change the laydown or environment, and compare. Pins made here carry the
        full AAR summary and compare side by side above.
      </p>
    </>
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
  const patchScenario = useStore((s) => s.patchScenario)
  const showThreatWez = useStore((s) => s.ui.showThreatWez)
  const setShowThreatWez = useStore((s) => s.setShowThreatWez)
  const displayUnits = useStore((s) => s.ui.units)
  const [advanced, setAdvanced] = useState(false)
  // One shared computation per scenario with the canvas WEZ layer
  // (module-level WeakMap in impact.ts), so the sweep never runs twice.
  const { assessments, report, impacts } = useMemo(() => engagementPicture(scenario), [scenario])
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
      {threats.length > 0 && <KpiTiles threats={threats} report={report} score={score} />}
      {/* Live-telemetry strip: all playback subscriptions live inside LiveStrip. */}
      <LiveStrip />
      <Section
        title="Environment"
        headline={environmentHeadline(scenario.environment, displayUnits)}
        headerExtra={<ApplyEffectsCheck />}
      >
        <EnvironmentBody />
      </Section>
      {assessments.length === 0 && (
        <p className="muted">Place a UAS threat on the canvas to analyze it.</p>
      )}
      <LeakerWarningStrip impacts={impacts} />
      {threats.length > 0 && <div className="panel-subtitle">Threats · {threats.length}</div>}
      <ThreatGroupList threats={threats} report={report} impacts={impacts} advanced={advanced} />
      {showMagazines && (
        <Section title="Effector magazines" headline={magazinesHeadline(aar)}>
          <EffectorBody report={report} />
        </Section>
      )}
      {aar.threats.length > 0 && (
        <Section title="After-action report" headline={aarHeadline(aar)}>
          <AarBody aar={aar} />
        </Section>
      )}
      {noPath > 0 && (
        <p className="muted">
          {noPath} UAS without a flight path. Draw a path with the Path tool to include them.
        </p>
      )}
      {(parts != null || pinned.length > 0) && (
        <Section title="Configuration score" headline={scoreHeadline(score)}>
          <ScorecardBody parts={parts} score={score} weights={weights} aar={aar} />
        </Section>
      )}
      <Section title="About these numbers">
        <p className="muted small">
          ROE: Hold = analyze only, no engagement. Tight = engage tracks classified hostile. Free =
          engage on first detection.
        </p>
        <p className="muted small">
          Warning time = arrival at the defended asset minus first detection. Windows start when
          the ROE gate is met. RF sensors do not see RF-silent threats; EO/IR needs a cue from
          another technology; radar sees bigger airframes farther than the drawn Group 1 ring.
          Computed at 0.5 s steps; planning figures, not test evidence.
        </p>
        <p className="muted small">
          PF = planning factor. WEZ effect radii and standoff ranges marked PF are laydown
          planning values tiered by warhead class, not study-derived lethality data.
        </p>
      </Section>
    </div>
  )
}
