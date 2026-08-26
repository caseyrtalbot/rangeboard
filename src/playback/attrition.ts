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
import { defaultJamBehavior, effectiveDoctrine, entityActive } from '../model/types'
import { dist, pointInSector, posAtTime } from '../geometry/geo'
import { assessJam } from '../analysis/ewPhysics'
import type { ThreatAssessment } from './sim'
import { assessAllThreats, killChainRoutes, memberPositions } from './sim'
import { effectivePathDelayS } from './raid'
import { profileFor } from '../model/integration'

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

/** What a salvo costs the battery, as opposed to how it kills. */
export type ExpenditureChannel = 'kinetic' | 'directed-energy' | 'ew'

const EXPENDITURE_CHANNEL: Record<EffectorSpec['effectorType'], ExpenditureChannel> = {
  interceptor: 'kinetic',
  gun: 'kinetic',
  net: 'kinetic',
  de: 'directed-energy',
  hpm: 'directed-energy',
  jammer: 'ew',
}

/**
 * Expenditure channel of an effector type. This answers what the salvo SPENT,
 * which is a different question from isHardKill's what the salvo DESTROYS.
 * Directed energy is both: a DE or HPM burst is a hard kill that fires no
 * round, so rolling it into the kinetic count misreports rounds expended and
 * reads on the board as interceptors that were never launched.
 */
export function expenditureChannel(
  effectorType: EffectorSpec['effectorType'],
): ExpenditureChannel {
  return EXPENDITURE_CHANNEL[effectorType]
}

export interface ThreatAttrition {
  uasId: string
  /** Ships in the formation; 1 when the entity flies alone. */
  shipCount: number
  /**
   * DEFEATS: expected ships killed at or before arrival, hard plus soft. Kill
   * mass whose effect landed after the threat was already inside the defended
   * asset's boundary is NOT here; it is in expectedLateKills.
   */
  expectedKills: number
  /** Pre-arrival ships destroyed by hard-kill effectors. */
  expectedHardKills: number
  /** Pre-arrival mission kills through the soft channel (jam ends the approach). */
  expectedSoftKills: number
  /**
   * Kill mass whose effect landed strictly after arrival. Real destruction,
   * but it did not defend the asset, so it never counts toward the defeat
   * rate. Always 0 for a threat with no arrival.
   */
  expectedLateKills: number
  /** Post-arrival hard-kill mass; part of expectedLateKills. */
  expectedLateHardKills: number
  /** Post-arrival soft-kill mass; part of expectedLateKills. */
  expectedLateSoftKills: number
  /**
   * True when this threat crossed a defended boundary, i.e. its assessment
   * carries an arrivalS. False for a fly-by and for every threat when no
   * asset is placed.
   */
  arrived: boolean
  /**
   * Ships of this threat that reached the defended asset undefeated:
   * shipCount minus the pre-arrival kill mass. Zero when arrived is false.
   * Kill mass that landed after the crossing stays inside this figure; a
   * leaker destroyed too late still leaked.
   */
  expectedLeakers: number
  /**
   * Ships of this threat that were neither defeated nor arrived: they never
   * crossed a defended boundary. Zero when arrived is true. Together with
   * expectedKills and expectedLeakers this partitions shipCount exactly.
   */
  expectedNoArrival: number
  /** Mean per-ship survival probability AT ARRIVAL; 1 = certain leaker. */
  leakProbability: number
  /** Mean probability a ship's track is jam-degraded on arrival ('continue'). */
  continueJamProb: number
  /** First salvo of any channel at this threat; null when never engaged. */
  firstShotS: number | null
  /** Kinetic salvos (interceptor, gun, net) fired at this threat. */
  shotsFired: number
  /** Directed-energy bursts (DE, HPM) directed at this threat. */
  deSalvos: number
  /** Jammer salvos of every behavior directed at this threat. */
  jamSalvos: number
  /** Effector with the largest expected-kill contribution, late mass included. */
  killedByEffectorId: string | null
  /** True when killedByEffectorId is a jammer: the dominant kill is soft. */
  killedBySoft: boolean
}

export interface EffectorAttrition {
  effectorId: string
  /** Kinetic salvos; 0 for DE, HPM, and jammers (see deSalvos, jamSalvos). */
  shotsFired: number
  /** Directed-energy bursts; 0 for every other effector class. */
  deSalvos: number
  /** Jammer salvos of every behavior; 0 for every other effector class. */
  jamSalvos: number
  /** Null when the magazine is unlimited (jammers, DE, HPM). */
  expectedRoundsRemaining: number | null
}

