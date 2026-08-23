import type {
  EffectorSpec,
  Entity,
  FlightPath,
  JamBehavior,
  Scenario,
  SpecModel,
  UasGroup,
  UasSpec,
  Vec2,
} from '../model/types'
import { defaultJamBehavior, entityActive } from '../model/types'
import { dist, pointInSector, posAtTime } from '../geometry/geo'
import type { ThreatAssessment } from './sim'
import { assessAllThreats, connectedEffectorIds, memberPositions } from './sim'
import { effectivePathDelayS } from './raid'

/**
 * Deterministic expected-value attrition over the raid. No random rolls: each
 * salvo multiplies the target ship's survival probability by (1 - Pk) and the
 * magazine ledger counts the salvo. Pure function of the scenario; no store
 * imports, so it is trivially testable.
 *
 * Pk model and baselines follow the PicoGrid drone-swarm engagement
 * calculator (dormant core/ path): per-shot
 * Pk = basePk * distanceFalloff * sizePenalty * evasionPenalty.
 *
 * Target assignment is global at ship level. At each tick a ready effector
 * considers every gated threat whose window (its own) contains both t and
 * tEffect, and every ship of those threats inside its envelope at tEffect,
 * then engages the ship with the highest effective survival — survival
 * discounted by the salvos already in flight at that ship — so simultaneous
 * volleys spread across the raid instead of stacking on one airframe.
 * Expected-dead ships (effective survival below SHIP_DEAD_BELOW) draw no
 * fire, and a 'continue' jam track saturated near certainty draws no more
 * jam salvos. Ties break by earlier threat arrival, then scenario order,
 * then lower ship index.
 *
 * Assignment-to-effect latency: a salvo assigned (fired) at t takes effect at
 * tEffect = t + engageTimeS. The shot is only valid when some in-range
 * interval of the same effector still contains tEffect — a target that exits
 * the envelope before the effect arrives cannot be engaged by that
 * assignment, so the salvo is never fired. Kill math (target position,
 * distance falloff, jam-state coupling) is evaluated at tEffect; magazine
 * decrement, cooldown, firstShotS, and the expenditure counts stay at
 * assignment time. Nonzero-latency effects are buffered and applied in
 * tEffect order (see the ordering note in attrition.test.ts); zero-latency
 * effects apply inline.
 *
 * Outcomes split into two channels. Hard kills (interceptor, gun, net, DE,
 * HPM) destroy the airframe. Soft kills (jammer) apply the threat's
 * JamBehavior: 'drift' and 'return-home' end the approach — a mission kill
 * flagged soft — while 'continue' leaves the threat inbound with a degraded
 * track, so it still leaks.
 *
 * Expenditure splits by effector class: shotsFired counts kinetic
 * (non-jammer) salvos only; jamSalvos counts jammer salvos of every
 * behavior. The events ledger records every salvo — assignment time, effect
 * time, target ship, channel, Pk, and the expected-kill mass the effect
 * removed — so shots-so-far, kills-so-far, and per-threat state at any sim
 * time can be prefix-aggregated from it.
 */

const DT = 0.5

/** Type-baseline single-shot Pk for specs saved before the pk field existed. */
export const DEFAULT_PK: Record<EffectorSpec['effectorType'], number> = {
  interceptor: 0.8,
  gun: 0.75,
  net: 0.7,
  de: 0.8,
  hpm: 0.7,
  jammer: 0.6,
}

/** Type-baseline seconds between salvos when the spec does not set one. */
export const DEFAULT_SALVO_COOLDOWN_S: Record<EffectorSpec['effectorType'], number> = {
  interceptor: 30,
  gun: 10,
  net: 60,
  de: 15,
  hpm: 5,
  jammer: 5,
}

/** Smaller airframes are harder to hit (source: Group 1 = 0.7 ... Group 4+ = 1.0). */
export const SIZE_PENALTY: Record<UasGroup, number> = { 1: 0.7, 2: 0.8, 3: 0.9, 4: 1, 5: 1 }

/** Pk multiplier for an evading target (source: x0.7). FPV airframes are
 *  hand-flown and jink; every other airframe flies waypoints. */
export const EVASION_PENALTY = 0.7

/** Distance falloff: 30% Pk reduction at max range (source formula). Zero
 *  beyond max range: no envelope means no kill probability at all. */
