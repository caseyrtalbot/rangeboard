import type { RefObject } from 'react'
import type { RunTimelineRow } from '../../analysis/runTimeline'
import type { Placed } from './layout'

// Contract stub (timeline/p3). Lane 3A replaces every body; the signatures hold.

const NONE: ReadonlySet<string> = new Set()

/**
 * A row label click (SPEC 1.5): selects `row.entityId` on the board through
 * the store's `select`. A track row carries its threat's id; a false track
 * carries null and selects nothing.
 */
export function selectRunTimelineRow(_row: RunTimelineRow): void {}

/**
 * Keys of the lines that draw a board-selected entity: a row or sub-lane whose
 * `entityId` is selected, and a summary or fold line with such a member. The
 * set keeps its identity while the selection and the lines hold.
 */
export function useSelectedLines(_lines: readonly Placed[]): ReadonlySet<string> {
  return NONE
}

/**
 * When the board selection changes, scrolls the first selected line into the
 * rows' scroll container, nearest edge. A layout change alone does not scroll.
 */
export function useScrollToSelection(
  _scrollRef: RefObject<HTMLElement | null>,
  _lines: readonly Placed[],
  _selected: ReadonlySet<string>,
): void {}
