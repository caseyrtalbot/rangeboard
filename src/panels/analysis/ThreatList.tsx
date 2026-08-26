import { useState } from 'react'
import type { SpecModel } from '../../model/types'
import { useStore } from '../../state/store'
import type { ClassificationTimes, ThreatAssessment, ThreatStatus } from '../../playback/sim'
import type { AttritionReport, ThreatAttrition } from '../../playback/attrition'
import { formatDistance, formatTime } from '../../geometry/geo'
import type { DisplayUnits } from '../../geometry/geo'
import type { LeakerImpact } from '../../analysis/impact'
import { SEVERITY_LABEL, wezKindFor, wezRadiusM } from '../../analysis/impact'
import { expenditureParts, TIER_CLS, threatCompactStats, threatShotLine } from '../headlines'

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
  'no-stable-track': {
    label: 'No stable fire-control track (doctrine gate)',
    short: 'No firm track',
    cls: 'warn',
  },
  'no-fc-uplink': {
    label: 'Interceptor needs its fire-control radar connected',
    short: 'NO FC UPLINK',
    cls: 'warn',
  },
  'window-too-short': { label: 'Engagement window too short', short: 'Short window', cls: 'warn' },
  engageable: { label: 'Engageable', short: 'Engageable', cls: 'good' },
}

