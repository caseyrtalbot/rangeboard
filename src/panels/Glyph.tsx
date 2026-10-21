import type { EntityKind, SpecModel } from '../model/types'

/**
 * The one symbol library. The SVG `Glyph` (palette, library rows, detail header) and
 * the Konva EntityLayer draw these same shapes, so one object has one symbol on every
 * surface. Geometry follows the Valkryn symbology primer: a frame carries identity, an
 * icon or a short text carries function, and amplifiers (brackets, bar, slash, X) carry
 * state. Every frame is a line frame with a board-tone knockout; nothing is filled.
 *
 * Units: the SYMBOL BOX is centred on the origin, y down, one unit = one board px at
 * board scale. The primer draws its tiles at 1.5 times board size.
 */

export type { Affiliation } from '../ui/ink'
/** Affiliation frame each entity kind draws: `AFFILIATION`, the one table in src/ui/ink.ts. */
export { AFFILIATION as FRAME_FOR } from '../ui/ink'

/* ------------------------------------------------------------------------------------ */
/* Air track frames                                                                      */
/* ------------------------------------------------------------------------------------ */

/**
 * Identity of an air track. `none` is truth that no sensor has held yet: a grey frame
 * keeps it on the board until a system calls the track.
 */
export type AirIdentity =
  'pending' | 'unknown' | 'suspect' | 'hostile' | 'friend' | 'neutral' | 'none'

export type AirShape = 'circle' | 'diamond' | 'square'

/** The identity inks of `BoardInk` (src/ui/ink.ts) an air frame can take. */
export type AirInkKey = 'hostile' | 'unknown' | 'friend' | 'neutral' | 'noTrack'

export interface AirFrame {
  shape: AirShape
  /** Dashed frames are one rung short of a call: pending and suspect. */
  dashed: boolean
  inkKey: AirInkKey
}

/** Frame shape, dash and ink per identity. Closed frames throughout (house). */
export const AIR_FRAME: Record<AirIdentity, AirFrame> = {
  pending: { shape: 'circle', dashed: true, inkKey: 'unknown' },
  unknown: { shape: 'circle', dashed: false, inkKey: 'unknown' },
  suspect: { shape: 'diamond', dashed: true, inkKey: 'hostile' },
  hostile: { shape: 'diamond', dashed: false, inkKey: 'hostile' },
  friend: { shape: 'circle', dashed: false, inkKey: 'friend' },
  neutral: { shape: 'square', dashed: false, inkKey: 'neutral' },
  none: { shape: 'diamond', dashed: false, inkKey: 'noTrack' },
}

export function airFrameFor(identity: AirIdentity): AirFrame {
  return AIR_FRAME[identity]
}

/** Air circle radius, centre (0, 0). */
export const AIR_CIRCLE_R = 11
/** Air diamond half diagonal, centre (0, 0). Points: top, right, bottom, left. */
export const AIR_DIAMOND_R = 13
export const AIR_DIAMOND_POINTS = [
  0,
  -AIR_DIAMOND_R,
  AIR_DIAMOND_R,
  0,
  0,
  AIR_DIAMOND_R,
  -AIR_DIAMOND_R,
  0,
]
/** Air square half side, centre (0, 0). */
export const AIR_SQUARE_HALF = 10
/** Frame stroke, box units. */
export const FRAME_STROKE = 1.6
/** Dash of a pending or suspect frame, and of an inactive ground frame. */
export const FRAME_DASH = [4, 2.5]
/** Distance from the centre to the top of each air frame, for the bar and the leader tip. */
export const AIR_FRAME_TOP: Record<AirShape, number> = {
  circle: AIR_CIRCLE_R,
  diamond: AIR_DIAMOND_R,
  square: AIR_SQUARE_HALF,
}

/* ------------------------------------------------------------------------------------ */
/* Ground system frames                                                                  */
/* ------------------------------------------------------------------------------------ */

export type GroundShape = 'circle' | 'rect' | 'inst' | 'marker'
export type FunctionIcon = 'radar' | 'sensor' | 'launcher' | 'laser'
export type FunctionText = 'EW' | 'C2' | 'DA'

