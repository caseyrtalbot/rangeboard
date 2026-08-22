import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from '../state/store'
import { emptyScenario } from '../model/seed'
import type { Roe, Scenario, SensorRole } from '../model/types'
import { newId } from '../model/types'
import { assessThreat, detectionsAt, memberPositions } from './sim'

function reset() {
  useStore.getState().replaceScenario(emptyScenario())
}

/** Radar + C2 + interceptor at the origin, connected sensor -> c2 -> effector. */
function placeKillChain() {
  const st = useStore.getState()
  st.addEntityFromModel('lib-lstar', { x: 0, y: 0 })
  st.addEntityFromModel('lib-faadc2', { x: 500, y: 0 })
  st.addEntityFromModel('lib-coyote', { x: 1000, y: 0 })
  const [radar, c2, eff] = useStore.getState().scenario.entities
  st.beginConnect(radar.id)
  st.completeConnect(c2.id)
  useStore.getState().beginConnect(c2.id)
  useStore.getState().completeConnect(eff.id)
  return { radarId: radar.id, c2Id: c2.id, effId: eff.id }
}

/** One quad flying west-to-east straight over the origin. */
function placeThreat() {
  const st = useStore.getState()
  st.addEntityFromModel('lib-mavic3', { x: -60000, y: 0 })
  const uasId = useStore.getState().scenario.entities.at(-1)!.id
  st.beginPath(uasId)
  useStore.getState().addDraftPoint({ x: 60000, y: 0 })
  useStore.getState().finishPath()
  return uasId
}

describe('enabled flag in analysis', () => {
  beforeEach(reset)

  it('an intact chain makes the threat engageable', () => {
    placeKillChain()
    const uasId = placeThreat()
    const a = assessThreat(useStore.getState().scenario, uasId)
    expect(a.status).toBe('engageable')
  })

  it('a disabled sensor stops detection', () => {
    const { radarId } = placeKillChain()
    const uasId = placeThreat()
    useStore.getState().updateEntity(radarId, { enabled: false })
    const a = assessThreat(useStore.getState().scenario, uasId)
    expect(a.status).toBe('never-detected')
    expect(detectionsAt(useStore.getState().scenario, 1000).get(uasId)).toBeUndefined()
  })

  it('a disabled C2 node breaks the kill chain', () => {
    const { c2Id } = placeKillChain()
    const uasId = placeThreat()
    useStore.getState().updateEntity(c2Id, { enabled: false })
    const a = assessThreat(useStore.getState().scenario, uasId)
    expect(a.status).toBe('no-kill-chain')
  })

  it('a disabled effector removes the engagement window', () => {
    const { effId } = placeKillChain()
    const uasId = placeThreat()
    useStore.getState().updateEntity(effId, { enabled: false })
    const a = assessThreat(useStore.getState().scenario, uasId)
    expect(a.status).toBe('detect-only')
  })
})

describe('formation detection', () => {
  beforeEach(reset)

  it('detects a formation when any member enters coverage', () => {
    const st = useStore.getState()
    st.addEntityFromModel('lib-acoustic-picket', { x: 0, y: 0 }) // 4000 m omni
    st.addEntityFromModel('lib-mavic3', { x: 5000, y: 0 }) // lead outside coverage
    const [, uas] = useStore.getState().scenario.entities
    // Heading north, line abreast: one wingman sits 1200 m east (outside) and
    // the other 1200 m west, at x = 3800, inside the 4000 m ring.
    useStore.getState().updateEntity(uas.id, {
      headingDeg: 0,
      formation: { count: 3, shape: 'line', spacingM: 1200 },
    })
    const hits = detectionsAt(useStore.getState().scenario, 0)
    expect(hits.get(uas.id)).toHaveLength(1)
  })

  it('memberPositions returns the lead alone without a formation', () => {
    useStore.getState().addEntityFromModel('lib-mavic3', { x: 100, y: 200 })
    const uas = useStore.getState().scenario.entities.at(-1)!
    expect(memberPositions(uas, uas.pos, 0)).toEqual([{ x: 100, y: 200 }])
  })
})

