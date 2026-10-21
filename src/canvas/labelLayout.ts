import type { EntityKind } from '../model/types'

/**
 * Screen-space placement for entity data blocks. A block is one or two mono lines to
 * the right of the frame (the primer's data block). When anchored blocks would
 * overlap at the current zoom, the colliding group fans out into spoke
 * callouts: thin elbow leaders to line-one labels stacked left and right of the
 * cluster. Pure and unit-tested; all coordinates are screen pixels.
 *
 * Clustering runs in three passes so fans never land on other labels:
 * glyph proximity and label overlap build the initial components; clusters
 * whose fan envelopes intersect merge; anchored singletons whose label or glyph
 * falls inside a fan envelope are absorbed into that cluster.
 */

export interface LabelInput {
  id: string
  name: string
  sx: number
  sy: number
  /** The entity kind: it sets the block x (`DATA_BLOCK_X`). Absent reads as an air frame. */
  kind?: EntityKind
  /**
   * The lines the canvas draws, when the caller already holds them. Absent, the
   * layout draws one line, `boardDesignator(name)`.
   */
  lines?: readonly string[]
  /**
   * Heading of the handle knob the entity shows, degrees. Absent when it shows none.
   * The box then sits where `anchoredBlockPos` puts the drawn block.
   */
  handleDeg?: number
}

/** A label input with its box measured once, so the O(n^2) pass does no string work. */
interface Measured extends LabelInput {
  /** Line one, the text a spoke callout draws. */
  name: string
  /** Block width, px. */
  w: number
  /** Block height, px. */
  h: number
  /** Block left edge, px from the glyph centre: `anchoredBlockPos`. */
  bx: number
  /** Block top, px from the glyph centre: `anchoredBlockPos`. */
  top: number
}

export interface SpokePlacement {
  mode: 'spoke'
  /** Leader polyline: glyph anchor, elbow, horizontal terminal. */
  points: [number, number, number, number, number, number]
  /** Text box: left edge, top edge, width. */
  tx: number
  ty: number
  width: number
  align: 'left' | 'right'
  /** Line one of the block: the text the callout draws. */
  text: string
}

/** Where an anchored data block draws, px from the glyph centre. */
export interface BlockPos {
  /** Left edge of the text box. */
  x: number
  /** Top edge of the text box. */
  y: number
  /** Text box width: the longest line, capped at `BLOCK_W`. */
  width: number
  /** Right-aligned when the block flipped left of the frame. */
  align: 'left' | 'right'
}

export type LabelPlacement = { mode: 'anchored' } | SpokePlacement

interface LayoutOptions {
  /** Ids spoked last frame; their cluster tests get padding so labels do not flicker at the boundary. */
  sticky?: Set<string>
  /** Stage size; fans flip sides and clamp vertically to stay visible. */
  viewport?: { w: number; h: number }
}

export const LABEL_FONT_PX = 11
/**
 * Stroke width of the board-tone halo on a label, px. The stroke runs under the fill,
 * so half of it shows outside each glyph; that half stays under the letter gap, so
 * over a coverage tint only the letter outlines show, never a filled patch.
 */
export const LABEL_HALO_PX = 2.5
const CHAR_W = LABEL_FONT_PX * 0.6
/** Widest data block, px: line one is a designator and up to three short words. */
export const BLOCK_W = 140
/** First baseline of the data block, px below the glyph centre (the primer's `by`). */
export const BLOCK_BASELINE = 4
/**
 * Top of the data block text box, px from the glyph centre. EntityLayer draws the block
 * at this offset, so the two must move together.
 */
export const BLOCK_TOP = BLOCK_BASELINE - LABEL_FONT_PX
/** Line pitch of the data block, px. */
export const LABEL_LINE_H = 12
/**
 * Left edge of the data block, px from the glyph centre, per frame: an air frame's
 * 21 clears the 17 px target brackets; a ground circle (r 12) takes 19; the unit and
 * installation rectangles (half width 14) take 21; the marker (half 7) takes 12.
 */
