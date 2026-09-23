import type { Entity, EntityKind, SpecModel } from '../model/types'

/**
 * Board ink. A Konva node cannot read a CSS variable, so the colors the layers share
 * are written once here. The palette glyphs and the detail panels read the same values.
 */

/** Kill, depletion, restricted airspace, endurance limit, the hostile ring. */
export const DANGER_INK = '#c4564a'

/** Jam ring on a target and the EW beam. Matches `--ew` in index.css. */
export const EW_INK = '#7da7c4'

/** Fallback color per entity kind when neither the entity nor its model sets one. */
export const KIND_INK: Record<EntityKind, string> = {
  sensor: '#7da7c4',
  effector: '#c9975a',
  c2: '#d6d9d2',
  uas: '#c46a5a',
  asset: '#8fae7a',
  marker: '#b7bdb2',
}

/** The entity's own color, then its model's, then the kind fallback. */
export function entityInk(entity: Entity, model: SpecModel | undefined): string {
  return entity.color ?? model?.color ?? KIND_INK[entity.kind]
}

/** '#rrggbb' to 'rgba(...)' for a Konva fill or gradient stop. */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

/** The board ink that changes with the theme. `useBoardInk` picks one table. */
export interface BoardInk {
  /** Minor and major grid lines on the plain canvas. */
  gridMinor: string
  gridMajor: string
  /** Minor and major grid lines on the airspace basemap. */
  airspaceGridMinor: string
  airspaceGridMajor: string
  /** Entity names and callout labels. */
  label: string
  /** The caption on a connection. */
  linkCaption: string
  /** The leader line and dot of a label callout, and the range button when off. */
  calloutLeader: string
  /** Text 1: the selection ring and a selected link. */
  selection: string
  /** The board tone: the halo under the selection ring. */
  board: string
  /** A path or boundary draft. */
  draft: string
  /** Calibrate marks, the connect ring, the marquee and the range button when on. */
  tool: string
  /** The range button fill when off. */
  control: string
}

/** Night board ink: the values the layers drew before the paper table existed. */
export const BOARD_INK_DARK: BoardInk = {
  gridMinor: '#26292c',
  gridMajor: '#323639',
  airspaceGridMinor: '#232729',
  airspaceGridMajor: '#2e3336',
  label: '#b7bdb2',
  linkCaption: '#8a9199',
  calloutLeader: '#82887e',
  selection: '#ebe9e3',
  board: '#121313',
  draft: '#ffffff',
  tool: '#a9b4bd',
  control: '#1d2023',
}

/**
 * Paper board ink, measured on the paper board `#eeebe4`: label 6.9:1, link caption
 * 5.5:1, callout leader 3.5:1, tool 5.3:1. The airspace grid has no separate paper tone.
 */
export const BOARD_INK_PAPER: BoardInk = {
  gridMinor: '#dcd7cd',
  gridMajor: '#c9c3b8',
  airspaceGridMinor: '#dcd7cd',
  airspaceGridMajor: '#c9c3b8',
  label: '#4e504b',
  linkCaption: '#5c5f57',
  calloutLeader: '#7b7d73',
  selection: '#212220',
  board: '#eeebe4',
  draft: '#212220',
  tool: '#56626c',
  control: '#f7f5f0',
}