describe('emissions and detection technology rules', () => {
  beforeEach(reset)

  it('an RF sensor never sees a fiber-guided threat', () => {
    const st = useStore.getState()
    st.addEntityFromModel('lib-rf360', { x: 0, y: 0 }) // 2000 m omni RF
    st.addEntityFromModel('lib-fpv-fiber', { x: 1000, y: 0 })
    const uasId = useStore.getState().scenario.entities.at(-1)!.id
    expect(detectionsAt(useStore.getState().scenario, 0).get(uasId)).toBeUndefined()
  })

  it('the same RF sensor sees an RF-linked threat', () => {
    const st = useStore.getState()
    st.addEntityFromModel('lib-rf360', { x: 0, y: 0 })
    st.addEntityFromModel('lib-mavic3', { x: 1000, y: 0 }) // mixed nav: emits
    const uasId = useStore.getState().scenario.entities.at(-1)!.id
    expect(detectionsAt(useStore.getState().scenario, 0).get(uasId)).toHaveLength(1)
  })

  it('EO/IR alone never detects; it holds after a cue from another technology', () => {
    const st = useStore.getState()
    st.addEntityFromModel('lib-hdcmr', { x: 0, y: 0 }) // 3000 m EO/IR
    st.addEntityFromModel('lib-mavic3', { x: 1500, y: 0 })
    const uasId = useStore.getState().scenario.entities.at(-1)!.id
    expect(detectionsAt(useStore.getState().scenario, 0).get(uasId)).toBeUndefined()
    useStore.getState().addEntityFromModel('lib-lstar', { x: 0, y: 0 }) // radar cue
    const hits = detectionsAt(useStore.getState().scenario, 0).get(uasId)!
    expect(hits.map((h) => h.sensorType).sort()).toEqual(['eo-ir', 'radar'])
  })
})

describe('environment effects on sensors', () => {
  beforeEach(reset)

  it('rain shrinks radar detection range', () => {
    const st = useStore.getState()
    st.addEntityFromModel('lib-lstar', { x: 0, y: 0 }) // 10 km radar
    st.addEntityFromModel('lib-mavic3', { x: 9500, y: 0 })
    const uasId = useStore.getState().scenario.entities.at(-1)!.id
    expect(detectionsAt(useStore.getState().scenario, 0).get(uasId)).toHaveLength(1)
    useStore.getState().updateEnvironment({ precipitation: 'rain' }) // x0.75 -> 7500 m
    expect(detectionsAt(useStore.getState().scenario, 0).get(uasId)).toBeUndefined()
  })

  it('radar sees a Group 3 airframe farther than a Group 1 at the same spot', () => {
    const st = useStore.getState()
    st.addEntityFromModel('lib-lstar', { x: 0, y: 0 }) // 10 km base
    st.addEntityFromModel('lib-mavic3', { x: 14000, y: 0 }) // G1
    st.addEntityFromModel('lib-shahed136', { x: -14000, y: 0 }) // G3: x1.6 -> 16 km
    const [, g1, g3] = useStore.getState().scenario.entities
    const hits = detectionsAt(useStore.getState().scenario, 0)
    expect(hits.get(g1.id)).toBeUndefined()
    expect(hits.get(g3.id)).toHaveLength(1)
  })

  it('when apply is off, no environment effect remains', () => {
    const st = useStore.getState()
    st.addEntityFromModel('lib-lstar', { x: 0, y: 0 })
    st.addEntityFromModel('lib-mavic3', { x: 9500, y: 0 })
    const uasId = useStore.getState().scenario.entities.at(-1)!.id
    useStore.getState().updateEnvironment({ precipitation: 'rain', apply: false })
    expect(detectionsAt(useStore.getState().scenario, 0).get(uasId)).toHaveLength(1)
  })
})

