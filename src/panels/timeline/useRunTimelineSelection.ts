import { useLayoutEffect, useMemo, useRef, type RefObject } from 'react'
import type { RunTimelineRow } from '../../analysis/runTimeline'
import { useStore } from '../../state/store'
import type { Placed } from './layout'

/** One shared empty set, so "nothing selected" keeps its identity. */
const NONE: ReadonlySet<string> = new Set()

/**
 * A row label click (SPEC 1.5): selects `row.entityId` on the board through
 * the store's `select`. A track row carries its threat's id; a false track
 * carries null and selects nothing.
 */
export function selectRunTimelineRow(row: RunTimelineRow): void {
  if (row.entityId == null) return
  useStore.getState().select({ entityIds: [row.entityId] })
}

function drawsSelected(line: Placed, ids: ReadonlySet<string>): boolean {
  switch (line.t) {
    case 'row':
    case 'sub':
      return line.row.entityId != null && ids.has(line.row.entityId)
    case 'summary':
    case 'fold':
      // A collapsed group's summary line is often the only visible representative.
      return line.rows.some((row) => row.entityId != null && ids.has(row.entityId))
    case 'group':
      return false
  }
}

/**
 * Keys of the lines that draw a selected entity: a row or sub-lane whose
 * `entityId` is in `entityIds`, and a summary or fold line with such a member.
 * A group header never. Returns the shared empty set when nothing matches.
 */
export function selectedLineKeys(
  lines: readonly Placed[],
  entityIds: readonly string[],
): ReadonlySet<string> {
  if (entityIds.length === 0 || lines.length === 0) return NONE
  const ids = new Set(entityIds)
  let keys: Set<string> | null = null
  for (const line of lines) {
    if (!drawsSelected(line, ids)) continue
    keys ??= new Set()
    keys.add(line.key)
  }
  return keys ?? NONE
}

/**
 * Keys of the lines that draw a board-selected entity. The set keeps its
 * identity while the selection and the lines hold (`select` keeps the
 * `entityIds` identity when a selection repeats).
 */
export function useSelectedLines(lines: readonly Placed[]): ReadonlySet<string> {
  const entityIds = useStore((s) => s.selection.entityIds)
  return useMemo(() => selectedLineKeys(lines, entityIds), [lines, entityIds])
}

/**
 * The scroll offset that brings a line `y`..`y + h` into a view of
 * `clientHeight` scrolled to `scrollTop`, nearest edge; null when the line is
 * already fully visible. A line taller than the view aligns its top.
 */
export function scrollTopFor(
  y: number,
  h: number,
  scrollTop: number,
  clientHeight: number,
): number | null {
  if (y < scrollTop) return y
  if (y + h <= scrollTop + clientHeight) return null
  return h > clientHeight ? y : y + h - clientHeight
}

/**
 * The selected line to scroll to. A threat's id is also the `entityId` of its
 * sensor sub-lane and its track row, which sit above the Threats group, so the
 * first selected line is often not the entity's own row. In order: a selected
 * row line that is not a track row; else a selected summary or fold line that
 * holds a row that is not a track row; else the first selected line; else null.
 * A summary or fold line is selected only through a member with a selected id,
 * and a group holds one kind, so its non-track member is the selected entity.
 */
export function scrollTargetLine(
  lines: readonly Placed[],
  selected: ReadonlySet<string>,
): Placed | null {
  if (selected.size === 0) return null
  const own = lines.find((l) => l.t === 'row' && l.row.kind !== 'track' && selected.has(l.key))
  if (own) return own
  const holder = lines.find(
    (l) =>
      (l.t === 'summary' || l.t === 'fold') &&
      selected.has(l.key) &&
      l.rows.some((row) => row.kind !== 'track'),
  )
  return holder ?? lines.find((l) => selected.has(l.key)) ?? null
}

/**
 * When the board selection changes, scrolls the entity's own line
 * (`scrollTargetLine`) into the rows' scroll container, nearest edge. A layout
 * change alone does not scroll: the effect runs on every input change but acts
 * only on a new `entityIds`.
 */
export function useScrollToSelection(
  scrollRef: RefObject<HTMLElement | null>,
  lines: readonly Placed[],
  selected: ReadonlySet<string>,
): void {
  const entityIds = useStore((s) => s.selection.entityIds)
  const seen = useRef(entityIds)
  useLayoutEffect(() => {
    if (seen.current === entityIds) return
    seen.current = entityIds
    const el = scrollRef.current
    if (!el || selected.size === 0) return
    const line = scrollTargetLine(lines, selected)
    if (!line) return
    const top = scrollTopFor(line.y, line.h, el.scrollTop, el.clientHeight)
    if (top != null) el.scrollTop = top
  }, [scrollRef, lines, selected, entityIds])
}
