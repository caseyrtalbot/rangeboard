import { describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import type { Entity, EntityKind, Scenario, Vec2 } from '../model/types'
import { DEFAULT_REQUIREMENT_THRESHOLDS, newId } from '../model/types'
import { mulberry32 } from '../geometry/prng'
import { resolveEngagements } from './attrition'
import type { ScanSteering } from './sim'
import { assessAllThreats, sweepSensorHits } from './sim'
import type { DrawPolicy } from './policy'
import { deterministicPolicy, monteCarloPolicy } from './policy'

const T = DEFAULT_REQUIREMENT_THRESHOLDS

describe('deterministicPolicy', () => {
  it('detects at the pdDetect threshold and not below it', () => {
    const p = deterministicPolicy(T)
    expect(p.detect(0.5, 's', 'u', 0, 0)).toBe(true)
    expect(p.detect(0.49, 's', 'u', 0, 0)).toBe(false)
  })

  it('returns pk and p unchanged as mass', () => {
    const p = deterministicPolicy(T)
    expect(p.kill(0.37, 'e', 'u', 0, 1)).toBe(0.37)
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
})

describe('monteCarloPolicy', () => {
  function fixedRng(values: number[]): { rng: () => number; calls: () => number } {
    let i = 0
    return {
      rng: () => values[i++ % values.length],
      calls: () => i,
    }
  }

  it('draws rng() < p for each outcome with a fixed sequence', () => {
    const { rng } = fixedRng([0.2, 0.9, 0.5])
    const p = monteCarloPolicy(rng, T)
    expect(p.detect(0.5, 's', 'u', 0, 0)).toBe(true)
    expect(p.kill(0.5, 'e', 'u', 0, 1)).toBe(0)
    expect(p.jam(0.5, 'e', 'u', 1)).toBe(0)
  })

  it('consumes exactly one rng call per draw', () => {
    const { rng, calls } = fixedRng([0.2, 0.9, 0.5])
    const p = monteCarloPolicy(rng, T)
    p.detect(0.5, 's', 'u', 0, 0)
    expect(calls()).toBe(1)
    p.kill(0.5, 'e', 'u', 0, 1)
    expect(calls()).toBe(2)
    p.jam(0.5, 'e', 'u', 1)
    expect(calls()).toBe(3)
  })

  it('draws the scan phase in [0, 1) with one rng call', () => {
    const { rng, calls } = fixedRng([0.37, 0.999])
    const p = monteCarloPolicy(rng, T)
    expect(p.phase('s')).toBe(0.37)
    expect(calls()).toBe(1)
    const phase = p.phase('s')
    expect(phase).toBeGreaterThanOrEqual(0)
    expect(phase).toBeLessThan(1)
    expect(calls()).toBe(2)
  })

  it('gives 0 or 1 for kill and jam', () => {
    const { rng } = fixedRng([0.2, 0.9])
    const p = monteCarloPolicy(rng, T)
    expect(p.kill(0.5, 'e', 'u', 0, 1)).toBe(1)
    expect(p.kill(0.5, 'e', 'u', 0, 1)).toBe(0)
    expect(p.jam(0.5, 'e', 'u', 1)).toBe(1)
    expect(p.jam(0.5, 'e', 'u', 1)).toBe(0)
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
      const policy = monteCarloPolicy(mulberry32(seed), thresholdsOf(s))
      const assessments = assessAllThreats(s, policy)
      const report = resolveEngagements(s, assessments, policy)
      for (const e of report.events) expect([0, 1]).toContain(e.killDelta)
      for (const t of report.threats) expect(Number.isInteger(t.expectedKills)).toBe(true)
      const { expectedKills, expectedLeakers, expectedNoArrival, raidSize } = report.totals
      expect(expectedKills + expectedLeakers + expectedNoArrival).toBeCloseTo(raidSize, 9)
    }
    const policy = monteCarloPolicy(mulberry32(4821), thresholdsOf(s))
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
      ...monteCarloPolicy(mulberry32(4821), thresholdsOf(s)),
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
