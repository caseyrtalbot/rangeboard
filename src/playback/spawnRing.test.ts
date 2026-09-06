import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from '../state/store'
import { emptyScenario } from '../model/seed'
import type { Scenario, Vec2 } from '../model/types'
import { fillScenario } from '../io/persist'
import { assessRunValidity } from '../analysis/runValidity'
import { resolveEngagements } from './attrition'
import { runReplicates } from './mcRun'
import { assessAllThreats } from './sim'
import { spawnInRingViolations } from './detection'

function reset() {
  useStore.getState().replaceScenario(emptyScenario())
}

/** UAS from the library with a straight path spawning at `spawn`. */
function placeThreatAt(modelId: string, spawn: Vec2): string {
  const st = useStore.getState()
  st.addEntityFromModel(modelId, spawn)
  const uasId = useStore.getState().scenario.entities.at(-1)!.id
  st.beginPath(uasId)
  useStore.getState().addDraftPoint({ x: spawn.x + 20000, y: spawn.y })
  useStore.getState().finishPath()
  return uasId
}

function scenario(): Scenario {
  return useStore.getState().scenario
}

describe('spawnInRingViolations', () => {
  beforeEach(reset)

  it('flags a spawn inside a radar detect ring', () => {
    useStore.getState().addEntityFromModel('lib-lstar', { x: 0, y: 0 }) // 10 km omni
    const sensorId = scenario().entities.at(-1)!.id
    const uasId = placeThreatAt('lib-mavic3', { x: 2800, y: 0 })
    expect(spawnInRingViolations(scenario())).toEqual([{ uasId, sensorId }])
  })

  it('a spawn outside the ring is clean', () => {
    useStore.getState().addEntityFromModel('lib-lstar', { x: 0, y: 0 })
    placeThreatAt('lib-mavic3', { x: 12000, y: 0 })
    expect(spawnInRingViolations(scenario())).toEqual([])
  })

  it('a threat without a path is not checked', () => {
    useStore.getState().addEntityFromModel('lib-lstar', { x: 0, y: 0 })
    useStore.getState().addEntityFromModel('lib-mavic3', { x: 2800, y: 0 }) // no path
    expect(spawnInRingViolations(scenario())).toEqual([])
  })

  it('ignores a disabled sensor', () => {
    useStore.getState().addEntityFromModel('lib-lstar', { x: 0, y: 0 })
    const sensorId = scenario().entities.at(-1)!.id
    placeThreatAt('lib-mavic3', { x: 2800, y: 0 })
    useStore.getState().updateEntity(sensorId, { enabled: false })
    expect(spawnInRingViolations(scenario())).toEqual([])
  })

  it('ignores a disabled threat', () => {
    useStore.getState().addEntityFromModel('lib-lstar', { x: 0, y: 0 })
    const uasId = placeThreatAt('lib-mavic3', { x: 2800, y: 0 })
    useStore.getState().updateEntity(uasId, { enabled: false })
    expect(spawnInRingViolations(scenario())).toEqual([])
  })

  it('honors the sector wedge of a panel radar', () => {
    // RPS-42: 8 km, 90 deg face. Heading 0 = north; wedge covers +/- 45 deg.
    useStore.getState().addEntityFromModel('lib-rps42', { x: 0, y: 0 })
    const sensorId = scenario().entities.at(-1)!.id
    // South of the panel (+y): in range but outside the wedge.
    placeThreatAt('lib-mavic3', { x: 0, y: 4000 })
    expect(spawnInRingViolations(scenario())).toEqual([])
    // North of the panel (-y): inside the wedge.
    const uasId = placeThreatAt('lib-mavic3', { x: 0, y: -4000 })
    expect(spawnInRingViolations(scenario())).toEqual([{ uasId, sensorId }])
  })

  it('an RF sensor never flags an RF-silent threat', () => {
    useStore.getState().addEntityFromModel('lib-rf360', { x: 0, y: 0 }) // 2 km omni RF
    placeThreatAt('lib-fpv-fiber', { x: 1000, y: 0 }) // fiber: no emissions
    expect(spawnInRingViolations(scenario())).toEqual([])
  })

  it('EO/IR alone is no violation; it joins after a cue', () => {
    useStore.getState().addEntityFromModel('lib-hdcmr', { x: 0, y: 0 }) // 3 km EO/IR
    const eoId = scenario().entities.at(-1)!.id
    const uasId = placeThreatAt('lib-mavic3', { x: 1500, y: 0 })
    expect(spawnInRingViolations(scenario())).toEqual([])
    useStore.getState().addEntityFromModel('lib-lstar', { x: 0, y: 0 }) // radar cue
    const radarId = scenario().entities.at(-1)!.id
    const ids = spawnInRingViolations(scenario()).map((v) => v.sensorId)
    expect(ids.sort()).toEqual([eoId, radarId].sort())
    expect(spawnInRingViolations(scenario()).every((v) => v.uasId === uasId)).toBe(true)
  })

  it('a wide-area EO/IR search sensor flags a spawn on its own', () => {
    useStore.getState().addEntityFromModel('lib-wisp', { x: 0, y: 0 }) // surveillance role: no cue needed
    const sensorId = scenario().entities.at(-1)!.id
    const uasId = placeThreatAt('lib-mavic3', { x: 1500, y: 0 })
    expect(spawnInRingViolations(scenario())).toEqual([{ uasId, sensorId }])
  })

  it('an RF sensor never flags a threat outside its bands', () => {
    useStore.getState().addEntityFromModel('lib-rf360', { x: 0, y: 0 })
    const sensor = scenario().entities.at(-1)!
    const uasId = placeThreatAt('lib-fpv7', { x: 1000, y: 0 }) // 2.4 / 5.8 GHz link
    expect(spawnInRingViolations(scenario())).toEqual([{ uasId, sensorId: sensor.id }])
    const model = scenario().library.find((m) => m.id === sensor.specId)!
    useStore.getState().updateModel(model.id, { sensor: { ...model.sensor!, rfBands: ['uhf-433'] } })
    expect(spawnInRingViolations(scenario())).toEqual([])
  })

  it('environment derate changes the verdict', () => {
    useStore.getState().addEntityFromModel('lib-lstar', { x: 0, y: 0 }) // 10 km clear
    placeThreatAt('lib-mavic3', { x: 9500, y: 0 })
    expect(spawnInRingViolations(scenario())).toHaveLength(1)
    // Rain derates radar x0.75 -> 7500 m: outside the derated ring.
    useStore.getState().updateEnvironment({ precipitation: 'rain' })
    expect(spawnInRingViolations(scenario())).toEqual([])
    // Apply off restores spec range and the violation.
    useStore.getState().updateEnvironment({ apply: false })
    expect(spawnInRingViolations(scenario())).toHaveLength(1)
  })
})

