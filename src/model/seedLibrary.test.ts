// @ts-expect-error node types are not in the app tsconfig; vitest runs this file in node.
import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { SpecModel } from './types'
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
          // A pf row may link a page when it carries a spread: the source gives the
          // trial counts behind the spread, not the nominal value.
          if (url !== null && row.spread == null) {
            offenders.push(`${model.id} ${row.field}: pf row has a url and no spread`)
          }
        } else if (!url?.startsWith('http')) {
          offenders.push(`${model.id} ${row.field}: ${row.basis} row has no url`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('the Stinger and Leonidas kill probabilities keep their counts in the text, not as a spread', () => {
    // 2 of 2 and 61 of 61 (49 in one pulse) are outside their trial
    // domain, so both rows take the PF pseudo-beta around the nominal 0.7
    // like every other effector; the counts stay in the row value.
    const rows = ['lib-stinger', 'lib-leonidas'].map((id) => {
      const model = SEED_LIBRARY.find((m) => m.id === id)
      return model?.provenance?.find((row) => row.field === 'pk')
    })
    expect(rows.map((row) => row?.spread)).toEqual([undefined, undefined])
    expect(rows.map((row) => row?.basis)).toEqual(['pf', 'pf'])
    expect(rows[0]?.value).toContain('2 of 2')
    expect(rows[1]?.value).toContain('61 of 61')
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

/**
 * The library is compiled from data/library/**.json by scripts/build-library.mjs.
 * The fixture is the hand-written library at 8e9a0bc, so parity against it is
 * what proves the migration changed no value. `npm run library:check` enforces
 * the rest of the data health rules; the unit and grade check below repeats the
 * two that would silently drop a value's meaning.
 */

const FIXTURE = JSON.parse(
  readFileSync(new URL('./__fixtures__/seedLibrary.8e9a0bc.json', import.meta.url), 'utf8'),
) as SpecModel[]

/** The keys the data package adds to a provenance row; everything else is pre-migration. */
const LINEAGE_KEYS = ['grade', 'layer', 'rangeType', 'condition', 'unit', 'estimator', 'comparisonSet', 'note']

interface LibraryFileOnDisk {
  name: string
  fields: Record<string, { unit?: string; grade?: string }>
}

function libraryFiles(): LibraryFileOnDisk[] {
  const base = new URL('../../data/library/', import.meta.url)
  const out: LibraryFileOnDisk[] = []
  for (const kind of ['sensor', 'effector', 'c2', 'uas', 'asset', 'marker']) {
    const dir = new URL(`${kind}/`, base)
    for (const name of readdirSync(dir)) {
      const parsed = JSON.parse(readFileSync(new URL(name, dir), 'utf8'))
      out.push({ name: `${kind}/${name}`, fields: parsed.fields ?? {} })
    }
  }
  return out
}

describe('generated library parity', () => {
  it('carries the same models, in the same order, as the pre-migration library', () => {
    expect(SEED_LIBRARY).toHaveLength(FIXTURE.length)
    expect(SEED_LIBRARY.map((m) => m.id)).toEqual(FIXTURE.map((m) => m.id))
  })

  it('every model equals its fixture once the added lineage keys are dropped', () => {
    for (const [i, model] of SEED_LIBRARY.entries()) {
      const rows = model.provenance?.map((row) => {
        const copy: Record<string, unknown> = { ...row }
        for (const key of LINEAGE_KEYS) delete copy[key]
        return copy
      })
      expect(rows ? { ...model, provenance: rows } : model).toEqual(FIXTURE[i])
    }
  })
})

describe('library data package', () => {
  it('gives every field a unit and a grade', () => {
    const offenders: string[] = []
    for (const file of libraryFiles()) {
      for (const [key, field] of Object.entries(file.fields)) {
        if (!field.unit) offenders.push(`${file.name} ${key}: no unit`)
        if (!field.grade) offenders.push(`${file.name} ${key}: no grade`)
      }
    }
    expect(offenders).toEqual([])
  })
})