export interface GroundFrame {
  /** circle: equipment; rect: unit; inst: installation; marker: reference point. */
  shape: GroundShape
  /** A 2525 function icon inside the frame. */
  icon?: FunctionIcon
  /** A 2525 (EW, C2) or house (DA) text amplifier inside the frame. */
  text?: FunctionText
  /** The letter drawn in place of the icon under ICON_MIN_PX, where an icon is too fine. */
  letter: string
}

/** Below this symbol size the SVG glyph draws the letter, not the icon. */
export const ICON_MIN_PX = 16

/**
 * Frame, function icon and small-size letter for a ground kind. The model names the
 * sub-kind: a radar takes the radar icon and every other sensor the sensor icon; a
 * kinetic effector the launcher, a jammer the text EW, a DE or HPM effector the laser.
 */
export function groundFrameFor(kind: EntityKind, model?: SpecModel): GroundFrame {
  switch (kind) {
    case 'sensor':
      return model?.sensor?.sensorType === 'radar'
        ? { shape: 'circle', icon: 'radar', letter: 'S' }
        : { shape: 'circle', icon: 'sensor', letter: 'S' }
    case 'effector': {
      const t = model?.effector?.effectorType
      if (t === 'jammer') return { shape: 'circle', text: 'EW', letter: 'EW' }
      if (t === 'de' || t === 'hpm') return { shape: 'circle', icon: 'laser', letter: 'E' }
      return { shape: 'circle', icon: 'launcher', letter: 'E' }
    }
    case 'c2':
      return { shape: 'rect', text: 'C2', letter: 'C2' }
    case 'asset':
      return { shape: 'inst', text: 'DA', letter: 'DA' }
    case 'marker':
      return { shape: 'marker', letter: '' }
    case 'uas':
      // An air object; the air frame tables draw it. Returned so callers need no guard.
      return { shape: 'circle', letter: '' }
  }
}

/** Equipment circle radius, centre (0, 0). */
export const GND_CIRCLE_R = 12
/** Unit rectangle: x -14, y -9.5, 28 by 19, centre (0, 0). */
export const GND_RECT = { x: -14, y: -9.5, w: 28, h: 19 }
/** Installation bar on top of the unit rectangle: x -5, y -14, 10 by 3. */
export const GND_INST_BAR = { x: -5, y: -14, w: 10, h: 3 }
/** Distance from the centre to the top edge of each ground frame. */
export const GND_FRAME_TOP: Record<GroundShape, number> = {
  circle: GND_CIRCLE_R,
  rect: -GND_RECT.y,
  inst: -GND_RECT.y,
  marker: 7,
}
/** Boresight tick: from the frame top edge, 7 units outward, stroke 1.6. */
export const BORESIGHT_TICK_LEN = 7
/** Condition bar under a ground frame: 24 by 3, 3 units below the frame bottom edge. */
export const CONDITION_BAR = { w: 24, h: 3, gap: 3 }

/** Marker: a 14 unit square (x, y at -7) with an r2 centre dot, stroke 1.5. */
export const MARKER_HALF = 7
export const MARKER_DOT_R = 2
export const MARKER_STROKE = 1.5

/* ------------------------------------------------------------------------------------ */
/* Function icons (milsymbol, MIL-STD-2525)                                              */
/* ------------------------------------------------------------------------------------ */

/**
 * Icons are drawn in milsymbol's 200 unit box, centre (100, 100). To place one in a
 * frame: scale by ICON_SCALE about the origin after translating by (-100, -100), i.e.
 * `scale(0.2) translate(-100 -100)`. A `transform` entry is applied inside that box
 * first (the sensor and laser icons sit smaller in their frame). `kind` says whether
 * the path is stroked in the frame ink or filled with it; stroke widths are in frame
 * units and must not scale with the icon (SVG `vector-effect`, Konva
 * `strokeScaleEnabled={false}`).
 */
export const ICON_SCALE = 0.2
export const ICON_BOX_CENTRE = 100

export interface IconPath {
  d: string
  kind: 'stroke' | 'fill'
  /** Stroke width in frame units for a stroked icon. */
  strokeWidth?: number
  /** Extra transform inside the 200 box, applied before the frame placement. */
  transform?: string
}

