import type { EntityKind } from '../model/types'

/** Subtle darker edge that reads over any fill color. */
const EDGE = 'rgba(0, 0, 0, 0.35)'

/**
 * MIL-STD-2525-inspired affiliation frame, shared by the palette and panels.
 * Rectangle = friendly emplacement (sensor/effector), circle = unit (c2/asset),
 * diamond = hostile (uas), square = neutral point (marker).
 */
export function Glyph({ kind, color, size }: { kind: EntityKind; color: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" style={{ flexShrink: 0 }} aria-hidden>
      <g fill={color} stroke={EDGE} strokeWidth={1}>
        {kind === 'sensor' || kind === 'effector' ? (
          <rect x={0.5} y={2} width={9} height={6} />
        ) : kind === 'uas' ? (
          <polygon points="5,0.5 9.5,5 5,9.5 0.5,5" />
        ) : kind === 'marker' ? (
          <rect x={1.5} y={1.5} width={7} height={7} />
        ) : (
          <circle cx={5} cy={5} r={4.5} />
        )}
      </g>
    </svg>
  )
}