describe('ROE gates and jammer limits', () => {
  beforeEach(reset)

  it('default ROE is tight: the track goes hostile and gates the window there', () => {
    placeKillChain()
    const uasId = placeThreat()
    expect(useStore.getState().scenario.roe).toBe('tight')
    const a = assessThreat(useStore.getState().scenario, uasId)
    expect(a.classificationAtS.hostileAtS).not.toBeNull()
    expect(a.engageGateS).toBe(a.classificationAtS.hostileAtS)
    expect(a.status).toBe('engageable')
  })

  it('weapons hold removes every engagement window', () => {
    placeKillChain()
    const uasId = placeThreat()
    useStore.getState().patchScenario({ roe: 'hold' })
    const a = assessThreat(useStore.getState().scenario, uasId)
    expect(a.status).toBe('weapons-hold')
    expect(a.windowS).toBeNull()
    expect(a.engageGateS).toBeNull()
  })

  it('weapons free gates the window at first detection', () => {
    placeKillChain()
    const uasId = placeThreat()
    useStore.getState().patchScenario({ roe: 'free' })
    const a = assessThreat(useStore.getState().scenario, uasId)
    expect(a.engageGateS).toBe(a.firstDetectS)
    expect(a.status).toBe('engageable')
  })

  it('a second detection technology still sets firstConfirmS', () => {
    placeKillChain()
    const uasId = placeThreat()
    useStore.getState().addEntityFromModel('lib-rf360', { x: 0, y: 0 }) // omni RF, 2 km
    const a = assessThreat(useStore.getState().scenario, uasId)
    expect(a.firstConfirmS).not.toBeNull()
  })

  it('a jammer is no effector against a fiber-guided threat', () => {
    const st = useStore.getState()
    st.addEntityFromModel('lib-lstar', { x: 0, y: 0 })
    st.addEntityFromModel('lib-modi', { x: 0, y: 0 }) // jammer, 2 km
    const [radar, jam] = useStore.getState().scenario.entities
    useStore.getState().beginConnect(radar.id)
    useStore.getState().completeConnect(jam.id)
    st.addEntityFromModel('lib-fpv-fiber', { x: -30000, y: 0 })
    const uasId = useStore.getState().scenario.entities.at(-1)!.id
    useStore.getState().beginPath(uasId)
    useStore.getState().addDraftPoint({ x: 30000, y: 0 })
    useStore.getState().finishPath()
    const a = assessThreat(useStore.getState().scenario, uasId)
    expect(a.status).toBe('detect-only')
    // The same jammer works against a GNSS-guided threat.
    useStore.getState().addEntityFromModel('lib-mugin5', { x: -30000, y: 0 })
    const gpsId = useStore.getState().scenario.entities.at(-1)!.id
    useStore.getState().beginPath(gpsId)
    useStore.getState().addDraftPoint({ x: 30000, y: 0 })
    useStore.getState().finishPath()
    expect(assessThreat(useStore.getState().scenario, gpsId).status).toBe('engageable')
  })
})

describe('swarm track resolution', () => {
  beforeEach(reset)

  it('flags a formation no detecting sensor can split', () => {
    const st = useStore.getState()
    st.addEntityFromModel('lib-acoustic-picket', { x: 0, y: 0 }) // resolution 500 m
    st.addEntityFromModel('lib-fpv7', { x: -20000, y: 0 })
    const uasId = useStore.getState().scenario.entities.at(-1)!.id
    useStore.getState().updateEntity(uasId, {
      formation: { count: 5, shape: 'wedge', spacingM: 100 },
    })
    useStore.getState().beginPath(uasId)
    useStore.getState().addDraftPoint({ x: 20000, y: 0 })
    useStore.getState().finishPath()
    expect(assessThreat(useStore.getState().scenario, uasId).swarmMerged).toBe(true)
    // Wider spacing than the sensor resolution splits the tracks.
    useStore.getState().updateEntity(uasId, {
      formation: { count: 5, shape: 'wedge', spacingM: 600 },
    })
    expect(assessThreat(useStore.getState().scenario, uasId).swarmMerged).toBe(false)
  })
})

/**
 * Hand-built scenario on the x axis: one omni radar, an optional effector
 * (gun, min range 0, engage time 0), and one UAS flying pathFromX -> pathToX
 * at speedMps with no start delay. All positions sit on y = 0.
 */
