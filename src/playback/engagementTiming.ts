import type { Scenario } from '../model/types'
import type { EngagementEvent } from './attritionReport'

type ReleaseEvent = Pick<EngagementEvent, 'tS' | 'tReleaseS' | 'tEffectS' | 'effectorId'>

/**
 * Resolve physical launch only from recorded timing or the captured scenario.
 * A captured effector spec with an omitted delay resolves to the engine's zero
 * default. A missing effector/spec supplies no delay and must remain unknown.
 * A malformed explicit time is never repaired from another source.
 */
export function engagementReleaseS(
  event: ReleaseEvent,
  capturedScenario?: Scenario,
): number | null {
  let release = event.tReleaseS
  if (release === undefined) {
    const effector = capturedScenario?.entities.find(
      (e) => e.id === event.effectorId && e.kind === 'effector',
    )
    const spec =
      effector && capturedScenario?.library.find((m) => m.id === effector.specId)?.effector
    if (!spec) return null
    const delay = spec.engageTimeS ?? 0
    if (!Number.isFinite(delay) || delay < 0) return null
    release = event.tS + delay
  }
  return Number.isFinite(release) && release >= event.tS && release <= event.tEffectS
    ? release
    : null
}

export function engagementIsKinetic(event: Pick<EngagementEvent, 'channelClass'>): boolean {
  return event.channelClass === 'kinetic'
}
