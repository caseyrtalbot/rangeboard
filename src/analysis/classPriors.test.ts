// @ts-expect-error node types are not in the app tsconfig; vitest runs this file in node.
import { spawnSync } from 'node:child_process'
// @ts-expect-error node types are not in the app tsconfig; vitest runs this file in node.
import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { SpecModel, Spread } from '../model/types'
import { SEED_LIBRARY } from '../model/seed'
import { CLASS_PRIORS, classOfModel, classPriorFor } from './classPriors'
import { FIELDS_BY_KIND, PF_SPREAD, spreadBasisFor, spreadFor } from './parameterBasis'

/**
 * Class priors are derived from L1 entries by scripts/derive-priors.mjs. These
 * tests pin the statistic to a hand computation, prove the runtime class rule
 * matches the script's on every seed model, and show the resolver is unchanged
 * for every caller that passes no table.
 */

const ROOT = new URL('../../', import.meta.url).pathname

/** Every library JSON file with its class key as the generated prior files name it. */
function libraryFiles(): Array<{ id: string; spec: string | null; attributes: Record<string, unknown>; fields: Record<string, { value: unknown }> }> {
  const out = []
  for (const dir of ['sensor', 'effector', 'uas', 'c2', 'asset', 'marker']) {
    for (const name of readdirSync(`${ROOT}data/library/${dir}`)) {
      if (name.endsWith('.json')) out.push(JSON.parse(readFileSync(`${ROOT}data/library/${dir}/${name}`, 'utf8')))
    }
  }
  return out
}

/** The script's class rule, restated on the JSON file so the two are compared independently. */
function classOfFile(file: ReturnType<typeof libraryFiles>[number]): string | null {
  const a = file.attributes
  const join = (b: unknown) => (Array.isArray(b) && b.length ? [...b].sort().join('+') : 'any')
  if (file.spec === 'sensor') {
    const t = a.sensorType
    const band = t === 'eo-ir' ? (a.eoBand ?? 'dual') : t === 'rf' ? join(a.rfBands) : 'any'
    return `sensor/${t}/${band}/any`
  }
  if (file.spec === 'effector') return `effector/${a.effectorType}/${join(a.jamBands)}/any`
  if (file.spec === 'uas') return `uas/${a.airframe}/${file.fields.group.value}/any`
  return null
}

/** The resolver as it stood before class priors: row spread, pinned null, else the PF table. */
function oldSpreadFor(model: SpecModel, field: string): Spread | null {
  const row = model.provenance?.find((r) => r.field === field)
  if (row?.spread) return row.spread
  if (row && row.spread === null) return null
  return PF_SPREAD[field]?.spread ?? null
}

function sampleSd(values: number[]): number {
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1))
}