const TECH_LABEL: Record<string, string> = {
  radar: 'radar',
  'eo-ir': 'EO/IR',
  acoustic: 'acoustic',
  rf: 'RF',
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

/**
 * CLOSEST APPROACH: pure geometry to the nearest defended asset. It exists
 * whenever any asset is placed, including for a threat that turned away and
 * never got near. It says how close the track got, never that it got there.
 */
function closestApproachText(
  a: ThreatAssessment,
  name: (id: string | null) => string,
  units: DisplayUnits,
): string {
  if (a.cpaAssetId == null || a.cpaDistanceM == null) return 'no asset placed'
  const when = a.cpaS != null ? `${formatTime(a.cpaS)} · ` : ''
  return `${when}${name(a.cpaAssetId)} · ${formatDistance(a.cpaDistanceM, units)}`
}

/**
 * ARRIVAL: the threat crossed the asset's defended boundary. This is a
 * different measurement from closest approach, and it is the one the defeat
 * credit turns on, so a fly-by must never borrow an arrival time. No
 * crossing reads as a dash with the reason.
 */
function arrivalText(a: ThreatAssessment, name: (id: string | null) => string): string {
  if (a.arrivalS != null) return `${formatTime(a.arrivalS)} · ${name(a.cpaAssetId)}`
  if (a.cpaAssetId == null) return '— · no asset placed'
  return '— · fly-by, never crossed the defended boundary'
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
export function ThreatDetail({
  a,
  att,
  imp,
  advanced,
  name,
  threatModel,
  mode = 'actual',
}: {
  a: ThreatAssessment
  att?: ThreatAttrition
  imp?: LeakerImpact
  advanced: boolean
  name: (id: string | null) => string
  threatModel?: SpecModel
  mode?: 'actual' | 'projected'
}) {
  const units = useStore((s) => s.ui.units)
  const projected = mode === 'projected'
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
            <td>{projected ? 'Projected full-run status' : 'Status'}</td>
            <td>{status.label}</td>
          </tr>
          <tr>
            <td>{projected ? 'Projected detection' : 'First detection'}</td>
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
            <td>{projected ? 'Projected closest approach' : 'Closest approach'}</td>
            <td>{closestApproachText(a, name, units)}</td>
          </tr>
          <tr>
            <td>{projected ? 'Projected arrival at asset' : 'Arrival at asset'}</td>
            <td>{arrivalText(a, name)}</td>
          </tr>
          <tr>
            <td>{projected ? 'Projected best window' : 'Best window'}</td>
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
              <td>{projected ? 'Projected expenditure' : 'Expenditure'}</td>
              <td>
                {att && expenditureParts(att).length > 0
                  ? [
                      ...expenditureParts(att),
                      att.firstShotS != null ? `first at ${formatTime(att.firstShotS)}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : 'none'}
              </td>
            </tr>
          )}
          <tr>
            <td>{projected ? 'Projected outcome' : 'Outcome'}</td>
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
 * Compact threat row: designator and status chip on the head line, shots and
 * kill/leak on the stat line under it (a 320px panel cannot hold both on one
 * line without losing the designator).
 * Warning and window times live in the hover title and the expanded table.
 * Click toggles the detail table; the amber I&W line renders inside the
 * expansion whenever leak probability reaches 0.5 or an impact severity is
 * set (the collapsed asset-level alert lives in LeakerWarningStrip).
 * Expansion is local state, reset per mount.
 */
export function ThreatRowCompact({
  a,
  att,
  imp,
  advanced,
  mode = 'actual',
}: {
  a: ThreatAssessment
  att?: ThreatAttrition
  imp?: LeakerImpact
  advanced: boolean
  mode?: 'actual' | 'projected'
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

  const toggle = () => setOpen((v) => !v)
  return (
    <div className="threat-row compact">
      <div className="threat-compact" onClick={toggle}>
        <span className={`chevron${open ? ' open' : ''}`}>▸</span>
        <span className="threat-name">{name(a.uasId)}</span>
        <span className={`status ${status.cls}`} title={status.label}>
          {status.short}
        </span>
      </div>
      <div
        className="threat-substats"
        onClick={toggle}
        title={`${mode === 'projected' ? 'full-run projection · ' : ''}expenditure by channel (kin · DE · EW) · kill/leak · warning ${stats.warning} · window ${stats.window}`}
      >
        {threatShotLine(att)}
      </div>
      {open && showIw && (
        <div className="iw-line">
          <span className={`status ${severity != null ? TIER_CLS[severity] : 'warn'}`}>
            I&W{severity != null ? ` ${SEVERITY_LABEL[severity]}` : ''}
          </span>
          {iwText}
          {imp != null && imp.jamDegradedProb > 0.005 && (
            <span
              className="status jam"
              title={`Track arrives jam-degraded with probability ${Math.round(imp.jamDegradedProb * 100)}%`}
            >
              JAM DEG {Math.round(imp.jamDegradedProb * 100)}%
            </span>
          )}
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
          mode={mode}
        />
      )}
    </div>
  )
}

/** Trailing raid-member index off ("THR-G3-OWA-01 7" -> "THR-G3-OWA-01"). */
function stripMemberIndex(name: string): string {
  return name.replace(/\s+\d+$/, '')
}

interface GroupAgg {
  totalShips: number
  kills: number
  hardKills: number
  softKills: number
  /** Kinetic salvos (interceptor, gun, net) fired at the group's members. */
  shotsFired: number
  /** Directed-energy bursts (DE, HPM) directed at the group's members. */
  deSalvos: number
  /** EW salvos (jammer) directed at the group's members. */
  jamSalvos: number
  /** Ships in members that never drew a shot (microbar gray segment). */
  notEngaged: number
  /** Expected surviving ships among engaged members (microbar red segment). */
  engagedLeak: number
  /** Total expected leakers: notEngaged + engagedLeak. */
  leak: number
  minWarnS: number | null
}

function aggregate(members: ThreatAssessment[], report: AttritionReport): GroupAgg {
  const agg: GroupAgg = {
    totalShips: 0,
    kills: 0,
    hardKills: 0,
    softKills: 0,
    shotsFired: 0,
    deSalvos: 0,
    jamSalvos: 0,
    notEngaged: 0,
    engagedLeak: 0,
    leak: 0,
    minWarnS: null,
  }
  for (const a of members) {
    const att = report.threats.find((t) => t.uasId === a.uasId)
    const ships = att?.shipCount ?? 1
    agg.totalShips += ships
    agg.kills += att?.expectedKills ?? 0
    agg.hardKills += att?.expectedHardKills ?? 0
    agg.softKills += att?.expectedSoftKills ?? 0
    agg.shotsFired += att?.shotsFired ?? 0
    agg.deSalvos += att?.deSalvos ?? 0
    agg.jamSalvos += att?.jamSalvos ?? 0
    if (!att || expenditureParts(att).length === 0) agg.notEngaged += ships
    else agg.engagedLeak += ships * att.leakProbability
    if (a.warningS != null && (agg.minWarnS == null || a.warningS < agg.minWarnS)) {
      agg.minWarnS = a.warningS
    }
  }
  agg.leak = agg.notEngaged + agg.engagedLeak
  return agg
}

/** Chip severity order for picking a group's headline status. */
const STATUS_CLS_RANK: Record<string, number> = { bad: 3, warn: 2, neutral: 1, good: 0 }

/** Worst member status (by chip severity) plus a per-status count title. */
function groupStatus(members: ThreatAssessment[]): { status: ThreatStatus; title: string } {
  let worst: ThreatStatus = members[0].status
  const counts = new Map<ThreatStatus, number>()
  for (const a of members) {
    counts.set(a.status, (counts.get(a.status) ?? 0) + 1)
    if (STATUS_CLS_RANK[STATUS_TEXT[a.status].cls] > STATUS_CLS_RANK[STATUS_TEXT[worst].cls]) {
      worst = a.status
    }
  }
  const title = [...counts.entries()]
    .map(([s, n]) => `${n} ${STATUS_TEXT[s].label.toLowerCase()}`)
    .join(' · ')
  return { status: worst, title }
}

/**
 * Outcome distribution for one threat group: killed · not engaged · leakers,
 * a true partition of the group's ships. No numbers in the bar; the aggregate
 * text beside it carries the values and the title holds the exact split.
 */
function GroupMicrobar({ agg }: { agg: GroupAgg }) {
  const segments = [
    { v: agg.kills, fill: '#8fae7a' },
    { v: agg.notEngaged, fill: 'var(--border)' },
    { v: agg.engagedLeak, fill: '#c4564a' },
  ].filter((s) => s.v > 0.01)
  const title = [
    `killed ${agg.kills.toFixed(1)} (${agg.hardKills.toFixed(1)} hard · ${agg.softKills.toFixed(1)} soft)`,
    `not engaged ${agg.notEngaged}`,
    `leakers ${agg.engagedLeak.toFixed(1)}`,
    `${agg.totalShips} ships total`,
  ].join(' · ')
  return (
    <span className="microbar" title={title}>
      {segments.map((s, i) => (
        <span key={i} style={{ flexGrow: s.v, background: s.fill }} />
      ))}
    </span>
  )
}

/** Collapsed raid element: one row for N same-model threats; click expands members. */
function ThreatGroupRow({
  label,
  members,
  report,
  impacts,
  advanced,
  mode,
}: {
  label: string
  members: ThreatAssessment[]
  report: AttritionReport
  impacts: LeakerImpact[]
  advanced: boolean
  mode: 'actual' | 'projected'
}) {
  const [open, setOpen] = useState(false)
  const agg = aggregate(members, report)
  const gs = groupStatus(members)
  const shots = expenditureParts(agg)
  const statsText =
    shots.length > 0
      ? `${shots.join(' · ')} · kill ${agg.kills.toFixed(1)} · leak ${agg.leak.toFixed(1)}`
      : 'no shots'
  const toggle = () => setOpen((v) => !v)
  return (
    <div className="threat-row compact">
      <div className="threat-group-head" onClick={toggle}>
        <span className={`chevron${open ? ' open' : ''}`}>▸</span>
        <span className="threat-name">
          {label} ×{members.length}
        </span>
        <span className={`status ${STATUS_TEXT[gs.status].cls}`} title={gs.title}>
          {STATUS_TEXT[gs.status].short}
        </span>
        <GroupMicrobar agg={agg} />
      </div>
      <div
        className="threat-substats"
        onClick={toggle}
        title={`expenditure by channel (kin · DE · EW) · kill/leak · min warning ${
          agg.minWarnS != null ? formatTime(agg.minWarnS) : 'none'
        }`}
      >
        {statsText}
      </div>
      {open && (
        <div className="threat-group-members">
          {members.map((a) => (
            <ThreatRowCompact
              key={a.uasId}
              a={a}
              att={report.threats.find((t) => t.uasId === a.uasId)}
              imp={impacts.find((i) => i.uasId === a.uasId)}
              advanced={advanced}
              mode={mode}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Threat list grouped by library model (fallback: entity name with the
 * trailing raid index stripped). Singles render the plain compact row;
 * multi-member groups collapse to one row with an outcome microbar.
 * Group order follows first appearance.
 */
export function ThreatGroupList({
  threats,
  report,
  impacts,
  advanced,
  mode = 'actual',
}: {
  threats: ThreatAssessment[]
  report: AttritionReport
  impacts: LeakerImpact[]
  advanced: boolean
  mode?: 'actual' | 'projected'
}) {
  const scenario = useStore((s) => s.scenario)
  const groups = new Map<string, { label: string; members: ThreatAssessment[] }>()
  for (const a of threats) {
    const entity = scenario.entities.find((e) => e.id === a.uasId)
    const base = stripMemberIndex(entity?.name ?? a.uasId)
    const key = entity?.specId ?? `name:${base}`
    const group = groups.get(key)
    if (group) group.members.push(a)
    else groups.set(key, { label: base, members: [a] })
  }
  return (
    <>
      {[...groups.values()].map((g) =>
        g.members.length === 1 ? (
          <ThreatRowCompact
            key={g.members[0].uasId}
            a={g.members[0]}
            att={report.threats.find((t) => t.uasId === g.members[0].uasId)}
            imp={impacts.find((i) => i.uasId === g.members[0].uasId)}
            advanced={advanced}
            mode={mode}
          />
        ) : (
          <ThreatGroupRow
            key={g.members[0].uasId}
            label={g.label}
            members={g.members}
            report={report}
            impacts={impacts}
            advanced={advanced}
            mode={mode}
          />
        ),
      )}
    </>
  )
}
