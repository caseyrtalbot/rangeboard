import { Circle, Group, Line, Path, Rect, Text } from 'react-konva'
import type Konva from 'konva'
import type { BlockPos } from '../labelLayout'
import { LABEL_FONT_PX, LABEL_HALO_PX, LABEL_LINE_H } from '../labelLayout'
import type {
  AirFrame as AirFrameSpec,
  GroundFrame as GroundFrameSpec,
  IconPath,
} from '../../panels/Glyph'
import {
  AIR_CIRCLE_R,
  AIR_DIAMOND_POINTS,
  AIR_SQUARE_HALF,
  BACKSLASH_POINTS,
  BAR_TEXT,
  barBox,
  BRACKET_STROKE,
  bracketPoints,
  FRAME_DASH,
  FRAME_STROKE,
  FUNCTION_TEXT,
  GND_CIRCLE_R,
  GND_INST_BAR,
  GND_RECT,
  ICON_BOX_CENTRE,
  ICON_PATH,
  ICON_SCALE,
  MARKER_DOT_R,
  MARKER_HALF,
  MARKER_STROKE,
  SLASH_POINTS,
  STRIKE_STROKE,
  UAV_ICON,
} from '../../panels/Glyph'

/**
 * Konva twins of the Glyph.tsx symbol library. Every shape, dash and size comes from
 * Glyph.tsx, so the palette SVG and the board draw one symbol per object. Each
 * component draws in the counter-scaled screen-px group of its entity and renders
 * no Group of its own, so a caller controls child order (a test reads the first Text
 * of a member node). Dash and point arrays are module constants: Konva compares them
 * by identity.
 */

const MONO = 'JetBrains Mono'
const BRACKETS = bracketPoints()
/** The bar text box: `BAR_TEXT.fontSize` in a 9.5 box leaves 1 px above the glyphs. */
const BAR_TEXT_INSET = 1
/** Konva Text y for the function text: the baseline less about 0.8 em. */
const FUNCTION_TEXT_TOP = FUNCTION_TEXT.baselineY - FUNCTION_TEXT.fontSize * 0.85

/**
 * Net scale of an icon in its frame: ICON_SCALE times the scale in the icon's own
 * transform. Every milsymbol transform here is `translate(c c) scale(s) translate(-c -c)`,
 * a scale about the box centre, so it folds into one scale about the origin.
 */
function iconScale(icon: IconPath): number {
  const m = icon.transform?.match(/scale\(([\d.]+)\)/)
  return ICON_SCALE * (m ? Number(m[1]) : 1)
}

/** A 2525 function icon from the 200 box, placed in the frame at `scale`. */
function FunctionIcon({
  icon,
  color,
  scale = 1,
}: {
  icon: IconPath
  color: string
  scale?: number
}) {
  const s = iconScale(icon) * scale
  const common = {
    data: icon.d,
    x: -ICON_BOX_CENTRE * s,
    y: -ICON_BOX_CENTRE * s,
    scaleX: s,
    scaleY: s,
    listening: false,
    perfectDrawEnabled: false,
  }
  return icon.kind === 'fill' ? (
    <Path {...common} fill={color} />
  ) : (
    <Path
      {...common}
      stroke={color}
      strokeWidth={icon.strokeWidth}
      strokeScaleEnabled={false}
      lineJoin="round"
    />
  )
}

/** A short text amplifier centred in a frame: EW, C2 or DA. */
function FunctionText({ text, color }: { text: string; color: string }) {
  return (
    <Text
      fontFamily={MONO}
      fontStyle={String(FUNCTION_TEXT.fontWeight)}
      x={-20}
      y={FUNCTION_TEXT_TOP}
      width={40}
      align="center"
      text={text}
      fontSize={FUNCTION_TEXT.fontSize}
      fill={color}
      listening={false}
    />
  )
}

interface AirFrameProps {
  frame: AirFrameSpec
  /** The frame and icon ink. */
  color: string
  /** The board tone: the knockout under the frame. */
  board: string
  /** Overrides the table dash (a hard kill draws solid in the ghost ink). */
  dashed?: boolean
  /** Member frames draw at 7/13 of the lead. */
  scale?: number
  /** False on the neutral square, which stands for a crewed aircraft. */
  icon?: boolean
}

/** An air track frame (circle, diamond or square) with the UAS icon, from Glyph.tsx. */
export function AirFrame({ frame, color, board, dashed, scale = 1, icon = true }: AirFrameProps) {
  const dash = (dashed ?? frame.dashed) ? FRAME_DASH : undefined
  const common = {
    fill: board,
    stroke: color,
    strokeWidth: FRAME_STROKE,
    dash,
    scaleX: scale,
    scaleY: scale,
    lineJoin: 'round' as const,
    listening: false,
    perfectDrawEnabled: false,
  }
  return (
    <>
      {frame.shape === 'diamond' && <Line points={AIR_DIAMOND_POINTS} closed {...common} />}
      {frame.shape === 'circle' && <Circle radius={AIR_CIRCLE_R} {...common} />}
      {frame.shape === 'square' && (
        <Rect
          x={-AIR_SQUARE_HALF}
          y={-AIR_SQUARE_HALF}
          width={2 * AIR_SQUARE_HALF}
          height={2 * AIR_SQUARE_HALF}
          {...common}
        />
      )}
      {icon && frame.shape !== 'square' && (
        <FunctionIcon icon={UAV_ICON} color={color} scale={scale} />
      )}
    </>
  )
}

