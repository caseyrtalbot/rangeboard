import { describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import type { Entity, Scenario, SpecModel } from '../model/types'
import { DEFAULT_FIRE_DOCTRINE } from '../model/types'
import { defaultLinkLatencyS, targetSFor, trackInitSFor } from './doctrineFactors'
import { mulberry32 } from '../geometry/prng'
import { betaQuantile, meanInterval, quantile } from './stats'
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

/** The first `n` uniforms of one mulberry32 stream, plus the hash range ends 0 and 1. */
function uniforms(n: number, seed = 1): number[] {
  const next = mulberry32(seed)
  return [0, 1, ...Array.from({ length: n }, () => next())]
}

describe('support and convergence', () => {
  it('a sampled probability, time and RCS never leave their support over 2000 uniforms', () => {
    // The support is exact: a beta lies in the open unit interval, a triangular
    // in [nominal (1 + lo), nominal (1 + hi)], a lognormal in (0, Infinity).
    const tri = PF_SPREAD.trackInitS.spread
    for (const u of uniforms(2000)) {
      for (const spread of [
        PF_SPREAD.pk.spread,
        { kind: 'beta', successes: 2, trials: 2 } as const,
        { kind: 'beta', successes: 61, trials: 61 } as const,
      ]) {
        const p = sampleSpread(0.7, spread, u)
        expect(p).toBeGreaterThan(0)
        expect(p).toBeLessThan(1)
      }
      const s = sampleSpread(10, tri, u)
      expect(s).toBeGreaterThanOrEqual(7)
      expect(s).toBeLessThanOrEqual(15)
      const r = sampleSpread(0.2, PF_SPREAD.rcsM2.spread, u)
      expect(r).toBeGreaterThan(0)
      expect(Number.isFinite(r)).toBe(true)
    }
    // End to end: the written pk of a sampled scenario keeps the same support.
    for (const u of [0, 1e-9, 0.5, 1 - 1e-9, 1]) {
      const out = sampleScenario(scenario([INTERCEPTOR]), () => u)
      expect(out.library[0].effector!.pk).toBeGreaterThan(0)
      expect(out.library[0].effector!.pk).toBeLessThan(1)
    }
  })

  it('replicate means converge to the analytic lognormal and triangular means within 3 SE', () => {
    // Lognormal 3 dB: sigma_ln = 0.3 ln 10 = 0.6908, mean exp(sigma^2 / 2) = 1.2695
    // times the nominal, sd 0.9927; SE 0.0628 at n 250 and 0.0157 at n 4000.
    // Triangular -0.3 / +0.5 on 10: bounds 7 and 15, mode 10, mean (7 + 10 + 15) / 3
    // = 10.6667, variance (a^2 + b^2 + c^2 - ab - ac - bc) / 18 = 49 / 18, sd 1.6499;
    // SE 0.1044 at n 250 and 0.0261 at n 4000.
    const us = uniforms(4000).slice(2)
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
    const log = us.map((u) => sampleSpread(1, PF_SPREAD.detectRangeM.spread, u))
    const tri = us.map((u) => sampleSpread(10, PF_SPREAD.trackInitS.spread, u))
    expect(Math.abs(mean(log.slice(0, 250)) - 1.2695)).toBeLessThan(3 * 0.0628)
    expect(Math.abs(mean(log) - 1.2695)).toBeLessThan(3 * 0.0157)
    expect(Math.abs(mean(tri.slice(0, 250)) - 10.6667)).toBeLessThan(3 * 0.1044)
    expect(Math.abs(mean(tri) - 10.6667)).toBeLessThan(3 * 0.0261)
    // The lognormal nominal is the median, not the mean: the sample median sits
    // at 1 within 3 SE = 3 sqrt(0.25 / 4000) / f(1), f(1) = 1 / (sigma sqrt(2 pi))
    // = 0.5776, so 0.041, while the mean sits a quarter above it.
    expect(Math.abs(quantile(log, 0.5) - 1)).toBeLessThan(0.041)
    expect(mean(log)).toBeGreaterThan(1.2)
  })

  it('the mean interval narrows with n while the p10 and p90 stay at the analytic quantiles', () => {
    // Lognormal 3 dB on 1: p10 = 10^(-0.3 z90) = 0.4126 and p90 = 2.4236 with
    // z90 = 1.2816. A sample quantile has SE sqrt(q (1 - q) / n) / f(x_q); with
    // f(x_q) = phi(z_q) / (x_q sigma_ln) that is 0.0109 for p10 and 0.0640 for p90
    // at n 2000. The 95 percent mean interval half-width is t sd / sqrt(n) =
    // 1.9612 * 0.9927 / sqrt(2000) = 0.0435; the sample sd of a lognormal with
    // excess kurtosis 16.9 has relative SE sqrt(18.9 / (4 n)) = 4.9 percent at
    // n 2000, so 3 SE is 15 percent of the half-width. The interval on the mean
    // says nothing about the replicate spread: p10 and p90 do not move with n.
    const us = uniforms(2000).slice(2)
    const xs = us.map((u) => sampleSpread(1, PF_SPREAD.detectRangeM.spread, u))
    const half = (values: number[]) => {
      const { lo, hi } = meanInterval(values, 0.95)
      return (hi - lo) / 2
    }
    expect(Math.abs(half(xs) - 0.0435)).toBeLessThan(0.15 * 0.0435)
    expect(half(xs.slice(0, 500))).toBeGreaterThan(half(xs))
    expect(Math.abs(quantile(xs, 0.1) - 0.4126)).toBeLessThan(3 * 0.0109)
    expect(Math.abs(quantile(xs, 0.9) - 2.4236)).toBeLessThan(3 * 0.064)
    expect(Math.abs(quantile(xs.slice(0, 500), 0.1) - 0.4126)).toBeLessThan(3 * 0.0109 * 2)
    // The half-width covers the mean, not the replicates: most samples lie outside it.
    const { lo, hi } = meanInterval(xs, 0.95)
    const inside = xs.filter((x) => x >= lo && x <= hi).length
    expect(inside / xs.length).toBeLessThan(0.1)
  })

  it('a connection with no latency samples an inert 0 when doctrine is off', () => {
    // The nominal is 0 with doctrine off, so the triangular bounds are 0 and 0:
    // the field is enumerated and written, and the value cannot move.
    const s = { ...scenario([RADAR]), doctrine: { ...DEFAULT_FIRE_DOCTRINE, enabled: false } }
    expect(uncertainFields(s).map((f) => `${f.modelId}.${f.field}`)).toContain('k1.latencyS')
    for (const u of [0, 0.1, 0.5, 0.9, 1]) {
      const out = sampleScenario(s, (m, f) => (m === 'k1' && f === 'latencyS' ? u : null))
      expect(out.connections[0].latencyS).toBe(0)
      // A stated latency still samples with doctrine off.
      const stated = sampleScenario(s, (m, f) => (m === 'k2' && f === 'latencyS' ? u : null))
      expect(stated.connections[1].latencyS).toBeCloseTo(
        sampleSpread(6, PF_SPREAD.latencyS.spread, u), 9)
    }
  })
})
