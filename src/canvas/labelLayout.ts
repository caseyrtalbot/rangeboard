/**
 * Screen-space placement for entity name labels. When anchored labels would
 * overlap at the current zoom, the colliding group fans out into spoke
 * callouts: thin elbow leaders to labels stacked left and right of the
 * cluster. Pure and unit-tested; all coordinates are screen pixels.
 *
 * Clustering runs in three passes so fans never land on other labels:
 * glyph proximity and label overlap build the initial components; clusters
 * whose fan envelopes intersect merge; anchored singletons whose label falls
 * inside a fan envelope are absorbed into that cluster.
 */

export interface LabelInput {
  id: string
  name: string
  sx: number
  sy: number
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

export interface LayoutOptions {
  /** Ids spoked last frame; their cluster tests get padding so labels do not flicker at the boundary. */
  sticky?: Set<string>
  /** Stage size; fans flip sides and clamp vertically to stay visible. */
  viewport?: { w: number; h: number }
}

export const LABEL_FONT_PX = 11
const CHAR_W = LABEL_FONT_PX * 0.6
const ANCHOR_W = 120
const ANCHOR_TOP = 14
const LINE_H = 12
const SLOT_H = 15
const TERMINAL_LEN = 30
const TEXT_GAP = 5
const GLYPH_CLEAR = 12
const GLYPH_NEAR = 44
const STICKY_PAD = 6
const EDGE_MARGIN = 10
const MIN_RADIUS = 80
const RADIUS_PAD = 70

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

interface Cluster {
  members: LabelInput[]
  cx: number
  cy: number
  radius: number
}

/** Footprint of the default anchored label (centered, 120px wrap). */
function anchoredRect(m: LabelInput): Rect {
  const textW = m.name.length * CHAR_W
  const w = Math.min(ANCHOR_W, textW)
  const lines = Math.max(1, Math.ceil(textW / ANCHOR_W))
  return { x: m.sx - w / 2, y: m.sy + ANCHOR_TOP, w, h: lines * LINE_H }
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

function inflate(r: Rect, pad: number): Rect {
  return { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 }
}

/** Two entities tangle when their glyphs converge or their anchored labels overlap. */
function near(a: LabelInput, b: LabelInput, sticky?: Set<string>): boolean {
  const pad = sticky && (sticky.has(a.id) || sticky.has(b.id)) ? STICKY_PAD : 0
  if (Math.hypot(a.sx - b.sx, a.sy - b.sy) < GLYPH_NEAR + pad) return true
  return overlaps(inflate(anchoredRect(a), pad), anchoredRect(b))
}

function clusters(inputs: LabelInput[], sticky?: Set<string>): LabelInput[][] {
  const seen = new Array<boolean>(inputs.length).fill(false)
  const out: LabelInput[][] = []
  for (let i = 0; i < inputs.length; i++) {
    if (seen[i]) continue
    const queue = [i]
    seen[i] = true
    const group: LabelInput[] = []
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

function geometry(members: LabelInput[]): Cluster {
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

/** Merge fanning clusters whose envelopes intersect; absorb anchored singletons caught in a fan. */
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
            : overlaps(env, anchoredRect(cs[j].members[0]))
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
  sorted.forEach((m, i) => {
    const ly = c.cy + (i - (sorted.length - 1) / 2) * SLOT_H + shift
    const elbowX = terminalX - dir * TERMINAL_LEN
    const dx = elbowX - m.sx
    const dy = ly - m.sy
    const d = Math.hypot(dx, dy) || 1
    const ax = m.sx + (dx / d) * GLYPH_CLEAR
    const ay = m.sy + (dy / d) * GLYPH_CLEAR
    const width = m.name.length * CHAR_W
    out.set(m.id, {
      mode: 'spoke',
      points: [ax, ay, elbowX, ly, terminalX, ly],
      tx: dir === 1 ? terminalX + TEXT_GAP : terminalX - TEXT_GAP - width,
      ty: ly - LABEL_FONT_PX / 2,
      width,
      align: dir === 1 ? 'left' : 'right',
    })
  })
}

function fanCluster(c: Cluster, viewport: LayoutOptions['viewport'], out: Map<string, LabelPlacement>) {
  let right = c.members.filter((m) => m.sx >= c.cx)
  let left = c.members.filter((m) => m.sx < c.cx)
  if (viewport) {
    const rightOver = right.length > 0 && c.cx + c.radius + TEXT_GAP + maxWidth(right) > viewport.w - EDGE_MARGIN
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

export function layoutLabels(inputs: LabelInput[], opts: LayoutOptions = {}): Map<string, LabelPlacement> {
  const out = new Map<string, LabelPlacement>()
  const cs = consolidate(clusters(inputs, opts.sticky).map(geometry))
  for (const c of cs) {
    if (c.members.length === 1) out.set(c.members[0].id, { mode: 'anchored' })
    else fanCluster(c, opts.viewport, out)
  }
  return out
}
