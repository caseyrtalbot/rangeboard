import { beforeEach, describe, expect, it } from 'vitest'
import { engagementPicture } from '../analysis/impact'
import { emptyScenario } from '../model/seed'
import type { Scenario } from '../model/types'
import { useStore } from '../state/store'
import { sweepAt } from './sweepAt'
import { trackTimelineOf } from './trackState'

/**
 * One 5 km radar at the origin and one 12 m/s threat flying at it from 8 km
 * north: outside the ring at T0, held from about T+250 s.
 */
function seeded(): Scenario {
  const store = useStore.getState()
  store.replaceScenario(emptyScenario())
  store.addEntityFromModel('lib-rps42', { x: 0, y: 0 })
  store.addEntityFromModel('lib-mavic3', { x: 0, y: -8000 })
  const threat = useStore.getState().scenario.entities.find((entity) => entity.kind === 'uas')!
  useStore.getState().beginPath(threat.id)
  useStore.getState().addDraftPoint({ x: 0, y: -100 })
  useStore.getState().finishPath()
  return useStore.getState().scenario
}

describe('sweepAt', () => {
  beforeEach(() => {
    seeded()
  })

  it('returns one object per (scenario, timeline, tS) and a fresh one per scenario', () => {
    const scenario = useStore.getState().scenario
    const { assessments, report } = engagementPicture(scenario)
    const timeline = trackTimelineOf(scenario, assessments, report)
    const a = sweepAt(scenario, timeline, 10)
    expect(sweepAt(scenario, timeline, 10)).toBe(a)
    expect(sweepAt(scenario, timeline, 10.5)).not.toBe(a)
    // Four slots: the live scene, the readout and the pane never evict each other.
    sweepAt(scenario, timeline, 11)
    sweepAt(scenario, timeline, 11.5)
    expect(sweepAt(scenario, timeline, 10)).toBe(a)

    const other = seeded()
    expect(other).not.toBe(scenario)
    const picture = engagementPicture(other)
    const otherTimeline = trackTimelineOf(other, picture.assessments, picture.report)
    expect(sweepAt(other, otherTimeline, 10)).not.toBe(a)
  })

  it('keeps the sensor set and the track state identities while nothing changed', () => {
    const scenario = useStore.getState().scenario
    const { assessments, report } = engagementPicture(scenario)
    const timeline = trackTimelineOf(scenario, assessments, report)
    const uasId = scenario.entities.find((entity) => entity.kind === 'uas')!.id
    const sensorId = scenario.entities.find((entity) => entity.kind === 'sensor')!.id

    // Mid-run: the radar holds the track on both publications, so the set and
    // the state object carry over; the sweep itself is a fresh map (slant moves).
    const t0 = 400
    const a = sweepAt(scenario, timeline, t0)
    const b = sweepAt(scenario, timeline, t0 + 0.1)
    expect(a.activeSensorIds.has(sensorId)).toBe(true)
    expect(b.activeSensorIds).toBe(a.activeSensorIds)
    expect(b.states.get(uasId)).toBe(a.states.get(uasId))
    expect(b.states).toBe(a.states)
    expect(b.hits).not.toBe(a.hits)

    // Before first detection the set is empty and a different object.
    const c = sweepAt(scenario, timeline, 0)
    expect(c.activeSensorIds.size).toBe(0)
    expect(c.activeSensorIds).not.toBe(a.activeSensorIds)
    expect(c.states.get(uasId)).not.toBe(a.states.get(uasId))
  })
})

describe('trackTimelineOf', () => {
  it('caches by scenario identity and rebuilds for a new picture', () => {
    const scenario = seeded()
    const { assessments, report } = engagementPicture(scenario)
    const a = trackTimelineOf(scenario, assessments, report)
    expect(trackTimelineOf(scenario, assessments, report)).toBe(a)
    expect(trackTimelineOf(scenario, [...assessments], report)).not.toBe(a)
    const other = seeded()
    const picture = engagementPicture(other)
    expect(trackTimelineOf(other, picture.assessments, picture.report)).not.toBe(a)
  })
})