describe('class priors', () => {
  it('uas/one-way-attack/3 spanM equals the hand computation over its three L1 members', () => {
    // Geran-4 3 m, Mugin-5 5 m, Shahed-136 2.5 m: the L1 spans of the class.
    const spans = [3, 5, 2.5]
    const logs = spans.map((v) => Math.log(v)).sort((x, y) => x - y)
    const logMedian = logs[1] // odd n: the middle value, ln 3
    const sigmaDb = sampleSd(spans.map((v) => 20 * Math.log10(v)))
    const prior = CLASS_PRIORS['uas/one-way-attack/3/any'].fields.spanM
    expect(prior.n).toBe(3)
    expect(prior.members.sort()).toEqual(['lib-geran4', 'lib-mugin5', 'lib-shahed136'])
    expect('logMedian' in prior && prior.logMedian).toBeCloseTo(logMedian, 9)
    expect('sigmaDb' in prior && prior.sigmaDb).toBeCloseTo(sigmaDb, 9)
    expect(logMedian).toBeCloseTo(Math.log(3), 12)
  })

  it('sensor/radar updateRateS equals the hand computation of an additive prior', () => {
    // Giraffe 1X 1 s, IRIS 1 s, R8SS 0.5 s.
    const values = [1, 1, 0.5]
    const mean = (1 + 1 + 0.5) / 3
    const sd = Math.sqrt(((1 - mean) ** 2 + (1 - mean) ** 2 + (0.5 - mean) ** 2) / 2)
    const prior = CLASS_PRIORS['sensor/radar/any/any'].fields.updateRateS
    expect(prior.n).toBe(values.length)
    expect('mean' in prior && prior.mean).toBeCloseTo(mean, 9)
    expect('sd' in prior && prior.sd).toBeCloseTo(sd, 9)
  })

  it('every prior comes from at least three members and is bounded by its member list', () => {
    for (const prior of Object.values(CLASS_PRIORS)) {
      for (const [field, f] of Object.entries(prior.fields)) {
        expect(f.n, `${prior.class} ${field}`).toBeGreaterThanOrEqual(3)
        expect(f.members).toHaveLength(f.n)
        for (const id of f.members) expect(prior.members).toContain(id)
      }
    }
  })

  it('classOfModel gives the class key of every seed model JSON file', () => {
    const byId = new Map(libraryFiles().map((f) => [f.id, f]))
    expect(byId.size).toBe(SEED_LIBRARY.length)
    for (const model of SEED_LIBRARY) {
      expect(classOfModel(model), model.id).toBe(classOfFile(byId.get(model.id)!))
    }
  })

  it('every class with a prior is the class of at least three seed models', () => {
    for (const key of Object.keys(CLASS_PRIORS)) {
      expect(SEED_LIBRARY.filter((m) => classOfModel(m) === key).length, key).toBeGreaterThanOrEqual(3)
    }
  })

  it('spreadFor with no table equals the old three-step rule on every seed model and field', () => {
    for (const model of SEED_LIBRARY) {
      for (const field of FIELDS_BY_KIND[model.kind] ?? []) {
        expect(spreadFor(model, field), `${model.id} ${field}`).toEqual(oldSpreadFor(model, field))
      }
    }
  })

  it('spreadFor with CLASS_PRIORS returns the class prior for a member whose row has no spread', () => {
    const a422 = SEED_LIBRARY.find((m) => m.id === 'lib-a422')!
    const row = a422.provenance?.find((r) => r.field === 'detectRangeM')
    expect(row).toBeDefined()
    expect(row!.spread).toBeUndefined()
    const prior = CLASS_PRIORS['sensor/radar/any/any'].fields.detectRangeM
    expect(spreadFor(a422, 'detectRangeM')).toEqual(PF_SPREAD.detectRangeM.spread)
    expect(spreadFor(a422, 'detectRangeM', CLASS_PRIORS)).toEqual({ kind: 'lognormal', sigmaDb: 'sigmaDb' in prior && prior.sigmaDb })
    expect(spreadBasisFor(a422, 'detectRangeM')).toBe('pf')
    expect(spreadBasisFor(a422, 'detectRangeM', CLASS_PRIORS)).toBe('class-prior')
    // A field with no prior in the class keeps the PF fallback under the table too.
    expect(spreadFor(a422, 'trackInitS', CLASS_PRIORS)).toEqual(PF_SPREAD.trackInitS.spread)
    expect(spreadBasisFor(a422, 'trackInitS', CLASS_PRIORS)).toBe('pf')
  })

  it('an additive prior becomes the symmetric triangular whose sd equals the class sd', () => {
    const radar = SEED_LIBRARY.find((m) => m.id === 'lib-giraffe1x')!
    const prior = CLASS_PRIORS['sensor/radar/any/any'].fields.updateRateS
    const spread = classPriorFor(radar, 'updateRateS')
    expect(spread?.kind).toBe('triangular')
    if (spread?.kind !== 'triangular' || !('mean' in prior)) throw new Error('shape')
    // Symmetric triangular of half width w: sd = w / sqrt(6).
    const w = spread.hi * prior.mean
    expect(-spread.lo).toBeCloseTo(spread.hi, 12)
    expect(w / Math.sqrt(6)).toBeCloseTo(prior.sd, 9)
    expect(classPriorFor(radar, 'noSuchField')).toBeNull()
  })

  it('derive-priors --check passes against the committed files', () => {
    const run = spawnSync('node', ['scripts/derive-priors.mjs', '--check'], { cwd: ROOT, encoding: 'utf8' })
    expect(run.stderr).toBe('')
    expect(run.status).toBe(0)
  })
})
