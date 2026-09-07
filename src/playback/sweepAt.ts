import type { Scenario } from '../model/types'
import { engineKeyOf } from '../model/scenario'
import type { DetectionHit } from './detection'
import { detectionsAt } from './detection'
import type { EffectorLiveState, TrackFileState, TrackTimeline } from './trackState'
import { effectorStatesAt, trackStatesAt } from './trackState'

/**
 * Everything the board reads at one published instant: the sensor sweep, the
 * track lifecycle and the effector glyph state. One computation per
 * (scenario, timeline, tS) is shared by the live scene, the static rings, the
 * track card and the threat pane. Pure and store-free, like engagementPicture.
 */
export interface Sweep {
  /** Sensor sweep at tS, keyed by UAS id. Only a held threat has an entry. */
  hits: Map<string, DetectionHit[]>
  /** Track lifecycle at tS, keyed by UAS id. Only a threat with a path has an entry. */
  states: Map<string, TrackFileState>
  /** Effector glyph treatment at tS, keyed by effector id. Absent means idle. */
  effectorStates: Map<string, EffectorLiveState>
  /** Sensors holding at least one track at tS. */
  activeSensorIds: Set<string>
}

interface Slot {
  scenario: Scenario
  timeline: TrackTimeline
  tS: number
  sweep: Sweep
}

/**
 * The live scene and the track card read simTimeS, the threat pane reads its
 * own 2 Hz cursor, and a scrub can land on a time a slot still holds. A few
 * slots keep those readers from evicting each other.
 */
const SLOT_COUNT = 4
const slots: Slot[] = []

/**
 * The sweep at tS, computed once per publication and shared by every reader.
 * Slots key on the engine identity (`engineKeyOf`), so a presentation stamp
 * on the Play click does not evict the sweep the canvas just drew.
 */
export function sweepAt(input: Scenario, timeline: TrackTimeline, tS: number): Sweep {
  const scenario = engineKeyOf(input)
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]
    if (slot.scenario !== scenario || slot.timeline !== timeline || slot.tS !== tS) continue
    if (i > 0) {
      slots.splice(i, 1)
      slots.unshift(slot)
    }
    return slot.sweep
  }
  // The newest result for the same inputs lends its identities to every value
  // that did not change, so a memo keyed on a state object or the sensor set
  // holds across publications where nothing happened.
  const prev = slots.find((slot) => slot.scenario === scenario && slot.timeline === timeline)?.sweep
  const hits = detectionsAt(scenario, tS)
  const sweep: Sweep = {
    hits,
    states: stableStates(trackStatesAt(timeline, tS), prev?.states),
    effectorStates: effectorStatesAt(timeline, tS),
    activeSensorIds: stableSet(activeSensors(hits), prev?.activeSensorIds),
  }
  slots.unshift({ scenario, timeline, tS, sweep })
  if (slots.length > SLOT_COUNT) slots.pop()
  return sweep
}

function activeSensors(hits: Map<string, DetectionHit[]>): Set<string> {
  const out = new Set<string>()
  for (const list of hits.values()) for (const hit of list) out.add(hit.sensorId)
  return out
}

function stableSet(next: Set<string>, prev: Set<string> | undefined): Set<string> {
  if (!prev || prev.size !== next.size) return next
  for (const id of next) if (!prev.has(id)) return next
  return prev
}

function sameStrings(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

/** Field-equal track states keep the previous object; an unchanged map keeps the previous map. */
function stableStates(
  next: Map<string, TrackFileState>,
  prev: Map<string, TrackFileState> | undefined,
): Map<string, TrackFileState> {
  if (!prev) return next
  let reused = 0
  for (const [id, state] of next) {
    const old = prev.get(id)
    if (!old) continue
    let same = true
    for (const key of Object.keys(state) as Array<keyof TrackFileState>) {
      if (key === 'holdingSensorIds') {
        if (!sameStrings(state.holdingSensorIds, old.holdingSensorIds)) {
          same = false
          break
        }
        continue
      }
      if (state[key] !== old[key]) {
        same = false
        break
      }
    }
    if (!same) continue
    next.set(id, old)
    reused++
  }
  return reused === next.size && prev.size === next.size ? prev : next
}
