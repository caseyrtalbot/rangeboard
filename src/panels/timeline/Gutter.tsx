import { memo } from 'react'
import type { RunTimelineGroup, RunTimelineKind, RunTimelineRow } from '../../analysis/runTimeline'
import { useStore } from '../../state/store'
import type { Placed } from './layout'
import { useWindowedLines, type RowView } from './useRowWindow'
import { selectRunTimelineRow } from './useRunTimelineSelection'

/** Row ink per kind: the strip's kind tokens; a track reads as the C2 picture. */
const ROW_INK: Record<RunTimelineKind, string> = {
  sensor: 'var(--runtl-sensor)',
  c2: 'var(--runtl-c2)',
  track: 'var(--runtl-c2)',
  effector: 'var(--runtl-effector)',
  threat: 'var(--runtl-uas)',
}

/** Side ink: red for a threat, the sensor-blue family for every other kind. */
const SIDE_INK = { blue: 'var(--runtl-ew)', red: 'var(--danger)' } as const

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

/** The class suffix of a line the board selection highlights. */
const sel = (selected: boolean) => (selected ? ' selected' : '')

/**
 * A platform or track row. The label is the button that selects the row's
 * entity on the board; a false track has none, so its label is text. A sensor
 * with held tracks expands to its sub-lanes.
 */
const RowLine = memo(function RowLine({
  row,
  open,
  inFold,
  selected,
}: {
  row: RunTimelineRow
  open: boolean
  inFold: boolean
  selected: boolean
}) {
  const expandable = row.subLanes != null && row.subLanes.length > 0
  return (
    <div className={`runtl-line runtl-row${inFold ? ' in-fold' : ''}${sel(selected)}`}>
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
      {row.entityId != null ? (
        <button
          type="button"
          className="runtl-name runtl-select"
          title={row.label}
          onClick={() => selectRunTimelineRow(row)}
        >
          {row.label}
        </button>
      ) : (
        <span className="runtl-name" title={row.label}>
          {row.label}
        </span>
      )}
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

/**
 * A sensor sub-lane: one held track. Its label is the button that selects the
 * track's threat on the board, as a track row label does; a false track has
 * no threat, so its label is text.
 */
const SubLine = memo(function SubLine({
  row,
  selected,
}: {
  row: RunTimelineRow
  selected: boolean
}) {
  return (
    <div className={`runtl-line runtl-sub${sel(selected)}`}>
      {row.entityId != null ? (
        <button
          type="button"
          className="runtl-name runtl-select"
          title={row.label}
          onClick={() => selectRunTimelineRow(row)}
        >
          {row.label}
        </button>
      ) : (
        <span className="runtl-name" title={row.label}>
          {row.label}
        </span>
      )}
    </div>
  )
})

const FoldLine = memo(function FoldLine({
  foldKey,
  label,
  open,
  selected,
}: {
  foldKey: string
  label: string
  open: boolean
  selected: boolean
}) {
  return (
    <div className={`runtl-line runtl-fold${sel(selected)}`}>
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

/**
 * The gutter: one line per drawn plot line, in the same order and at the same
 * heights. Only the lines near the scroll view render (`useWindowedLines`); a
 * spacer holds the first one at its layout y, and the gutter keeps the full
 * height. `selected` holds the line keys the board selection highlights.
 */
export const Gutter = memo(function Gutter({
  lines,
  view,
  heightPx,
  selected,
}: {
  lines: Placed[]
  view: RowView
  heightPx: number
  selected: ReadonlySet<string>
}) {
  const shown = useWindowedLines(lines, view)
  return (
    <div className="runtl-gutter" style={{ height: heightPx }}>
      {shown.length > 0 && shown[0].y > 0 && <div style={{ height: shown[0].y }} />}
      {shown.map((line) => {
        switch (line.t) {
          case 'group':
            return (
              <GroupHeader key={line.key} group={line.group} open={line.open} shown={line.shown} />
            )
          case 'summary':
            return (
              <div
                key={line.key}
                className={`runtl-line runtl-summary-name${sel(selected.has(line.key))}`}
              >
                {summaryLabel(line.group)}
              </div>
            )
          case 'row':
            return (
              <RowLine
                key={line.key}
                row={line.row}
                open={line.open}
                inFold={line.inFold}
                selected={selected.has(line.key)}
              />
            )
          case 'sub':
            return <SubLine key={line.key} row={line.row} selected={selected.has(line.key)} />
          case 'fold':
            return (
              <FoldLine
                key={line.key}
                foldKey={line.key}
                label={line.label}
                open={line.open}
                selected={selected.has(line.key)}
              />
            )
        }
      })}
    </div>
  )
})
