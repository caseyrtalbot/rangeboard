import { memo } from 'react'
import type { RunTimelineGroup, RunTimelineKind, RunTimelineRow } from '../../analysis/runTimeline'
import { useStore } from '../../state/store'
import { KIND_INK } from '../../ui/ink'
import type { Placed } from './layout'

/** Row ink per kind: the board glyph ink; a track reads as the C2 picture. */
const ROW_INK: Record<RunTimelineKind, string> = {
  sensor: KIND_INK.sensor,
  c2: KIND_INK.c2,
  track: KIND_INK.c2,
  effector: KIND_INK.effector,
  threat: KIND_INK.uas,
}

/** Side ink: red for a threat, the sensor-blue family for every other kind. */
const SIDE_INK = { blue: 'var(--ew)', red: 'var(--danger)' } as const

/** The summary line under a collapsed group header. */
function summaryLabel(group: RunTimelineGroup): string {
  return group.key === 'c2' ? 'All C2 nodes' : `All ${group.label.toLowerCase()}`
}

const GroupHeader = memo(function GroupHeader({
  group,
  open,
  shown,
}: {
  group: RunTimelineGroup
  open: boolean
  shown: number
}) {
  const hidden = group.rows.length - shown
  return (
    <div className="runtl-line runtl-group">
      <button
        type="button"
        className="runtl-group-btn"
        aria-expanded={open}
        onClick={() => useStore.getState().toggleRunTimelineGroup(group.key)}
      >
        <span className="runtl-chev" aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
        <i className="runtl-ink" style={{ background: SIDE_INK[group.side] }} aria-hidden="true" />
        <span className="runtl-name">{group.label}</span>
        <span className="runtl-count">{hidden > 0 ? `${shown} · ${hidden} hidden` : shown}</span>
        <span className="runtl-side">{group.side}</span>
      </button>
    </div>
  )
})

/**
 * A platform or track row. The label is plain text in Phase 2; Phase 3 makes it
 * the selecting button. A sensor with held tracks expands to its sub-lanes.
 */
const RowLine = memo(function RowLine({
  row,
  open,
  inFold,
}: {
  row: RunTimelineRow
  open: boolean
  inFold: boolean
}) {
  const expandable = row.subLanes != null && row.subLanes.length > 0
  return (
    <div className={`runtl-line runtl-row${inFold ? ' in-fold' : ''}`}>
      {expandable ? (
        <button
          type="button"
          className="runtl-chev runtl-expand"
          aria-expanded={open}
          aria-label={`Tracks held by ${row.label}`}
          onClick={() => useStore.getState().toggleRunTimelineSensor(row.key)}
        >
          {open ? '▾' : '▸'}
        </button>
      ) : (
        <span className="runtl-chev" aria-hidden="true" />
      )}
      <i className="runtl-ink" style={{ background: ROW_INK[row.kind] }} aria-hidden="true" />
      <span className="runtl-name" title={row.label}>
        {row.label}
      </span>
      {row.meta !== '' && (
        <span className="runtl-meta" title={row.meta}>
          {row.meta}
        </span>
      )}
      <button
        type="button"
        className="runtl-hide"
        aria-label={`Hide ${row.label}`}
        onClick={() => useStore.getState().hideRunTimelineRow(row.key)}
      >
        ×
      </button>
    </div>
  )
})

const SubLine = memo(function SubLine({ row }: { row: RunTimelineRow }) {
  return (
    <div className="runtl-line runtl-sub" title={row.label}>
      {row.label}
    </div>
  )
})

const FoldLine = memo(function FoldLine({
  foldKey,
  label,
  open,
}: {
  foldKey: string
  label: string
  open: boolean
}) {
  return (
    <div className="runtl-line runtl-fold">
      <button
        type="button"
        className="runtl-group-btn"
        aria-expanded={open}
        onClick={() => useStore.getState().toggleRunTimelineFold(foldKey)}
      >
        <span className="runtl-chev" aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
        <i className="runtl-ink" style={{ background: ROW_INK.threat }} aria-hidden="true" />
        <span className="runtl-name">{label}</span>
      </button>
    </div>
  )
})

/** The gutter: one line per plot line, in the same order and at the same heights. */
export const Gutter = memo(function Gutter({ lines }: { lines: Placed[] }) {
  return (
    <div className="runtl-gutter">
      {lines.map((line) => {
        switch (line.t) {
          case 'group':
            return (
              <GroupHeader key={line.key} group={line.group} open={line.open} shown={line.shown} />
            )
          case 'summary':
            return (
              <div key={line.key} className="runtl-line runtl-summary-name">
                {summaryLabel(line.group)}
              </div>
            )
          case 'row':
            return <RowLine key={line.key} row={line.row} open={line.open} inFold={line.inFold} />
          case 'sub':
            return <SubLine key={line.key} row={line.row} />
          case 'fold':
            return (
              <FoldLine key={line.key} foldKey={line.key} label={line.label} open={line.open} />
            )
        }
      })}
    </div>
  )
})