export const ICON_PATH: Record<FunctionIcon, IconPath> = {
  radar: {
    d: 'M72,95 l30,-25 0,25 30,-25 M70,70 c0,35 15,50 50,50',
    kind: 'stroke',
    strokeWidth: 1.4,
  },
  sensor: {
    d: 'm100,60 c0,15 25,40 40,40 -15,0 -40,25 -40,40 0,-15 -25,-40 -40,-40 15,0 40,-25 40,-40z',
    kind: 'fill',
    transform: 'translate(100 100) scale(0.72) translate(-100 -100)',
  },
  launcher: {
    d: 'm85,140 30,0 c0,-20 -30,-20 -30,0z m15,-15 0,-65 m-15,80 0,-65 c0,-20 30,-20 30,0 l0,65',
    kind: 'stroke',
    strokeWidth: 1.3,
  },
  laser: {
    d: 'm100,55 0,25 10,5 -20,5 20,5 -20,5 10,5 0,15 10,5 -20,5 20,5 -20,5 M90,65 100,55 110,65',
    kind: 'stroke',
    strokeWidth: 1.2,
    transform: 'translate(100 100) scale(0.82) translate(-100 -100)',
  },
}

/** The 2525 unmanned aircraft icon: a shallow V, filled, in the same 200 box. */
export const UAV_ICON: IconPath = { d: 'm60,84 40,20 40,-20 0,8 -40,25 -40,-25z', kind: 'fill' }

/** Text amplifier inside a frame: mono 9, weight 500, baseline y 3.2, centred. */
export const FUNCTION_TEXT = { fontSize: 9, fontWeight: 500, baselineY: 3.2 }

/* ------------------------------------------------------------------------------------ */
/* Amplifiers                                                                            */
/* ------------------------------------------------------------------------------------ */

/** Corner brackets of a locked track: four Ls at `half` from the centre, arms `arm`. */
export const BRACKET_HALF = 17
export const BRACKET_ARM = 5
export const BRACKET_STROKE = 1.6

/** Each bracket as a polyline [x1, y1, x2, y2, x3, y3], outer corner in the middle. */
export function bracketPoints(half = BRACKET_HALF, arm = BRACKET_ARM): number[][] {
  return [-1, 1].flatMap((sx) =>
    [-1, 1].map((sy) => {
      const cx = sx * half
      const cy = sy * half
      return [cx - sx * arm, cy, cx, cy, cx, cy - sy * arm]
    }),
  )
}

/**
 * The 2525D engagement bar: a filled box above the frame with its text in the board
 * tone. `top` is the frame top edge (negative y). The box bottom sits 10 above `top`.
 */
export const BAR_H = 9.5
export const BAR_TEXT = { fontSize: 7.5, fontWeight: 500 }
export const BAR_GAP = 10

export interface BarBox {
  x: number
  y: number
  w: number
  h: number
  /** Text baseline. */
  textY: number
}

export function barBox(text: string, top: number): BarBox {
  const w = Math.max(22, text.length * 4.9 + 6)
  return { x: -w / 2, y: top - BAR_GAP, w, h: BAR_H, textY: top - 2.7 }
}

/** Mission kill: one slash, lower left to upper right. Hard kill adds the other. */
export const SLASH_POINTS = [9, -15, -9, 15]
export const BACKSLASH_POINTS = [-9, -15, 9, 15]
export const STRIKE_STROKE = 2.2

/** The selection hook: an r28 ring in the selection ink over a 5.5 board-tone halo. */
export const HOOK_R = 28
export const HOOK_HALO_STROKE = 5.5
export const HOOK_STROKE = 1.5

/* ------------------------------------------------------------------------------------ */
/* SVG glyph                                                                             */
/* ------------------------------------------------------------------------------------ */

/** The symbol box the SVG draws: 40 units a side, origin at the centre. */
const BOX = 40
const VIEW_BOX = `${-BOX / 2} ${-BOX / 2} ${BOX} ${BOX}`
const MONO = "'JetBrains Mono', ui-monospace, monospace"
/** The knockout follows the theme: an SVG can read the sheet where Konva cannot. */
const KNOCKOUT = 'var(--surface-board)'
const DASH = FRAME_DASH.join(' ')

