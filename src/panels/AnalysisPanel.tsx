import { useMemo, useState } from 'react'
import type {
  AarOutcome,
  AarSummary,
  AarThreatRow as AarThreatRowData,
  EmBackground,
  LightLevel,
  McdaVector,
  Precipitation,
  Roe,
} from '../model/types'
import { newId } from '../model/types'
import type { SpecModel } from '../model/types'
import { useStore } from '../state/store'
import type { ClassificationTimes, ThreatAssessment, ThreatStatus } from '../playback/sim'
import type { AttritionReport, ThreatAttrition } from '../playback/attrition'
import { formatDistance, formatSpeed, formatTime } from '../geometry/geo'
import type { DisplayUnits } from '../geometry/geo'
import { mcdaParts, mcdaScore, WARNING_FULL_S } from '../analysis/mcda'
import { buildAarSummary } from '../analysis/aar'
import type { LeakerImpact } from '../analysis/impact'
import { engagementPicture, SEVERITY_LABEL, wezKindFor, wezRadiusM } from '../analysis/impact'
import { LeakerWarningStrip } from './LeakerWarningStrip'
import {
  TIER_CLS,
  aarHeadline,
  environmentHeadline,
  magazinesHeadline,
  scoreHeadline,
  threatCompactStats,
} from './headlines'
import { exportAar } from '../io/persist'

const STATUS_TEXT: Record<ThreatStatus, { label: string; short: string; cls: string }> = {
  'no-path': { label: 'No flight path', short: 'No path', cls: 'neutral' },
  'never-detected': { label: 'Never detected', short: 'Undetected', cls: 'bad' },
  'not-confirmed': {
    label: 'Detected, never classified hostile',
    short: 'Never hostile',
    cls: 'warn',
  },
  'detect-only': { label: 'Detected, no usable effector', short: 'Detect only', cls: 'warn' },
  'no-kill-chain': {
    label: 'Detected, kill chain not connected',
    short: 'No kill chain',
    cls: 'warn',
  },
  'weapons-hold': { label: 'Weapons hold (ROE)', short: 'Hold', cls: 'neutral' },
  'window-too-short': { label: 'Engagement window too short', short: 'Short window', cls: 'warn' },
  engageable: { label: 'Engageable', short: 'Engageable', cls: 'good' },
}

const TECH_LABEL: Record<string, string> = {
  radar: 'radar',
  'eo-ir': 'EO/IR',
  acoustic: 'acoustic',
  rf: 'RF',
}

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

/** One-line derived classification history: unknown -> suspected -> hostile with times. */
function classificationTimeline(c: ClassificationTimes): string {
  if (c.unknownAtS == null) return 'pending · never detected'
  const steps = [`unknown ${formatTime(c.unknownAtS)}`]
  if (c.suspectedAtS != null) steps.push(`suspected ${formatTime(c.suspectedAtS)}`)
  if (c.hostileAtS != null) steps.push(`hostile ${formatTime(c.hostileAtS)}`)
  const tail =
    c.hostileAtS != null ? '' : c.suspectedAtS != null ? ' · never hostile' : ' · never suspected'
  return steps.join(' → ') + tail
}

/**
 * Engagement-potential line copy: WEZ membership at arrival, expected ships
 * and leaked warhead, severity tier, and any jam degrade. Honest blanks:
 * unknown radius reads "r unknown" (asset assumed inside, conservative) and
 * an unknown warhead reads "warhead unknown", never 0.
 */
function engagementPotentialText(
  a: ThreatAssessment,
  imp: LeakerImpact | undefined,
  kind: ReturnType<typeof wezKindFor>,
  radiusM: number | null,
  units: DisplayUnits,
): string {
  if (kind === 'none') return 'no weapon zone (ISR or decoy platform)'
  if (!imp) return '—'
  if (imp.assetId == null) return 'no asset placed'
  if (!imp.assetInWez) {
    return `target outside WEZ (CPA ${formatDistance(a.closestApproachM ?? 0, units)} > r ${formatDistance(
      radiusM ?? 0,
      units,
    )})`
  }
  const inside = radiusM == null ? 'target assumed inside WEZ (r unknown)' : 'target inside WEZ'
  const parts = [
    imp.arrivalS != null ? `${inside} at ${formatTime(imp.arrivalS)}` : inside,
    `${imp.expectedShipsArriving.toFixed(1)} ships`,
    imp.expectedWarheadKg > 0 ? `${Math.round(imp.expectedWarheadKg)} kg` : 'warhead unknown',
    imp.severity != null ? SEVERITY_LABEL[imp.severity] : 'below warning floor',
  ]
  if (imp.jamDegradedProb > 0.005) {
    parts.push(`arrives jam-degraded ${Math.round(imp.jamDegradedProb * 100)}%`)
  }
  return parts.join(' · ')
}