export interface AttritionTotals {
  /** Total ships across all threats with flight paths. */
  raidSize: number
  /** Pre-arrival hard plus soft kills: the raid's defeat mass. */
  expectedKills: number
  expectedHardKills: number
  expectedSoftKills: number
  /**
   * Kill mass that landed after arrival. Excluded from expectedKills and
   * included in expectedLeakers: it is a sub-measure of the leaker mass, not
   * a deduction from it.
   */
  expectedLateKills: number
  /**
   * PARTITION TERM, not a display value: ships that reached a defended asset
   * undefeated. Zero when nothing arrived, which an asset-free run cannot
   * tell apart from a perfect defence, so print reportedLeakers instead.
   */
  expectedLeakers: number
  /**
   * Ships neither defeated nor arrived: they never crossed a defended
   * boundary. A fly-by that turned away short, or a run with no asset placed.
   * expectedKills + expectedLeakers + expectedNoArrival === raidSize.
   */
  expectedNoArrival: number
  /**
   * The leaker figure a caller may DISPLAY: expectedLeakers when the scenario
   * places at least one asset, null when it places none. Null means "not
   * measurable", so render a dash, never 0.
   */
  reportedLeakers: number | null
  /** Kinetic salvos (interceptor, gun, net) only. */
  shotsFired: number
  /** Directed-energy bursts (DE, HPM). */
  deSalvos: number
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
  /** Firing effector's type, so a reader never has to re-look up the spec. */
  effectorType: EffectorSpec['effectorType']
  /** What the salvo cost: kinetic round, directed-energy burst, or EW dwell. */
  channelClass: ExpenditureChannel
  /**
   * True when tEffectS is strictly after the target threat's arrivalS. The
   * kill still happens; it just lands too late to have defended the asset, so
   * its mass is credited to expectedLateKills. False when the threat has no
   * arrival.
   */
  lateEffect: boolean
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

/**
 * One jammer's 'continue' hold on one ship. Jamming is illumination, not
 * damage: the denial exists only while the transmitter keeps painting the
 * target, so the hold is valid only while the ship stays inside the SAME
 * in-range interval of that jammer that produced the dwells. A fixed cone
 * stops jamming the moment the target flies out behind it; a later re-entry
 * starts a fresh hold from zero.
 */
interface JamHold {
  /** Compounded probability the jam degrades this ship's track. */
  value: number
  /** Index of the jammer's in-range interval the dwells landed in; -1 when
   *  the geometry is unknown (hold never lapses, the legacy behavior). */
  intervalIdx: number
}

interface ShipState {
  /** Probability the ship is still inbound (not hard- or mission-killed). */
  alive: number
  /** Expected hard kills of this ship credited AT OR BEFORE arrival. */
  hard: number
  /** Expected soft (mission) kills of this ship credited AT OR BEFORE arrival. */
  soft: number
  /** Hard-kill mass that landed after arrival: destroyed, but too late. */
  lateHard: number
  /** Soft-kill mass that landed after arrival: destroyed, but too late. */
  lateSoft: number
  /** 'Continue' jam holds by jammer entity id (see JamHold). */
  jamBy: Map<string, JamHold>
  /**
   * Doctrine shoot-look-shoot lockout: no kill salvo targets this ship
   * before this time (assigned salvo's effect time + the BDA dwell).
   * Always 0 when doctrine is off.
   */
  holdUntilS: number
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

/** Index of the interval containing t, or -1 (none, or intervals unknown). */
export function intervalIndexAt(
  intervals: Array<[number, number]> | undefined,
  t: number,
): number {
  if (!intervals) return -1
  for (let i = 0; i < intervals.length; i++) {
    const [s0, s1] = intervals[i]
    if (t >= s0 - EPS && t <= s1 + EPS) return i
  }
  return -1
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
  /**
   * Minimum kill-chain route latency from the detecting sensors to each
   * connected effector, seconds. Charged from gateS, not from T0: the cue has
   * to reach the shooter before it can be told to fire.
   */
  routeLatencyS: Map<string, number>
  /** Time the required track quality was met; shots start no earlier. */
  gateS: number | null
  shotsFired: number
  deSalvos: number
  jamSalvos: number
  /** Effect time of the last 'continue' jam dwell; null when never jammed. */
  lastJamEffectS: number | null
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
  deSalvos: number
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
 * survival across the whole raid (eligible = threat gate met AND the route
 * latency to this effector elapsed since that gate, this effector's window
 * contains t and tEffect = t + engageTimeS, ship inside this effector's
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
): AttritionReport {
  const assessments = (precomputed ?? assessAllThreats(scenario)).filter(
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
      path,
      speedMps: path ? speedFor(scenario, path) : 15,
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
      if (hold && hold.intervalIdx === idx) hold.value += (1 - hold.value) * fx.pk
      else ship.jamBy.set(fx.effectorId, { value: fx.pk, intervalIdx: idx })
      if (fx.target.lastJamEffectS == null || fx.tEffectS > fx.target.lastJamEffectS) {
        fx.target.lastJamEffectS = fx.tEffectS
      }
    } else {
      // Kill shot; a track jam-degraded AT THE EFFECT TIME worsens the
      // firing solution. A target that already flew out of the jam cone has
      // its link back, so it takes no degrade.
      const kill =
        ship.alive * fx.pk * (1 - CONTINUE_TRACK_DEGRADE * jammedAt(fx.target, ship, fx.tEffectS))
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

  // One salvo, committed: the event, the in-flight (or inline) effect, the
  // expenditure channel counts, the magazine decrement, and the cooldown.
  // Shared by the legacy volley loop and the doctrine assignment pass, so the
  // bookkeeping cannot diverge between them.
  const commitSalvo = (
    es: EffectorState,
    target: ThreatState,
    shipIdx: number,
    pk: number,
    t: number,
    continueJam: boolean,
  ) => {
    const tEffect = t + es.engageTimeS
    const softShot = !isHardKill(es.spec.effectorType)
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
    const tickGeom = new Map<ThreatState, Map<number, ThreatGeom>>()

    for (const es of effectors.values()) {
      // Under doctrine, kinetic and DE fire moves to the assignment pass
      // below. Jammers stay here: a jam dwell is illumination, not a round,
      // so shoot-look-shoot and magazine preservation do not apply to it.
      if (doctrine.enabled && es.spec.effectorType !== 'jammer') continue
      if (t + EPS < es.nextReadyS) continue
      if (es.rounds != null && es.rounds <= 0) continue
      const tEffect = t + es.engageTimeS
      const softShot = !isHardKill(es.spec.effectorType)

      // The in-range intervals are member-union geometry, so ship
      // eligibility re-verifies the same min/max/sector test per ship.
      const inEnvelope = (p: Vec2) =>
        dist(es.entity.pos, p) >= es.spec.minRangeM &&
        pointInSector(es.entity.pos, es.entity.headingDeg, es.spec.sectorDeg ?? 360, es.spec.maxRangeM, p)
      const isJammer = es.spec.effectorType === 'jammer'
      // Jam physics (band coverage, alignment, power out) decide whether a
      // jammer can affect this ship at all; a ship the physics cannot reach
      // is never a jam candidate, so the dwell is not wasted on it.
      const jamFactor = (uasSpec: UasSpec | undefined, p: Vec2): number =>
        assessJam(es.spec, es.entity.pos, es.entity.headingDeg, uasSpec, p).factor

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
        if (ts.gateS == null || !ts.path) continue
        const intervals = ts.windows.get(es.entity.id)
        if (!intervals) continue
        // The cue reaches this shooter routeLatencyS after the track became
        // engageable. Charging it from the gate (not from T0) keeps the delay
        // real when the ROE gate is later than the latency.
        if (t + EPS < ts.gateS + (ts.routeLatencyS.get(es.entity.id) ?? 0)) continue
        const contains = (x: number) => intervals.some(([s0, s1]) => x >= s0 - EPS && x <= s1 + EPS)
        if (!contains(t) || !contains(tEffect)) continue
        const continueJam = softShot && ts.jamBehavior === 'continue'

        // Geometry is evaluated where the effect lands, not where it is fired.
        const { members } = geomAt(tickGeom, ts, tEffect)
        // Prefer the threat closing soonest. Arrival when it has one, else
        // closest approach, which is all the geometry a fly-by offers.
        const arrivalS = ts.a.arrivalS ?? ts.a.cpaS ?? Number.POSITIVE_INFINITY

        for (let i = 0; i < ts.ships.length; i++) {
          const p = members[Math.min(i, members.length - 1)]
          if (!inEnvelope(p)) continue
          if (isJammer && jamFactor(ts.uasSpec, p) <= 0) continue
          const s = ts.ships[i]
          const alive = effectiveAlive(s)
          if (alive < SHIP_DEAD_BELOW) continue // expected dead: never targeted
          let weight = alive
          if (continueJam) {
            // Un-jammed probability where the dwell would land, discounted by
            // the jam salvos already in flight. Illumination-bound: a hold on
            // a target that left the beam has lapsed, so the track is open to
            // fresh jamming again.
            const unjammed = (1 - jammedAt(ts, s, tEffect)) * s.jamDiscount
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

      // Jam Pk is link physics (band, alignment, power/range), not aiming:
      // airframe size and jinking do not protect a link, so a jammer takes
      // none of the kinetic penalties and all of the EW ones.
      let pk: number
      if (isJammer) {
        pk = Math.min(1, Math.max(0, es.pk * jamFactor(target.uasSpec, shipPos)))
      } else {
        const falloff = distanceFalloff(dist(es.entity.pos, shipPos), es.spec.maxRangeM)
        const size = target.uasSpec ? SIZE_PENALTY[target.uasSpec.group] : 1
        const evasion = target.uasSpec?.airframe === 'fpv' ? EVASION_PENALTY : 1
        pk = Math.min(1, Math.max(0, es.pk * falloff * size * evasion))
      }

      commitSalvo(es, target, shipIdx, pk, t, continueJam)
    }

    // DOCTRINE ASSIGNMENT PASS (kinetic and DE only). Doctrinal sequence:
    // the gate in sim.ts already required a stable fire-control track,
    // hostile ID, and the declaration dwell. Here the fire distribution is
    // shoot-look-shoot: a ship with a kill salvo in flight, or inside its
    // post-effect BDA dwell (ShipState.holdUntilS), draws no fire from
    // anyone. Among the shooters that CAN engage a ship this tick, the best
    // predicted per-shot Pk takes the shot (ties prefer unlimited magazines,
    // then fuller magazines, then the threat closing soonest). A shooter
    // holds fire until its Pk at effect time reaches pkCommit — the target
    // is closing, so waiting buys accuracy — unless waiting past the
    // deadline would forfeit `opportunities` full engagement cycles before
    // the threat's arrival (CPA for a fly-by, window end when no asset
    // exists), in which case it fires at the deadline regardless.
    if (doctrine.enabled) {
      interface Candidate {
        es: EffectorState
        ts: ThreatState
        shipIdx: number
        pk: number
        arrivalS: number
      }
      const candidates: Candidate[] = []
      for (const es of effectors.values()) {
        if (es.spec.effectorType === 'jammer') continue
        if (t + EPS < es.nextReadyS) continue
        if (es.rounds != null && es.rounds <= 0) continue
        const tEffect = t + es.engageTimeS
        const inEnvelope = (p: Vec2) =>
          dist(es.entity.pos, p) >= es.spec.minRangeM &&
          pointInSector(es.entity.pos, es.entity.headingDeg, es.spec.sectorDeg ?? 360, es.spec.maxRangeM, p)
        for (const ts of threats) {
          if (ts.gateS == null || !ts.path) continue
          const intervals = ts.windows.get(es.entity.id)
          if (!intervals) continue
          if (t + EPS < ts.gateS + (ts.routeLatencyS.get(es.entity.id) ?? 0)) continue
          const within = intervals.find(
            ([s0, s1]) => t >= s0 - EPS && tEffect >= s0 - EPS && t <= s1 + EPS && tEffect <= s1 + EPS,
          )
          if (!within) continue
          // Latest commit that still leaves the planned re-engagement depth,
          // capped by the last launch whose effect still lands inside this
          // in-range window: a closing window is its own deadline, so a high
          // pkCommit can never hold fire past the final physical shot.
          const refS = ts.a.arrivalS ?? ts.a.cpaS
          const windowDeadlineS = within[1] - es.engageTimeS
          const deadlineS =
            refS != null
              ? Math.min(
                  refS - doctrine.opportunities * (es.engageTimeS + doctrine.bdaS),
                  windowDeadlineS,
                )
              : windowDeadlineS
          const { members } = geomAt(tickGeom, ts, tEffect)
          const arrivalS = ts.a.arrivalS ?? ts.a.cpaS ?? Number.POSITIVE_INFINITY
          for (let i = 0; i < ts.ships.length; i++) {
            const ship = ts.ships[i]
            // Shoot-look-shoot: in-flight salvo or BDA dwell locks the ship.
            if (t + EPS < ship.holdUntilS) continue
            if (effectiveAlive(ship) < SHIP_DEAD_BELOW) continue
            const p = members[Math.min(i, members.length - 1)]
            if (!inEnvelope(p)) continue
            const falloff = distanceFalloff(dist(es.entity.pos, p), es.spec.maxRangeM)
            const size = ts.uasSpec ? SIZE_PENALTY[ts.uasSpec.group] : 1
            const evasion = ts.uasSpec?.airframe === 'fpv' ? EVASION_PENALTY : 1
            const pk = Math.min(1, Math.max(0, es.pk * falloff * size * evasion))
            if (pk <= 0) continue
            // Hold fire below commit Pk while time still allows.
            if (pk < doctrine.pkCommit - EPS && t + EPS < deadlineS) continue
            candidates.push({ es, ts, shipIdx: i, pk, arrivalS })
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
        commitSalvo(c.es, c.ts, c.shipIdx, c.pk, t, false)
        ship.holdUntilS = t + c.es.engageTimeS + doctrine.bdaS
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
