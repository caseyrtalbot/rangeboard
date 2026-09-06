import type { Entity, EntityKind, SpecModel } from '../model/types'

/**
 * Board ink. A Konva node cannot read a CSS variable, so the colors the layers
 * share are written once here. The palette glyphs and the detail panels draw
 * from the same values, so the board and the panels never disagree about an
 * entity's color.
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