export function distanceFalloff(distM: number, maxRangeM: number): number {
  if (maxRangeM <= 0 || distM > maxRangeM) return 0
  return 1 - 0.3 * (distM / maxRangeM)
}

/**
 * Kill-shot Pk penalty against a ship inbound under a 'continue' jam: the
 * denied GNSS/RF link silences emissions and degrades the track, so the
 * firing solution suffers. Planning factor on the source's 30% falloff scale.
 */
export const CONTINUE_TRACK_DEGRADE = 0.3

/**
 * Expected-survival cutoff (shoot-look doctrine). A ship whose effective
 * survival — alive discounted by kill salvos already in flight at it — falls
 * below this is expected dead: no kill or jam salvo targets it again, and a
 * threat with every ship below the cutoff draws no further fire. The same
 * threshold caps 'continue' jamming: once a ship's un-jammed probability
 * (discounted by jam salvos in flight) falls below it, the track is
 * saturated and jam salvos stop.
 */
export const SHIP_DEAD_BELOW = 0.05

/** Effector types whose success destroys the airframe (vs a jammer soft kill). */
export function isHardKill(effectorType: EffectorSpec['effectorType']): boolean {
  return effectorType !== 'jammer'
}

export interface ThreatAttrition {
  uasId: string
  /** Ships in the formation; 1 when the entity flies alone. */
  shipCount: number
  /** Sum over ships of (1 - survival probability): hard plus soft kills. */
  expectedKills: number
  /** Expected ships destroyed by hard-kill effectors. */
  expectedHardKills: number
  /** Expected mission kills through the soft channel (jam ends the approach). */
  expectedSoftKills: number
  /** Mean per-ship survival probability; 1 = certain leaker. */
  leakProbability: number
  /** Mean probability a ship's track is jam-degraded on arrival ('continue'). */
  continueJamProb: number
  /** First salvo of either channel at this threat; null when never engaged. */
  firstShotS: number | null
  /** Kinetic (non-jammer) salvos fired at this threat. */
  shotsFired: number
  /** Jammer salvos of every behavior directed at this threat. */
  jamSalvos: number
  /** Effector with the largest expected-kill contribution; null when no shots. */
  killedByEffectorId: string | null
  /** True when killedByEffectorId is a jammer: the dominant kill is soft. */
  killedBySoft: boolean
}

export interface EffectorAttrition {
  effectorId: string
  /** Kinetic salvos; 0 for jammers (their expenditure is jamSalvos). */
  shotsFired: number
  /** Jammer salvos of every behavior; 0 for kinetic effectors. */
  jamSalvos: number
  /** Null when the magazine is unlimited (jammers, DE, HPM). */
  expectedRoundsRemaining: number | null
}

export interface AttritionTotals {
  /** Total ships across all threats with flight paths. */
  raidSize: number
  /** Hard plus soft kills. */
  expectedKills: number
  expectedHardKills: number
  expectedSoftKills: number
  expectedLeakers: number
  /** Kinetic (non-jammer) salvos only. */
  shotsFired: number
  /** Jammer salvos of every behavior. */
  jamSalvos: number
}

/**
 * One salvo in the engagement ledger. Events are emitted in assignment-time
 * order; killDelta is filled in when the effect applies at tEffectS. Prefix
 * aggregation by tS gives shots-so-far; by tEffectS it gives kills-so-far
 * and per-threat expected state at any sim time.
 */
export interface EngagementEvent {
  /** Assignment (trigger) time; magazine, cooldown, and counts land here. */
  tS: number
  /** Effect time: tS + engageTimeS; kill or jam math lands here. */
  tEffectS: number
  effectorId: string
  uasId: string
  /** Formation ship the salvo is aimed at; 0 for a lone airframe. */
  shipIdx: number
  /** 'jam' = a 'continue' jam salvo (degrades the track, removes no
   *  survival); 'kill' = any salvo that removes survival, hard or soft. */
  channel: 'kill' | 'jam'
  /** True when the firing effector is a jammer (soft channel). */
  softShot: boolean
  /** Geometry Pk evaluated at tEffect. */
  pk: number
  /** Expected-kill mass removed when the effect applied; 0 for 'continue' jams. */
  killDelta: number
}

export interface AttritionReport {
  threats: ThreatAttrition[]
  effectors: EffectorAttrition[]
  totals: AttritionTotals
  /** Every salvo, in assignment-time order (see EngagementEvent). */
  events: EngagementEvent[]
}

