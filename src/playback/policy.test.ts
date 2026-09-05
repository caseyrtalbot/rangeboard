import { describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import type { Entity, EntityKind, Scenario, Vec2 } from '../model/types'
import { DEFAULT_REQUIREMENT_THRESHOLDS, newId } from '../model/types'
import { hashU01, idHash } from '../geometry/prng'
import { resolveEngagements } from './attrition'
import type { ScanSteering } from './sim'
import { assessAllThreats, stepIndex, sweepSensorHits } from './sim'
import type { DrawPolicy } from './policy'
import { deterministicPolicy, DRAW_KIND, monteCarloPolicy } from './policy'

const T = DEFAULT_REQUIREMENT_THRESHOLDS

describe('deterministicPolicy', () => {
  it('detects at the pdDetect threshold and not below it', () => {
    const p = deterministicPolicy(T)
    expect(p.detect(0.5, 's', 'u', 0, 0)).toBe(true)
    expect(p.detect(0.49, 's', 'u', 0, 0)).toBe(false)
  })

  it('returns pk and p unchanged as mass', () => {
    const p = deterministicPolicy(T)
    expect(p.kill(0.37, 'e', 'u', 0, 0, 1)).toBe(0.37)
    expect(p.jam(0.62, 'e', 'u', 1)).toBe(0.62)
  })

  it('reads the default pdDetect when the saved threshold is outside (0, 1)', () => {
    for (const pdDetect of [0, 1.5]) {
      const p = deterministicPolicy({ ...T, pdDetect })
      expect(p.detect(0.5, 's', 'u', 0, 0)).toBe(true)
      expect(p.detect(0.49, 's', 'u', 0, 0)).toBe(false)
    }
  })

  it('reads a saved threshold inside (0, 1)', () => {
    const p = deterministicPolicy({ ...T, pdDetect: 0.8 })
    expect(p.detect(0.79, 's', 'u', 0, 0)).toBe(false)
    expect(p.detect(0.8, 's', 'u', 0, 0)).toBe(true)
  })

  it('has scan phase 0', () => {
    expect(deterministicPolicy(T).phase('s')).toBe(0)
  })

  it('samples every parameter at u 0.5, the nominal', () => {
    expect(deterministicPolicy(T).param('lib-x', 'rcsM2')).toBe(0.5)
  })
})

describe('monteCarloPolicy', () => {
  const SEED = 4821
  // The four keys of contract 1.2, built by hand from the parts.
  const uDetect = (rep: number, sensor: string, uas: string, tS: number, memberIdx: number) =>
    hashU01(SEED, rep, DRAW_KIND.detect, idHash(sensor), idHash(uas), memberIdx, stepIndex(tS))
  const uKill = (rep: number, eff: string, uas: string, shipIdx: number, salvoIdx: number) =>
    hashU01(SEED, rep, DRAW_KIND.kill, idHash(eff), idHash(uas), shipIdx, salvoIdx)
  const uJam = (rep: number, eff: string, uas: string, tS: number) =>
    hashU01(SEED, rep, DRAW_KIND.jam, idHash(eff), idHash(uas), 0, stepIndex(tS))
  const uPhase = (rep: number, sensor: string) =>
    hashU01(SEED, rep, DRAW_KIND.phase, idHash(sensor), 0, 0, 0)
  const uParam = (rep: number, modelId: string, field: string) =>
    hashU01(SEED, rep, DRAW_KIND.param, idHash(modelId), idHash(field), 0, 0)
  const TINY = 1e-9

  it('detect draws u < pd from the detect key; the same key gives the same value', () => {
    const p = monteCarloPolicy(SEED, 0, T)
    const u = uDetect(0, 's', 'u', 3, 0)
    expect(u).toBeGreaterThanOrEqual(0)
    expect(u).toBeLessThan(1)
    expect(p.detect(u + TINY, 's', 'u', 3, 0)).toBe(true)
    expect(p.detect(u - TINY, 's', 'u', 3, 0)).toBe(false)
    // A second instance, and a second call on the same instance: no stream state.
    expect(monteCarloPolicy(SEED, 0, T).detect(u + TINY, 's', 'u', 3, 0)).toBe(true)
    expect(p.detect(u - TINY, 's', 'u', 3, 0)).toBe(false)
  })

  it('a changed replicate, memberIdx or step changes the detect draw', () => {
    const u = uDetect(0, 's', 'u', 3, 0)
    for (const [rep, memberIdx, tS] of [
      [1, 0, 3],
      [0, 1, 3],
      [0, 0, 3.5],
    ] as const) {
      const v = uDetect(rep, 's', 'u', tS, memberIdx)
      expect(v).not.toBe(u)
      const p = monteCarloPolicy(SEED, rep, T)
      expect(p.detect(v + TINY, 's', 'u', tS, memberIdx)).toBe(true)
      expect(p.detect(v - TINY, 's', 'u', tS, memberIdx)).toBe(false)
    }
    // Two samples DT apart never share a step, on or off the grid.
    expect(stepIndex(3.25)).not.toBe(stepIndex(3.75))
  })

  it('kill draws from the kill key: shipIdx and salvoIdx move it, tS does not', () => {
    const p = monteCarloPolicy(SEED, 0, T)
    const u = uKill(0, 'e', 'u', 0, 0)
    expect(p.kill(u + TINY, 'e', 'u', 0, 0, 5)).toBe(1)
    expect(p.kill(u - TINY, 'e', 'u', 0, 0, 5)).toBe(0)
    expect(p.kill(u + TINY, 'e', 'u', 0, 0, 99)).toBe(1)
    expect(p.kill(u - TINY, 'e', 'u', 0, 0, 99)).toBe(0)
    for (const [shipIdx, salvoIdx] of [
      [1, 0],
      [0, 1],
    ] as const) {
      const v = uKill(0, 'e', 'u', shipIdx, salvoIdx)
      expect(v).not.toBe(u)
      expect(p.kill(v + TINY, 'e', 'u', shipIdx, salvoIdx, 5)).toBe(1)
      expect(p.kill(v - TINY, 'e', 'u', shipIdx, salvoIdx, 5)).toBe(0)
    }
    expect(uKill(1, 'e', 'u', 0, 0)).not.toBe(u)
  })

  it('jam draws from the jam key at the effect step', () => {
    const p = monteCarloPolicy(SEED, 0, T)
    const u = uJam(0, 'e', 'u', 12.5)
    expect(p.jam(u + TINY, 'e', 'u', 12.5)).toBe(1)
    expect(p.jam(u - TINY, 'e', 'u', 12.5)).toBe(0)
    expect(uJam(0, 'e', 'u', 13)).not.toBe(u)
    // The jam key is not the kill key of the same effector and step.
    expect(uKill(0, 'e', 'u', 0, stepIndex(12.5))).not.toBe(u)
  })

  it('draws the scan phase in [0, 1) from the phase key, the same on every call', () => {
    const p = monteCarloPolicy(SEED, 0, T)
    const phase = p.phase('s')
    expect(phase).toBe(uPhase(0, 's'))
    expect(phase).toBeGreaterThanOrEqual(0)
    expect(phase).toBeLessThan(1)
    expect(p.phase('s')).toBe(phase)
    expect(monteCarloPolicy(SEED, 1, T).phase('s')).not.toBe(phase)
    expect(p.phase('s2')).not.toBe(phase)
  })

  it('draws a parameter sample from the param key; two fields of one model differ', () => {
    const p = monteCarloPolicy(SEED, 0, T)
    const u = p.param('lib-x', 'rcsM2')
    expect(u).toBe(uParam(0, 'lib-x', 'rcsM2'))
    expect(u).toBeGreaterThanOrEqual(0)
    expect(u).toBeLessThan(1)
    expect(p.param('lib-x', 'rcsM2')).toBe(u)
    expect(p.param('lib-x', 'detectRangeM')).not.toBe(u)
    expect(p.param('lib-y', 'rcsM2')).not.toBe(u)
    expect(monteCarloPolicy(SEED, 1, T).param('lib-x', 'rcsM2')).not.toBe(u)
  })

  it('gives 0 or 1 for kill and jam', () => {
    const p = monteCarloPolicy(SEED, 0, T)
    for (let i = 0; i < 20; i += 1) {
      expect([0, 1]).toContain(p.kill(0.5, 'e', 'u', 0, i, 1))
      expect([0, 1]).toContain(p.jam(0.5, 'e', 'u', i * 0.5))
    }
  })
})

/**
 * Engine regression: a bare engine call and an explicit deterministic policy
 * give byte-identical output, and the Monte Carlo policy keeps the raid
 * partition with discrete ships. Laydown from the seed library: Giraffe 1X at
 * the origin, Coyote 2.4 km to the northeast, FAAD C2 600 m west, chain
 * Giraffe -> C2 -> Coyote, ROE free. Mohajer-6 (fixed-wing, Swerling 1
 * pinned because the Giraffe Pd model reads it) inbound from 14 km north at
 * 14000 ft; Mavic 3 inbound from 3 km north.
 */
describe('draw policy engine regression', () => {
  const common = { headingDeg: 0, color: null, notes: '' }

  function ent(
    s: Scenario,
    kind: EntityKind,
    specId: string,
    pos: Vec2,
    extra?: Partial<Entity>,
  ): string {
    const id = newId('e')
    s.entities.push({ id, name: specId, kind, specId, pos, ...common, ...extra })
    return id
  }

  function flight(s: Scenario, entityId: string, from: Vec2, to: Vec2): void {
    s.paths.push({ id: newId('p'), entityId, points: [from, to], speedMps: 0, startDelayS: 0 })
  }

  function link(s: Scenario, fromId: string, toId: string): void {
    s.connections.push({ id: newId('c'), fromId, toId, label: 'track data' })
  }

  function laydown(): Scenario {
    const s = emptyScenario()
    s.roe = 'free'
    const mohajer = s.library.find((m) => m.id === 'lib-mohajer6')!
    mohajer.uas = { ...mohajer.uas!, swerling: 1 }
    const radar = ent(s, 'sensor', 'lib-giraffe1x', { x: 0, y: 0 })
    const coyote = ent(s, 'effector', 'lib-coyote', { x: 1697, y: -1697 })
    const c2 = ent(s, 'c2', 'lib-faadc2', { x: -600, y: 0 })
    link(s, radar, c2)
    link(s, c2, coyote)
    const m6 = ent(s, 'uas', 'lib-mohajer6', { x: 0, y: -14000 }, { altitudeFt: 14000 })
    flight(s, m6, { x: 0, y: -14000 }, { x: 0, y: -800 })
    const mavic = ent(s, 'uas', 'lib-mavic3', { x: 0, y: -3000 })
    flight(s, mavic, { x: 0, y: -3000 }, { x: 0, y: -100 })
    return s
  }

  const thresholdsOf = (s: Scenario) => ({ ...DEFAULT_REQUIREMENT_THRESHOLDS, ...s.requirements })

  it('a bare call equals an explicit deterministic policy', () => {
    const s = laydown()
    const policy = deterministicPolicy(thresholdsOf(s))
    const bare = assessAllThreats(s)
    expect(bare.some((a) => a.firstDetectS != null)).toBe(true)
    expect(JSON.stringify(bare)).toBe(JSON.stringify(assessAllThreats(s, policy)))
    const report = resolveEngagements(s)
    expect(report.events.length).toBeGreaterThan(0)
    expect(JSON.stringify(report)).toBe(JSON.stringify(resolveEngagements(s, undefined, policy)))
  })

  it('a bare sweep takes every step as a scan step; steered off a scan, no radar hit', () => {
    const s = laydown()
    const sensors = s.entities.filter((e) => e.kind === 'sensor')
    const mavic = s.library.find((m) => m.id === 'lib-mavic3')!
    const members = [{ x: 0, y: -1500 }]
    const at = (scan?: ScanSteering) =>
      sweepSensorHits(s, sensors, undefined, mavic.uas, 300, members, undefined, 'u', 0.5, scan)
    expect(at().map((h) => h.hit.sensorType)).toEqual(['radar'])
    const off: ScanSteering = { scanStep: () => false, holding: () => false }
    expect(at(off)).toHaveLength(0)
  })

  it('the Monte Carlo policy gives discrete outcomes and keeps the raid partition', () => {
    const s = laydown()
    for (const seed of [4821, 4822, 4823]) {
      const policy = monteCarloPolicy(seed, 0, thresholdsOf(s))
      const assessments = assessAllThreats(s, policy)
      const report = resolveEngagements(s, assessments, policy)
      for (const e of report.events) expect([0, 1]).toContain(e.killDelta)
      for (const t of report.threats) expect(Number.isInteger(t.expectedKills)).toBe(true)
      const { expectedKills, expectedLeakers, expectedNoArrival, raidSize } = report.totals
      expect(expectedKills + expectedLeakers + expectedNoArrival).toBeCloseTo(raidSize, 9)
    }
    const policy = monteCarloPolicy(4821, 0, thresholdsOf(s))
    const report = resolveEngagements(s, assessAllThreats(s, policy), policy)
    expect(report.events.length).toBeGreaterThan(0)
  })

  it('Pk 1 and a planning-basis radar draw no Pd: identical assessments, discrete kills', () => {
    const s = laydown()
    const coyote = s.library.find((m) => m.id === 'lib-coyote')!
    coyote.effector = { ...coyote.effector!, pk: 1 }
    const giraffe = s.library.find((m) => m.id === 'lib-giraffe1x')!
    giraffe.sensor = { ...giraffe.sensor!, rangeBasis: 'planning' }
    // Giraffe states updateRateS 1, so its one remaining draw is the scan
    // phase; pin it to 0 (the deterministic origin) so the comparison isolates
    // the Pd draw.
    const mc: DrawPolicy = {
      ...monteCarloPolicy(4821, 0, thresholdsOf(s)),
      phase: () => 0,
    }
    const assessments = assessAllThreats(s, mc)
    expect(JSON.stringify(assessments)).toBe(JSON.stringify(assessAllThreats(s)))
    // The per-shot Pk still carries distanceFalloff below 1, so the kill draw
    // can miss: the MC report agrees with the deterministic one on the raid
    // partition and on integer kills, never on the falloff mass.
    const det = resolveEngagements(s)
    const rep = resolveEngagements(s, assessments, mc)
    expect(det.events.length).toBeGreaterThan(0)
    expect(det.totals.expectedKills).toBeLessThan(1)
    expect(Number.isInteger(rep.totals.expectedKills)).toBe(true)
    expect(rep.totals.raidSize).toBe(det.totals.raidSize)
    expect(rep.totals.reportedLeakers).toBe(det.totals.reportedLeakers)
  })
})
