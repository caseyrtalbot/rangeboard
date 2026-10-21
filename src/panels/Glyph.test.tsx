import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { SpecModel } from '../model/types'
import {
  AIR_FRAME,
  airFrameFor,
  barBox,
  bracketPoints,
  Glyph,
  groundFrameFor,
  ICON_PATH,
} from './Glyph'

const model = (patch: Partial<SpecModel>): SpecModel => patch as SpecModel

describe('airFrameFor', () => {
  it('carries identity in shape, dash and ink', () => {
    expect(airFrameFor('pending')).toEqual({ shape: 'circle', dashed: true, inkKey: 'unknown' })
    expect(airFrameFor('unknown')).toEqual({ shape: 'circle', dashed: false, inkKey: 'unknown' })
    expect(airFrameFor('suspect')).toEqual({ shape: 'diamond', dashed: true, inkKey: 'hostile' })
    expect(airFrameFor('hostile')).toEqual({ shape: 'diamond', dashed: false, inkKey: 'hostile' })
    expect(airFrameFor('friend')).toEqual({ shape: 'circle', dashed: false, inkKey: 'friend' })
    expect(airFrameFor('neutral')).toEqual({ shape: 'square', dashed: false, inkKey: 'neutral' })
    expect(airFrameFor('none')).toEqual({ shape: 'diamond', dashed: false, inkKey: 'noTrack' })
  })

  it('dashes only the rungs one short of a call', () => {
    const dashed = Object.entries(AIR_FRAME)
      .filter(([, f]) => f.dashed)
      .map(([id]) => id)
    expect(dashed.sort()).toEqual(['pending', 'suspect'])
  })
})

describe('groundFrameFor', () => {
  it('picks the frame by kind and the icon by sub-kind', () => {
    expect(groundFrameFor('sensor', model({ sensor: { sensorType: 'radar' } as never }))).toEqual({
      shape: 'circle',
      icon: 'radar',
      letter: 'S',
    })
    expect(groundFrameFor('sensor', model({ sensor: { sensorType: 'eo-ir' } as never }))).toEqual({
      shape: 'circle',
      icon: 'sensor',
      letter: 'S',
    })
    expect(groundFrameFor('sensor')).toEqual({ shape: 'circle', icon: 'sensor', letter: 'S' })
    expect(
      groundFrameFor('effector', model({ effector: { effectorType: 'interceptor' } as never })),
    ).toEqual({ shape: 'circle', icon: 'launcher', letter: 'E' })
    expect(
      groundFrameFor('effector', model({ effector: { effectorType: 'jammer' } as never })),
    ).toEqual({ shape: 'circle', text: 'EW', letter: 'EW' })
    expect(
      groundFrameFor('effector', model({ effector: { effectorType: 'de' } as never })),
    ).toEqual({ shape: 'circle', icon: 'laser', letter: 'E' })
    expect(
      groundFrameFor('effector', model({ effector: { effectorType: 'hpm' } as never })),
    ).toEqual({ shape: 'circle', icon: 'laser', letter: 'E' })
    expect(groundFrameFor('c2')).toEqual({ shape: 'rect', text: 'C2', letter: 'C2' })
    expect(groundFrameFor('asset')).toEqual({ shape: 'inst', text: 'DA', letter: 'DA' })
    expect(groundFrameFor('marker')).toEqual({ shape: 'marker', letter: '' })
  })

  it('has a path for every icon it names', () => {
    for (const icon of ['radar', 'sensor', 'launcher', 'laser'] as const) {
      expect(ICON_PATH[icon].d.length).toBeGreaterThan(10)
    }
  })
})

describe('amplifier geometry', () => {
  it('builds four corner brackets with the corner in the middle of each polyline', () => {
    const b = bracketPoints(17, 5)
    expect(b).toHaveLength(4)
    expect(b[0]).toEqual([-12, -17, -17, -17, -17, -12])
  })

  it('sizes the engagement bar by its text with a 22 unit floor', () => {
    expect(barBox('ASN', -13).w).toBe(22)
    expect(barBox('MIF-M', -13).w).toBeCloseTo(5 * 4.9 + 6)
    expect(barBox('MIF-M', -13).y).toBe(-23)
  })
})

describe('Glyph', () => {
  const radar = model({ sensor: { sensorType: 'radar' } as never })

  it('draws a dashed frame for pending and suspect, solid otherwise', () => {
    const pending = renderToStaticMarkup(
      <Glyph kind="uas" color="#e6cf5a" size={16} identity="pending" />,
    )
    const suspect = renderToStaticMarkup(
      <Glyph kind="uas" color="#e46f62" size={16} identity="suspect" />,
    )
    const hostile = renderToStaticMarkup(<Glyph kind="uas" color="#e46f62" size={16} />)
    expect(pending).toContain('<circle')
    expect(pending).toContain('stroke-dasharray="4 2.5"')
    expect(suspect).toContain('<polygon')
    expect(suspect).toContain('stroke-dasharray="4 2.5"')
    expect(hostile).toContain('<polygon')
    expect(hostile).not.toContain('stroke-dasharray')
  })

  it('knocks out the frame in the board tone and strokes it in the ink', () => {
    const html = renderToStaticMarkup(<Glyph kind="c2" color="#7fbfe6" size={16} />)
    expect(html).toContain('fill="var(--surface-board)"')
    expect(html).toContain('stroke="#7fbfe6"')
    expect(html).toContain('>C2<')
  })

  it('draws the icon at 16 px and the letter below it', () => {
    const big = renderToStaticMarkup(
      <Glyph kind="sensor" color="#7fbfe6" size={16} model={radar} />,
    )
    const small = renderToStaticMarkup(
      <Glyph kind="sensor" color="#7fbfe6" size={12} model={radar} />,
    )
    expect(big).toContain(ICON_PATH.radar.d)
    expect(big).not.toContain('>S<')
    expect(small).not.toContain(ICON_PATH.radar.d)
    expect(small).toContain('>S<')
  })

  it('keeps the marker as a square with a centre dot', () => {
    const html = renderToStaticMarkup(<Glyph kind="marker" color="#b7bdb2" size={12} />)
    expect(html).toContain('<rect')
    expect(html).toContain('<circle r="2"')
  })
})
