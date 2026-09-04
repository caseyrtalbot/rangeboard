import { describe, expect, it } from 'vitest'
import { mulberry32 } from './prng'

describe('mulberry32', () => {
  it('gives the same first values the stats.ts private copy gave for seed 1', () => {
    const r = mulberry32(1)
    expect([r(), r(), r()]).toEqual([
      0.6270739405881613, 0.002735721180215478, 0.5274470399599522,
    ])
  })

  it('two generators with the same seed agree', () => {
    const a = mulberry32(4821)
    const b = mulberry32(4821)
    for (let i = 0; i < 20; i++) expect(a()).toBe(b())
  })
})