function ladderScenario(o: {
  speedMps: number
  routeIntent?: string
  sensor: { x: number; detectRangeM: number; classifyRangeM?: number | null; role?: SensorRole }
  effector?: { x: number; maxRangeM: number }
  /** Connect sensor -> effector. Default true. */
  connect?: boolean
  pathFromX: number
  pathToX: number
  roe?: Roe
}): { scenario: Scenario; uasId: string } {
  const s = emptyScenario()
  if (o.roe) s.roe = o.roe
  const uasModelId = newId('m-uas')
  const sensorModelId = newId('m-sen')
  s.library.push(
    {
      id: uasModelId,
      name: 'Test UAS',
      kind: 'uas',
      description: '',
      color: '#f00',
      builtin: false,
      uas: {
        group: 1,
        airframe: 'quad',
        cruiseSpeedMps: o.speedMps,
        maxSpeedMps: o.speedMps,
        enduranceMin: 60,
        altBandFt: [0, 400],
        navMode: 'gps',
        emissionsNote: '',
      },
      threatProfile: o.routeIntent
        ? {
            designator: 'TST-1',
            routeIntent: o.routeIntent,
            altitudeFt: 400,
            speedMps: o.speedMps,
            count: 1,
          }
        : undefined,
    },
    {
      id: sensorModelId,
      name: 'Test radar',
      kind: 'sensor',
      description: '',
      color: '#0f0',
      builtin: false,
      sensor: {
        sensorType: 'radar',
        role: o.sensor.role ?? 'early-warning',
        detectRangeM: o.sensor.detectRangeM,
        classifyRangeM: o.sensor.classifyRangeM ?? null,
        sectorDeg: 360,
      },
    },
  )
  const uasId = newId('e-uas')
  const sensorId = newId('e-sen')
  s.entities.push(
    {
      id: sensorId,
      name: 'S1',
      kind: 'sensor',
      specId: sensorModelId,
      pos: { x: o.sensor.x, y: 0 },
      headingDeg: 0,
      color: null,
      notes: '',
    },
    {
      id: uasId,
      name: 'T1',
      kind: 'uas',
      specId: uasModelId,
      pos: { x: o.pathFromX, y: 0 },
      headingDeg: 90,
      color: null,
      notes: '',
    },
  )
  if (o.effector) {
    const effModelId = newId('m-eff')
    s.library.push({
      id: effModelId,
      name: 'Test gun',
      kind: 'effector',
      description: '',
      color: '#00f',
      builtin: false,
      effector: {
        effectorType: 'gun',
        minRangeM: 0,
        maxRangeM: o.effector.maxRangeM,
        engageTimeS: 0,
      },
    })
    const effId = newId('e-eff')
    s.entities.push({
      id: effId,
      name: 'E1',
      kind: 'effector',
      specId: effModelId,
      pos: { x: o.effector.x, y: 0 },
      headingDeg: 0,
      color: null,
      notes: '',
    })
    if (o.connect !== false) {
      s.connections.push({ id: newId('c'), fromId: sensorId, toId: effId, label: '' })
    }
  }
  s.paths.push({
    id: newId('p'),
    entityId: uasId,
    points: [
      { x: o.pathFromX, y: 0 },
      { x: o.pathToX, y: 0 },
    ],
    speedMps: o.speedMps,
    startDelayS: 0,
  })
  return { scenario: s, uasId }
}

/** The sweep samples at 0.5 s; a boundary crossing lands within one step. */
function near(v: number | null, expectedS: number) {
  expect(v).not.toBeNull()
  expect(v!).toBeGreaterThanOrEqual(expectedS - 1e-6)
  expect(v!).toBeLessThanOrEqual(expectedS + 0.5)
}

