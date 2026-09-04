import { describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import type { Entity, Scenario, SpecModel } from '../model/types'
import { DEFAULT_FIRE_DOCTRINE } from '../model/types'
import { defaultLinkLatencyS, targetSFor, trackInitSFor } from './doctrineFactors'
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
    entities: [
      ent('s1', 'sensor', RADAR.id),
      ent('c1', 'c2', null),
      ent('e1', 'effector', INTERCEPTOR.id),
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
    expect(sampleSpread(10, tri, 0)).toBeCloseTo(8, 12)
    expect(sampleSpread(10, tri, 1)).toBeCloseTo(13, 12)
  })

  it('lognormal at z 1 for 3 dB is nominal times 10^0.3', () => {
    const u = 0.8413447460685429 // Phi(1)
    const v = sampleSpread(1000, { kind: 'lognormal', sigmaDb: 3 }, u)
    expect(Math.abs(v - 1000 * Math.pow(10, 0.3))).toBeLessThan(1e-6)
  })

  it('a row beta uses the stated counts as is', () => {
    // Beta(9, 1): median 0.5^(1/9) = 0.9259...; a table beta at 0.9 would give a different value.
    const v = sampleSpread(0.9, { kind: 'beta', successes: 9, trials: 10 }, 0.5)
    expect(v).toBeCloseTo(Math.pow(0.5, 1 / 9), 9)
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

describe('sampleScenario', () => {
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