describe('spawnInRingViolations on the captured fixture', () => {
  it('flags the 6-ship THR-G1-Q-01 wave spawned inside the radar rings', () => {
    const fixtures = import.meta.glob<string>('./__fixtures__/*.json', {
      eager: true,
      import: 'default',
      query: '?raw',
    })
    const raw = fixtures['./__fixtures__/layered-acoustic-merops.json']
    const s = fillScenario(JSON.parse(raw) as Scenario)
    const violations = spawnInRingViolations(s)
    const uasIds = [...new Set(violations.map((v) => v.uasId))]
    expect(uasIds).toHaveLength(6)
    const names = uasIds.map((id) => s.entities.find((e) => e.id === id)?.name ?? id)
    for (const name of names) expect(name).toContain('THR-G1-Q-01')
  })

  // The firing laydown (Giraffe 1X, KuRFS, FAAD C2, Coyote) with the Mavic 3
  // spawned 18 km north, 3 km beyond the 15 km KuRFS placard. The search problem runs:
  // detection lands well after T0 and the routed chain still fires.
  it('the detection fixture spawns outside every ring and still fires', () => {
    const fixtures = import.meta.glob<string>('./__fixtures__/*.json', {
      eager: true,
      import: 'default',
      query: '?raw',
    })
    const s = fillScenario(JSON.parse(fixtures['./__fixtures__/detection-outside-rings.json']) as Scenario)
    expect(spawnInRingViolations(s)).toEqual([])
    const assessments = assessAllThreats(s)
    expect(assessRunValidity(s, assessments).findings.map((f) => f.id)).not.toContain('spawn-in-ring')
    const [track] = assessments
    expect(track.status).toBe('engageable')
    expect(track.firstDetectS).toBeGreaterThan(100)
    expect(track.arrivalS).toBeGreaterThan(track.firstDetectS!)
    const report = resolveEngagements(s, assessments)
    expect(report.events.length).toBeGreaterThan(0)
    expect(report.threats[0].expectedKills).toBeGreaterThan(0.5)
    const mc = runReplicates({ ...s, runMode: 'monte-carlo', replicates: 30, uncertainty: 'total' })
    expect(mc.firstDetectS.defined.p).toBe(1)
    expect(mc.firstDetectS.mean).toBeGreaterThan(0)
    expect(mc.kills.mean[mc.kills.mean.length - 1]).toBeGreaterThan(0.5)
  })
})