function specFor(scenario: Scenario, entity: Entity): SpecModel | undefined {
  return scenario.library.find((m) => m.id === entity.specId) ?? undefined
}

/** Effective path speed: override, spec cruise, or 15 m/s (matches store.pathSpeed). */
function speedFor(scenario: Scenario, path: FlightPath): number {
  if (path.speedMps && path.speedMps > 0) return path.speedMps
  const entity = scenario.entities.find((e) => e.id === path.entityId)
  const model = entity ? specFor(scenario, entity) : undefined
  return model?.uas?.cruiseSpeedMps ?? 15
}

interface ShipState {
  /** Probability the ship is still inbound (not hard- or mission-killed). */
  alive: number
  /** Accumulated expected hard kills of this ship. */
  hard: number
  /** Accumulated expected soft (mission) kills of this ship. */
  soft: number
  /** Probability a 'continue' jam degrades this ship's track. */
  jammed: number
  /** Kill-channel salvos in flight at this ship (assigned, effect pending). */
  pendingKill: Set<PendingEffect>
  /** 'Continue' jam salvos in flight at this ship. */
  pendingJam: Set<PendingEffect>
  /** Running product of (1 - pk) over pendingKill, maintained on push/retire. */
  killDiscount: number
  /** Running product of (1 - pk) over pendingJam. */
  jamDiscount: number
}

/** Survival discounted by the kill salvos already in flight at the ship. */
function effectiveAlive(s: ShipState): number {
  return s.alive * s.killDiscount
}

/** Un-jammed probability discounted by the jam salvos already in flight. */
function effectiveUnjammed(s: ShipState): number {
  return (1 - s.jammed) * s.jamDiscount
}

/**
 * Take one salvo out of a ship's in-flight set and restore its discount.
 * Exact 1 when the set empties (no float drift can survive an empty set);
 * divide out the retired factor otherwise, recomputing the product from the
 * survivors when the factor is too small to divide by safely.
 */
function retirePending(set: Set<PendingEffect>, discount: number, fx: PendingEffect): number {
  set.delete(fx)
  if (set.size === 0) return 1
  const factor = 1 - fx.pk
  if (factor > EPS) return discount / factor
  let p = 1
  for (const rem of set) p *= 1 - rem.pk
  return p
}

interface ThreatState {
  a: ThreatAssessment
  entity: Entity
  uasSpec: UasSpec | undefined
  path: FlightPath | undefined
  speedMps: number
  /** One expected-value state per ship in the formation. */
  ships: ShipState[]
  /** Response to a successful jam; spec value or nav-mode default. */
  jamBehavior: JamBehavior
  /** In-range intervals per connected effector; empty unless engageable. */
  windows: Map<string, Array<[number, number]>>
  /** Time the required track quality was met; shots start no earlier. */
  gateS: number | null
  shotsFired: number
  jamSalvos: number
  firstShotS: number | null
  /** Expected kills contributed per effector, for killedByEffectorId. */
  killContrib: Map<string, number>
}

interface EffectorState {
  entity: Entity
  spec: EffectorSpec
  pk: number
  cooldownS: number
  /** Seconds from assignment to effect; 0 for pre-latency saves. */
  engageTimeS: number
  /** Null = unlimited. */
  rounds: number | null
  nextReadyS: number
  shotsFired: number
  jamSalvos: number
}

/** A salvo in flight: assigned, magazine spent, effect not yet applied. */
interface PendingEffect {
  tEffectS: number
  effectorId: string
  target: ThreatState
  shipIdx: number
  /** Geometry Pk evaluated at tEffect (position, falloff, size, evasion). */
  pk: number
  softShot: boolean
  continueJam: boolean
  /** Ledger entry to receive killDelta when the effect applies. */
  event: EngagementEvent
}

const EPS = 1e-9

/**
 * Resolve every engagement window into expected kills, leakers, and magazine
 * use. Sweeps the timeline at DT = 0.5 s; each ready effector fires one salvo
 * per salvoCooldownS at the eligible ship with the highest effective
 * survival across the whole raid (eligible = threat gate met, this
 * effector's window contains t and tEffect = t + engageTimeS, ship inside
 * this effector's envelope at tEffect, ship above the SHIP_DEAD_BELOW
 * cutoffs; no eligible ship = hold fire: no magazine spend, no cooldown),
 * until the windows close or the magazine is empty. The salvo's effect (kill
 * or jam) lands at tEffect with kill math evaluated there; effects still
 * pending when the sweep ends are flushed in tEffect order.
 */
