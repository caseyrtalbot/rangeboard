import type { Entity, FlightPath, Scenario, SpecModel, Vec2 } from '../model/types'
import {
  DEFAULT_REQUIREMENT_THRESHOLDS,
  defaultJamBehavior,
  effectiveDoctrine,
  entityActive,
  mountHeightOf,
} from '../model/types'
import { dist, pointInWedge } from '../geometry/geo'
import { slantRangeM } from '../geometry/slant'
import { assessJam, effectiveJamRangeM } from '../analysis/ewPhysics'
import { FT_TO_M, effectorGeometryGate } from '../analysis/sensorEnv'
import type { ThreatAssessment } from './sim'
import { assessAllThreats } from './sim'
import { DT } from './clock'
import { threatAltitudeFt } from './tracks'
import { killChainRoutes } from './killChain'
import {
  CONTINUE_TRACK_DEGRADE,
  DEFAULT_PK,
  DEFAULT_SALVO_COOLDOWN_S,
  expenditureChannel,
  isHardKill,
  kineticPk,
  SHIP_DEAD_BELOW,
} from './pk'
import type {
  AttritionReport,
  EffectorAttrition,
  EngagementEvent,
  ThreatAttrition,
} from './attritionReport'
import type { EffectorState, JamHold, PendingEffect, ShipState, ThreatState } from './sweepState'
import { EPS, interceptAt, intervalIndexAt, launchPolicyReleases, membersAtTime } from './intercept'
import type { DrawPolicy } from './policy'
import { deterministicPolicy } from './policy'
import { effectivePathDelayS } from './raid'
import { profileFor } from '../model/integration'
import { bdaSFor, commitPkFor } from '../analysis/doctrineFactors'

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
 * jam salvos. Ties break by the threat closing soonest (arrival, else closest
 * approach), then scenario order, then lower ship index.
 *
 * Route latency: an effector cannot shoot the instant the ROE gate opens. The
 * cue has to traverse the kill chain first, so a threat is a candidate for one
 * effector only from gateS + that (effector, threat) route latency. The charge
 * is relative to the gate, never an absolute floor from T0, so a late gate
 * still pays the full delay.
 *
 * Assignment-to-effect latency: a salvo assigned (fired) at t takes effect at
 * tEffect = t + engageTimeS + timeOfFlightS, the flight time from a stated
 * flyoutSpeedMps to the predicted intercept point (interceptAt; 0 with no
 * stated speed). The shot is only valid when some in-range
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
 * track, so it still leaks. A 'continue' jam is ILLUMINATION, not damage:
 * the hold is bound to the jammer's in-range interval that produced it
 * (JamHold), lapses the moment the target flies out of the beam, and a
 * later re-entry starts from zero.
 *
 * ARRIVAL RULE. A defeat that lands after the threat was already over the
 * defended asset did not protect the asset. Every salvo is stamped
 * lateEffect: true when its tEffectS is strictly after that threat's
 * ThreatAssessment.arrivalS (the protected-boundary crossing in sim.ts).
 * The physics is untouched: alive still decrements at effect time exactly as
 * before, so a late kill still removes the airframe. Only the CREDIT splits.
 * expectedKills, expectedHardKills, and expectedSoftKills carry PRE-ARRIVAL
 * mass and are the defeat number; expectedLateKills carries the rest, as a
 * sub-measure of the leaker mass rather than a deduction from it.
 * leakProbability is per-ship survival AT ARRIVAL, derived from the
 * pre-arrival mass.
 *
 * RAID PARTITION. Every ship of the raid lands in exactly one of three
 * buckets, and the three sum to raidSize:
 *   expectedKills      defeated at or before arrival.
 *   expectedLeakers    reached a defended asset undefeated. Counted only for
 *                      threats that actually crossed a boundary.
 *   expectedNoArrival  neither defeated nor arrived. A fly-by that turned
 *                      away short, or any run with no asset placed at all.
 * Charging every undefeated ship as a leaker (the old raidSize minus kills)
 * conflated the second and third buckets, so an asset-free run reported the
 * whole raid as leakers.
 *
 * MEASURABILITY. With no asset entity on the board there is nothing to leak
 * past, so expectedLeakers is 0 for arithmetic reasons, not because the
 * defence worked. Printing that 0 reads as a perfect defence. totals
 * therefore also carries reportedLeakers: the same figure when an asset
 * exists, and null when none does. Callers display reportedLeakers and render
 * a dash for null; expectedLeakers is the partition term, not a display
 * value.
 *
 * Expenditure splits three ways by effector class, independently of the kill
 * channel: shotsFired counts KINETIC salvos (interceptor, gun, net),
 * deSalvos counts DIRECTED-ENERGY bursts (DE, HPM), and jamSalvos counts EW
 * salvos (jammer) of every behavior. DE and HPM stay hard kills; what changes
 * is only what their salvo is reported to have cost. The events ledger
 * records every salvo — assignment time, effect time, target ship, kill
 * channel, expenditure channel, effector type, late flag, Pk, and the
 * expected-kill mass the effect removed — so shots-so-far, kills-so-far, and
 * per-threat state at any sim time can be prefix-aggregated from it.
 */

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