export const DATA_BLOCK_X: Record<EntityKind, number> = {
  uas: 21,
  sensor: 19,
  effector: 19,
  c2: 21,
  asset: 21,
  marker: 12,
}
/** Heading-handle knob: its centre sits this far from the glyph centre, px. */
export const HANDLE_REACH = 34
/** Heading-handle knob radius, px. */
export const HANDLE_KNOB_R = 6
/** Knob radius plus its 1.5 px rim and a 1.25 px gap: the label keeps this from the centre. */
const KNOB_CLEAR = HANDLE_KNOB_R + 2
const SLOT_H = 15
const TERMINAL_LEN = 30
const TEXT_GAP = 5
const GLYPH_CLEAR = 12
const GLYPH_NEAR = 44
const STICKY_PAD = 6
const EDGE_MARGIN = 10
const MIN_RADIUS = 80
const RADIUS_PAD = 70
/** Half side of a glyph box: the target brackets reach 17 px. */
const GLYPH_HALF = 18

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

interface Cluster {
  members: Measured[]
  cx: number
  cy: number
  radius: number
}

/**
 * Character budget for a board designator, chosen so the result plus its
 * instance number and a status word still fit the `BLOCK_W` block on one line.
 */
const DESIGNATOR_CHARS = 16

/** A product token: it carries a capital or a digit, so it names a thing. */
function productToken(word: string): boolean {
  return /[A-Z0-9]/.test(word)
}

/**
 * Short board designator for a canvas label: the product name and the instance
 * number in the board's uppercase idiom, so "Anvil interceptor (Anduril) 1"
 * becomes "ANVIL 1". Render-time only; Entity.name is never rewritten.
 *
 * The trailing instance number is split off and every parenthetical dropped. A
 * head within DESIGNATOR_CHARS is kept whole; otherwise the leading run of
 * product tokens is kept, stopping at the first plain lowercase word or at the
 * budget. A head that opens with a plain lowercase word keeps its first two words.
 */
