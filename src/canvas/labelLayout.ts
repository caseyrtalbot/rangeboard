/**
 * Screen-space placement for entity name labels. When anchored labels would
 * overlap at the current zoom, the colliding group fans out into spoke
 * callouts: thin elbow leaders to labels stacked left and right of the
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
  /**
   * The string the canvas draws, when the caller already holds it. Absent, the
   * layout derives it with `boardDesignator`.
   */
  drawn?: string
}

/** A label input with its box measured once, so the O(n^2) pass does no string work. */
interface Measured extends LabelInput {
  /** Anchored box width, px. */
  w: number
  /** Anchored box height, px. */
  h: number
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
}

export type LabelPlacement = { mode: 'anchored' } | SpokePlacement

interface LayoutOptions {
  /** Ids spoked last frame; their cluster tests get padding so labels do not flicker at the boundary. */
  sticky?: Set<string>
  /** Stage size; fans flip sides and clamp vertically to stay visible. */
  viewport?: { w: number; h: number }
}

export const LABEL_FONT_PX = 11
const CHAR_W = LABEL_FONT_PX * 0.6
const ANCHOR_W = 120
/**
 * Top of the anchored label box, px below the glyph centre. EntityLayer draws
 * the label at this offset, so the two must move together. It clears the
 * selection ring (r 28) and its halo, which reach y 30.75.
 */
export const LABEL_ANCHOR_TOP = 32
/** Line box height of a wrapped anchored label, px. */
export const LABEL_LINE_H = 12
const SLOT_H = 15
const TERMINAL_LEN = 30
const TEXT_GAP = 5
const GLYPH_CLEAR = 12
const GLYPH_NEAR = 44
const STICKY_PAD = 6
const EDGE_MARGIN = 10
const MIN_RADIUS = 80
const RADIUS_PAD = 70
/** Half side of a glyph box: the target brackets reach 19 px. */
const GLYPH_HALF = 20

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
 * instance number still fits the 120px anchored box on one line.
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

/**
 * Lines an anchored name wraps to at the 120px box. Greedy word wrap over the
 * monospace metric, matching how Konva wraps the drawn Text. Pass the string
 * actually drawn, which is boardDesignator(entity.name).
 */
export function labelLineCount(name: string): number {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0)
  if (words.length === 0) return 1
  let lines = 1
  let width = 0
  for (const word of words) {
    const w = word.length * CHAR_W
    if (width > 0 && width + CHAR_W + w > ANCHOR_W) {
      lines++
      width = 0
    }
    if (w > ANCHOR_W) {
      // A word wider than the box breaks inside itself and fills its last line.
      lines += Math.ceil(w / ANCHOR_W) - 1
      width = ANCHOR_W
    } else {
      width = width > 0 ? width + CHAR_W + w : w
    }
  }
  return lines
}

/** One label measured: the drawn designator and its anchored box. */
function measure(m: LabelInput): Measured {
  const name = m.drawn ?? boardDesignator(m.name)
  return {
    ...m,
    name,
    w: Math.min(ANCHOR_W, name.length * CHAR_W),
    h: labelLineCount(name) * LABEL_LINE_H,
  }
}

/** Footprint of the default anchored label (centered, 120px wrap). */
function anchoredRect(m: Measured): Rect {
  return { x: m.sx - m.w / 2, y: m.sy + LABEL_ANCHOR_TOP, w: m.w, h: m.h }
}

/** One box over a glyph, its target brackets (19 px) and its anchored label. */
function markRect(m: Measured): Rect {
  const half = Math.max(GLYPH_HALF, m.w / 2)
  return {
    x: m.sx - half,
    y: m.sy - GLYPH_HALF,
    w: half * 2,
    h: GLYPH_HALF + LABEL_ANCHOR_TOP + m.h,
  }
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

function inflate(r: Rect, pad: number): Rect {
  return { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 }
}

/** Two entities tangle when their glyphs converge or their anchored labels overlap. */
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
 * True when a caption box whose top-left corner is (x, y) meets no glyph and no anchored
 * label. Coordinates are the scale-only screen frame: world meters times the zoom `k`.
 */
export function captionClear(
  x: number,
  y: number,
  text: string,
  entities: { id: string; name: string; pos: { x: number; y: number } }[],
  k: number,
): boolean {
  const box = { x, y, w: text.length * CHAR_W, h: LABEL_FONT_PX }
  return !entities.some((e) =>
    overlaps(box, markRect(measure({ id: e.id, name: e.name, sx: e.pos.x * k, sy: e.pos.y * k }))),
  )
}

export function layoutLabels(
  inputs: LabelInput[],
  opts: LayoutOptions = {},
): Map<string, LabelPlacement> {
  const out = new Map<string, LabelPlacement>()
  // Measure what the canvas draws: both layers render boardDesignator(name).
  const drawn = inputs.map(measure)
  const cs = consolidate(clusters(drawn, opts.sticky).map(geometry))
  for (const c of cs) {
    if (c.members.length === 1) out.set(c.members[0].id, { mode: 'anchored' })
    else fanCluster(c, opts.viewport, out)
  }
  return out
}
