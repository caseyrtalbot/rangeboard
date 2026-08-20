import { describe, expect, it } from 'vitest'
import { LABEL_FONT_PX, layoutLabels } from './labelLayout'
import type { LabelInput, SpokePlacement } from './labelLayout'

function spokeRect(p: SpokePlacement) {
  return { x: p.tx, y: p.ty, w: p.width, h: LABEL_FONT_PX }
}

function disjoint(a: ReturnType<typeof spokeRect>, b: ReturnType<typeof spokeRect>) {
  return a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y
}

describe('layoutLabels', () => {
  it('keeps distant labels anchored', () => {
    const out = layoutLabels([
      { id: 'a', name: 'RPS-42 Radar', sx: 100, sy: 100 },
      { id: 'b', name: 'FS-LIDS C2', sx: 500, sy: 400 },
    ])
    expect(out.get('a')).toEqual({ mode: 'anchored' })
    expect(out.get('b')).toEqual({ mode: 'anchored' })
  })

  it('fans overlapping labels into spokes on opposite sides', () => {
    const out = layoutLabels([
      { id: 'a', name: 'RPS-42 Radar', sx: 396, sy: 200 },
      { id: 'b', name: 'FS-LIDS C2', sx: 404, sy: 202 },
    ])
    const a = out.get('a') as SpokePlacement
    const b = out.get('b') as SpokePlacement
    expect(a.mode).toBe('spoke')
    expect(b.mode).toBe('spoke')
    expect(a.align).toBe('right')
    expect(b.align).toBe('left')
  })

  it('separates every label in a converged cluster', () => {
    const names = ['RPS-42 Radar (RADA)', 'FS-LIDS C2', 'EnforceAir 2 (D-Fend)', 'Anvil Interceptor', 'FOB Perimeter Asset', 'Shahed-136 / Geran']
    const inputs: LabelInput[] = names.map((name, i) => ({
      id: `e${i}`,
      name,
      sx: 400 + (i % 3) * 14,
      sy: 200 + Math.floor(i / 3) * 12,
    }))
    const out = layoutLabels(inputs)
    const placements = inputs.map((m) => out.get(m.id) as SpokePlacement)
    for (const p of placements) expect(p.mode).toBe('spoke')
    const rects = placements.map(spokeRect)
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        expect(disjoint(rects[i], rects[j])).toBe(true)
      }
    }
  })

  it('is deterministic for identical input', () => {
    const inputs: LabelInput[] = [
      { id: 'a', name: 'Alpha', sx: 400, sy: 200 },
      { id: 'b', name: 'Bravo', sx: 405, sy: 200 },
      { id: 'c', name: 'Charlie', sx: 410, sy: 205 },
    ]
    expect(layoutLabels(inputs)).toEqual(layoutLabels(inputs))
  })

  it('merges vertically split rows so cross-cluster labels never overlap', () => {
    const names = ['Anvil interceptor (Anduril)', 'RPS-42 radar panel (RADA MHR)', 'Coyote Block 2 interceptor']
    const inputs: LabelInput[] = []
    for (let r = 0; r < 2; r++)
      for (let c = 0; c < 6; c++)
        inputs.push({ id: `r${r}c${c}`, name: `${names[c % 3]} ${r * 6 + c + 1}`, sx: 480 + (c % 3) * 22 + Math.floor(c / 3), sy: 435 + r * 31 })
    const out = layoutLabels(inputs)
    const rects = inputs.map((m) => spokeRect(out.get(m.id) as SpokePlacement))
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        expect(disjoint(rects[i], rects[j])).toBe(true)
      }
    }
  })

  it('absorbs an anchored singleton whose label sits inside a fan band', () => {
    const out = layoutLabels([
      { id: 'a', name: 'RPS-42 radar panel (RADA MHR) 1', sx: 400, sy: 200 },
      { id: 'b', name: 'Coyote Block 2 interceptor 1', sx: 410, sy: 200 },
      { id: 'c', name: 'Ranger HDC MR EO/IR (FLIR) 1', sx: 560, sy: 190 },
    ])
    expect(out.get('c')!.mode).toBe('spoke')
  })

  it('flips a fan away from the viewport edge', () => {
    const out = layoutLabels(
      [
        { id: 'a', name: 'RPS-42 radar panel (RADA MHR) 1', sx: 980, sy: 300 },
        { id: 'b', name: 'Coyote Block 2 interceptor 1', sx: 985, sy: 302 },
      ],
      { viewport: { w: 1000, h: 600 } },
    )
    for (const id of ['a', 'b']) {
      const p = out.get(id) as SpokePlacement
      expect(p.align).toBe('right')
      expect(p.tx + p.width).toBeLessThan(1000)
    }
  })

  it('keeps labels inside the viewport when the cluster is past the edge', () => {
    const out = layoutLabels(
      [
        { id: 'a', name: 'RPS-42 radar panel (RADA MHR) 1', sx: 1050, sy: 300 },
        { id: 'b', name: 'Coyote Block 2 interceptor 1', sx: 1055, sy: 302 },
      ],
      { viewport: { w: 1000, h: 600 } },
    )
    for (const id of ['a', 'b']) {
      const p = out.get(id) as SpokePlacement
      expect(p.tx + p.width).toBeLessThanOrEqual(995)
    }
  })

  it('keeps a barely separated pair spoked when sticky', () => {
    const inputs: LabelInput[] = [
      { id: 'a', name: 'Alpha', sx: 100, sy: 100 },
      { id: 'b', name: 'Bravo', sx: 100, sy: 145 },
    ]
    expect(layoutLabels(inputs).get('a')!.mode).toBe('anchored')
    const sticky = layoutLabels(inputs, { sticky: new Set(['a', 'b']) })
    expect(sticky.get('a')!.mode).toBe('spoke')
    expect(sticky.get('b')!.mode).toBe('spoke')
  })
})
