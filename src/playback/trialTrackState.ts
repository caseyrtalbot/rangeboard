import type { Entity, Vec2 } from '../model/types'
import { entityActive } from '../model/types'
import type { TrialResultView } from '../analysis/trialResult'
import type { EngagementEvent } from './attritionReport'
import { memberPositions, sampleFlightPath } from './tracks'
import { intervalIndexAt } from './intercept'

export interface TrialMemberState {
  uasId: string
  /** Formation ledger shipIdx, never scan drawIndex. */
  memberIdx: number
  outcome: 'active' | 'hard-kill' | 'mission-kill'
  reachedEffectTimeS?: number
  effectSourceIdx?: number
  /** Ledger credit: strictly after defended-boundary arrival. */
  lateEffect: boolean
  position: Vec2
  heading: number
  jamState: { jammed: boolean; saturation?: number } | null
  /** Reached track-file arrival, independent of physical survival. */
  arrivalCredit: boolean
  leakageCredit: boolean
}

export interface TrialTrackState {
  entity: Entity
  members: TrialMemberState[]
  activeCount: number
  hardKillCount: number
  missionKillCount: number
  arrivedCount: number
}

export interface TrialTrackTimeline {
  entity: Entity
  memberCount: number
  stateAtTime: (horizonS: number) => TrialTrackState
}

type Effect = { event: EngagementEvent; index: number; position: Vec2; heading: number }
type JamStep = { timeS: number; value: number }
const cache = new WeakMap<TrialResultView, Map<string, TrialTrackTimeline>>()

function lastAt(steps: JamStep[], t: number): JamStep | undefined {
  let lo = 0
  let hi = steps.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (steps[mid].timeS <= t) lo = mid + 1
    else hi = mid
  }
  return steps[lo - 1]
}

function timelinesOf(view: TrialResultView): Map<string, TrialTrackTimeline> {
  const hit = cache.get(view)
  if (hit) return hit
  const timelines = new Map<string, TrialTrackTimeline>()
  const events = new Map<string, Array<{ event: EngagementEvent; index: number }>>()
  view.attrition.events.forEach((event, index) => {
    const list = events.get(event.uasId) ?? []
    list.push({ event, index })
    events.set(event.uasId, list)
  })
  const decisions = new Map(view.jamDecisions.map(d => [JSON.stringify([d.effectorId, d.uasId, d.tEffectS]), d]))
  const assessments = new Map(view.assessments.map(a => [a.uasId, a]))
  for (const entity of view.scenario.entities) {
    if (entity.kind !== 'uas' || !entityActive(entity)) continue
    const a = assessments.get(entity.id)
    const memberCount = Math.max(1, entity.formation?.count ?? 1)
    const path = view.scenario.paths.find(p => p.entityId === entity.id && p.points.length >= 2)
    const geometryAt = (t: number) => {
      const sample = path
        ? sampleFlightPath(view.scenario, path, t)
        : { pos: entity.pos, headingDeg: entity.headingDeg }
      return { positions: memberPositions(entity, sample.pos, sample.headingDeg), heading: sample.headingDeg }
    }
    const effects = new Map<number, Effect>()
    const jams = Array.from({ length: memberCount }, () => new Map<string, JamStep[]>())
    const jamValues = new Map<string, { interval: number; value: number }>()
    const ordered = (events.get(entity.id) ?? []).sort((x, y) => x.event.tEffectS - y.event.tEffectS || x.index - y.index)
    for (const { event, index } of ordered) {
      const member = event.shipIdx
      if (member < 0 || member >= memberCount) throw new Error('Trial ledger member is outside its formation')
      if (event.killDelta > 0 && !effects.has(member)) {
        const geometry = geometryAt(event.tEffectS)
        effects.set(member, { event, index, position: geometry.positions[member], heading: geometry.heading })
      }
      if (event.channel !== 'jam') continue
      const decision = decisions.get(JSON.stringify([event.effectorId, event.uasId, event.tEffectS]))
      if (!decision) continue
      const intervals = a?.effectorWindows.find(w => w.effectorId === event.effectorId)?.intervals
      const interval = intervalIndexAt(intervals, event.tEffectS)
      const key = JSON.stringify([member, event.effectorId])
      const previous = jamValues.get(key)
      const value = previous?.interval === interval ? Math.max(previous.value, decision.outcome) : decision.outcome
      jamValues.set(key, { interval, value })
      const steps = jams[member].get(event.effectorId) ?? []
      steps.push({ timeS: event.tEffectS, value })
      if (interval >= 0 && intervals) steps.push({ timeS: intervals[interval][1], value: 0 })
      jams[member].set(event.effectorId, steps)
    }
    for (const member of jams) for (const steps of member.values()) steps.sort((x, y) => x.timeS - y.timeS)
    timelines.set(entity.id, {
      entity,
      memberCount,
      stateAtTime(horizonS) {
        const t = Math.min(Number.isNaN(horizonS) ? 0 : Math.max(0, horizonS), view.observedThroughS)
        const geometry = geometryAt(t)
        const arrival = a?.arrivalS
        const arrived = arrival != null && arrival <= t
        const members = Array.from({ length: memberCount }, (_, memberIdx): TrialMemberState => {
          const effect = effects.get(memberIdx)
          const reached = effect != null && effect.event.tEffectS <= t
          const hard = reached && !effect.event.softShot
          let jamKnown = false
          let jammed = false
          for (const steps of jams[memberIdx].values()) {
            const step = lastAt(steps, t)
            if (step) {
              jamKnown = true
              jammed ||= step.value === 1
            }
          }
          return {
            uasId: entity.id, memberIdx,
            outcome: reached ? hard ? 'hard-kill' : 'mission-kill' : 'active',
            ...(reached ? { reachedEffectTimeS: effect.event.tEffectS, effectSourceIdx: effect.index } : {}),
            lateEffect: reached && effect.event.lateEffect,
            position: hard ? effect.position : geometry.positions[memberIdx],
            heading: hard ? effect.heading : geometry.heading,
            jamState: jamKnown ? { jammed } : null, arrivalCredit: arrived,
            leakageCredit: view.hasActiveAsset && arrived && (!effect || effect.event.tEffectS > arrival!),
          }
        })
        return {
          entity, members,
          activeCount: members.filter(m => m.outcome === 'active').length,
          hardKillCount: members.filter(m => m.outcome === 'hard-kill').length,
          missionKillCount: members.filter(m => m.outcome === 'mission-kill').length,
          arrivedCount: members.filter(m => m.arrivalCredit).length,
        }
      },
    })
  }
  cache.set(view, timelines)
  return timelines
}

/** A formation needs an identity when the captured trial contains multiple entities. */
export function trialTrackTimelineOf(view: TrialResultView, uasId?: string): TrialTrackTimeline {
  const timelines = timelinesOf(view)
  const timeline = uasId == null && timelines.size === 1 ? timelines.values().next().value : timelines.get(uasId ?? '')
  if (!timeline) throw new Error('Select a trial threat identity for its member timeline')
  return timeline
}

export function trialMemberStatesAt(view: TrialResultView, uasId: string, horizonS: number): TrialMemberState[] {
  return timelinesOf(view).get(uasId)?.stateAtTime(horizonS).members ?? []
}

export function trialTrackStatesAt(view: TrialResultView, horizonS: number): TrialTrackState[] {
  return [...timelinesOf(view).values()].map(timeline => timeline.stateAtTime(horizonS))
}
