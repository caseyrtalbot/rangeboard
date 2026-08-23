import { describe, expect, it } from 'vitest'
import type { Scenario } from '../model/types'
import { fillScenario } from '../io/persist'
import { assessAllThreats } from './sim'
import { resolveEngagements } from './attrition'
import raw from './__fixtures__/layered-acoustic-merops.json'

/**
 * Captured real scenario (live-app autosave, 2026-08-22): a 9-ship layered
 * raid (3 FPV waves + 6 mixed-nav Mavic quads) against an acoustic + MEROPS
 * IADS with three interceptor types and a Modi II jammer. Locks the
 * engagement doctrine at full-scenario scale.
 *
 * Pre-doctrine engine on this laydown: 168 kinetic shots + 90 jam salvos for
 * 4.00 expected kills; one Mavic absorbed 66 shots while two others were
 * never engaged, and the jammer salvoed a saturated 'continue' track for its
 * whole window. Every bound below is derived from the doctrine, not copied
 * from output, so it holds as tuning shifts but fails on any regression to
 * concentration-without-cutoff fire distribution.
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
    // Pk -> within 15 salvos. Cap: 3 FPV * 10 + 6 Mavic * 15 = 120, well
    // under the pre-doctrine 168.
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
    // track (0.706^9 < 0.05). 6 mixed-nav Mavic tracks * 9 = 54, well under
    // the pre-doctrine 90.
    expect(report.totals.jamSalvos).toBeLessThanOrEqual(54)
    expect(report.totals.jamSalvos).toBeGreaterThan(0)
  })

  it('keeps the event ledger consistent with the totals', () => {
    // Sorted by assignment time; expenditure and kill mass reconcile, so a
    // scrubbed view can prefix-aggregate shots and kills at any time.
    for (let i = 1; i < report.events.length; i++) {
      expect(report.events[i].tS).toBeGreaterThanOrEqual(report.events[i - 1].tS)
    }
    const kinetic = report.events.filter((e) => !e.softShot).length
    const jam = report.events.filter((e) => e.softShot).length
    expect(kinetic).toBe(report.totals.shotsFired)
    expect(jam).toBe(report.totals.jamSalvos)
    const killMass = report.events.reduce((s, e) => s + e.killDelta, 0)
    expect(killMass).toBeCloseTo(report.totals.expectedKills, 9)
  })
})
