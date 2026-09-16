import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from '../state/store'
import { scenarioDurationS } from '../model/scenario'
import { emptyScenario } from '../model/seed'
import type { FlightPath, Scenario } from '../model/types'
import { buildRaidPlan, effectivePathDelayS, waveIndexFor } from './raid'
import { liveTracks } from './tracks'

function reset() {
  useStore.getState().replaceScenario(emptyScenario())
}

function makePath(entityId: string, startDelayS = 0): FlightPath {
  return {
    id: `pth-${entityId}`,
    entityId,
    points: [
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
    ],
    speedMps: null,
    startDelayS,
  }
}

/** One UAS with a straight west-to-east path, returns its entity id. */
function placeUasWithPath(): string {
  const st = useStore.getState()
  st.addEntityFromModel('lib-mavic3', { x: -10000, y: 0 })
  const uasId = useStore.getState().scenario.entities.at(-1)!.id
  useStore.getState().beginPath(uasId)
  useStore.getState().addDraftPoint({ x: 10000, y: 0 })
  useStore.getState().finishPath()
  return uasId
}

describe('effective path delay helper', () => {
  it('adds the wave delay to the path delay', () => {
    const s: Scenario = {
      ...emptyScenario(),
      raid: { waves: [{ startDelayS: 45, entityIds: ['e1'] }] },
    }
    expect(effectivePathDelayS(s, makePath('e1', 15))).toBe(60)
    expect(waveIndexFor(s.raid, 'e1')).toBe(0)
  })

  it('an unassigned entity keeps its own path delay', () => {
    const s: Scenario = {
      ...emptyScenario(),
      raid: { waves: [{ startDelayS: 45, entityIds: ['e1'] }] },
    }
    expect(effectivePathDelayS(s, makePath('e2', 15))).toBe(15)
    expect(waveIndexFor(s.raid, 'e2')).toBeNull()
  })

  it('a scenario without a raid field (old save) keeps the path delay', () => {
    const s = emptyScenario()
    delete s.raid
    expect(effectivePathDelayS(s, makePath('e1', 15))).toBe(15)
  })
})

describe('buildRaidPlan', () => {
  it('a stream timing puts one ship per wave at fixed spacing', () => {
    const plan = buildRaidPlan({ shipsPerWave: 1, waveSpacingS: 60 }, ['a', 'b', 'c'])
    expect(plan.waves).toHaveLength(3)
    expect(plan.waves.map((w) => w.startDelayS)).toEqual([0, 60, 120])
    expect(plan.waves.map((w) => w.entityIds)).toEqual([['a'], ['b'], ['c']])
  })

  it('a simultaneous timing launches every wave at T+0', () => {
    const plan = buildRaidPlan({ shipsPerWave: 5, waveSpacingS: 0 }, [
      'a',
      'b',
      'c',
      'd',
      'e',
      'f',
      'g',
    ])
    expect(plan.waves).toHaveLength(2)
    expect(plan.waves.every((w) => w.startDelayS === 0)).toBe(true)
    expect(plan.waves[0].entityIds).toHaveLength(5)
    expect(plan.waves[1].entityIds).toHaveLength(2)
  })

  it('clamps a fractional or zero shipsPerWave to whole waves of at least one ship', () => {
    const plan = buildRaidPlan({ shipsPerWave: 0, waveSpacingS: 30 }, ['a', 'b'])
    expect(plan.waves).toHaveLength(2)
    expect(plan.waves.map((w) => w.startDelayS)).toEqual([0, 30])
  })
})

describe('store wave actions', () => {
  beforeEach(reset)

  it('assignToWave creates the wave and moves an entity between waves', () => {
    const id = placeUasWithPath()
    useStore.getState().assignToWave(id, 0)
    let raid = useStore.getState().scenario.raid!
    expect(raid.waves[0].entityIds).toEqual([id])

    // A new follow-on wave staggers 60 s behind the previous one.
    useStore.getState().assignToWave(id, 1)
    raid = useStore.getState().scenario.raid!
    expect(raid.waves[0].entityIds).toEqual([])
    expect(raid.waves[1].entityIds).toEqual([id])
    expect(raid.waves[1].startDelayS).toBe(60)

    // Null unassigns without deleting waves.
    useStore.getState().assignToWave(id, null)
    raid = useStore.getState().scenario.raid!
    expect(raid.waves).toHaveLength(2)
    expect(raid.waves.every((w) => w.entityIds.length === 0)).toBe(true)
  })

  it('setWaveDelay updates one wave and clamps at zero', () => {
    const id = placeUasWithPath()
    useStore.getState().assignToWave(id, 0)
    useStore.getState().setWaveDelay(0, 45)
    expect(useStore.getState().scenario.raid!.waves[0].startDelayS).toBe(45)
    useStore.getState().setWaveDelay(0, -10)
    expect(useStore.getState().scenario.raid!.waves[0].startDelayS).toBe(0)
    // Out-of-range index is a no-op.
    useStore.getState().setWaveDelay(5, 99)
    expect(useStore.getState().scenario.raid!.waves).toHaveLength(1)
  })

  it('a wave with three ships launches together', () => {
    const ids = [placeUasWithPath(), placeUasWithPath(), placeUasWithPath()]
    for (const id of ids) useStore.getState().assignToWave(id, 0)
    useStore.getState().setWaveDelay(0, 30)
    const s = useStore.getState().scenario
    const before = liveTracks(s, 10)
    expect(ids.map((id) => before.get(id)!.flying)).toEqual([false, false, false])
    const after = liveTracks(s, 31)
    expect(ids.map((id) => after.get(id)!.flying)).toEqual([true, true, true])
  })

  it('waves stagger launches across the timeline', () => {
    const a = placeUasWithPath()
    const b = placeUasWithPath()
    useStore.getState().assignToWave(a, 0)
    useStore.getState().assignToWave(b, 1) // auto delay 60
    const s = useStore.getState().scenario
    const mid = liveTracks(s, 30)
    expect(mid.get(a)!.flying).toBe(true)
    expect(mid.get(b)!.flying).toBe(false)
    const late = liveTracks(s, 61)
    expect(late.get(b)!.flying).toBe(true)
  })

  it('removing an entity cleans its wave reference', () => {
    const id = placeUasWithPath()
    useStore.getState().assignToWave(id, 0)
    useStore.getState().select({ entityIds: [id] })
    useStore.getState().deleteSelection()
    const raid = useStore.getState().scenario.raid!
    expect(raid.waves.every((w) => !w.entityIds.includes(id))).toBe(true)
  })

  it('scenario duration includes the wave delay', () => {
    const id = placeUasWithPath()
    const base = scenarioDurationS(useStore.getState().scenario)
    useStore.getState().assignToWave(id, 0)
    useStore.getState().setWaveDelay(0, 100)
    expect(scenarioDurationS(useStore.getState().scenario)).toBe(base + 100)
  })
})
