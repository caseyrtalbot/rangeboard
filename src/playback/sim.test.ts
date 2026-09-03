import { beforeEach, describe, expect, it } from 'vitest'
import { pathSpeed, useStore } from '../state/store'
import { emptyScenario } from '../model/seed'
import type { EntityKind, Roe, Scenario, SensorRole, SpecModel, Vec2 } from '../model/types'
import { newId } from '../model/types'
import type { LinkMedium } from '../model/integration'
import { MEDIUM_LATENCY_S } from '../model/integration'
import { FT_TO_M } from '../analysis/sensorEnv'
import {
  assessThreat,
  DEFAULT_DEFENDED_RADIUS_M,
  detectionsAt,
  memberPositions,
  threatAltitudeFt,
} from './sim'

function reset() {
  useStore.getState().replaceScenario(legacyScenario())
}

/**
 * Radar + C2 + interceptor at the origin, connected sensor -> c2 -> effector.
 * The radar must be KuRFS: completeConnect types the links from the research
 * data, and a typed chain to Coyote needs a fire-control source to close.
 */
function placeKillChain() {
  const st = useStore.getState()
  st.addEntityFromModel('lib-kurfs', { x: 0, y: 0 })
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

describe('altitude and slant range', () => {
  beforeEach(reset)

  /** Custom omni sensor at the origin; returns its entity id. */
  function placeSensor(patch: Partial<NonNullable<SpecModel['sensor']>>): string {
    const st = useStore.getState()
    const modelId = st.addModel('sensor')
    useStore.getState().updateModel(modelId, {
      sensor: {
        sensorType: 'radar',
        role: 'surveillance',
        detectRangeM: 50000,
        classifyRangeM: null,
        sectorDeg: 360,
        rangeBasis: 'planning',
        ...patch,
      },
    })
    useStore.getState().addEntityFromModel(modelId, { x: 0, y: 0 })
    return useStore.getState().scenario.entities.at(-1)!.id
  }

  it('threatAltitudeFt: entity field, else the threat profile, else the band midpoint, else 0', () => {
    const st = useStore.getState()
    st.addEntityFromModel('lib-mohajer6', { x: 0, y: 0 })
    const uas = useStore.getState().scenario.entities.at(-1)!
    const scenario = useStore.getState().scenario
    expect(threatAltitudeFt(scenario, { ...uas, altitudeFt: null })).toBe(14000)
    expect(threatAltitudeFt(scenario, { ...uas, altitudeFt: 500 })).toBe(500)
    const model = scenario.library.find((m) => m.id === uas.specId)!
    const noProfile = { ...scenario, library: [{ ...model, threatProfile: undefined }] }
    expect(threatAltitudeFt(noProfile, { ...uas, altitudeFt: null })).toBe(13000) // [8000, 18000]
    expect(threatAltitudeFt(scenario, { ...uas, specId: null, altitudeFt: null })).toBe(0)
  })

  it('a radar with a 10,000 ft ceiling never sees a Mohajer-6 at 14,000 ft', () => {
    const sensorId = placeSensor({ maxAltitudeFt: 10000 })
    useStore.getState().addEntityFromModel('lib-mohajer6', { x: 5000, y: 0 })
    const uasId = useStore.getState().scenario.entities.at(-1)!.id
    expect(detectionsAt(useStore.getState().scenario, 0).get(uasId)).toBeUndefined()
    const modelId = useStore.getState().scenario.entities.find((e) => e.id === sensorId)!.specId!
    const spec = useStore.getState().scenario.library.find((m) => m.id === modelId)!.sensor!
    useStore.getState().updateModel(modelId, { sensor: { ...spec, maxAltitudeFt: null } })
    const hits = detectionsAt(useStore.getState().scenario, 0).get(uasId)
    expect(hits).toHaveLength(1)
    // Slant from a 4 m phase center to 14,000 ft (4267.2 m) at 5 km ground.
    expect(hits![0].slantM).toBeCloseTo(Math.hypot(5000, 14000 * FT_TO_M - 4), 6)
  })

  it('a radar cannot see a low target beyond its radio horizon; an acoustic sensor can', () => {
    // 4 m mast to a 2 m target: horizon 14.07 km, well inside the 100 km ring.
    placeSensor({ detectRangeM: 100000 })
    useStore.getState().addEntityFromModel('lib-mavic3', { x: 60000, y: 0 })
    const uasId = useStore.getState().scenario.entities.at(-1)!.id
    useStore.getState().updateEntity(uasId, { altitudeFt: 2 / FT_TO_M })
    expect(detectionsAt(useStore.getState().scenario, 0).get(uasId)).toBeUndefined()
    placeSensor({ sensorType: 'acoustic', detectRangeM: 100000 })
    const hits = detectionsAt(useStore.getState().scenario, 0).get(uasId)
    expect(hits?.map((h) => h.sensorType)).toEqual(['acoustic'])
  })

  it('an effector with a 3,000 ft ceiling has no window against a 14,000 ft threat', () => {
    const st = useStore.getState()
    const effModelId = st.addModel('effector')
    useStore.getState().updateModel(effModelId, {
      effector: {
        effectorType: 'interceptor',
        minRangeM: 0,
        maxRangeM: 10000,
        engageTimeS: 0,
        maxAltitudeFt: 3000,
      },
    })
    useStore.getState().addEntityFromModel(effModelId, { x: 0, y: 0 })
    const effId = useStore.getState().scenario.entities.at(-1)!.id
    useStore.getState().addEntityFromModel('lib-mohajer6', { x: -20000, y: 0 })
    const uasId = useStore.getState().scenario.entities.at(-1)!.id
    useStore.getState().beginPath(uasId)
    useStore.getState().addDraftPoint({ x: 20000, y: 0 })
    useStore.getState().finishPath()
    const windowsFor = () =>
      assessThreat(useStore.getState().scenario, uasId).effectorWindows.find(
        (w) => w.effectorId === effId,
      )
    expect(windowsFor()).toBeUndefined()
    useStore.getState().updateModel(effModelId, {
      effector: {
        effectorType: 'interceptor',
        minRangeM: 0,
        maxRangeM: 10000,
        engageTimeS: 0,
        maxAltitudeFt: null,
      },
    })
    // Slant 10 km at 4263 m of height difference is 9.05 km of ground range.
    const w = windowsFor()!
    expect(w.intervals).toHaveLength(1)
    const groundM = Math.sqrt(10000 ** 2 - (14000 * FT_TO_M - 4) ** 2)
    const scenario = useStore.getState().scenario
    const speed = pathSpeed(scenario, scenario.paths[0])
    expect(w.intervals[0][0]).toBeCloseTo(Math.ceil((20000 - groundM) / speed / 0.5) * 0.5, 9)
  })
})

describe('formation detection', () => {
  beforeEach(reset)

  it('detects a formation when any member enters coverage', () => {
    const st = useStore.getState()
    st.addEntityFromModel('lib-lstar', { x: 0, y: 0 }) // 10 km omni, planning basis (no target scaling)
    st.addEntityFromModel('lib-mavic3', { x: 12500, y: 0 }) // lead outside coverage
    const [, uas] = useStore.getState().scenario.entities
    // Heading north, line abreast: one wingman sits 3000 m east (outside) and
    // the other 3000 m west, at x = 9500, inside the 10 km ring.
    useStore.getState().updateEntity(uas.id, {
      headingDeg: 0,
      formation: { count: 3, shape: 'line', spacingM: 3000 },
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

  it('a wide-area EO/IR search sensor holds without a cue and cues a narrow camera', () => {
    const st = useStore.getState()
    st.addEntityFromModel('lib-wisp', { x: 0, y: 0 }) // surveillance role, 4.8 km thermal
    st.addEntityFromModel('lib-mavic3', { x: 1500, y: 0 })
    const uasId = useStore.getState().scenario.entities.at(-1)!.id
    expect(detectionsAt(useStore.getState().scenario, 0).get(uasId)).toHaveLength(1)
    useStore.getState().addEntityFromModel('lib-hdcmr', { x: 0, y: 0 }) // classification: needs the cue
    expect(detectionsAt(useStore.getState().scenario, 0).get(uasId)).toHaveLength(2)
  })

  it('an RF sensor hears only the bands it covers', () => {
    const st = useStore.getState()
    st.addEntityFromModel('lib-rf360', { x: 0, y: 0 }) // every band
    st.addEntityFromModel('lib-fpv7', { x: 1000, y: 0 }) // rf-manual: 2.4 / 5.8 GHz default
    const [rf, uas] = useStore.getState().scenario.entities
    expect(detectionsAt(useStore.getState().scenario, 0).get(uas.id)).toHaveLength(1)
    const model = useStore.getState().scenario.library.find((m) => m.id === rf.specId)!
    useStore.getState().updateModel(model.id, {
      sensor: { ...model.sensor!, rfBands: ['uhf-433'] },
    })
    expect(detectionsAt(useStore.getState().scenario, 0).get(uas.id)).toBeUndefined()
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
    // Blighter A422: 2.73 km sourced at 0.01 m2. Shahed 0.2 m2 -> x2.11 -> 5.77 km.
    st.addEntityFromModel('lib-a422', { x: 0, y: 0 })
    useStore.getState().updateEntity(useStore.getState().scenario.entities[0].id, { headingDeg: 90 })
    st.addEntityFromModel('lib-mavic3', { x: 3000, y: 0 }) // G1, outside 2.73 km
    st.addEntityFromModel('lib-shahed136', { x: 4000, y: 0 }) // G3, inside 5.77 km
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
    // Modi II is a control-link jammer (no GNSS band), so an RF-silent
    // GNSS-waypoint threat is out of its reach as well.
    useStore.getState().addEntityFromModel('lib-mugin5', { x: -30000, y: 0 })
    const gpsId = useStore.getState().scenario.entities.at(-1)!.id
    useStore.getState().beginPath(gpsId)
    useStore.getState().addDraftPoint({ x: 30000, y: 0 })
    useStore.getState().finishPath()
    expect(assessThreat(useStore.getState().scenario, gpsId).status).toBe('detect-only')
    // A jammer whose bands cover GNSS (CUAEWS NAVWAR) closes the chain.
    const st2 = useStore.getState()
    st2.addEntityFromModel('lib-cuaews', { x: 0, y: 0 })
    const navwar = useStore.getState().scenario.entities.at(-1)!
    useStore.getState().beginConnect(radar.id)
    useStore.getState().completeConnect(navwar.id)
    expect(assessThreat(useStore.getState().scenario, gpsId).status).toBe('engageable')
  })
})

describe('jammer windows', () => {
  beforeEach(reset)

  it('effectorWindows uses the power-scaled jam range, not the placard', () => {
    const st = useStore.getState()
    st.addEntityFromModel('lib-lstar', { x: 0, y: 0 })
    st.addEntityFromModel('lib-modi', { x: 0, y: 0 }) // jammer, 2 km placard
    const [radar, jam] = useStore.getState().scenario.entities
    useStore.getState().beginConnect(radar.id)
    useStore.getState().completeConnect(jam.id)
    const uasId = placeThreat() // 12 m/s straight over the jammer
    const full = assessThreat(useStore.getState().scenario, uasId)
    const w0 = full.effectorWindows.find((w) => w.effectorId === jam.id)!.intervals[0]
    expect(w0[1] - w0[0]).toBeCloseTo(4000 / 12, -1)
    // A quarter of rated EIRP halves the reach, so the window halves too.
    const model = useStore.getState().scenario.library.find((m) => m.id === jam.specId)!
    useStore.getState().updateModel(model.id, {
      effector: { ...model.effector!, eirpW: 25, ratedEirpW: 100 },
    })
    const derated = assessThreat(useStore.getState().scenario, uasId)
    const w1 = derated.effectorWindows.find((w) => w.effectorId === jam.id)!.intervals[0]
    expect(w1[1] - w1[0]).toBeCloseTo(2000 / 12, -1)
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
  const s = legacyScenario()
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

describe('windows come only from effectors the detecting sensors can reach', () => {
  /**
   * Omni radar at the origin holds the whole path (5 km). Two identical guns
   * (1000 m, engage time 0): 'near' sits on the path and is in range over the
   * last 100 s; 'far' sits 20 km off axis and never gets the threat in range.
   * ROE free, so the gate is first detection (t = 0). Each test wires the
   * connections itself.
   */
  function twoGunScenario(): {
    scenario: Scenario
    uasId: string
    sensorId: string
    nearId: string
    farId: string
  } {
    const s = legacyScenario()
    s.roe = 'free'
    const uasModelId = newId('m-uas')
    const sensorModelId = newId('m-sen')
    const gunModelId = newId('m-gun')
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
          cruiseSpeedMps: 10,
          maxSpeedMps: 10,
          enduranceMin: 60,
          altBandFt: [0, 400],
          navMode: 'gps',
          emissionsNote: '',
        },
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
          role: 'early-warning',
          detectRangeM: 5000,
          classifyRangeM: null,
          sectorDeg: 360,
        },
      },
      {
        id: gunModelId,
        name: 'Test gun',
        kind: 'effector',
        description: '',
        color: '#00f',
        builtin: false,
        effector: { effectorType: 'gun', minRangeM: 0, maxRangeM: 1000, engageTimeS: 0 },
      },
    )
    const sensorId = newId('e-sen')
    const uasId = newId('e-uas')
    const nearId = newId('e-near')
    const farId = newId('e-far')
    const common = { headingDeg: 0, color: null, notes: '' }
    s.entities.push(
      { id: sensorId, name: 'S1', kind: 'sensor', specId: sensorModelId, pos: { x: 0, y: 0 }, ...common },
      { id: nearId, name: 'E-near', kind: 'effector', specId: gunModelId, pos: { x: 0, y: 0 }, ...common },
      { id: farId, name: 'E-far', kind: 'effector', specId: gunModelId, pos: { x: 20000, y: 0 }, ...common },
      { id: uasId, name: 'T1', kind: 'uas', specId: uasModelId, pos: { x: -4000, y: 0 }, ...common, headingDeg: 90 },
    )
    s.paths.push({
      id: newId('p'),
      entityId: uasId,
      points: [
        { x: -4000, y: 0 },
        { x: 0, y: 0 },
      ],
      speedMps: 10,
      startDelayS: 0,
    })
    return { scenario: s, uasId, sensorId, nearId, farId }
  }

  it('an unconnected in-range effector yields no window and no engageable status', () => {
    const { scenario, uasId, sensorId, nearId, farId } = twoGunScenario()
    // Only the out-of-range gun is connected; the in-range gun has no link.
    scenario.connections.push({ id: newId('c'), fromId: sensorId, toId: farId, label: '' })
    const a = assessThreat(scenario, uasId)
    expect(a.status).toBe('window-too-short')
    expect(a.windowS).toBeNull()
    expect(a.windowEffectorId).toBeNull()
    // The raw geometry stays available: effectorWindows keeps the unconnected
    // gun's in-range interval (attrition filters it against the connected set).
    const raw = a.effectorWindows.find((w) => w.effectorId === nearId)
    expect(raw).toBeDefined()
    expect(raw!.intervals.length).toBeGreaterThan(0)
  })

  it('connecting the in-range effector through C2 makes the threat engageable on it', () => {
    const { scenario, uasId, sensorId, nearId } = twoGunScenario()
    const c2Id = newId('e-c2')
    scenario.entities.push({
      id: c2Id,
      name: 'C2',
      kind: 'c2',
      specId: null,
      pos: { x: 500, y: 500 },
      headingDeg: 0,
      color: null,
      notes: '',
    })
    scenario.connections.push(
      { id: newId('c'), fromId: sensorId, toId: c2Id, label: '' },
      { id: newId('c'), fromId: c2Id, toId: nearId, label: '' },
    )
    const a = assessThreat(scenario, uasId)
    expect(a.status).toBe('engageable')
    expect(a.windowEffectorId).toBe(nearId)
    near(a.windowS![0], 300) // enters the 1000 m ring at t = 300 s
    near(a.windowS![1], 400) // path ends over the gun at t = 400 s
  })

  it('no connected effector at all is no-kill-chain', () => {
    const { scenario, uasId } = twoGunScenario()
    const a = assessThreat(scenario, uasId)
    expect(a.status).toBe('no-kill-chain')
    expect(a.windowS).toBeNull()
  })
})

/**
 * Typed integration semantics: routes over researched links carry latency and
 * the fc-uplink / requiredC2 / standalone rules. Scenarios are hand-built on
 * the x axis (ROE free so the gate is first detection); connections carry the
 * fields applyConnectSuggestion would set. Untyped links must keep today's
 * behavior, which the rest of this file proves.
 */
describe('typed kill-chain routing', () => {
  const common = { headingDeg: 0, color: null, notes: '' }

  function ent(s: Scenario, kind: EntityKind, specId: string | null, x: number, headingDeg = 0): string {
    const id = newId('e')
    s.entities.push({ id, name: specId ?? kind, kind, specId, pos: { x, y: 0 }, ...common, headingDeg })
    return id
  }

  function typedLink(s: Scenario, fromId: string, toId: string, medium: LinkMedium = 'cable') {
    s.connections.push({
      id: newId('c'),
      fromId,
      toId,
      label: 'track data',
      medium,
      confidence: 'documented',
      latencyS: MEDIUM_LATENCY_S[medium],
    })
  }

  /** One Mavic overflying the origin west to east at 20 m/s. */
  function overflight(s: Scenario, fromX: number, toX: number): string {
    const uasId = ent(s, 'uas', 'lib-mavic3', fromX)
    s.paths.push({
      id: newId('p'),
      entityId: uasId,
      points: [
        { x: fromX, y: 0 },
        { x: toX, y: 0 },
      ],
      speedMps: 20,
      startDelayS: 0,
    })
    return uasId
  }

  /**
   * EchoShield -> FAAD C2 -> Coyote over typed links; KuRFS optional. The
   * research denies EchoShield as a Coyote fire-control source, so without
   * KuRFS the chain has track data but no Ku-band uplink. EchoShield's 130 deg
   * wedge faces west, into the inbound leg.
   */
  function coyoteLaydown(withKurfs: boolean): { s: Scenario; uasId: string } {
    const s = legacyScenario()
    s.roe = 'free'
    const radar = ent(s, 'sensor', 'lib-echoshield', 0, 270)
    const c2 = ent(s, 'c2', 'lib-faadc2', 500)
    const coyote = ent(s, 'effector', 'lib-coyote', 1000)
    typedLink(s, radar, c2)
    typedLink(s, c2, coyote)
    if (withKurfs) typedLink(s, ent(s, 'sensor', 'lib-kurfs', 0), c2)
    const uasId = overflight(s, -12000, 12000)
    return { s, uasId }
  }

  it('Coyote routed only via C2 without its fire-control radar is no-fc-uplink', () => {
    const { s, uasId } = coyoteLaydown(false)
    const a = assessThreat(s, uasId)
    expect(a.status).toBe('no-fc-uplink')
    // The blocked window stays visible as geometry.
    expect(a.windowS).not.toBeNull()
    expect(a.effectorWindows.length).toBeGreaterThan(0)
  })

  it('KuRFS connected into the same C2 satisfies the fc uplink', () => {
    const { s, uasId } = coyoteLaydown(true)
    expect(assessThreat(s, uasId).status).toBe('engageable')
  })

  it('a cue-role pairing is not fire control: TPQ-50 cannot close a Coyote engagement', () => {
    // lib-lstar carries a documented 'cue' pair with Coyote (FS-LIDS
    // surveillance cueing); only fcSources / fc-uplink pairs may close it.
    const s = legacyScenario()
    s.roe = 'free'
    const lstar = ent(s, 'sensor', 'lib-lstar', 0)
    const c2 = ent(s, 'c2', 'lib-faadc2', 500)
    const coyote = ent(s, 'effector', 'lib-coyote', 1000)
    typedLink(s, lstar, c2)
    typedLink(s, c2, coyote)
    const uasId = overflight(s, -12000, 12000)
    expect(assessThreat(s, uasId).status).toBe('no-fc-uplink')
  })

  it('Lattice satisfies the Coyote requiredC2 gate like FAAD C2 does', () => {
    const s = legacyScenario()
    s.roe = 'free'
    const kurfs = ent(s, 'sensor', 'lib-kurfs', 0)
    const lattice = ent(s, 'c2', 'lib-lattice', 500)
    const coyote = ent(s, 'effector', 'lib-coyote', 1000)
    typedLink(s, kurfs, lattice)
    typedLink(s, lattice, coyote)
    const uasId = overflight(s, -12000, 12000)
    const a = assessThreat(s, uasId)
    expect(a.status).toBe('engageable')
    expect(a.windowEffectorId).toBe(coyote)
  })

  it('a standalone LPWS with no connections still completes the kill chain', () => {
    const s = legacyScenario()
    s.roe = 'free'
    ent(s, 'sensor', 'lib-lstar', 0)
    const lpws = ent(s, 'effector', 'lib-lpws', 0)
    const uasId = overflight(s, -3000, 3000)
    const a = assessThreat(s, uasId)
    expect(a.status).toBe('engageable')
    expect(a.windowEffectorId).toBe(lpws)
  })

  /** Unprofiled test gun (1000 m, engage time 0) so no researched gate applies. */
  function pushGunModel(s: Scenario, engageTimeS = 0): string {
    const id = newId('m-gun')
    s.library.push({
      id,
      name: 'Test gun',
      kind: 'effector',
      description: '',
      color: '#00f',
      builtin: false,
      effector: { effectorType: 'gun', minRangeM: 0, maxRangeM: 1000, engageTimeS },
    })
    return id
  }

  it('routes sensor -> Lattice -> FAAD C2 -> effector across the c2-c2 link', () => {
    const s = legacyScenario()
    s.roe = 'free'
    const lstar = ent(s, 'sensor', 'lib-lstar', 0)
    const lattice = ent(s, 'c2', 'lib-lattice', 500)
    const faad = ent(s, 'c2', 'lib-faadc2', 600)
    const gun = ent(s, 'effector', pushGunModel(s), 0)
    typedLink(s, lstar, lattice)
    typedLink(s, faad, gun)
    const uasId = overflight(s, -3000, 3000)
    // The chain is split in two until the c2-c2 interop link exists.
    expect(assessThreat(s, uasId).status).toBe('no-kill-chain')
    typedLink(s, lattice, faad)
    const a = assessThreat(s, uasId)
    expect(a.status).toBe('engageable')
    expect(a.windowEffectorId).toBe(gun)
  })

  it('the c2-c2 link routes against its stored direction (interop is mutual)', () => {
    const s = legacyScenario()
    s.roe = 'free'
    const lstar = ent(s, 'sensor', 'lib-lstar', 0)
    const lattice = ent(s, 'c2', 'lib-lattice', 500)
    const faad = ent(s, 'c2', 'lib-faadc2', 600)
    ent(s, 'effector', pushGunModel(s), 0)
    typedLink(s, lstar, lattice)
    typedLink(s, faad, s.entities[3].id)
    typedLink(s, faad, lattice) // stored opposite to the track flow
    const uasId = overflight(s, -3000, 3000)
    expect(assessThreat(s, uasId).status).toBe('engageable')
  })

  it('mesh-radio hop latency shrinks the usable window', () => {
    // The gun ring crossing yields a ~99.5 s gated window: engage time 99
    // fits it bare (99.5 >= 99) but not plus two mesh-radio hops (99.5 < 101).
    const s = legacyScenario()
    s.roe = 'free'
    const radarModelId = newId('m-sen')
    s.library.push({
      id: radarModelId,
      name: 'Test radar',
      kind: 'sensor',
      description: '',
      color: '#0f0',
      builtin: false,
      sensor: {
        sensorType: 'radar',
        role: 'early-warning',
        detectRangeM: 5000,
        classifyRangeM: null,
        sectorDeg: 360,
      },
    })
    const radar = ent(s, 'sensor', radarModelId, 0)
    const c2 = ent(s, 'c2', null, 500)
    const gun = ent(s, 'effector', pushGunModel(s, 99), 0)
    typedLink(s, radar, c2, 'mesh-radio')
    typedLink(s, c2, gun, 'mesh-radio')
    const uasId = overflight(s, -3007, 3007)
    expect(assessThreat(s, uasId).status).toBe('window-too-short')
    // The same laydown over untyped links keeps its legacy zero latency.
    for (const c of s.connections) Object.assign(c, { confidence: null, latencyS: 0 })
    expect(assessThreat(s, uasId).status).toBe('engageable')
  })
})

/**
 * Arrival is a protected-boundary crossing; closest approach is geometry.
 * Before the fix `arrivalS` was the closest-approach time, so a threat that
 * turned away 2 km short still "arrived", and a laydown with no asset placed
 * reported null with no way to tell "never arrived" from "nothing to arrive
 * at". The CPA fields now always carry the geometry and arrivalS answers only
 * the boundary question.
 */
describe('arrival versus closest approach', () => {
  /** 50 km radar at the origin, threat crossing west to east at 40 m/s. */
  function crossingScenario(): { scenario: Scenario; uasId: string } {
    return ladderScenario({
      speedMps: 40,
      sensor: { x: 0, detectRangeM: 50000 },
      pathFromX: -2000,
      pathToX: 2000,
    })
  }

  function addAsset(s: Scenario, pos: Vec2, defendedRadiusM?: number): string {
    const id = newId('e-ast')
    s.entities.push({
      id,
      name: 'Asset',
      kind: 'asset',
      specId: null,
      pos,
      headingDeg: 0,
      color: null,
      notes: '',
      ...(defendedRadiusM != null ? { defendedRadiusM } : {}),
    })
    return id
  }

  it('uses the default 500 m protected boundary as a planning factor', () => {
    expect(DEFAULT_DEFENDED_RADIUS_M).toBe(500)
  })

  it('arrives at the first sample inside the boundary, not at closest approach', () => {
    // x(t) = -2000 + 40 t. Inside 500 m when |x| <= 500 -> t in [37.5, 62.5];
    // 37.5 is on the 0.5 s grid. Closest approach is x = 0 at t = 50.
    const { scenario, uasId } = crossingScenario()
    const assetId = addAsset(scenario, { x: 0, y: 0 })
    const a = assessThreat(scenario, uasId)
    expect(a.arrivalS).toBeCloseTo(37.5, 9)
    expect(a.cpaS).toBeCloseTo(50, 9)
    expect(a.cpaDistanceM).toBeCloseTo(0, 6)
    expect(a.cpaAssetId).toBe(assetId)
    // Legacy fields still carry the CPA values for callers not yet updated.
    expect(a.assetId).toBe(assetId)
    expect(a.closestApproachM).toBe(a.cpaDistanceM)
    // warningS = arrival - first detection; the 50 km radar holds from t = 0.
    expect(a.firstDetectS).toBeCloseTo(0, 9)
    expect(a.warningS).toBeCloseTo(37.5, 9)
  })

  it('honours a per-asset defendedRadiusM', () => {
    // 1000 m boundary: |x| <= 1000 -> t in [25, 75].
    const { scenario, uasId } = crossingScenario()
    addAsset(scenario, { x: 0, y: 0 }, 1000)
    const a = assessThreat(scenario, uasId)
    expect(a.arrivalS).toBeCloseTo(25, 9)
    expect(a.cpaS).toBeCloseTo(50, 9)
  })

  it('never arrives when the track turns away short of the boundary', () => {
    // Asset 2500 m off the lane: CPA 2500 m at t = 50, boundary never crossed.
    const { scenario, uasId } = crossingScenario()
    const assetId = addAsset(scenario, { x: 0, y: 2500 })
    const a = assessThreat(scenario, uasId)
    expect(a.arrivalS).toBeNull()
    expect(a.warningS).toBeNull()
    // The geometry is still reported, so a caller can say how close it got.
    expect(a.cpaS).toBeCloseTo(50, 9)
    expect(a.cpaDistanceM).toBeCloseTo(2500, 6)
    expect(a.cpaAssetId).toBe(assetId)
  })

  it('reports null CPA and null arrival when no asset is placed', () => {
    const { scenario, uasId } = crossingScenario()
    const a = assessThreat(scenario, uasId)
    expect(a.cpaAssetId).toBeNull()
    expect(a.cpaS).toBeNull()
    expect(a.cpaDistanceM).toBeNull()
    expect(a.assetId).toBeNull()
    expect(a.closestApproachM).toBeNull()
    expect(a.arrivalS).toBeNull()
    expect(a.warningS).toBeNull()
  })

  it('takes the first boundary crossed when several assets are placed', () => {
    // Near asset at x = -1200 (crossed from t = 7.5), far asset at x = 1200.
    const { scenario, uasId } = crossingScenario()
    addAsset(scenario, { x: 1200, y: 0 })
    addAsset(scenario, { x: -1200, y: 0 })
    const a = assessThreat(scenario, uasId)
    expect(a.arrivalS).toBeCloseTo(7.5, 9)
  })
})

/**
 * Legacy instant-release engine (doctrine off). These fixtures assert the
 * pre-doctrine numbers: the ROE gate alone opens the window and every ready
 * effector volleys. New scenarios default to the doctrinal sequence.
 */
function legacyScenario(): ReturnType<typeof emptyScenario> {
  const s = emptyScenario()
  s.doctrine = { ...s.doctrine!, enabled: false }
  return s
}
