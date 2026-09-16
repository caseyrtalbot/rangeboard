import { describe, expect, it } from 'vitest'
import type { Scenario } from '../model/types'
import { fillScenario } from '../io/persist'
import { assessAllThreats } from './sim'
import { resolveEngagements } from './attrition'
import raw from './__fixtures__/layered-acoustic-merops.json'

/**
 * Captured real scenario (live-app autosave): a 9-ship layered raid (3 FPV
 * waves + 6 mixed-nav Mavic quads) against an acoustic + MEROPS IADS with
 * three interceptor types and a Modi II jammer. Every bound below is derived
 * from the doctrine, not copied from output, so it holds as tuning shifts.
 */

const scenario = fillScenario(raw as unknown as Scenario)

describe('captured Layered (Acoustic + MEROPS) scenario', () => {
  const assessments = assessAllThreats(scenario)
  const report = resolveEngagements(scenario, assessments)

  it('bounds kinetic expenditure by the survival cutoff', () => {
    // Worst-case per-salvo Pk in this laydown: interceptor base 0.8, falloff
    // >= 0.7, group 1 size 0.7, FPV evasion 0.7 -> Pk >= 0.274, so a ship's
    // effective survival crosses SHIP_DEAD_BELOW = 0.05 within 10 salvos
    // (0.726^10 < 0.05). Jam-degraded Mavic kills apply at >= 0.7 of that
    // Pk -> within 15 salvos. Cap: 3 FPV * 10 + 6 Mavic * 15 = 120.
    expect(report.totals.shotsFired).toBeLessThanOrEqual(120)
  })

  it('kills more of the raid than the concentrated-fire engine did', () => {
    expect(report.totals.expectedKills).toBeGreaterThan(4.0)
    // Identity: kills + leakers partition the raid.
    expect(report.totals.expectedKills + report.totals.expectedLeakers).toBeCloseTo(
      report.totals.raidSize,
      9,
    )
  })

  it('engages every engageable threat at least once (no starvation)', () => {
    for (const a of assessments) {
      if (a.status !== 'engageable') continue
      const att = report.threats.find((t) => t.uasId === a.uasId)!
      expect(att.shotsFired + att.jamSalvos).toBeGreaterThanOrEqual(1)
    }
  })

  it('bounds jam salvos by track saturation', () => {
    // 'Continue' jam salvos stop once a track's un-jammed probability falls
    // below SHIP_DEAD_BELOW. Worst-case jam Pk here: base 0.6, falloff
    // >= 0.7, size 0.7 -> Pk >= 0.294, so saturation within 9 salvos per
    // track (0.706^9 < 0.05). 6 mixed-nav Mavic tracks * 9 = 54.
    expect(report.totals.jamSalvos).toBeLessThanOrEqual(54)
    expect(report.totals.jamSalvos).toBeGreaterThan(0)
  })

  it('keeps the event ledger consistent with the totals', () => {
    // Sorted by assignment time; expenditure and kill mass reconcile, so a
    // scrubbed view can prefix-aggregate shots and kills at any time.
    for (let i = 1; i < report.events.length; i++) {
      expect(report.events[i].tS).toBeGreaterThanOrEqual(report.events[i - 1].tS)
    }
    // Expenditure reconciles per channel. This laydown carries three
    // interceptor types plus a Modi II jammer and no directed energy.
    const kinetic = report.events.filter((e) => e.channelClass === 'kinetic').length
    const de = report.events.filter((e) => e.channelClass === 'directed-energy').length
    const jam = report.events.filter((e) => e.channelClass === 'ew').length
    expect(kinetic).toBe(report.totals.shotsFired)
    expect(de).toBe(report.totals.deSalvos)
    expect(de).toBe(0)
    expect(jam).toBe(report.totals.jamSalvos)
    // Kill mass reconciles only against both credit buckets.
    const killMass = report.events.reduce((s, e) => s + e.killDelta, 0)
    expect(killMass).toBeCloseTo(report.totals.expectedKills + report.totals.expectedLateKills, 9)
  })

  it('credits kill mass that lands after arrival as late, not as defeat', () => {
    // One defended asset sits at (4464, 3912) with the default 500 m
    // protected boundary, and part of the raid crosses it before the last
    // intercepts land. Late mass is real destruction that failed to defend
    // the asset, so it must sit outside expectedKills.
    const lateEvents = report.events.filter((e) => e.lateEffect)
    expect(lateEvents.length).toBeGreaterThan(0)
    const lateMass = lateEvents.reduce((s, e) => s + e.killDelta, 0)
    expect(lateMass).toBeCloseTo(report.totals.expectedLateKills, 9)
    expect(report.totals.expectedLateKills).toBeGreaterThan(0)
    // Every late event belongs to a threat that actually arrived.
    for (const e of lateEvents) {
      const a = assessments.find((x) => x.uasId === e.uasId)!
      expect(a.arrivalS).not.toBeNull()
      expect(e.tEffectS).toBeGreaterThan(a.arrivalS!)
    }
    // The partition identity uses the defeat mass alone.
    expect(
      report.totals.expectedKills + report.totals.expectedLeakers + report.totals.expectedNoArrival,
    ).toBeCloseTo(report.totals.raidSize, 9)
  })

  it('partitions the raid into defeated, leaked, and never-arrived ships', () => {
    // One asset and every threat crosses its boundary, so never-arrived mass
    // is 0 and leakers equal raidSize minus kills. The buckets must still be
    // filled independently, not by subtraction.
    const { totals } = report
    expect(report.threats.every((t) => t.arrived)).toBe(true)
    expect(totals.reportedLeakers).toBe(totals.expectedLeakers)
    expect(totals.expectedLeakers).toBeGreaterThan(0)
    expect(totals.expectedNoArrival).toBe(0)
    expect(totals.expectedLeakers).toBeCloseTo(totals.raidSize - totals.expectedKills, 9)
    expect(totals.expectedKills + totals.expectedLeakers + totals.expectedNoArrival).toBeCloseTo(
      totals.raidSize,
      9,
    )
    // Row by row as well, so no threat is double counted into two buckets.
    for (const t of report.threats) {
      expect(t.expectedKills + t.expectedLeakers + t.expectedNoArrival).toBeCloseTo(t.shipCount, 9)
      if (t.arrived) expect(t.expectedNoArrival).toBe(0)
      else expect(t.expectedLeakers).toBe(0)
    }
    // Late mass is a sub-measure of the leaker mass, never a deduction.
    expect(totals.expectedLateKills).toBeGreaterThan(0)
    expect(totals.expectedLeakers).toBeGreaterThan(totals.expectedLateKills)
  })
})