interface GroundFrameProps {
  frame: GroundFrameSpec
  color: string
  board: string
  /** An inactive system: the 2525 dashed frame. */
  dashed?: boolean
  /** No knockout: the placement preview draws the frame as a bare outline. */
  outline?: boolean
}

/** A ground system frame with its 2525 function icon or text, from Glyph.tsx. */
export function GroundFrame({ frame, color, board, dashed, outline }: GroundFrameProps) {
  const common = {
    fill: outline ? undefined : board,
    stroke: color,
    strokeWidth: FRAME_STROKE,
    dash: dashed ? FRAME_DASH : undefined,
    listening: false,
    perfectDrawEnabled: false,
  }
  return (
    <>
      {frame.shape === 'circle' && <Circle radius={GND_CIRCLE_R} {...common} />}
      {(frame.shape === 'rect' || frame.shape === 'inst') && (
        <Rect x={GND_RECT.x} y={GND_RECT.y} width={GND_RECT.w} height={GND_RECT.h} {...common} />
      )}
      {frame.shape === 'inst' && (
        <Rect
          x={GND_INST_BAR.x}
          y={GND_INST_BAR.y}
          width={GND_INST_BAR.w}
          height={GND_INST_BAR.h}
          fill={color}
          listening={false}
        />
      )}
      {frame.shape === 'marker' && (
        <>
          <Rect
            x={-MARKER_HALF}
            y={-MARKER_HALF}
            width={2 * MARKER_HALF}
            height={2 * MARKER_HALF}
            stroke={color}
            strokeWidth={MARKER_STROKE}
            dash={dashed ? FRAME_DASH : undefined}
            listening={false}
          />
          <Circle radius={MARKER_DOT_R} fill={color} listening={false} />
        </>
      )}
      {frame.icon && <FunctionIcon icon={ICON_PATH[frame.icon]} color={color} />}
      {frame.text && <FunctionText text={frame.text} color={color} />}
    </>
  )
}

interface EngagementBarProps {
  /** The 2525D stage code and weapon suffix: ASN-M, MIF-M, ENG-EA. */
  text: string
  /** The bar fill: the hue of the object it sits on. */
  color: string
  /** The board tone: the bar text. */
  board: string
  /** The frame top edge, negative y; the box bottom sits BAR_GAP above it. */
  top: number
}

/** The 2525D engagement bar above a frame, from Glyph.tsx `barBox`. */
export function EngagementBar({ text, color, board, top }: EngagementBarProps) {
  const box = barBox(text, top)
  return (
    <>
      <Rect x={box.x} y={box.y} width={box.w} height={box.h} fill={color} listening={false} />
      <Text
        fontFamily={MONO}
        fontStyle={String(BAR_TEXT.fontWeight)}
        x={box.x}
        y={box.y + BAR_TEXT_INSET}
        width={box.w}
        align="center"
        text={text}
        fontSize={BAR_TEXT.fontSize}
        fill={board}
        listening={false}
      />
    </>
  )
}

/** The four corner brackets of a locked track, in the lock ink. */
export function Brackets({ color }: { color: string }) {
  return (
    <>
      {BRACKETS.map((points, i) => (
        <Line
          key={i}
          points={points}
          stroke={color}
          strokeWidth={BRACKET_STROKE}
          listening={false}
        />
      ))}
    </>
  )
}

interface KillStrikeProps {
  color: string
  /** True draws the 2525 destroyed X; false the one slash of a mission kill. */
  x?: boolean
  /** Member strikes draw at the member frame scale. */
  scale?: number
}

/** The 2525 condition overlays: one slash for damaged, an X for destroyed. */
export function KillStrike({ color, x, scale = 1 }: KillStrikeProps) {
  const common = {
    stroke: color,
    strokeWidth: STRIKE_STROKE,
    lineCap: 'round' as const,
    scaleX: scale,
    scaleY: scale,
    listening: false,
  }
  return (
    <>
      <Line points={SLASH_POINTS} {...common} />
      {x && <Line points={BACKSLASH_POINTS} {...common} />}
    </>
  )
}

interface DataBlockProps {
  /** One or two mono lines: the designator and its words, then altitude and speed. */
  lines: readonly string[]
  /** Where the block draws, from `anchoredBlockPos`. */
  pos: BlockPos
  /** The text ink: the label grey, or the ghost grey on a hard kill. */
  color: string
  /** The board tone: the glyph halo under each line. */
  board: string
  /** Per-line ink overrides, indexed like `lines` (EMPTY in white). */
  lineColors?: readonly (string | undefined)[]
  /** The group, so a heading drag can preview the block position on the node. */
  groupRef?: React.Ref<Konva.Group>
}

/**
 * The data block beside a frame: `LABEL_FONT_PX` mono lines at `LABEL_LINE_H` pitch
 * over a board-tone glyph halo, left of or right of the frame per `pos`. One Text per
 * line, so a line can take its own ink.
 */
export function DataBlock({ lines, pos, color, board, lineColors, groupRef }: DataBlockProps) {
  return (
    <Group ref={groupRef} x={pos.x} y={pos.y} listening={false}>
      {lines.map((line, i) => (
        <Text
          key={i}
          name="block-line"
          fontFamily={MONO}
          y={i * LABEL_LINE_H}
          width={pos.width}
          text={line}
          fontSize={LABEL_FONT_PX}
          fill={lineColors?.[i] ?? color}
          stroke={board}
          strokeWidth={LABEL_HALO_PX}
          lineJoin="round"
          fillAfterStrokeEnabled
          align={pos.align}
          wrap="none"
          listening={false}
        />
      ))}
    </Group>
  )
}