/** Per-channel kill split for the advanced view: hard, soft (jam), jam-degraded arrival. */
function killSplitText(att: ThreatAttrition | undefined, name: (id: string | null) => string) {
  if (
    !att ||
    (att.expectedHardKills <= 0.0005 &&
      att.expectedSoftKills <= 0.0005 &&
      att.continueJamProb <= 0.0005)
  ) {
    return '—'
  }
  return [
    att.shipCount > 1
      ? `${att.expectedHardKills.toFixed(1)} hard kill · ${att.expectedSoftKills.toFixed(1)} soft kill (jam)`
      : `hard kill ${Math.round(att.expectedHardKills * 100)}% · soft kill (jam) ${Math.round(att.expectedSoftKills * 100)}%`,
    att.killedByEffectorId
      ? `dominant ${name(att.killedByEffectorId)}${att.killedBySoft ? ' (jam)' : ''}`
      : null,
    att.continueJamProb > 0.0005
      ? `arrives jam-degraded ${Math.round(att.continueJamProb * 100)}%`
      : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** Expanded telemetry table. Advanced adds the deep rows the old cards showed. */
function ThreatDetail({
  a,
  att,
  imp,
  advanced,
  name,
  threatModel,
}: {
  a: ThreatAssessment
  att?: ThreatAttrition
  imp?: LeakerImpact
  advanced: boolean
  name: (id: string | null) => string
  threatModel?: SpecModel
}) {
  const units = useStore((s) => s.ui.units)
  const status = STATUS_TEXT[a.status]
  const outcome = att
    ? att.shipCount > 1
      ? `${att.expectedKills.toFixed(1)} of ${att.shipCount} ships expected killed · ${Math.round(
          att.leakProbability * 100,
        )}% leak`
      : `expected kill ${Math.round(att.expectedKills * 100)}% · leak ${Math.round(
          att.leakProbability * 100,
        )}%`
    : '—'
  return (
    <>
      <table className="threat-table">
        <tbody>
          <tr>
            <td>Status</td>
            <td>{status.label}</td>
          </tr>
          <tr>
            <td>First detection</td>
            <td>
              {a.firstDetectS != null
                ? `${formatTime(a.firstDetectS)} by ${name(a.firstDetectSensorId)}`
                : 'none'}
            </td>
          </tr>
          {advanced && (
            <tr>
              <td>Detecting sensors</td>
              <td>
                {a.detectingSensorIds.length > 0
                  ? a.detectingSensorIds.map((id) => name(id)).join(', ')
                  : 'none'}
              </td>
            </tr>
          )}
          <tr>
            <td>Classification</td>
            <td>{classificationTimeline(a.classificationAtS)}</td>
          </tr>
          {advanced && (
            <tr>
              <td>Confirmed (2 techs)</td>
              <td>
                {a.firstConfirmS != null
                  ? `${formatTime(a.firstConfirmS)} · ${a.techs.map((t) => TECH_LABEL[t]).join(' + ')}`
                  : a.techs.length === 1
                    ? `never · ${TECH_LABEL[a.techs[0]]} only`
                    : 'never'}
              </td>
            </tr>
          )}
          <tr>
            <td>Arrival at asset</td>
            <td>
              {a.arrivalS != null
                ? `${formatTime(a.arrivalS)} · ${name(a.assetId)} · CPA ${formatDistance(
                    a.closestApproachM ?? 0,
                    units,
                  )}`
                : 'no asset placed'}
            </td>
          </tr>
          <tr>
            <td>Best window</td>
            <td>
              {a.windowS
                ? `${formatTime(a.windowS[0])} – ${formatTime(a.windowS[1])} (${Math.round(
                    a.windowS[1] - a.windowS[0],
                  )} s) · ${name(a.windowEffectorId)}`
                : 'none after track quality is met'}
            </td>
          </tr>
          {advanced && (
            <tr>
              <td>Shots fired</td>
              <td>
                {att && att.shotsFired > 0
                  ? `${att.shotsFired}${
                      att.firstShotS != null ? ` · first at ${formatTime(att.firstShotS)}` : ''
                    }`
                  : 'none'}
              </td>
            </tr>
          )}
          <tr>
            <td>Outcome</td>
            <td>{outcome}</td>
          </tr>
          {advanced && (
            <tr>
              <td>Kill split</td>
              <td>{killSplitText(att, name)}</td>
            </tr>
          )}
          <tr>
            <td>Engagement potential</td>
            <td>
              {engagementPotentialText(a, imp, wezKindFor(threatModel), wezRadiusM(threatModel), units)}
            </td>
          </tr>
        </tbody>
      </table>
      {advanced && a.swarmMerged && (
        <p className="muted small">
          Formation merges into one track: no detecting sensor can split ships at this spacing.
          The defense does not know the count.
        </p>
      )}
    </>
  )
}

/**
 * One compact line per threat: name · status chip · warning · window · leak.
 * Click toggles the detail table; the amber I&W line shows whenever leak
 * probability reaches 0.5 or an impact severity is set. Expansion is local
 * state, reset per mount.
 */
function ThreatRowCompact({
  a,
  att,
  imp,
  advanced,
}: {
  a: ThreatAssessment
  att?: ThreatAttrition
  imp?: LeakerImpact
  advanced: boolean
}) {
  const [open, setOpen] = useState(false)
  const scenario = useStore((s) => s.scenario)
  const name = (id: string | null) => scenario.entities.find((e) => e.id === id)?.name ?? '—'
  const status = STATUS_TEXT[a.status]
  const stats = threatCompactStats(a, att)
  const threatModel = scenario.library.find(
    (m) => m.id === scenario.entities.find((e) => e.id === a.uasId)?.specId,
  )
  const severity = imp?.severity ?? null
  const showIw = (att != null && att.leakProbability >= 0.5) || severity != null
  // "Reaches" only when the target sits inside the WEZ; a leaker whose closest
  // approach stays outside the WEZ passes, it does not reach.
  const iwVerb = imp?.assetInWez ? 'Reaches' : 'Passes'
  const iwText = imp?.assetName
    ? `${iwVerb} ${imp.assetName}${imp.arrivalS != null ? ` T+${formatTime(imp.arrivalS)}` : ''}`
    : 'High leak probability'

  return (
    <div className="threat-row compact">
      <div className="threat-compact" onClick={() => setOpen((v) => !v)}>
        <span className={`chevron${open ? ' open' : ''}`}>▸</span>
        <span className="threat-name">{name(a.uasId)}</span>
        <span className={`status ${status.cls}`} title={status.label}>
          {status.short}
        </span>
        <span className="threat-stats" title="warning time · engagement window · leak probability">
          warn {stats.warning} · win {stats.window} · leak {stats.leak}
        </span>
      </div>
      {showIw && (
        <div className="iw-line">
          <span className={`status ${severity != null ? TIER_CLS[severity] : 'warn'}`}>
            I&W{severity != null ? ` ${SEVERITY_LABEL[severity]}` : ''}
          </span>
          {iwText}
        </div>
      )}
      {open && (
        <ThreatDetail
          a={a}
          att={att}
          imp={imp}
          advanced={advanced}
          name={name}
          threatModel={threatModel}
        />
      )}
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

const OUTCOME_TEXT: Record<AarOutcome, { label: string; cls: string }> = {
  'hard-kill': { label: 'hard kill', cls: 'good' },
  'soft-kill': { label: 'soft kill (jam)', cls: 'good' },
  leaker: { label: 'leaker', cls: 'bad' },
  'not-engaged': { label: 'not engaged', cls: 'warn' },
}

/** Compact classification cell: highest rung reached and when. */
function classifyCell(t: AarThreatRowData): string {
  if (t.hostileAtS != null) return `hostile ${formatTime(t.hostileAtS)}`
  if (t.suspectedAtS != null) return `suspect ${formatTime(t.suspectedAtS)}`
  if (t.unknownAtS != null) return `unknown ${formatTime(t.unknownAtS)}`
  return 'never'
}

const aarTime = (v: number | null) => (v == null ? '—' : formatTime(v))
const aarPct = (v: number | null) => (v == null ? '—' : `${Math.round(v * 100)}%`)

/**
 * Impact cell from the optional I&W row fields. Three states: a severity
 * tier with the expected arriving mass, 'none' when the row was assessed and
 * nothing warns (severity present but null), and '—' for pins made before
 * the fields existed.
 */
function aarImpactCell(t: AarThreatRowData): string {
  if (t.impactSeverity != null) {
    const kg =
      (t.expectedWarheadKg ?? 0) > 0 ? ` · ${Math.round(t.expectedWarheadKg!)} kg` : ''
    return `${SEVERITY_LABEL[t.impactSeverity]} · ${(t.expectedShipsArriving ?? 0).toFixed(1)} ships${kg}`
  }
  return t.impactSeverity === null ? 'none' : '—'
}

/** AAR totals and per-effector shot ledger. Renders from the summary alone. */
function AarTotals({ aar }: { aar: AarSummary }) {
  return (
    <>
      <table className="threat-table">
        <tbody>
          <tr>
            <td>Raid size</td>
            <td>
              {aar.raidSize} ships · ROE {aar.roe}
            </td>
          </tr>
          <tr>
            <td>Hard kills</td>
            <td>{aar.expectedHardKills.toFixed(1)}</td>
          </tr>
          <tr>
            <td>Soft kills (jam)</td>
            <td>{aar.expectedSoftKills.toFixed(1)}</td>
          </tr>
          <tr>
            <td>Leakers</td>
            <td>
              {aar.expectedLeakers.toFixed(1)} · {aarPct(aar.leakProbability)}
            </td>
          </tr>
          <tr>
            <td>First detection</td>
            <td>{aarTime(aar.firstDetectS)}</td>
          </tr>
          <tr>
            <td>First shot</td>
            <td>{aarTime(aar.firstShotS)}</td>
          </tr>
          <tr>
            <td>Shots fired</td>
            <td>{aar.shotsFired}</td>
          </tr>
        </tbody>
      </table>
      {aar.effectors.length > 0 && (
        <table className="threat-table">
          <tbody>
            {aar.effectors.map((e) => (
              <tr key={e.effectorId}>
                <td>{e.name}</td>
                <td>
                  {e.shotsFired} fired ·{' '}
                  {e.expectedRoundsRemaining != null
                    ? `${e.expectedRoundsRemaining}${
                        e.magazineSize != null ? ` of ${e.magazineSize}` : ''
                      } left`
                    : 'unlimited'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}

/** One compact line per threat, for narrow pinned-comparison columns. */
function AarThreatLines({ aar }: { aar: AarSummary }) {
  return (
    <>
      {aar.threats.map((t) => (
        <div className="aar-threat-line" key={t.uasId}>
          <strong>{t.name}</strong>
          {t.shipCount > 1 ? ` ×${t.shipCount}` : ''} · det {aarTime(t.detectS)} ·{' '}
          {classifyCell(t)} · shot {aarTime(t.engageS)} ·{' '}
          <span className={`status ${OUTCOME_TEXT[t.outcome].cls}`}>
            {OUTCOME_TEXT[t.outcome].label}
          </span>
          {t.impactSeverity != null && (
            <>
              {' · '}
              <span className={`status ${TIER_CLS[t.impactSeverity]}`}>
                I&W {SEVERITY_LABEL[t.impactSeverity]}
              </span>
            </>
          )}
        </div>
      ))}
    </>
  )
}

/** After-action report: totals, magazines, and the per-threat timeline. */
function AarBody({ aar }: { aar: AarSummary }) {
  const name = useStore((s) => s.scenario.name)
  return (
    <>
      <AarTotals aar={aar} />
      <table className="aar-threat-table">
        <thead>
          <tr>
            <th>Threat</th>
            <th>Detect</th>
            <th>Classify</th>
            <th>Engage</th>
            <th>Outcome</th>
            <th>Impact</th>
          </tr>
        </thead>
        <tbody>
          {aar.threats.map((t) => (
            <tr key={t.uasId}>
              <td>
                {t.name}
                {t.shipCount > 1 ? ` ×${t.shipCount}` : ''}
              </td>
              <td>{aarTime(t.detectS)}</td>
              <td>{classifyCell(t)}</td>
              <td>{aarTime(t.engageS)}</td>
              <td>
                <span className={`status ${OUTCOME_TEXT[t.outcome].cls}`}>
                  {OUTCOME_TEXT[t.outcome].label}
                </span>
                {t.leakProbability > 0.0005 && t.leakProbability < 0.9995
                  ? ` ${aarPct(t.leakProbability)} leak`
                  : ''}
              </td>
              <td>{aarImpactCell(t)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="inspector-actions">
        <button onClick={() => exportAar(name, aar)}>Export AAR JSON</button>
      </div>
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
 * default: one line per threat, collapsed sections with headline numbers.
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
      {threats.map((a) => (
        <ThreatRowCompact
          key={a.uasId}
          a={a}
          att={report.threats.find((t) => t.uasId === a.uasId)}
          imp={impacts.find((i) => i.uasId === a.uasId)}
          advanced={advanced}
        />
      ))}
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