function Icon({ icon, color }: { icon: IconPath; color: string }) {
  const place = `scale(${ICON_SCALE}) translate(${-ICON_BOX_CENTRE} ${-ICON_BOX_CENTRE})`
  const transform = icon.transform ? `${place} ${icon.transform}` : place
  return icon.kind === 'fill' ? (
    <path d={icon.d} transform={transform} fill={color} />
  ) : (
    <path
      d={icon.d}
      transform={transform}
      fill="none"
      stroke={color}
      strokeWidth={icon.strokeWidth}
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
    />
  )
}

function FunctionLabel({ text, color }: { text: string; color: string }) {
  return (
    <text
      x={0}
      y={FUNCTION_TEXT.baselineY}
      fontSize={FUNCTION_TEXT.fontSize}
      fontWeight={FUNCTION_TEXT.fontWeight}
      fontFamily={MONO}
      textAnchor="middle"
      fill={color}
    >
      {text}
    </text>
  )
}

/**
 * One symbol for the DOM: an air frame for a uas (identity defaults to hostile), a
 * ground frame with its function icon for every other kind. Icons draw at ICON_MIN_PX
 * and above; smaller sizes draw the letter instead. `color` is the frame ink.
 */
export function Glyph({
  kind,
  color,
  size,
  model,
  identity,
}: {
  kind: EntityKind
  color: string
  size: number
  model?: SpecModel
  identity?: AirIdentity
}) {
  const frameProps = {
    fill: KNOCKOUT,
    stroke: color,
    strokeWidth: FRAME_STROKE,
    strokeLinejoin: 'round' as const,
  }
  let body: React.ReactNode
  if (kind === 'uas') {
    const f = airFrameFor(identity ?? 'hostile')
    const dash = f.dashed ? DASH : undefined
    body = (
      <>
        {f.shape === 'diamond' && (
          <polygon points={AIR_DIAMOND_POINTS.join(' ')} strokeDasharray={dash} {...frameProps} />
        )}
        {f.shape === 'circle' && <circle r={AIR_CIRCLE_R} strokeDasharray={dash} {...frameProps} />}
        {f.shape === 'square' && (
          <rect
            x={-AIR_SQUARE_HALF}
            y={-AIR_SQUARE_HALF}
            width={2 * AIR_SQUARE_HALF}
            height={2 * AIR_SQUARE_HALF}
            strokeDasharray={dash}
            {...frameProps}
          />
        )}
        {f.shape !== 'square' && <Icon icon={UAV_ICON} color={color} />}
      </>
    )
  } else {
    const g = groundFrameFor(kind, model)
    const fine = size >= ICON_MIN_PX
    body = (
      <>
        {g.shape === 'circle' && <circle r={GND_CIRCLE_R} {...frameProps} />}
        {(g.shape === 'rect' || g.shape === 'inst') && (
          <rect
            x={GND_RECT.x}
            y={GND_RECT.y}
            width={GND_RECT.w}
            height={GND_RECT.h}
            {...frameProps}
          />
        )}
        {g.shape === 'inst' && (
          <rect
            x={GND_INST_BAR.x}
            y={GND_INST_BAR.y}
            width={GND_INST_BAR.w}
            height={GND_INST_BAR.h}
            fill={color}
          />
        )}
        {g.shape === 'marker' && (
          <>
            <rect
              x={-MARKER_HALF}
              y={-MARKER_HALF}
              width={2 * MARKER_HALF}
              height={2 * MARKER_HALF}
              fill="none"
              stroke={color}
              strokeWidth={MARKER_STROKE}
            />
            <circle r={MARKER_DOT_R} fill={color} />
          </>
        )}
        {g.icon && fine && <Icon icon={ICON_PATH[g.icon]} color={color} />}
        {g.icon && !fine && <FunctionLabel text={g.letter} color={color} />}
        {g.text && <FunctionLabel text={g.text} color={color} />}
      </>
    )
  }
  return (
    <svg width={size} height={size} viewBox={VIEW_BOX} style={{ flexShrink: 0 }} aria-hidden>
      {body}
    </svg>
  )
}
