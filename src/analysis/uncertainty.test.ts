import { describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import type { Entity, Scenario, SpecModel } from '../model/types'
import { DEFAULT_FIRE_DOCTRINE } from '../model/types'
import { defaultLinkLatencyS, targetSFor, trackInitSFor } from './doctrineFactors'
import { betaQuantile } from '../te/calc/stats'
import {
  PF_SPREAD,
  normalQuantile,
  sampleScenario,
  sampleSpread,
  spreadFor,
  uncertainFields,
} from './uncertainty'

const RADAR: SpecModel = {
  id: 'tst-radar',
  name: 'test radar',
  kind: 'sensor',
  description: '',
  color: '#fff',
  builtin: false,
  sensor: {
    sensorType: 'radar',
    role: 'surveillance',
    detectRangeM: 5000,
    classifyRangeM: null,
    sectorDeg: 360,
  },
}

const INTERCEPTOR: SpecModel = {
  id: 'tst-int',
  name: 'test interceptor',
  kind: 'effector',
  description: '',
  color: '#fff',
  builtin: false,
  effector: {
    effectorType: 'interceptor',
    minRangeM: 0,
    maxRangeM: 1000,
    engageTimeS: 4,
    pk: 0.7,
    bdaS: 8,
  },
}

const UAS: SpecModel = {
  id: 'tst-uas',
  name: 'test uas',
  kind: 'uas',
  description: '',
  color: '#fff',
  builtin: false,
  uas: {
    group: 3,
    airframe: 'fixed-wing',
    cruiseSpeedMps: 40,
    maxSpeedMps: 60,
    enduranceMin: 60,
    altBandFt: [0, 5000],
    navMode: 'gps',
    emissionsNote: '',
  },
}

function ent(id: string, kind: Entity['kind'], specId: string | null): Entity {
  return { id, name: id, kind, specId, pos: { x: 0, y: 0 }, headingDeg: 0, color: null, notes: '' }
}

function scenario(library: SpecModel[]): Scenario {
  return {
    ...emptyScenario(),
    library,
    // One active entity per model, so every library model passed is in use.
    entities: [
      ent('s1', 'sensor', RADAR.id),
      ent('c1', 'c2', null),
      ent('e1', 'effector', INTERCEPTOR.id),
      ent('u1', 'uas', UAS.id),
    ],
    connections: [
      { id: 'k1', fromId: 's1', toId: 'c1', label: '' },
      { id: 'k2', fromId: 'c1', toId: 'e1', label: '', latencyS: 6 },
    ],
    doctrine: { ...DEFAULT_FIRE_DOCTRINE },
  }
}

describe('normalQuantile', () => {
  it('matches the 97.5 percent point', () => {
    expect(Math.abs(normalQuantile(0.975) - 1.959964)).toBeLessThan(1e-6)
    expect(normalQuantile(0.5)).toBe(0)
    expect(Math.abs(normalQuantile(0.8413447460685429) - 1)).toBeLessThan(1e-9)
    expect(Math.abs(normalQuantile(0.001) + 3.090232306167813)).toBeLessThan(1e-9)
  })
})

describe('sampleSpread', () => {
  it('returns the nominal at u 0.5 for lognormal and a symmetric triangular', () => {
    expect(sampleSpread(200, { kind: 'lognormal', sigmaDb: 3 }, 0.5)).toBe(200)
    expect(sampleSpread(10, { kind: 'triangular', lo: -0.3, hi: 0.3 }, 0.5)).toBeCloseTo(10, 12)
  })

  it('beta at u 0.5 returns its median, within 0.02 of the 17 of 20 nominal', () => {
    // Beta(17, 3) median is about 0.862; the PF table spread is rescaled to the nominal.
    const v = sampleSpread(0.85, PF_SPREAD.pk.spread, 0.5)
    expect(Math.abs(v - 0.85)).toBeLessThan(0.02)
    expect(v).toBeGreaterThan(0)
    expect(v).toBeLessThan(1)
  })

  it('an asymmetric triangular returns the median at u 0.5 and the bounds at the ends', () => {
    const tri = { kind: 'triangular', lo: -0.2, hi: 0.3 } as const
    // Mode fraction is 0.2 / 0.5 = 0.4, so the median sits above the mode.
    expect(sampleSpread(10, tri, 0.5)).toBeGreaterThan(10)
    // u clamps to 2^-32 = 2.3e-10: the u 0 sample is 8 + sqrt(2.3e-10 * 5 * 2)
    // = 8 + 4.8e-5 and the u 1 sample 13 - sqrt(2.3e-10 * 5 * 3) = 13 - 5.9e-5.
    expect(Math.abs(sampleSpread(10, tri, 0) - 8)).toBeLessThan(1e-4)
    expect(Math.abs(sampleSpread(10, tri, 1) - 13)).toBeLessThan(1e-4)
  })

  it('lognormal at z 1 for 3 dB is nominal times 10^0.3', () => {
    const u = 0.8413447460685429 // Phi(1)
    const v = sampleSpread(1000, { kind: 'lognormal', sigmaDb: 3 }, u)
    expect(Math.abs(v - 1000 * Math.pow(10, 0.3))).toBeLessThan(1e-6)
  })

  it('clamps u at the hash range ends: u 0 and u 1 give finite positive samples', () => {
    // hashU01 is [0, 1); an unclamped u 0 takes normalQuantile(0) = -Infinity.
    const six = { kind: 'lognormal', sigmaDb: 6 } as const
    expect(Number.isFinite(sampleSpread(1, six, 0))).toBe(true)
    expect(sampleSpread(1, six, 0)).toBeGreaterThan(0)
    expect(Number.isFinite(sampleSpread(1, six, 1))).toBe(true)
  })

  it('a row beta uses the stated counts under a Jeffreys prior', () => {
    // 2 of 2: Beta(2.5, 0.5), the stated counts plus 0.5 each side; the
    // nominal plays no part in a row beta.
    const two = sampleSpread(0.7, { kind: 'beta', successes: 2, trials: 2 }, 0.5)
    expect(two).toBeCloseTo(betaQuantile(0.5, 2.5, 0.5), 9)
    // 61 of 61: Beta(61.5, 0.5). Without the prior b is 0 and the sample is
    // the constant 1. Under the prior the mass sits near 1 but spreads: the
    // mean is 61.5 / 62 = 0.992 and the lower tail reaches down, so p10 is
    // under 1 and, with a = 61.5 pulling the mass up, above 0.9.
    const many = sampleSpread(0.7, { kind: 'beta', successes: 61, trials: 61 }, 0.1)
    expect(many).toBeLessThan(1)
    expect(many).toBeGreaterThan(0.9)
    expect(many).toBeCloseTo(betaQuantile(0.1, 61.5, 0.5), 9)
  })
})

describe('spreadFor', () => {
  it('reads the row, then the table, and a null row spread is fixed', () => {
    const rowSpread = { kind: 'lognormal', sigmaDb: 1 } as const
    const m: SpecModel = {
      ...RADAR,
      provenance: [
        { field: 'detectRangeM', value: '5000', source: 'x', date: '2026-09-04', basis: 'pf',
          spread: rowSpread },
        { field: 'trackInitS', value: '2', source: 'x', date: '2026-09-04', basis: 'pf',
          spread: null },
      ],
    }
    expect(spreadFor(m, 'detectRangeM')).toBe(rowSpread)
    expect(spreadFor(m, 'trackInitS')).toBeNull()
    expect(spreadFor(RADAR, 'detectRangeM')).toBe(PF_SPREAD.detectRangeM.spread)
    expect(spreadFor(RADAR, 'mountHeightM')).toBeNull()
  })
})

describe('uncertainFields', () => {
  it('lists library fields in library order, then connections, then doctrine', () => {
    const s = scenario([INTERCEPTOR, RADAR])
    expect(uncertainFields(s).map((f) => `${f.modelId}.${f.field}`)).toEqual([
      'tst-int.pk',
      'tst-int.engageTimeS',
      'tst-int.targetS',
      'tst-int.bdaS',
      'tst-radar.detectRangeM',
      'tst-radar.trackInitS',
      'k1.latencyS',
      'k2.latencyS',
      'doctrine.declareHostileS',
    ])
  })

  it('skips a fixed row and the doctrine field when doctrine is off', () => {
    const fixed: SpecModel = {
      ...RADAR,
      provenance: [
        { field: 'trackInitS', value: '2', source: 'x', date: '2026-09-04', basis: 'pf',
          spread: null },
      ],
    }
    const s = { ...scenario([fixed]), doctrine: { ...DEFAULT_FIRE_DOCTRINE, enabled: false } }
    expect(uncertainFields(s).map((f) => `${f.modelId}.${f.field}`)).toEqual([
      'tst-radar.detectRangeM',
      'k1.latencyS',
      'k2.latencyS',
    ])
  })
})

describe('models in use', () => {
  it('an unused library model contributes no field and is the same object after sampling', () => {
    const s = scenario([RADAR, INTERCEPTOR, UAS])
    s.entities = s.entities.filter((e) => e.id !== 'u1')
    expect(uncertainFields(s).some((f) => f.modelId === UAS.id)).toBe(false)
    expect(uncertainFields(s).some((f) => f.modelId === RADAR.id)).toBe(true)
    const out = sampleScenario(s, () => 0.9)
    expect(out.library[2]).toBe(UAS)
    expect(out.library[0]).not.toBe(RADAR)
  })

  it('a disabled entity leaves its model unused', () => {
    const s = scenario([RADAR, INTERCEPTOR, UAS])
    s.entities = s.entities.map((e) => (e.id === 'u1' ? { ...e, enabled: false } : e))
    expect(uncertainFields(s).some((f) => f.modelId === UAS.id)).toBe(false)
    expect(sampleScenario(s, () => 0.9).library[2]).toBe(UAS)
  })
})

describe('sampleScenario', () => {
  it('a null sample keeps every field at its nominal', () => {
    const s = scenario([RADAR, INTERCEPTOR, UAS])
    const out = sampleScenario(s, () => null)
    expect(out.library).not.toBe(s.library)
    expect(out.connections).not.toBe(s.connections)
    expect(out.doctrine).not.toBe(s.doctrine)
    expect(out.library.map((m) => m.sensor ?? m.effector ?? m.uas)).toEqual(
      s.library.map((m) => m.sensor ?? m.effector ?? m.uas))
    // An absent latency stays absent; a stated one keeps its value.
    expect(out.connections[0].latencyS).toBeUndefined()
    expect(out.connections[1].latencyS).toBe(6)
    expect(out.doctrine).toEqual(s.doctrine)
  })

  it('samples one field and keeps the rest nominal', () => {
    const s = scenario([RADAR, INTERCEPTOR, UAS])
    const out = sampleScenario(s, (m, f) => (m === UAS.id && f === 'rcsM2' ? 0.9 : null))
    expect(out.library[2].uas?.rcsM2).toBeCloseTo(
      sampleSpread(0.2, PF_SPREAD.rcsM2.spread, 0.9), 9)
    expect(out.library[0].sensor).toEqual(RADAR.sensor)
    expect(out.library[1].effector).toEqual(INTERCEPTOR.effector)
    expect(out.connections[0].latencyS).toBeUndefined()
    expect(out.doctrine).toEqual(s.doctrine)
  })

  it('changes only the listed fields, writes resolver values, and never mutates the input', () => {
    const s = scenario([RADAR, INTERCEPTOR, UAS])
    const before = JSON.parse(JSON.stringify(s))
    // u 0.5 keeps lognormal and symmetric triangular at the nominal; use u for the upper end.
    const out = sampleScenario(s, () => 0.9)
    expect(JSON.parse(JSON.stringify(s))).toEqual(before)
    expect(out.library).not.toBe(s.library)
    expect(out.connections).not.toBe(s.connections)
    expect(out.doctrine).not.toBe(s.doctrine)
    expect(out.entities).toBe(s.entities)
    expect(out.environment).toBe(s.environment)

    const [radar, fx, uas] = out.library
    const doctrine = DEFAULT_FIRE_DOCTRINE
    const u = 0.9
    expect(radar.sensor?.detectRangeM).toBeCloseTo(
      sampleSpread(5000, PF_SPREAD.detectRangeM.spread, u), 9)
    expect(radar.sensor?.trackInitS).toBeCloseTo(
      sampleSpread(trackInitSFor(RADAR.sensor!, doctrine), PF_SPREAD.trackInitS.spread, u), 9)
    expect(fx.effector?.pk).toBeCloseTo(sampleSpread(0.7, PF_SPREAD.pk.spread, u), 9)
    expect(fx.effector?.engageTimeS).toBeCloseTo(
      sampleSpread(4, PF_SPREAD.engageTimeS.spread, u), 9)
    expect(fx.effector?.targetS).toBeCloseTo(
      sampleSpread(targetSFor(INTERCEPTOR.effector!, doctrine), PF_SPREAD.targetS.spread, u), 9)
    expect(fx.effector?.bdaS).toBeCloseTo(sampleSpread(8, PF_SPREAD.bdaS.spread, u), 9)
    // Group 3 tier is 0.2 m2 when the spec states no RCS.
    expect(uas.uas?.rcsM2).toBeCloseTo(sampleSpread(0.2, PF_SPREAD.rcsM2.spread, u), 9)
    expect(out.connections[0].latencyS).toBeCloseTo(
      sampleSpread(defaultLinkLatencyS('sensor', 'c2'), PF_SPREAD.latencyS.spread, u), 9)
    expect(out.connections[1].latencyS).toBeCloseTo(
      sampleSpread(6, PF_SPREAD.latencyS.spread, u), 9)
    expect(out.doctrine?.declareHostileS).toBeCloseTo(
      sampleSpread(doctrine.declareHostileS, PF_SPREAD.declareHostileS.spread, u), 9)

    // Every other field is unchanged.
    const strip = (o: unknown, keys: string[]) => {
      const c = JSON.parse(JSON.stringify(o)) as Record<string, unknown>
      for (const k of keys) delete c[k]
      return c
    }
    const sampled = ['detectRangeM', 'trackInitS', 'pk', 'engageTimeS', 'targetS', 'bdaS', 'rcsM2']
    expect(strip(radar.sensor, sampled)).toEqual(strip(RADAR.sensor, sampled))
    expect(strip(fx.effector, sampled)).toEqual(strip(INTERCEPTOR.effector, sampled))
    expect(strip(uas.uas, sampled)).toEqual(strip(UAS.uas, sampled))
    expect(strip(out.doctrine, ['declareHostileS'])).toEqual(strip(s.doctrine, ['declareHostileS']))
    expect(strip(out, ['library', 'connections', 'doctrine'])).toEqual(
      strip(s, ['library', 'connections', 'doctrine']))
  })
})
