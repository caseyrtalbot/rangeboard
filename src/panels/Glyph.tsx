import type { EntityKind } from '../model/types'

/**
 * Shared MIL-STD-2525 symbology. The canvas draws these same constants in
 * Konva (src/canvas/layers/EntityLayer.tsx), so the palette, the library
 * lists and the board can never state different things about one entity.
 *
 * The standard split: the FRAME carries affiliation, an inner ICON carries
 * function.
 *   friend  - rectangle with the standard rounded top: sensor, c2, effector,
 *             asset. All four are blue force.
 *   hostile - diamond: uas. Red air.
 *   neutral - plain square, drawn hollow: marker. Neither side.
 * A function letter sits inside the friend frame, because four blue-force
 * kinds share one affiliation frame and must still be told apart.
 */
type FrameKind = 'friend' | 'hostile' | 'neutral'

/** Affiliation frame each entity kind draws. */
export const FRAME_FOR: Record<EntityKind, FrameKind> = {
  sensor: 'friend',
  effector: 'friend',
  c2: 'friend',
  asset: 'friend',
  uas: 'hostile',
  marker: 'neutral',
}

/** Function letter inside the friend frame. Empty where the frame is enough. */
export const FUNCTION_LETTER: Record<EntityKind, string> = {
  sensor: 'S',
  effector: 'E',
  c2: 'C2',
  asset: 'A',
  uas: '',
  marker: '',
}

/**
 * Friend frame outline in a 10 x 10 symbol box: flat base, straight sides,
 * arched top, wider than it is tall. Its ink spans x 0.6 to 9.4 and y 2.4 to
 * 8.4, so the centre is (5, 5.4) and the half extents are 4.4 x 3.0 box
 * units. Konva Path and SVG path take the same data string, so the two
 * renderers draw one shape by construction.
 */
export const FRIEND_FRAME_D = 'M0.6 8.4 V5 A4.4 2.6 0 0 1 9.4 5 V8.4 Z'
/** Ink centre of FRIEND_FRAME_D, box units. Translate by it to centre the frame. */
export const FRIEND_FRAME_CX = 5
export const FRIEND_FRAME_CY = 5.4

/** Subtle darker edge that reads over any fill color. */
export const FRAME_EDGE = 'rgba(0, 0, 0, 0.35)'
/** Board ink. The function letter is a cutout in a filled frame. */
export const FRAME_INK = '#121415'

export function Glyph({ kind, color, size }: { kind: EntityKind; color: string; size: number }) {
  const frame = FRAME_FOR[kind]
  const letter = FUNCTION_LETTER[kind]
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" style={{ flexShrink: 0 }} aria-hidden>
      {frame === 'friend' && (
        <>
          <path d={FRIEND_FRAME_D} fill={color} stroke={FRAME_EDGE} strokeWidth={1} />
          <text
            x={5}
            y={6.9}
            fontSize={4}
            fontFamily="'JetBrains Mono', ui-monospace, monospace"
            textAnchor="middle"
            fill={FRAME_INK}
          >
            {letter}
          </text>
        </>
      )}
      {frame === 'hostile' && (
        <polygon points="5,0.5 9.5,5 5,9.5 0.5,5" fill={color} stroke={FRAME_EDGE} strokeWidth={1} />
      )}
      {frame === 'neutral' && (
        <>
          <rect x={1.6} y={1.6} width={6.8} height={6.8} fill="none" stroke={color} strokeWidth={1.2} />
          <circle cx={5} cy={5} r={1.1} fill={color} />
        </>
      )}
    </svg>
  )
}