/** Survival discounted by the kill salvos already in flight at the ship. */
function effectiveAlive(s: ShipState): number {
  return s.alive * s.killDiscount
}

/**
 * Probability the ship's track is jam-degraded at t. A hold counts only
 * while t sits inside the same in-range interval of the jammer that fired
 * it (see JamHold); independent jammers combine as 1 - product of misses.
 */
function jammedAt(ts: ThreatState, s: ShipState, t: number): number {
  if (s.jamBy.size === 0) return 0
  let unjammed = 1
  for (const [effectorId, hold] of s.jamBy) {
    if (intervalIndexAt(ts.windows.get(effectorId), t) === hold.intervalIdx) {
      unjammed *= 1 - hold.value
    }
  }
  return 1 - unjammed
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

/**
 * Resolve every engagement window into expected kills, leakers, and magazine
 * use. Sweeps the timeline at DT = 0.5 s; each ready effector fires one salvo
 * per salvoCooldownS at the eligible ship with the highest effective
 * survival across the whole raid (eligible = threat gate met AND the route
 * latency to this effector elapsed since that gate, this effector's window
 * contains t and tEffect = t + engageTimeS + flyout, ship inside this effector's
 * envelope at tEffect, ship above the SHIP_DEAD_BELOW cutoffs; no eligible
 * ship = hold fire: no magazine spend, no cooldown), until the windows close
 * or the magazine is empty. The salvo's effect (kill or jam) lands at tEffect
 * with kill math evaluated there; effects still pending when the sweep ends
 * are flushed in tEffect order. Kill mass landing after the threat's arrival
 * is banked separately (see the ARRIVAL RULE at the top of this file).
 */
export function resolveEngagements(
  scenario: Scenario,
  precomputed?: ThreatAssessment[],
  policy?: DrawPolicy,
): AttritionReport {
  // A missing policy is the deterministic expected-value run.
  const draw =
    policy ??
    deterministicPolicy({ ...DEFAULT_REQUIREMENT_THRESHOLDS, ...scenario.requirements })
  const assessments = (precomputed ?? assessAllThreats(scenario, draw)).filter(
    (a) => a.status !== 'no-path',
  )
  const doctrine = effectiveDoctrine(scenario)

  const threats: ThreatState[] = assessments.map((a) => {
    const entity = scenario.entities.find((e) => e.id === a.uasId)!
    const uasSpec = specFor(scenario, entity)?.uas
    const path = scenario.paths.find((p) => p.entityId === a.uasId)
    const count = entity.formation && entity.formation.count > 1 ? entity.formation.count : 1
    const windows = new Map<string, Array<[number, number]>>()
    const routeLatencyS = new Map<string, number>()
    if (a.status === 'engageable') {
      const routes = killChainRoutes(scenario, new Set(a.detectingSensorIds))
      for (const w of a.effectorWindows) {
        const route = routes.get(w.effectorId)
        if (!route) continue
        // Same fc-uplink gate as assessThreat: a fully typed route without a
        // fire-control source cannot fire.
        if (route.typed && route.fcSourceIds.length === 0) {
          const eff = scenario.entities.find((e) => e.id === w.effectorId)
          if (profileFor(eff?.specId ?? null)?.guidance === 'fc-uplink') continue
        }
        windows.set(w.effectorId, w.intervals)
        // killChainRoutes already reduced every path to the minimum summed
        // edge latency, so this is the per-(effector, threat) minimum.
        routeLatencyS.set(w.effectorId, route.latencyS)
      }
    }
    return {
      a,
      entity,
      uasSpec,
      altM: threatAltitudeFt(scenario, entity) * FT_TO_M,
      path,
      speedMps: path ? speedFor(scenario, path) : 15,
      delayS: path ? effectivePathDelayS(scenario, path) : 0,
      ships: Array.from({ length: count }, () => ({
        alive: 1,
        hard: 0,
        soft: 0,
        lateHard: 0,
        lateSoft: 0,
        jamBy: new Map<string, JamHold>(),
        holdUntilS: 0,
        pendingKill: new Set<PendingEffect>(),
        pendingJam: new Set<PendingEffect>(),
        killDiscount: 1,
        jamDiscount: 1,
      })),
      jamBehavior: uasSpec ? defaultJamBehavior(uasSpec) : 'drift',
      windows,
      routeLatencyS,
      gateS: a.engageGateS,
      effectorReadyS: new Map((a.effectorGates ?? []).map((g) => [g.effectorId, g.readyS])),
      shotsFired: 0,
      deSalvos: 0,
      jamSalvos: 0,
      lastJamEffectS: null,
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
      mountM: mountHeightOf(spec),
      pk: spec.pk ?? DEFAULT_PK[spec.effectorType],
      cooldownS: Math.max(spec.salvoCooldownS ?? DEFAULT_SALVO_COOLDOWN_S[spec.effectorType], DT),
      engageTimeS: spec.engageTimeS ?? 0,
      rounds: spec.magazineSize ?? null,
      // Route latency is charged per threat from that threat's gate, not as
      // an absolute floor from T0, so the battery itself starts ready.
      nextReadyS: 0,
      shotsFired: 0,
      deSalvos: 0,
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
  // Salvos per (effector, threat, ship), every channel: the kill draw key.
  const salvoCounts = new Map<string, number>()

  // Salvos in flight. Applied in tEffect order so a jam that takes hold
  // before a kill shot arrives degrades that kill (see attrition.test.ts).
  const pending: PendingEffect[] = []

  const applyEffect = (fx: PendingEffect) => {
    const ship = fx.target.ships[fx.shipIdx]
    if (fx.continueJam) {
      // Jam holds but the threat presses on: no kill, the track degrades.
      // The hold is bound to the illumination interval the dwell landed in;
      // a dwell in a NEW interval starts a fresh hold, because the link
      // recovered while the target was outside the beam.
      const idx = intervalIndexAt(fx.target.windows.get(fx.effectorId), fx.tEffectS)
      const hold = ship.jamBy.get(fx.effectorId)
      const p = draw.jam(fx.pk, fx.effectorId, fx.target.a.uasId, fx.tEffectS)
      if (hold && hold.intervalIdx === idx) hold.value += (1 - hold.value) * p
      else ship.jamBy.set(fx.effectorId, { value: p, intervalIdx: idx })
      if (fx.target.lastJamEffectS == null || fx.tEffectS > fx.target.lastJamEffectS) {
        fx.target.lastJamEffectS = fx.tEffectS
      }
    } else {
      // Kill shot; a track jam-degraded AT THE EFFECT TIME worsens the
      // firing solution. A target that already flew out of the jam cone has
      // its link back, so it takes no degrade.
      const pEff = fx.pk * (1 - CONTINUE_TRACK_DEGRADE * jammedAt(fx.target, ship, fx.tEffectS))
      const kill =
        ship.alive *
        draw.kill(pEff, fx.effectorId, fx.target.a.uasId, fx.shipIdx, fx.salvoIdx, fx.tEffectS)
      ship.alive -= kill
      // Survival math is unchanged. Only the credit splits: mass removed
      // after the threat was already over the asset destroyed an airframe
      // but defended nothing, so it never counts toward the defeat rate.
      if (fx.event.lateEffect) {
        if (fx.softShot) ship.lateSoft += kill
        else ship.lateHard += kill
      } else if (fx.softShot) {
        ship.soft += kill
      } else {
        ship.hard += kill
      }
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
  // A flyout pass lands on a ship-specific tEffect, which simply misses.
  let tickGeom = new Map<ThreatState, Map<number, Vec2[]>>()
  const membersAt = (ts: ThreatState, tEffect: number): Vec2[] => {
    let byT = tickGeom.get(ts)
    if (!byT) {
      byT = new Map()
      tickGeom.set(ts, byT)
    }
    let g = byT.get(tEffect)
    if (!g) {
      g = membersAtTime(ts, tEffect)
      byT.set(tEffect, g)
    }
    return g
  }

  // One salvo, committed: the event, the in-flight (or inline) effect, the
  // expenditure channel counts, the magazine decrement, and the cooldown.
  // Shared by the legacy volley loop and the doctrine assignment pass, so the
  // bookkeeping cannot diverge between them. `tEffect` is the interceptAt
  // effect time of the chosen ship; `capped` is its flight-time cap flag.
  const commitSalvo = (
    es: EffectorState,
    target: ThreatState,
    shipIdx: number,
    pk: number,
    t: number,
    tEffect: number,
    continueJam: boolean,
    capped: boolean,
  ) => {
    const softShot = !isHardKill(es.spec.effectorType)
    // The kill draw key: this effector's salvos at this ship so far, so an
    // added threat never shifts the key of a shot at another one.
    const salvoKey = `${es.entity.id}:${target.a.uasId}:${shipIdx}`
    const salvoIdx = salvoCounts.get(salvoKey) ?? 0
    salvoCounts.set(salvoKey, salvoIdx + 1)
    const event: EngagementEvent = {
      tS: t,
      tEffectS: tEffect,
      effectorId: es.entity.id,
      uasId: target.a.uasId,
      shipIdx,
      channel: continueJam ? 'jam' : 'kill',
      softShot,
      effectorType: es.spec.effectorType,
      channelClass: expenditureChannel(es.spec.effectorType),
      // Strictly after: an effect landing exactly at arrival still defends.
      lateEffect: target.a.arrivalS != null && tEffect > target.a.arrivalS + EPS,
      pk,
      killDelta: 0,
      ...(capped ? { flightCapped: true as const } : {}),
    }
    events.push(event)

    const fx: PendingEffect = {
      tEffectS: tEffect,
      effectorId: es.entity.id,
      target,
      shipIdx,
      salvoIdx,
      pk,
      softShot,
      continueJam,
      event,
    }
    // Zero-latency effects land inside the same step (preserves the
    // pre-latency same-tick jam-then-kill coupling); the rest wait in
    // flight and discount later aiming at the same ship.
    if (tEffect <= t + EPS) {
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

    // Expenditure follows the effector class, not the kill channel: a DE or
    // HPM burst is a hard kill that spends no round.
    if (event.channelClass === 'ew') {
      target.jamSalvos += 1
      es.jamSalvos += 1
    } else if (event.channelClass === 'directed-energy') {
      target.deSalvos += 1
      es.deSalvos += 1
    } else {
      target.shotsFired += 1
      es.shotsFired += 1
    }
    if (target.firstShotS == null) target.firstShotS = t

    if (es.rounds != null) es.rounds -= 1
    es.nextReadyS = t + es.cooldownS
  }

  for (let t = 0; t <= tEnd + EPS; t += DT) {
    // Effects due by now land before this step's assignments.
    applyDueEffects(t)
    tickGeom = new Map()

    for (const es of effectors.values()) {
      // Under doctrine, kinetic and DE fire moves to the assignment pass
      // below. Jammers stay here: a jam dwell is illumination, not a round,
      // so shoot-look-shoot and magazine preservation do not apply to it.
      if (doctrine.enabled && es.spec.effectorType !== 'jammer') continue
      if (t + EPS < es.nextReadyS) continue
      if (es.rounds != null && es.rounds <= 0) continue
      const softShot = !isHardKill(es.spec.effectorType)

      const isJammer = es.spec.effectorType === 'jammer'
      // The in-range intervals are member-union geometry, so ship
      // eligibility re-verifies the same min/max/sector test per ship, on
      // slant range from the launcher, under the effector ceiling. A
      // jammer's reach is its power-scaled effective range against this
      // target (jamResistDb included), the same figure the sim window and
      // the drawn cone use; its cone test takes slant range and no ceiling.
      const inEnvelope = (p: Vec2, ts: ThreatState) => {
        if (!isJammer && effectorGeometryGate(es.spec, ts.altM) !== 'ok') return false
        const slant = slantRangeM(dist(es.entity.pos, p), ts.altM - es.mountM)
        return (
          slant >= es.spec.minRangeM &&
          slant <= (isJammer ? effectiveJamRangeM(es.spec, ts.uasSpec) : es.spec.maxRangeM) &&
          pointInWedge(es.entity.pos, es.entity.headingDeg, es.spec.sectorDeg ?? 360, p)
        )
      }
      // Jam physics (band coverage, alignment, power out) decide whether a
      // jammer can affect this ship at all; a ship the physics cannot reach
      // is never a jam candidate, so the dwell is not wasted on it. The
      // physics take the same slant range as inEnvelope (R-F-30).
      const jamFactor = (ts: ThreatState, p: Vec2): number =>
        assessJam(es.spec, es.entity.pos, es.entity.headingDeg, ts.uasSpec, p, ts.altM - es.mountM)
          .factor

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
      let hit: ReturnType<typeof interceptAt> | null = null
      let bestWeight = 0
      let bestArrivalS = Number.POSITIVE_INFINITY
      for (const ts of threats) {
        if (ts.gateS == null || !ts.path) continue
        const intervals = ts.windows.get(es.entity.id)
        if (!intervals) continue
        // The cue reaches this shooter routeLatencyS after the track became
        // engageable. Charging it from the gate (not from T0) keeps the delay
        // real when the ROE gate is later than the latency. Under doctrine
        // the effector's release-ready time already carries the latency and
        // its target dwell.
        const readyS = doctrine.enabled
          ? ts.effectorReadyS.get(es.entity.id)
          : ts.gateS == null
            ? null
            : ts.gateS + (ts.routeLatencyS.get(es.entity.id) ?? 0)
        if (readyS == null || t + EPS < readyS) continue
        const contains = (x: number) => intervals.some(([s0, s1]) => x >= s0 - EPS && x <= s1 + EPS)
        const within = intervals.find(([s0, s1]) => t >= s0 - EPS && t <= s1 + EPS)
        if (!within) continue
        const continueJam = softShot && ts.jamBehavior === 'continue'
        // Prefer the threat closing soonest. Arrival when it has one, else
        // closest approach, which is all the geometry a fly-by offers.
        const arrivalS = ts.a.arrivalS ?? ts.a.cpaS ?? Number.POSITIVE_INFINITY

        for (let i = 0; i < ts.ships.length; i++) {
          // Geometry is evaluated where the effect lands, not where it is
          // fired: the predicted intercept of this ship.
          const ic = interceptAt(ts, es, t, i, membersAt, within[1])
          if (!contains(ic.tEffectS)) continue
          if (!inEnvelope(ic.pos, ts)) continue
          if (isJammer && jamFactor(ts, ic.pos) <= 0) continue
          const s = ts.ships[i]
          const alive = effectiveAlive(s)
          if (alive < SHIP_DEAD_BELOW) continue // expected dead: never targeted
          let weight = alive
          if (continueJam) {
            // Un-jammed probability where the dwell would land, discounted by
            // the jam salvos already in flight. Illumination-bound: a hold on
            // a target that left the beam has lapsed, so the track is open to
            // fresh jamming again.
            const unjammed = (1 - jammedAt(ts, s, ic.tEffectS)) * s.jamDiscount
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
            hit = ic
            bestWeight = weight
            bestArrivalS = arrivalS
          }
        }
      }
      // No eligible ship anywhere on the raid: hold fire — no magazine
      // spend, no cooldown.
      if (target == null || shipIdx < 0 || hit == null) continue
      const continueJam = softShot && target.jamBehavior === 'continue'

      // Jam Pk is link physics (band, alignment, power/range), not aiming:
      // airframe size and jinking do not protect a link, so a jammer takes
      // none of the kinetic penalties and all of the EW ones.
      const pk = isJammer
        ? Math.min(1, Math.max(0, es.pk * jamFactor(target, hit.pos)))
        : kineticPk(es.pk, es.spec.maxRangeM, target.uasSpec, hit.slantM)

      commitSalvo(es, target, shipIdx, pk, t, hit.tEffectS, continueJam, hit.capped)
    }

    // DOCTRINE ASSIGNMENT PASS (kinetic and DE only). Doctrinal sequence:
    // sim.ts already required a stable fire-control track, hostile ID, the
    // declaration dwell, the route latency and the shooter's target dwell
    // (effectorReadyS). Here the fire distribution is shoot-look-shoot: a
    // ship with a kill salvo in flight, or inside its post-effect BDA dwell
    // (ShipState.holdUntilS), draws no fire from anyone. Among the shooters
    // that CAN engage a ship this tick, the best predicted per-shot Pk takes
    // the shot (ties prefer unlimited magazines, then fuller magazines, then
    // the threat closing soonest). WHERE in the envelope the shot is released
    // is the launch policy (FireDoctrine.launchPolicy): max-range releases at
    // the first opportunity, range-fraction once the intercept point is
    // inside launchRangeFraction x max range, pk-commit once the Pk at effect
    // time reaches the effector's commit Pk (the target is closing, so
    // waiting buys accuracy), latest never volunteers. Every policy fires at
    // the deadline regardless: the last launch that still preserves
    // `opportunities` full engagement cycles before the threat's arrival
    // (CPA for a fly-by, window end when no asset exists), capped by the
    // closing in-range window.
    if (doctrine.enabled) {
      interface Candidate {
        es: EffectorState
        ts: ThreatState
        shipIdx: number
        pk: number
        arrivalS: number
        /** interceptAt effect time of this ship, and its flight-time cap flag. */
        tEffectS: number
        capped: boolean
      }
      const candidates: Candidate[] = []
      for (const es of effectors.values()) {
        if (es.spec.effectorType === 'jammer') continue
        if (t + EPS < es.nextReadyS) continue
        if (es.rounds != null && es.rounds <= 0) continue
        // Per-system factors: spec override, else the type table, else the
        // scenario uniform value (doctrineFactors.ts).
        const esBdaS = bdaSFor(es.spec, doctrine)
        const esCommitPk = commitPkFor(es.spec, doctrine)
        // Slant range from the launcher, under the effector ceiling.
        const inEnvelope = (p: Vec2, ts: ThreatState) => {
          if (effectorGeometryGate(es.spec, ts.altM) !== 'ok') return false
          const slant = slantRangeM(dist(es.entity.pos, p), ts.altM - es.mountM)
          return (
            slant >= es.spec.minRangeM &&
            slant <= es.spec.maxRangeM &&
            pointInWedge(es.entity.pos, es.entity.headingDeg, es.spec.sectorDeg ?? 360, p)
          )
        }
        for (const ts of threats) {
          if (!ts.path) continue
          // This effector's own route-aware release-ready time; none, no shot.
          const readyS = ts.effectorReadyS.get(es.entity.id)
          if (readyS == null) continue
          const intervals = ts.windows.get(es.entity.id)
          if (!intervals) continue
          if (t + EPS < readyS) continue
          const refS = ts.a.arrivalS ?? ts.a.cpaS
          const arrivalS = ts.a.arrivalS ?? ts.a.cpaS ?? Number.POSITIVE_INFINITY
          for (let i = 0; i < ts.ships.length; i++) {
            const ship = ts.ships[i]
            // Shoot-look-shoot: in-flight salvo or BDA dwell locks the ship.
            if (t + EPS < ship.holdUntilS) continue
            if (effectiveAlive(ship) < SHIP_DEAD_BELOW) continue
            // Predicted intercept of this ship: its effect time carries the
            // flyout, capped at the end of the window that contains t, so
            // the window test and the deadline read it per ship.
            const at = intervals.find(([s0, s1]) => t >= s0 - EPS && t <= s1 + EPS)
            if (!at) continue
            const ic = interceptAt(ts, es, t, i, membersAt, at[1])
            const tEffect = ic.tEffectS
            const within = intervals.find(
              ([s0, s1]) =>
                t >= s0 - EPS && tEffect >= s0 - EPS && t <= s1 + EPS && tEffect <= s1 + EPS,
            )
            if (!within) continue
            // Assignment-to-effect time: engage time plus the flyout. Exact 0
            // flyout with no stated speed, so the legacy arithmetic is kept.
            const flightS = es.engageTimeS + (tEffect - (t + es.engageTimeS))
            // Latest commit that still leaves the planned re-engagement depth,
            // capped by the last launch whose effect still lands inside this
            // in-range window: a closing window is its own deadline, so a high
            // pkCommit can never hold fire past the final physical shot.
            const windowDeadlineS = within[1] - flightS
            const deadlineS =
              refS != null
                ? Math.min(refS - doctrine.opportunities * (flightS + esBdaS), windowDeadlineS)
                : windowDeadlineS
            if (!inEnvelope(ic.pos, ts)) continue
            const pk = kineticPk(es.pk, es.spec.maxRangeM, ts.uasSpec, ic.slantM)
            if (pk <= 0) continue
            // Launch policy: does this shooter volunteer the shot here? The
            // deadline overrides a "no" from every policy.
            if (!launchPolicyReleases(doctrine, pk, esCommitPk, ic.slantM, es.spec.maxRangeM)) {
              if (t + EPS < deadlineS) continue
            }
            candidates.push({
              es,
              ts,
              shipIdx: i,
              pk,
              arrivalS,
              tEffectS: tEffect,
              capped: ic.capped,
            })
          }
        }
      }
      // Best shot first. Near-ties (within 0.02 Pk) preserve salvo: an
      // unlimited magazine outranks a counted one, a fuller magazine a
      // lower one; then the threat closing soonest.
      candidates.sort((a, b) => {
        if (Math.abs(b.pk - a.pk) > 0.02) return b.pk - a.pk
        const aInf = a.es.rounds == null ? 1 : 0
        const bInf = b.es.rounds == null ? 1 : 0
        if (aInf !== bInf) return bInf - aInf
        if (a.es.rounds != null && b.es.rounds != null && a.es.rounds !== b.es.rounds) {
          return b.es.rounds - a.es.rounds
        }
        return a.arrivalS - b.arrivalS
      })
      const firedThisTick = new Set<EffectorState>()
      for (const c of candidates) {
        if (firedThisTick.has(c.es)) continue
        const ship = c.ts.ships[c.shipIdx]
        // A better candidate may already have taken this ship this tick.
        if (t + EPS < ship.holdUntilS) continue
        if (effectiveAlive(ship) < SHIP_DEAD_BELOW) continue
        commitSalvo(c.es, c.ts, c.shipIdx, c.pk, t, c.tEffectS, false, c.capped)
        ship.holdUntilS = c.tEffectS + bdaSFor(c.es.spec, doctrine)
        firedThisTick.add(c.es)
      }
    }
  }

  // Salvos assigned late in a window take effect after the last window ends.
  applyDueEffects(Number.POSITIVE_INFINITY)

  const threatRows: ThreatAttrition[] = threats.map((ts) => {
    const hardKills = ts.ships.reduce((s, v) => s + v.hard, 0)
    const softKills = ts.ships.reduce((s, v) => s + v.soft, 0)
    const lateHardKills = ts.ships.reduce((s, v) => s + v.lateHard, 0)
    const lateSoftKills = ts.ships.reduce((s, v) => s + v.lateSoft, 0)
    // Survival AT ARRIVAL: every ship starts alive, so what remains inbound
    // at the boundary is one minus the mass removed before it got there. Per
    // ship the removed mass never exceeds 1, so this stays non-negative and
    // the partition below is exact without a clamp.
    const survival = ts.ships.length - (hardKills + softKills)
    // Undefeated ships only count as LEAKERS when the threat actually
    // crossed a defended boundary. A fly-by, or any threat in a run with no
    // asset placed, banks its survivors as never-arrived instead.
    const arrived = ts.a.arrivalS != null
    // Jam degrade is read where it matters: at arrival when the threat
    // arrives, at closest approach for a fly-by, else at the last dwell. An
    // illumination-bound hold that lapsed before that instant counts 0.
    const jamRefS = ts.a.arrivalS ?? ts.a.cpaS ?? ts.lastJamEffectS
    const jammed =
      jamRefS == null ? 0 : ts.ships.reduce((s, v) => s + jammedAt(ts, v, jamRefS), 0)
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
      expectedLateKills: lateHardKills + lateSoftKills,
      expectedLateHardKills: lateHardKills,
      expectedLateSoftKills: lateSoftKills,
      arrived,
      expectedLeakers: arrived ? survival : 0,
      expectedNoArrival: arrived ? 0 : survival,
      leakProbability: ts.ships.length > 0 ? survival / ts.ships.length : 1,
      continueJamProb: ts.ships.length > 0 ? jammed / ts.ships.length : 0,
      firstShotS: ts.firstShotS,
      shotsFired: ts.shotsFired,
      deSalvos: ts.deSalvos,
      jamSalvos: ts.jamSalvos,
      killedByEffectorId: killedBy,
      killedBySoft: killedBySpec != null && !isHardKill(killedBySpec.effectorType),
    }
  })

  const effectorRows: EffectorAttrition[] = [...effectors.values()].map((es) => ({
    effectorId: es.entity.id,
    shotsFired: es.shotsFired,
    deSalvos: es.deSalvos,
    jamSalvos: es.jamSalvos,
    expectedRoundsRemaining: es.rounds,
  }))

  const raidSize = threatRows.reduce((s, t) => s + t.shipCount, 0)
  const expectedHardKills = threatRows.reduce((s, t) => s + t.expectedHardKills, 0)
  const expectedSoftKills = threatRows.reduce((s, t) => s + t.expectedSoftKills, 0)
  const expectedKills = expectedHardKills + expectedSoftKills
  const expectedLeakers = threatRows.reduce((s, t) => s + t.expectedLeakers, 0)
  // Measurability is a property of the LAYDOWN, not of the flight paths: one
  // asset entity anywhere makes the leaker count meaningful, even if this
  // particular raid all turned away.
  const hasAsset = scenario.entities.some((e) => e.kind === 'asset')
  return {
    threats: threatRows,
    effectors: effectorRows,
    totals: {
      raidSize,
      expectedKills,
      expectedHardKills,
      expectedSoftKills,
      expectedLateKills: threatRows.reduce((s, t) => s + t.expectedLateKills, 0),
      // The raid partition, summed from the rows. Each row already splits its
      // own shipCount three ways, so the totals sum to raidSize exactly. Late
      // kill mass never shrinks the leaker term.
      expectedLeakers,
      expectedNoArrival: threatRows.reduce((s, t) => s + t.expectedNoArrival, 0),
      // Honesty gate: with no asset on the board leakers are not measurable,
      // and reporting 0 would read as a perfect defence.
      reportedLeakers: hasAsset ? expectedLeakers : null,
      shotsFired: threatRows.reduce((s, t) => s + t.shotsFired, 0),
      deSalvos: threatRows.reduce((s, t) => s + t.deSalvos, 0),
      jamSalvos: threatRows.reduce((s, t) => s + t.jamSalvos, 0),
    },
    events,
  }
}
