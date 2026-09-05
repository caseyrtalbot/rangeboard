import type { LadderRow } from '../../../charts/types'
import { useMemo, type ReactNode } from 'react'
import type { ComponentTelemetry } from '../../../analysis/systemTelemetry'
import { systemTelemetryAt } from '../../../analysis/systemTelemetry'
import { readTokens, resolveColor } from '../../../charts/tokens'
import type { DisplayUnits } from '../../../geometry/geo'
import type { Scenario } from '../../../model/types'
import type { AttritionReport } from '../../../playback/attritionReport'
import type { ThreatAssessment } from '../../../playback/sim'
import { useStore } from '../../../state/store'
import { useEngagement, useRunCursor } from '../widgets/controls'

/** The value glyph for a missing or undefined figure. */
export const DASH = '—'

/** The store reads and the engagement picture every pane shares. */
export interface DetailRun {
  scenario: Scenario
  runId: string
  setSimTime: (t: number) => void
  units: DisplayUnits
  assessments: ThreatAssessment[]
  report: AttritionReport
  /** The one quantized cursor time. */
  t: number
  durationS: number
}

/** The store selectors, the engagement picture and the run cursor of one pane. */
export function useDetailRun(): DetailRun {
  const scenario = useStore((s) => s.scenario)
  const runId = useStore((s) => s.playback.runId)
  const setSimTime = useStore((s) => s.setSimTime)
  const units = useStore((s) => s.ui.units)
  const { assessments, report } = useEngagement(scenario, runId)
  const { t, durationS } = useRunCursor(scenario)
  return { scenario, runId, setSimTime, units, assessments, report, t, durationS }
}

/** This entity's component telemetry at t, or undefined when it is in no group. */
export function useComponentAt(run: DetailRun, entityId: string): ComponentTelemetry | undefined {
  const { scenario, runId, assessments, report, t } = run
  return useMemo(() => {
    void runId
    return systemTelemetryAt(scenario, assessments, report, t, new Map())
      .flatMap((group) => group.components)
      .find((component) => component.entityId === entityId)
  }, [scenario, runId, assessments, report, t, entityId])
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
/**
 * A ladder row with its span labels removed. The Ladder prints a span label
 * over the bar; the panes name the colors in a legend instead, as the mockup does.
 */
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