describe('classification ladder promotions', () => {
  it('first detection promotes pending to unknown; slow benign traffic stays there', () => {
    // 10 m/s = 36 kph, no attack intent, no effector anywhere.
    const { scenario, uasId } = ladderScenario({
      speedMps: 10,
      sensor: { x: 0, detectRangeM: 1000 },
      pathFromX: -2000,
      pathToX: 0,
    })
    const a = assessThreat(scenario, uasId)
    expect(a.firstDetectS).not.toBeNull()
    expect(a.classificationAtS.unknownAtS).toBe(a.firstDetectS)
    expect(a.classificationAtS.suspectedAtS).toBeNull()
    expect(a.classificationAtS.hostileAtS).toBeNull()
  })

  it('estimated speed above 50 kph promotes unknown to suspected at once', () => {
    // 20 m/s = 72 kph.
    const { scenario, uasId } = ladderScenario({
      speedMps: 20,
      sensor: { x: 0, detectRangeM: 1000 },
      pathFromX: -2000,
      pathToX: 0,
    })
    const a = assessThreat(scenario, uasId)
    expect(a.classificationAtS.suspectedAtS).toBe(a.classificationAtS.unknownAtS)
    expect(a.classificationAtS.hostileAtS).toBeNull()
  })

  it('an attack route intent promotes a slow track to suspected', () => {
    const { scenario, uasId } = ladderScenario({
      speedMps: 10,
      routeIntent: 'One-way attack along the river corridor',
      sensor: { x: 0, detectRangeM: 1000 },
      pathFromX: -2000,
      pathToX: 0,
    })
    const a = assessThreat(scenario, uasId)
    expect(a.classificationAtS.suspectedAtS).toBe(a.classificationAtS.unknownAtS)
    expect(a.classificationAtS.hostileAtS).toBeNull()
  })

  it('proximity ladder: suspected inside 1.5x and hostile inside a connected effector range', () => {
    // Radar holds the whole path; the gun (1000 m) sits at the origin.
    // 1500 m boundary at t = 150 s, 1000 m boundary at t = 200 s.
    const { scenario, uasId } = ladderScenario({
      speedMps: 10,
      sensor: { x: 0, detectRangeM: 5000 },
      effector: { x: 0, maxRangeM: 1000 },
      pathFromX: -3000,
      pathToX: 0,
    })
    const a = assessThreat(scenario, uasId)
    expect(a.classificationAtS.unknownAtS).toBe(0)
    near(a.classificationAtS.suspectedAtS, 150)
    near(a.classificationAtS.hostileAtS, 200)
  })

  it('an unconnected effector drives no proximity promotions', () => {
    const { scenario, uasId } = ladderScenario({
      speedMps: 10,
      sensor: { x: 0, detectRangeM: 5000 },
      effector: { x: 0, maxRangeM: 1000 },
      connect: false,
      pathFromX: -3000,
      pathToX: 0,
    })
    const a = assessThreat(scenario, uasId)
    expect(a.classificationAtS.suspectedAtS).toBeNull()
    expect(a.classificationAtS.hostileAtS).toBeNull()
  })

  it('a classification sensor inside classify range promotes suspected to hostile', () => {
    // Fast threat is suspected at first detection; classify range 2000 m is
    // crossed at t = 100 s. No effector in the scenario at all.
    const { scenario, uasId } = ladderScenario({
      speedMps: 20,
      sensor: { x: 0, detectRangeM: 4000, classifyRangeM: 2000, role: 'classification' },
      pathFromX: -4000,
      pathToX: 0,
    })
    const a = assessThreat(scenario, uasId)
    near(a.classificationAtS.hostileAtS, 100)
  })

  it('the same classified hit from an early-warning sensor does not go hostile', () => {
    const { scenario, uasId } = ladderScenario({
      speedMps: 20,
      sensor: { x: 0, detectRangeM: 4000, classifyRangeM: 2000, role: 'early-warning' },
      pathFromX: -4000,
      pathToX: 0,
    })
    const a = assessThreat(scenario, uasId)
    expect(a.classificationAtS.suspectedAtS).not.toBeNull()
    expect(a.classificationAtS.hostileAtS).toBeNull()
  })
})

describe('ROE window gating on a track that never goes hostile', () => {
  // The radar only covers the early path (x in [-3500, -2500], t in [50, 150]);
  // the gun sits downstream at the origin. Promotions need concurrent
  // detection, so the slow benign track never passes unknown.
  const laydown = {
    speedMps: 10,
    sensor: { x: -3000, detectRangeM: 500 },
    effector: { x: 0, maxRangeM: 1000 },
    pathFromX: -4000,
    pathToX: 0,
  }

  it('tight: no hostile classification means no window', () => {
    const { scenario, uasId } = ladderScenario(laydown)
    const a = assessThreat(scenario, uasId)
    expect(a.classificationAtS.hostileAtS).toBeNull()
    expect(a.status).toBe('not-confirmed')
    expect(a.windowS).toBeNull()
    expect(a.engageGateS).toBeNull()
  })

  it('free: the same laydown engages from first detection', () => {
    const { scenario, uasId } = ladderScenario({ ...laydown, roe: 'free' })
    const a = assessThreat(scenario, uasId)
    expect(a.engageGateS).toBe(a.firstDetectS)
    expect(a.status).toBe('engageable')
    near(a.windowS![0], 300) // enters the 1000 m gun ring at t = 300 s
  })

  it('hold: analysis only, no windows', () => {
    const { scenario, uasId } = ladderScenario({ ...laydown, roe: 'hold' })
    const a = assessThreat(scenario, uasId)
    expect(a.status).toBe('weapons-hold')
    expect(a.windowS).toBeNull()
    expect(a.engageGateS).toBeNull()
  })
})
