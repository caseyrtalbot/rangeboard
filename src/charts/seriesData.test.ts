import { describe, expect, it } from 'vitest'
import { DT } from '../playback/clock'
import { lastFiniteIndex, lastVisibleIndex, seriesDurationS, seriesRange, seriesRows } from './seriesData'
import type { Series } from './types'

const values = Array.from({ length: 60 / DT + 1 }, (_, i) => i * DT <= 30 ? i * DT : 1000)
const series: Series[] = [{
  id: 'a', label: 'Observed', unit: null, color: 'chart-1', kind: 'line', values,
  band80: [values.map((v) => -v), values.map((v) => v + 2)],
  band95: [values.map((v) => -v - 1), values.map((v) => v + 3)],
}]

describe('series horizon', () => {
  it('preserves unscoped rows, bands, ranges and endpoint indices with Infinity', () => {
    expect(seriesRows(series, Infinity)).toEqual(seriesRows(series))
    expect(seriesRange(series, undefined, Infinity)).toEqual(seriesRange(series))
    expect(lastVisibleIndex(values, Infinity)).toBe(lastFiniteIndex(values))
    expect(seriesRows(series)[61]).toEqual({ t: 30.5, a: 1000, 'a:80': [-1000, 1002], 'a:95': [-1001, 1003] })
  })

  it('keeps the full time grid but censors every future value and band', () => {
    const rows = seriesRows(series, 30)
    expect(rows).toHaveLength(values.length)
    expect(rows[60]).toEqual({ t: 30, a: 30, 'a:80': [-30, 32], 'a:95': [-31, 33] })
    for (const row of rows.slice(61)) {
      expect(row.a).toBeUndefined()
      expect(row['a:80']).toBeUndefined()
      expect(row['a:95']).toBeUndefined()
    }
    expect(rows.at(-1)?.t).toBe(60)
    expect(seriesDurationS(series)).toBe(60)
    expect(values[61]).toBe(1000)
  })

  it('ranges over visible values and bands while respecting a fixed domain', () => {
    expect(seriesRange(series, undefined, 30)).toEqual([-31, 33 * 1.08])
    expect(seriesRange(series, [0, 2000], -Infinity)).toEqual([0, 2000])
    expect(seriesRange(series, undefined, -Infinity)).toEqual([0, 1])
  })

  it('clips endpoint searches inclusively without rounding up across the horizon', () => {
    expect(lastVisibleIndex(values, 30)).toBe(60)
    expect(lastVisibleIndex(values, 29.99)).toBe(59)
    expect(lastVisibleIndex([1, NaN, 3], DT)).toBe(0)
    expect(lastVisibleIndex([NaN, NaN], Infinity)).toBe(-1)
    expect(lastVisibleIndex(values, -Infinity)).toBe(-1)
    expect(lastVisibleIndex(values, -0.1)).toBe(-1)
    expect(lastVisibleIndex(values, 0)).toBe(0)
    expect(lastVisibleIndex([], 30)).toBe(-1)
  })

  it('censors even the zero-time sample before any outcomes are observed', () => {
    for (const row of seriesRows(series, -Infinity)) {
      expect(row.a).toBeUndefined()
      expect(row['a:80']).toBeUndefined()
      expect(row['a:95']).toBeUndefined()
    }
  })
})