export function resolveEngagements(
  scenario: Scenario,
  precomputed?: ThreatAssessment[],
): AttritionReport {
  const assessments = (precomputed ?? assessAllThreats(scenario)).filter(
    (a) => a.status !== 'no-path',
  )

  const threats: ThreatState[] = assessments.map((a) => {
    const entity = scenario.entities.find((e) => e.id === a.uasId)!
    const uasSpec = specFor(scenario, entity)?.uas
    const path = scenario.paths.find((p) => p.entityId === a.uasId)
    const count = entity.formation && entity.formation.count > 1 ? entity.formation.count : 1
    const windows = new Map<string, Array<[number, number]>>()
    if (a.status === 'engageable') {
      const connected = connectedEffectorIds(scenario, new Set(a.detectingSensorIds))
      for (const w of a.effectorWindows) {
        if (connected.has(w.effectorId)) windows.set(w.effectorId, w.intervals)
      }
    }
    return {
      a,
      entity,
      uasSpec,
      path,
      speedMps: path ? speedFor(scenario, path) : 15,
      ships: Array.from({ length: count }, () => ({
        alive: 1,
        hard: 0,
        soft: 0,
        jammed: 0,
        pendingKill: new Set<PendingEffect>(),
        pendingJam: new Set<PendingEffect>(),
        killDiscount: 1,
        jamDiscount: 1,
      })),
      jamBehavior: uasSpec ? defaultJamBehavior(uasSpec) : 'drift',
      windows,
      gateS: a.engageGateS,
      shotsFired: 0,
      jamSalvos: 0,
      firstShotS: null,
      killContrib: new Map(),
    }
  })

  const effectors = new Map<string, EffectorState>()
  for (const e of scenario.entities) {
    if (e.kind !== 'effector' || !entityActive(e)) continue
    const spec = specFor(scenario, e)?.effector
    if (!spec) continue
    effectors.set(e.id, {
      entity: e,
      spec,
      pk: spec.pk ?? DEFAULT_PK[spec.effectorType],
      cooldownS: Math.max(spec.salvoCooldownS ?? DEFAULT_SALVO_COOLDOWN_S[spec.effectorType], DT),
      engageTimeS: spec.engageTimeS ?? 0,
      rounds: spec.magazineSize ?? null,
      nextReadyS: 0,
      shotsFired: 0,
      jamSalvos: 0,
    })
  }

  // The sweep only needs to cover the engagement windows.
  let tEnd = 0
  for (const ts of threats) {
    for (const intervals of ts.windows.values()) {
      for (const [, s1] of intervals) if (s1 > tEnd) tEnd = s1
    }
  }

  const events: EngagementEvent[] = []

  // Salvos in flight. Applied in tEffect order so a jam that takes hold
  // before a kill shot arrives degrades that kill (see attrition.test.ts).
  const pending: PendingEffect[] = []

  const applyEffect = (fx: PendingEffect) => {
    const ship = fx.target.ships[fx.shipIdx]
    if (fx.continueJam) {
      // Jam holds but the threat presses on: no kill, the track degrades.
      ship.jammed += (1 - ship.jammed) * fx.pk
    } else {
      // Kill shot; a jam-degraded track worsens the firing solution.
      const kill = ship.alive * fx.pk * (1 - CONTINUE_TRACK_DEGRADE * ship.jammed)
      ship.alive -= kill
      if (fx.softShot) ship.soft += kill
      else ship.hard += kill
      fx.event.killDelta = kill
      fx.target.killContrib.set(
        fx.effectorId,
        (fx.target.killContrib.get(fx.effectorId) ?? 0) + kill,
      )
    }
  }

  const applyDueEffects = (upToS: number) => {
    if (pending.length === 0) return
    pending.sort((a, b) => a.tEffectS - b.tEffectS)
    while (pending.length > 0 && pending[0].tEffectS <= upToS + EPS) {
      const fx = pending.shift()!
      // The salvo is no longer in flight: retire its aiming discount.
      const ship = fx.target.ships[fx.shipIdx]
      if (fx.continueJam) ship.jamDiscount = retirePending(ship.pendingJam, ship.jamDiscount, fx)
      else ship.killDiscount = retirePending(ship.pendingKill, ship.killDiscount, fx)
      applyEffect(fx)
    }
  }

  // Per-tick cache of interpolated threat geometry keyed by (threat, tEffect):
  // effectors sharing an engageTimeS all land at the same tEffect, so the
  // path sample and formation member positions compute once, not per effector.
  type ThreatGeom = { sample: ReturnType<typeof posAtTime>; members: Vec2[] }
  const geomAt = (cache: Map<ThreatState, Map<number, ThreatGeom>>, ts: ThreatState, tEffect: number): ThreatGeom => {
    let byT = cache.get(ts)
    if (!byT) {
      byT = new Map()
      cache.set(ts, byT)
    }
    let g = byT.get(tEffect)
    if (!g) {
      const sample = posAtTime(ts.path!.points, ts.speedMps, effectivePathDelayS(scenario, ts.path!), tEffect)
      g = { sample, members: memberPositions(ts.entity, sample.pos, sample.headingDeg) }
      byT.set(tEffect, g)
    }
    return g
  }

  for (let t = 0; t <= tEnd + EPS; t += DT) {
    // Effects due by now land before this step's assignments.
    applyDueEffects(t)
    const tickGeom = new Map<ThreatState, Map<number, ThreatGeom>>()

    for (const es of effectors.values()) {
      if (t + EPS < es.nextReadyS) continue
      if (es.rounds != null && es.rounds <= 0) continue
      const tEffect = t + es.engageTimeS
      const softShot = !isHardKill(es.spec.effectorType)

      // The in-range intervals are member-union geometry, so ship
      // eligibility re-verifies the same min/max/sector test per ship.
      const inEnvelope = (p: Vec2) =>
        dist(es.entity.pos, p) >= es.spec.minRangeM &&
        pointInSector(es.entity.pos, es.entity.headingDeg, es.spec.sectorDeg ?? 360, es.spec.maxRangeM, p)

      // Global ship-level assignment. Among every gated threat whose window
      // (this effector's) contains t and tEffect, and every ship inside the
      // envelope at tEffect and above the survival cutoffs, engage the ship
      // with the highest effective survival: alive discounted by the kill
      // salvos already in flight at it, times — for 'continue' jams — the
      // analogous discounted un-jammed probability. In-flight discounting
      // spreads simultaneous volleys across ships; the cutoff moves fire off
      // expected-dead targets. Ties break by earlier threat arrival, then
      // scenario order, then lower ship index (the scan order makes the
      // first candidate win exact ties).
      let target: ThreatState | null = null
      let shipIdx = -1
      let shipPos: Vec2 | null = null
      let bestWeight = 0
      let bestArrivalS = Number.POSITIVE_INFINITY
      for (const ts of threats) {
        if (ts.gateS == null || t + EPS < ts.gateS || !ts.path) continue
        const intervals = ts.windows.get(es.entity.id)
        if (!intervals) continue
        const contains = (x: number) => intervals.some(([s0, s1]) => x >= s0 - EPS && x <= s1 + EPS)
        if (!contains(t) || !contains(tEffect)) continue
        const continueJam = softShot && ts.jamBehavior === 'continue'

        // Geometry is evaluated where the effect lands, not where it is fired.
        const { members } = geomAt(tickGeom, ts, tEffect)
        const arrivalS = ts.a.arrivalS ?? Number.POSITIVE_INFINITY

        for (let i = 0; i < ts.ships.length; i++) {
          const p = members[Math.min(i, members.length - 1)]
          if (!inEnvelope(p)) continue
          const s = ts.ships[i]
          const alive = effectiveAlive(s)
          if (alive < SHIP_DEAD_BELOW) continue // expected dead: never targeted
          let weight = alive
          if (continueJam) {
            const unjammed = effectiveUnjammed(s)
            if (unjammed < SHIP_DEAD_BELOW) continue // track saturated: hold
            weight = alive * unjammed
          }
          if (
            target == null ||
            weight > bestWeight + EPS ||
            (weight > bestWeight - EPS && arrivalS < bestArrivalS - EPS)
          ) {
            target = ts
            shipIdx = i
            shipPos = p
            bestWeight = weight
            bestArrivalS = arrivalS
          }
        }
      }
      // No eligible ship anywhere on the raid: hold fire — no magazine
      // spend, no cooldown.
      if (target == null || shipIdx < 0 || shipPos == null) continue
      const continueJam = softShot && target.jamBehavior === 'continue'

      const falloff = distanceFalloff(dist(es.entity.pos, shipPos), es.spec.maxRangeM)
      const size = target.uasSpec ? SIZE_PENALTY[target.uasSpec.group] : 1
      const evasion = target.uasSpec?.airframe === 'fpv' ? EVASION_PENALTY : 1
      const pk = Math.min(1, Math.max(0, es.pk * falloff * size * evasion))

      const event: EngagementEvent = {
        tS: t,
        tEffectS: tEffect,
        effectorId: es.entity.id,
        uasId: target.a.uasId,
        shipIdx,
        channel: continueJam ? 'jam' : 'kill',
        softShot,
        pk,
        killDelta: 0,
      }
      events.push(event)

      const fx: PendingEffect = {
        tEffectS: tEffect,
        effectorId: es.entity.id,
        target,
        shipIdx,
        pk,
        softShot,
        continueJam,
        event,
      }
      // Zero-latency effects land inside the same step (preserves the
      // pre-latency same-tick jam-then-kill coupling); the rest wait in
      // flight and discount later aiming at the same ship.
      if (es.engageTimeS <= 0) {
        applyEffect(fx)
      } else {
        const ship = target.ships[shipIdx]
        if (continueJam) {
          ship.pendingJam.add(fx)
          ship.jamDiscount *= 1 - pk
        } else {
          ship.pendingKill.add(fx)
          ship.killDiscount *= 1 - pk
        }
        pending.push(fx)
      }

      if (softShot) {
        target.jamSalvos += 1
        es.jamSalvos += 1
      } else {
        target.shotsFired += 1
        es.shotsFired += 1
      }
      if (target.firstShotS == null) target.firstShotS = t

      if (es.rounds != null) es.rounds -= 1
      es.nextReadyS = t + es.cooldownS
    }
  }

  // Salvos assigned late in a window take effect after the last window ends.
  applyDueEffects(Number.POSITIVE_INFINITY)

  const threatRows: ThreatAttrition[] = threats.map((ts) => {
    const survival = ts.ships.reduce((s, v) => s + v.alive, 0)
    const hardKills = ts.ships.reduce((s, v) => s + v.hard, 0)
    const softKills = ts.ships.reduce((s, v) => s + v.soft, 0)
    const jammed = ts.ships.reduce((s, v) => s + v.jammed, 0)
    let killedBy: string | null = null
    let best = 0
    for (const [id, v] of ts.killContrib) {
      if (v > best + EPS) {
        best = v
        killedBy = id
      }
    }
    const killedBySpec = killedBy ? effectors.get(killedBy)?.spec : undefined
    return {
      uasId: ts.a.uasId,
      shipCount: ts.ships.length,
      expectedKills: hardKills + softKills,
      expectedHardKills: hardKills,
      expectedSoftKills: softKills,
      leakProbability: ts.ships.length > 0 ? survival / ts.ships.length : 1,
      continueJamProb: ts.ships.length > 0 ? jammed / ts.ships.length : 0,
      firstShotS: ts.firstShotS,
      shotsFired: ts.shotsFired,
      jamSalvos: ts.jamSalvos,
      killedByEffectorId: killedBy,
      killedBySoft: killedBySpec != null && !isHardKill(killedBySpec.effectorType),
    }
  })

  const effectorRows: EffectorAttrition[] = [...effectors.values()].map((es) => ({
    effectorId: es.entity.id,
    shotsFired: es.shotsFired,
    jamSalvos: es.jamSalvos,
    expectedRoundsRemaining: es.rounds,
  }))

  const raidSize = threatRows.reduce((s, t) => s + t.shipCount, 0)
  const expectedHardKills = threatRows.reduce((s, t) => s + t.expectedHardKills, 0)
  const expectedSoftKills = threatRows.reduce((s, t) => s + t.expectedSoftKills, 0)
  const expectedKills = expectedHardKills + expectedSoftKills
  return {
    threats: threatRows,
    effectors: effectorRows,
    totals: {
      raidSize,
      expectedKills,
      expectedHardKills,
      expectedSoftKills,
      expectedLeakers: raidSize - expectedKills,
      shotsFired: threatRows.reduce((s, t) => s + t.shotsFired, 0),
      jamSalvos: threatRows.reduce((s, t) => s + t.jamSalvos, 0),
    },
    events,
  }
}
