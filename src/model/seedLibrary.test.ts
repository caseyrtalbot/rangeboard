import { describe, expect, it } from 'vitest'
import { SEED_LIBRARY } from './seed'

/**
 * Provenance integrity for the seed library. Every unsourced number is a
 * planning factor, so a row must never claim a source it does not carry:
 * a sourced row needs a real link, a planning-factor row carries none, and
 * one field never gets two answers on the same model.
 */

const RADARS = SEED_LIBRARY.filter((m) => m.sensor?.sensorType === 'radar')
const SENSORS = SEED_LIBRARY.filter((m) => m.sensor != null)
const EFFECTORS = SEED_LIBRARY.filter((m) => m.effector != null)
const THREATS = SEED_LIBRARY.filter((m) => m.uas != null)
const BASES = ['datasheet', 'reference', 'pf']

/** Ids of the models that carry no row for `field`. */
function missingRow(models: typeof SEED_LIBRARY, field: string): string[] {
  return models.filter((m) => !m.provenance?.some((row) => row.field === field)).map((m) => m.id)
}

describe('seed library provenance', () => {
  it('carries the 19 radar models', () => {
    expect(RADARS).toHaveLength(19)
  })

  it('carries the 38 sensor, 25 effector and 15 threat models', () => {
    expect([SENSORS.length, EFFECTORS.length, THREATS.length]).toEqual([38, 25, 15])
  })

  it('every radar records where its placard detect range comes from', () => {
    expect(missingRow(RADARS, 'detectRangeM')).toEqual([])
  })

  it('every sensor records where its detect range comes from', () => {
    expect(missingRow(SENSORS, 'detectRangeM')).toEqual([])
  })

  it('every effector records its maximum range', () => {
    expect(missingRow(EFFECTORS, 'maxRangeM')).toEqual([])
  })

  it('every threat records its radar cross section basis', () => {
    expect(missingRow(THREATS, 'rcsM2')).toEqual([])
  })

  it('every flyout speed carries a sourced row', () => {
    const offenders: string[] = []
    for (const model of SEED_LIBRARY) {
      if (model.effector?.flyoutSpeedMps == null) continue
      const row = model.provenance?.find((p) => p.field === 'flyoutSpeedMps')
      if (!row || row.basis === 'pf') offenders.push(model.id)
    }
    expect(offenders).toEqual([])
  })

  it('every row carries an ISO date and a known basis', () => {
    const offenders: string[] = []
    for (const model of SEED_LIBRARY) {
      for (const row of model.provenance ?? []) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) offenders.push(`${model.id} ${row.field} date`)
        if (!BASES.includes(row.basis)) offenders.push(`${model.id} ${row.field} basis`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('a sourced row links the page and a planning-factor row does not', () => {
    const offenders: string[] = []
    for (const model of SEED_LIBRARY) {
      for (const row of model.provenance ?? []) {
        const url = row.url ?? null
        if (row.basis === 'pf') {
          if (url !== null) offenders.push(`${model.id} ${row.field}: pf row has a url`)
        } else if (!url?.startsWith('http')) {
          offenders.push(`${model.id} ${row.field}: ${row.basis} row has no url`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('no model answers one field twice', () => {
    const offenders: string[] = []
    for (const model of SEED_LIBRARY) {
      const seen = new Set<string>()
      for (const row of model.provenance ?? []) {
        if (seen.has(row.field)) offenders.push(`${model.id} ${row.field}`)
        seen.add(row.field)
      }
    }
    expect(offenders).toEqual([])
  })
})