export function boardDesignator(name: string): string {
  // A loaded record can carry a non-string name; the canvas must not throw on it.
  const trimmed = String(name ?? '').trim()
  if (trimmed.length === 0) return trimmed
  const tail = /^(.*?)\s+(\d+)$/.exec(trimmed)
  const index = tail ? ` ${tail[2]}` : ''
  const head = (tail ? tail[1] : trimmed)
    .replace(/\s*\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (head.length === 0) return trimmed.toUpperCase()
  if (head.length <= DESIGNATOR_CHARS) return (head + index).toUpperCase()

  const words = head.split(' ')
  let kept: string[]
  if (productToken(words[0])) {
    kept = []
    for (const word of words) {
      if (!productToken(word)) break
      const width = kept.length > 0 ? kept.join(' ').length + 1 + word.length : word.length
      if (kept.length > 0 && width > DESIGNATOR_CHARS) break
      kept.push(word)
    }
  } else {
    kept = words.slice(0, 2)
  }
  return (kept.join(' ') + index).toUpperCase()
}

/** Block text width, px: the longest line in the mono metric, capped at `BLOCK_W`. */
function blockWidth(lines: readonly string[]): number {
  const longest = lines.reduce((n, line) => Math.max(n, line.length), 0)
  return Math.min(BLOCK_W, longest * CHAR_W)
}

/** True when a disc meets a rect. */
function discMeetsRect(cx: number, cy: number, r: number, rect: Rect): boolean {
  const nx = Math.min(Math.max(cx, rect.x), rect.x + rect.w)
  const ny = Math.min(Math.max(cy, rect.y), rect.y + rect.h)
  return Math.hypot(cx - nx, cy - ny) < r
}

/**
 * Where the data block draws, px from the glyph centre. The block sits right of the
 * frame at `DATA_BLOCK_X[kind]`, first baseline at `BLOCK_BASELINE`. A heading knob
 * that would meet the right block flips it left of the frame, right-aligned, unless
 * the knob meets the left block too. Pass the lines actually drawn.
 */
export function anchoredBlockPos(
  lines: readonly string[],
  kind: EntityKind = 'uas',
  handleDeg?: number,
): BlockPos {
  const width = blockWidth(lines)
  const h = Math.max(1, lines.length) * LABEL_LINE_H
  const bx = DATA_BLOCK_X[kind]
  const right: BlockPos = { x: bx, y: BLOCK_TOP, width, align: 'left' }
  if (handleDeg == null) return right
  const r = (handleDeg * Math.PI) / 180
  const hx = Math.sin(r) * HANDLE_REACH
  const hy = -Math.cos(r) * HANDLE_REACH
  if (!discMeetsRect(hx, hy, KNOB_CLEAR, { x: right.x, y: right.y, w: width, h })) return right
  const left: BlockPos = { x: -bx - width, y: BLOCK_TOP, width, align: 'right' }
  if (discMeetsRect(hx, hy, KNOB_CLEAR, { x: left.x, y: left.y, w: width, h })) return right
  return left
}

/** One label measured: the drawn lines and the block box. */
function measure(m: LabelInput): Measured {
  const lines = m.lines ?? [boardDesignator(m.name)]
  const pos = anchoredBlockPos(lines, m.kind, m.handleDeg)
  return {
    ...m,
    name: lines[0] ?? '',
    lines,
    w: pos.width,
    h: Math.max(1, lines.length) * LABEL_LINE_H,
    bx: pos.x,
    top: pos.y,
  }
}

/** Footprint of the data block where EntityLayer draws it. */
function anchoredRect(m: Measured): Rect {
  return { x: m.sx + m.bx, y: m.sy + m.top, w: m.w, h: m.h }
}

/** One box over a glyph, its target brackets (17 px) and its data block. */
function markRect(m: Measured): Rect {
  const block = anchoredRect(m)
  const x0 = Math.min(m.sx - GLYPH_HALF, block.x)
  const y0 = Math.min(m.sy - GLYPH_HALF, block.y)
  const x1 = Math.max(m.sx + GLYPH_HALF, block.x + block.w)
  const y1 = Math.max(m.sy + GLYPH_HALF, block.y + block.h)
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

function inflate(r: Rect, pad: number): Rect {
  return { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 }
}

/** Two entities tangle when their glyphs converge or their data blocks overlap. */
function near(a: Measured, b: Measured, sticky?: Set<string>): boolean {
  const pad = sticky && (sticky.has(a.id) || sticky.has(b.id)) ? STICKY_PAD : 0
  if (Math.hypot(a.sx - b.sx, a.sy - b.sy) < GLYPH_NEAR + pad) return true
  return overlaps(inflate(anchoredRect(a), pad), anchoredRect(b))
}

function clusters(inputs: Measured[], sticky?: Set<string>): Measured[][] {
  const seen = new Array<boolean>(inputs.length).fill(false)
  const out: Measured[][] = []
  for (let i = 0; i < inputs.length; i++) {
    if (seen[i]) continue
    const queue = [i]
    seen[i] = true
    const group: Measured[] = []
    while (queue.length) {
      const a = queue.pop()!
      group.push(inputs[a])
      for (let b = 0; b < inputs.length; b++) {
        if (!seen[b] && near(inputs[a], inputs[b], sticky)) {
          seen[b] = true
          queue.push(b)
        }
      }
    }
    out.push(group)
  }
  return out
}

function geometry(members: Measured[]): Cluster {
  const cx = members.reduce((s, m) => s + m.sx, 0) / members.length
  const cy = members.reduce((s, m) => s + m.sy, 0) / members.length
  const ext = Math.max(...members.map((m) => Math.hypot(m.sx - cx, m.sy - cy)))
  return { members, cx, cy, radius: Math.max(MIN_RADIUS, ext + RADIUS_PAD) }
}

function maxWidth(members: LabelInput[]): number {
  return members.length ? Math.max(...members.map((m) => m.name.length * CHAR_W)) : 0
}

/** Screen rect a fanned cluster's leaders and labels will occupy. */
function envelope(c: Cluster): Rect {
  const left = c.members.filter((m) => m.sx < c.cx)
  const right = c.members.filter((m) => m.sx >= c.cx)
  const halfSpan = (side: LabelInput[]) =>
    side.length ? ((side.length - 1) / 2) * SLOT_H + LABEL_FONT_PX : 0
  const x0 = c.cx - (left.length ? c.radius + TEXT_GAP + maxWidth(left) : 0)
  const x1 = c.cx + (right.length ? c.radius + TEXT_GAP + maxWidth(right) : 0)
  const dy = Math.max(halfSpan(left), halfSpan(right))
  return { x: x0, y: c.cy - dy, w: x1 - x0, h: dy * 2 }
}

/**
 * Merge fanning clusters whose envelopes intersect; absorb anchored singletons whose
 * label or glyph a fan would cover.
 */
function consolidate(cs: Cluster[]): Cluster[] {
  let changed = true
  while (changed) {
    changed = false
    outer: for (let i = 0; i < cs.length; i++) {
      if (cs[i].members.length < 2) continue
      const env = envelope(cs[i])
      for (let j = 0; j < cs.length; j++) {
        if (i === j) continue
        const hit =
          cs[j].members.length >= 2
            ? overlaps(env, envelope(cs[j]))
            : overlaps(env, markRect(cs[j].members[0]))
        if (hit) {
          cs[i] = geometry([...cs[i].members, ...cs[j].members])
          cs.splice(j, 1)
          changed = true
          break outer
        }
      }
    }
  }
  return cs
}

function spokeSide(
  members: LabelInput[],
  dir: 1 | -1,
  c: Cluster,
  viewport: LayoutOptions['viewport'],
  out: Map<string, LabelPlacement>,
) {
  if (members.length === 0) return
  const sorted = [...members].sort((a, b) => a.sy - b.sy || a.sx - b.sx || (a.id < b.id ? -1 : 1))
  const half = ((sorted.length - 1) / 2) * SLOT_H
  let shift = 0
  if (viewport) {
    const top = c.cy - half - LABEL_FONT_PX / 2
    const bottom = c.cy + half + LABEL_FONT_PX / 2
    if (top < EDGE_MARGIN) shift = EDGE_MARGIN - top
    else if (bottom > viewport.h - EDGE_MARGIN) shift = viewport.h - EDGE_MARGIN - bottom
  }
  let terminalX = c.cx + dir * c.radius
  if (viewport) terminalX = Math.min(Math.max(terminalX, EDGE_MARGIN), viewport.w - EDGE_MARGIN)
  // Spoke geometry snaps to whole pixels, so a sub-pixel centroid drift while one
  // member flies leaves the callout identities unchanged.
  terminalX = Math.round(terminalX)
  sorted.forEach((m, i) => {
    const ly = Math.round(c.cy + (i - (sorted.length - 1) / 2) * SLOT_H + shift)
    const elbowX = terminalX - dir * TERMINAL_LEN
    const dx = elbowX - m.sx
    const dy = ly - m.sy
    const d = Math.hypot(dx, dy) || 1
    const ax = Math.round(m.sx + (dx / d) * GLYPH_CLEAR)
    const ay = Math.round(m.sy + (dy / d) * GLYPH_CLEAR)
    const width = m.name.length * CHAR_W
    out.set(m.id, {
      mode: 'spoke',
      points: [ax, ay, elbowX, ly, terminalX, ly],
      tx: dir === 1 ? terminalX + TEXT_GAP : terminalX - TEXT_GAP - width,
      ty: Math.round(ly - LABEL_FONT_PX / 2),
      width,
      align: dir === 1 ? 'left' : 'right',
      text: m.name,
    })
  })
}

function fanCluster(
  c: Cluster,
  viewport: LayoutOptions['viewport'],
  out: Map<string, LabelPlacement>,
) {
  let right = c.members.filter((m) => m.sx >= c.cx)
  let left = c.members.filter((m) => m.sx < c.cx)
  if (viewport) {
    const rightOver =
      right.length > 0 && c.cx + c.radius + TEXT_GAP + maxWidth(right) > viewport.w - EDGE_MARGIN
    const leftOver = left.length > 0 && c.cx - c.radius - TEXT_GAP - maxWidth(left) < EDGE_MARGIN
    if (rightOver && !leftOver) {
      left = [...left, ...right]
      right = []
    } else if (leftOver && !rightOver) {
      right = [...right, ...left]
      left = []
    }
  }
  spokeSide(right, 1, c, viewport, out)
  spokeSide(left, -1, c, viewport, out)
}

/**
 * True when a caption box whose top-left corner is (x, y) meets no glyph and no data
 * block. Coordinates are the scale-only screen frame: world meters times the zoom `k`.
 */
export function captionClear(
  x: number,
  y: number,
  text: string,
  entities: { id: string; name: string; kind?: EntityKind; pos: { x: number; y: number } }[],
  k: number,
): boolean {
  const box = { x, y, w: text.length * CHAR_W, h: LABEL_FONT_PX }
  return !entities.some((e) =>
    overlaps(
      box,
      markRect(measure({ id: e.id, name: e.name, kind: e.kind, sx: e.pos.x * k, sy: e.pos.y * k })),
    ),
  )
}

export function layoutLabels(
  inputs: LabelInput[],
  opts: LayoutOptions = {},
): Map<string, LabelPlacement> {
  const out = new Map<string, LabelPlacement>()
  // Measure what the canvas draws: the block lines, or boardDesignator(name) alone.
  const drawn = inputs.map(measure)
  const cs = consolidate(clusters(drawn, opts.sticky).map(geometry))
  for (const c of cs) {
    if (c.members.length === 1) out.set(c.members[0].id, { mode: 'anchored' })
    else fanCluster(c, opts.viewport, out)
  }
  return out
}
