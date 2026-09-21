import type { LadderRow } from '../../../charts/types'
import { useMemo, type ReactNode } from 'react'
import { trialSystemTelemetryAt } from '../../../analysis/systemTelemetry'
import { readTokens, resolveColor } from '../../../charts/tokens'
import { scenarioDurationS } from '../../../model/scenario'
import { trialSweepAt } from '../../../playback/trialSweepAt'
import { useStore } from '../../../state/store'
import { useTrialResult, trialViewOf, trialStateText } from '../controls'

/** The value glyph for a missing or undefined figure. */
export const DASH = '—'

/** Shared trial selection and bounded observation for every detail pane. */
export function useDetailRun() {
  const currentScenario = useStore((s) => s.scenario)
  const runId = useStore((s) => s.playback.runId)
  const setSimTime = useStore((s) => s.setSimTime)
  const units = useStore((s) => s.ui.units)
  const trial = useTrialResult()
  const view = trialViewOf(trial)
  const scenario = view?.scenario ?? currentScenario
  const tObs = view ? trial.horizon : -Infinity
  const horizon = useMemo(() => ({ scoped: true, horizonS: tObs }), [tObs])
  const sweep = useMemo(() => (view ? trialSweepAt(view, tObs) : undefined), [view, tObs])
  return {
    scenario,
    runId,
    setSimTime,
    units,
    view,
    sweep,
    series: trial.series,
    assessments: view?.assessments ?? [],
    report: view?.attrition,
    t: view ? tObs : 0,
    tObs,
    horizon,
    durationS: view?.durationS ?? scenarioDurationS(scenario),
    untouched: !view,
    stateText: trialStateText(trial.selection, trial.snapshot?.observedThroughS),
  }
}

/** This entity's sampled component telemetry, absent before Play. */
export function useComponentAt(run: ReturnType<typeof useDetailRun>, entityId: string) {
  const { view, tObs } = run
  return useMemo(
    () =>
      view
        ? trialSystemTelemetryAt(view, tObs)
            .flatMap((group) => group.components)
            .find((component) => component.entityId === entityId)
        : undefined,
    [view, tObs, entityId],
  )
}

/** One label and value line of a `.rows` block. */
export interface DetailRow {
  label: string
  value: string
  unit?: string
  tag?: ReactNode
}

/** A stack of label and value rows. */
export function Rows({ rows }: { rows: DetailRow[] }) {
  return (
    <div className="rows">
      {rows.map((row) => (
        <div className="row" key={row.label}>
          <span className="rl">{row.label}</span>
          <span className="rv num">
            {row.value}
            {row.unit ? <em>{row.unit}</em> : null}
            {row.tag}
          </span>
        </div>
      ))}
    </div>
  )
}

// The provenance tag lives in the Inspector kit: one tag for the whole app.
export { PfTag } from '../../inspector/kit'

/** A compact table: short headers, one row per record. */
export function DetailTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <table className="tb">
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((cells, i) => (
          <tr key={i}>
            {cells.map((cell, j) => (
              <td key={j}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** One legend entry: a token name or a hex, and its label. */
/** A ladder row with its span labels removed; the panes use a legend instead. */
export function bareSpans(row: LadderRow): LadderRow {
  return { ...row, spans: row.spans.map(({ startS, endS, color }) => ({ startS, endS, color })) }
}

export interface LegendEntry {
  label: string
  color: string
}

/** The chart kit legend under a ladder, colors resolved once per render. */
export function Legend({ entries }: { entries: LegendEntry[] }) {
  const tokens = useMemo(() => readTokens(), [])
  return (
    <div className="chart-legend">
      {entries.map((entry) => (
        <span key={entry.label}>
          <i style={{ background: resolveColor(entry.color, tokens) }} />
          {entry.label}
        </span>
      ))}
    </div>
  )
}
