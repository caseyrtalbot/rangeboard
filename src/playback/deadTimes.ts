import type { AttritionReport } from './attritionReport'
import { SHIP_DEAD_BELOW } from './pk'

/**
 * Time each threat's expected residual first falls below the engine's
 * expected-dead cutoff, keyed by uasId: residual fraction strictly below
 * SHIP_DEAD_BELOW, prefix-aggregated over the ledger in effect-time order,
 * the same rule trackState.ts latches its GHOST phase on. killDelta is never
 * negative, so residual only falls and the latch is one-way. A threat that
 * never reaches the cutoff is absent from the map.
 *
 * Late kill mass counts here exactly like pre-arrival mass: whether the
 * airframe still flies is a survival question, and a late kill still
 * destroys it.
 */
export function expectedDeadTimes(report: AttritionReport): Map<string, number> {
  const shipCounts = new Map(report.threats.map((row) => [row.uasId, row.shipCount]))
  const byThreat = new Map<string, AttritionReport['events']>()
  for (const event of report.events) {
    const events = byThreat.get(event.uasId) ?? []
    events.push(event)
    byThreat.set(event.uasId, events)
  }
  const out = new Map<string, number>()
  for (const [uasId, events] of byThreat) {
    // No attrition row means no resolved formation: treat it as one ship.
    const shipCount = shipCounts.get(uasId) ?? 1
    if (shipCount <= 0) continue
    let killed = 0
    for (const event of [...events].sort((a, b) => a.tEffectS - b.tEffectS)) {
      killed += event.killDelta
      if (Math.max(0, shipCount - killed) / shipCount < SHIP_DEAD_BELOW) {
        out.set(uasId, event.tEffectS)
        break
      }
    }
  }
  return out
}
