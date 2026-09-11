import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from '../state/store'
import { pathSpeed, scenarioDurationS } from '../model/scenario'
import { emptyScenario } from '../model/seed'
import type {
  EntityKind,
  Roe,
  Scenario,
  SensorRole,
  SensorSpec,
  SpecModel,
  Vec2,
} from '../model/types'
import { MOUNT_HEIGHT_M, newId } from '../model/types'
import { TRACK_INIT_S } from '../analysis/doctrineFactors'
import type { LinkMedium } from '../model/integration'
import { MEDIUM_LATENCY_S } from '../model/integration'
import { FT_TO_M, radarCalibration, radarPdAt } from '../analysis/sensorEnv'
import { rangeForPd } from '../analysis/radarPd'
import { posAtTime } from '../geometry/geo'
import { groundRangeM } from '../geometry/slant'
import type { DrawPolicy } from './policy'
import { assessThreat, DEFAULT_DEFENDED_RADIUS_M } from './sim'
import { memberPositions, threatAltitudeFt } from './tracks'
import { detectionsAt } from './detection'

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

  it('a radar that cues a camera at the same step keeps the first-detection credit', () => {
    const st = useStore.getState()
    st.addEntityFromModel('lib-lstar', { x: 0, y: 0 }) // radar cue
    const radarId = useStore.getState().scenario.entities.at(-1)!.id
    useStore.getState().addEntityFromModel('lib-hdcmr', { x: 0, y: 0 }) // cued EO/IR
    useStore.getState().addEntityFromModel('lib-mavic3', { x: 1500, y: 0 })
    const uasId = useStore.getState().scenario.entities.at(-1)!.id
    useStore.getState().beginPath(uasId)
    useStore.getState().addDraftPoint({ x: -1500, y: 0 })
    useStore.getState().finishPath()
    const a = assessThreat(useStore.getState().scenario, uasId)
    expect(a.firstDetectS).toBe(0)
    expect(a.firstDetectSensorId).toBe(radarId)
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
    // A Pd-modeled classification radar scans every SCAN_S 2 s from t = 0, so
    // the crossing at 100 s (slant still above 2000 m on that step) is first
    // seen at the 102 s scan.
    expect(a.classificationAtS.hostileAtS).toBe(102)
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
 * fields applyConnectSuggestion would set.
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
    // The same laydown over untyped links keeps zero latency.
    for (const c of s.connections) Object.assign(c, { confidence: null, latencyS: 0 })
    expect(assessThreat(s, uasId).status).toBe('engageable')
  })
})

/**
 * Arrival is a protected-boundary crossing; closest approach is geometry.
 * The CPA fields always carry the geometry; arrivalS answers only the
 * boundary question.
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
    // The alias fields carry the CPA values.
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

/** Doctrine off: the ROE gate alone opens the window and every ready effector volleys. */
function legacyScenario(): ReturnType<typeof emptyScenario> {
  const s = emptyScenario()
  s.doctrine = { ...s.doctrine!, enabled: false }
  return s
}

describe('probability of detection', () => {
  beforeEach(reset)

  /**
   * Giraffe 1X at the origin: 4 km at 0.01 m2, instrumented 75 km, sourced basis, PF Pd 0.5 /
   * Pfa 1e-6. The vertical window is pinned open: the threat stands at 14,000 ft at short
   * ground range, above the seed's sourced 0 to 70 deg coverage.
   */
  function placeGiraffe() {
    useStore.getState().addEntityFromModel('lib-giraffe1x', { x: 0, y: 0 })
    const giraffe = useStore.getState().scenario.library.find((m) => m.id === 'lib-giraffe1x')!
    useStore
      .getState()
      .updateModel(giraffe.id, { sensor: { ...giraffe.sensor!, elevationDeg: null } })
    const st = useStore.getState()
    const sensor = st.scenario.entities.at(-1)!
    return { sensorId: sensor.id, spec: st.scenario.library.find((m) => m.id === sensor.specId)!.sensor! }
  }

  /** Mohajer-6 (Group 4, 1 m2, fixed-wing, placed at 14,000 ft) standing at ground range x east. */
  function placeMohajer(x: number, swerling?: 1) {
    const st = useStore.getState()
    if (swerling) {
      const model = st.scenario.library.find((m) => m.id === 'lib-mohajer6')!
      st.updateModel(model.id, { uas: { ...model.uas!, swerling } })
    }
    useStore.getState().addEntityFromModel('lib-mohajer6', { x, y: 0 })
    return useStore.getState().scenario.entities.at(-1)!.id
  }

  const hitsAt = (uasId: string, pdDetect?: number) => {
    const scenario = useStore.getState().scenario
    const s =
      pdDetect == null
        ? scenario
        : { ...scenario, requirements: { ...scenario.requirements, pdDetect } }
    return detectionsAt(s, 0).get(uasId)
  }

  /** Height difference from the 4 m phase center to the placed Mohajer-6. */
  const D_ALT = 14000 * FT_TO_M - 4

  it('forced to the placard case, the detect boundary is the fourth-root slant range', () => {
    const { spec } = placeGiraffe()
    const cal = radarCalibration(spec)
    // 4000 * 100^0.25 = 12,649.11 m slant, 11,909.04 m of ground at 4,263.2 m of height difference.
    const slantB = rangeForPd(cal, 1, 0.5, 1, 1)
    expect(slantB).toBeCloseTo(4000 * Math.pow(100, 0.25), 9)
    const groundB = groundRangeM(slantB, D_ALT)
    expect(groundB).toBeCloseTo(11909.04, 2)
    const inside = placeMohajer(groundB - 20, 1)
    const outside = placeMohajer(groundB + 20, 1)
    const hit = hitsAt(inside)
    expect(hit).toHaveLength(1)
    expect(hit![0].slantM).toBeCloseTo(Math.hypot(groundB - 20, D_ALT), 6)
    expect(hitsAt(outside)).toBeUndefined()
  })

  it('with the model default (Swerling 3) the boundary moves out to rangeForPd at case 3', () => {
    const { spec } = placeGiraffe()
    // Fixed-wing resolves to case 3: 13,259.09 m slant, 12,555.02 m of ground.
    const groundB = groundRangeM(rangeForPd(radarCalibration(spec), 1, 0.5, 1, 3), D_ALT)
    expect(groundB).toBeCloseTo(12555.02, 2)
    const inside = placeMohajer(groundB - 20)
    const outside = placeMohajer(groundB + 20)
    const beyondCase1 = placeMohajer(11909.04 + 20)
    expect(hitsAt(inside)).toHaveLength(1)
    expect(hitsAt(outside)).toBeUndefined()
    expect(hitsAt(beyondCase1)).toHaveLength(1)
  })

  it('requirements.pdDetect = 0.9 shrinks the detect range to rangeForPd at 0.9', () => {
    const { spec } = placeGiraffe()
    const cal = radarCalibration(spec)
    // Case 1: Pd 0.9 needs SNR 130.126 vs 18.932 at the placard, so
    // 12,649.11 / (130.126 / 18.932)^0.25 = 7,812.06 m slant, 6,546.25 m of ground.
    const slant1 = rangeForPd(cal, 1, 0.9, 1, 1)
    expect(slant1).toBeCloseTo(7812.06, 2)
    const ground1 = groundRangeM(slant1, D_ALT)
    expect(ground1).toBeCloseTo(6546.25, 2)
    const in1 = placeMohajer(ground1 - 20, 1)
    const out1 = placeMohajer(ground1 + 20, 1)
    expect(hitsAt(in1)).toHaveLength(1)
    expect(hitsAt(in1, 0.9)).toHaveLength(1)
    expect(hitsAt(out1, 0.9)).toBeUndefined()
    expect(hitsAt(out1)).toHaveLength(1)
  })

  it('requirements.pdDetect = 0.9 at the model default case 3', () => {
    const { spec } = placeGiraffe()
    // Case 3: Pd 0.9 needs SNR 53.653: 9,748.95 m slant, 8,767.39 m of ground.
    const slant3 = rangeForPd(radarCalibration(spec), 1, 0.9, 1, 3)
    expect(slant3).toBeCloseTo(9748.95, 2)
    const ground3 = groundRangeM(slant3, D_ALT)
    expect(ground3).toBeCloseTo(8767.39, 2)
    const inside = placeMohajer(ground3 - 20)
    const outside = placeMohajer(ground3 + 20)
    expect(hitsAt(inside, 0.9)).toHaveLength(1)
    expect(hitsAt(outside, 0.9)).toBeUndefined()
    expect(hitsAt(outside)).toHaveLength(1)
  })

  it('hit.pd is radarPdAt at the hit slant range and clears pdDetect; null without a Pd model', () => {
    const { spec } = placeGiraffe()
    const uasId = placeMohajer(9000)
    const scenario = useStore.getState().scenario
    const uas = scenario.library.find((m) => m.id === 'lib-mohajer6')!.uas!
    for (const pdDetect of [0.5, 0.6, 0.75]) {
      const s = { ...scenario, requirements: { ...scenario.requirements, pdDetect } }
      const hit = detectionsAt(s, 0).get(uasId)![0]
      expect(hit.pd).toBe(radarPdAt(spec, scenario.environment, uas, hit.slantM))
      expect(hit.pd!).toBeGreaterThanOrEqual(pdDetect)
    }
    // No Pd model: an acoustic sensor and a planning-basis radar hit on range alone.
    for (const sensor of [
      { sensorType: 'acoustic' as const, rangeBasis: 'sourced' as const },
      { sensorType: 'radar' as const, rangeBasis: 'planning' as const },
    ]) {
      const modelId = useStore.getState().addModel('sensor')
      useStore.getState().updateModel(modelId, {
        sensor: {
          role: 'surveillance',
          detectRangeM: 50000,
          classifyRangeM: null,
          sectorDeg: 360,
          ...sensor,
        },
      })
      useStore.getState().addEntityFromModel(modelId, { x: 0, y: 0 })
    }
    const hits = detectionsAt(useStore.getState().scenario, 0).get(uasId)!
    expect(hits.map((h) => h.pd == null)).toEqual([false, true, true])
  })

  it('pdSeries runs from the first scan; scan steps clear the threshold only while held', () => {
    const { sensorId } = placeGiraffe()
    // Straight through the ring, west to east, and out the far side.
    const uasId = placeMohajer(-30000)
    useStore.getState().beginPath(uasId)
    useStore.getState().addDraftPoint({ x: 30000, y: 0 })
    useStore.getState().finishPath()
    const scenario = useStore.getState().scenario
    const a = assessThreat(scenario, uasId)
    const obs = a.sensorObservations!.find((o) => o.sensorId === sensorId)!
    const series = obs.pdSeries!
    expect(obs.firstDetectS).toBe(a.firstDetectS)
    // Giraffe states updateRateS 1: phase 0 puts the first scan at the sweep
    // start, so the series opens far out at t = 0 and first detection lands
    // on a whole second.
    expect(obs.pdSeriesStartS).toBe(0)
    expect(series[0]).toBeLessThan(0.5)
    expect(obs.firstDetectS % 1).toBe(0)
    expect(obs.firstDetectS).toBeGreaterThan(0)
    expect(series[series.length - 1]).toBeLessThan(0.5)
    // The sweep's own loop: DT steps from the first scan until the sample reports done.
    const path = scenario.paths[0]
    const speed = pathSpeed(scenario, path)
    let steps = 0
    for (let t = 0; t <= scenarioDurationS(scenario); t += 0.5) {
      steps += 1
      if (posAtTime(path.points, speed, 0, t).done) break
    }
    expect(steps).toBeGreaterThan(2)
    expect(series).toHaveLength(steps)
    // At every scan step (whole seconds) the Pd sits at or above the threshold
    // exactly while the radar is between first and last detection.
    for (let k = 0; k < series.length; k += 2) {
      const t = k * 0.5
      const held = t >= obs.firstDetectS && t <= obs.lastDetectS
      expect(series[k] >= 0.5).toBe(held)
    }
    expect(Math.max(...series)).toBeLessThanOrEqual(1)
  })

  it('a saved pdDetect outside (0, 1) falls back to the default, so 0 never detects past the cap', () => {
    placeGiraffe()
    // 200 km is beyond the 75 km instrumented cap, where radarPdAt returns 0.
    const far = placeMohajer(200000)
    const near = placeMohajer(11909.04 - 20, 1)
    expect(hitsAt(far, 0)).toBeUndefined()
    expect(hitsAt(near, 0)).toHaveLength(1)
    expect(hitsAt(near, 1)).toHaveLength(1)
  })

  it('a planning-basis radar records no pdSeries', () => {
    const modelId = useStore.getState().addModel('sensor')
    useStore.getState().updateModel(modelId, {
      sensor: {
        sensorType: 'radar',
        role: 'surveillance',
        detectRangeM: 15000,
        classifyRangeM: null,
        sectorDeg: 360,
        rangeBasis: 'planning',
      },
    })
    useStore.getState().addEntityFromModel(modelId, { x: 0, y: 0 })
    const sensorId = useStore.getState().scenario.entities.at(-1)!.id
    const uasId = placeMohajer(-30000)
    useStore.getState().beginPath(uasId)
    useStore.getState().addDraftPoint({ x: 30000, y: 0 })
    useStore.getState().finishPath()
    const a = assessThreat(useStore.getState().scenario, uasId)
    const obs = a.sensorObservations!.find((o) => o.sensorId === sensorId)!
    expect(obs.heldSamples).toBeGreaterThan(0)
    expect(obs.pdSeries).toBeUndefined()
    expect(detectionsAt(useStore.getState().scenario, a.firstDetectS!).get(uasId)![0].pd).toBeNull()
  })
})

describe('scan-model track initiation, coast and drop', () => {
  beforeEach(reset)

  /** Threat altitude equal to the phase-center height, so slant range equals ground range. */
  const FIXTURE_ALT_FT = MOUNT_HEIGHT_M / FT_TO_M

  /**
   * Sourced radar at the origin: 4 km against 0.01 m2 (the Mavic 3 planning
   * RCS, so the RCS ratio is 1), PF placard Pd 0.5 / Pfa 1e-6, case 1.
   */
  function placeScanRadar(sensor: Partial<SpecModel['sensor']> & { updateRateS: number | null }) {
    const st = useStore.getState()
    const modelId = st.addModel('sensor')
    st.updateModel(modelId, {
      sensor: {
        sensorType: 'radar',
        role: 'surveillance',
        rangeBasis: 'sourced',
        detectRangeM: 4000,
        refRcsM2: 0.01,
        classifyRangeM: null,
        sectorDeg: 360,
        ...sensor,
      },
    })
    useStore.getState().addEntityFromModel(modelId, { x: 0, y: 0 })
    const sensorId = useStore.getState().scenario.entities.at(-1)!.id
    return { sensorId, spec: useStore.getState().scenario.library.find((m) => m.id === modelId)!.sensor! }
  }

  /** Mavic 3 (quad, case 1) flying a short tangent north to south at ground range x, so Pd stays flat. */
  function flyTangent(x: number, speedMps = 10) {
    const st = useStore.getState()
    st.addEntityFromModel('lib-mavic3', { x, y: -50 })
    const uasId = useStore.getState().scenario.entities.at(-1)!.id
    useStore.getState().updateEntity(uasId, { altitudeFt: FIXTURE_ALT_FT })
    useStore.getState().beginPath(uasId)
    useStore.getState().addDraftPoint({ x, y: 50 })
    useStore.getState().finishPath()
    const scenario = useStore.getState().scenario
    return {
      uasId,
      scenario: {
        ...scenario,
        paths: scenario.paths.map((p) => (p.entityId === uasId ? { ...p, speedMps } : p)),
      },
    }
  }

  /** Ground range at which the fixture radar reads single-scan Pd `pd` against the Mavic. */
  const rangeAtPd = (spec: SpecModel['sensor'], pd: number) =>
    rangeForPd(radarCalibration(spec!), 0.01, pd, 1, 1)

  it('initiates at the third detecting scan when Pd holds at 0.85: firstDetectS + 2 s at rate 1', () => {
    const { sensorId, spec } = placeScanRadar({ updateRateS: 1 })
    const { uasId, scenario } = flyTangent(rangeAtPd(spec, 0.85) - 1)
    const a = assessThreat(scenario, uasId)
    const obs = a.sensorObservations!.find((o) => o.sensorId === sensorId)!
    expect(obs.firstDetectS).toBe(0)
    // Scans at 0, 1, 2 s: two detections cannot satisfy 3-of-5; the third
    // scan does, and mOfN(0.85, 3, 5) clears the 0.9 track threshold.
    expect(obs.pdSeries!.slice(0, 5).every((pd) => pd >= 0.85)).toBe(true)
    expect(obs.trackInitAtS).toBe(2)
    expect(a.stableTrackAtS).toBe(2)
    expect(obs.coastIntervals).toEqual([])
    expect(obs.intervals).toHaveLength(1)
    expect(obs.intervals[0][0]).toBe(0)
  })

  it('never initiates when Pd holds at 0.6: mOfN(0.6, 3, 5) = 0.68 stays under 0.9', () => {
    const { sensorId, spec } = placeScanRadar({ updateRateS: 1 })
    const { uasId, scenario } = flyTangent(rangeAtPd(spec, 0.6))
    const a = assessThreat(scenario, uasId)
    const obs = a.sensorObservations!.find((o) => o.sensorId === sensorId)!
    expect(a.firstDetectS).toBe(0)
    expect(obs.firstDetectS).toBe(0)
    expect(obs.pdSeries!.length).toBeGreaterThan(12)
    expect(obs.pdSeries!.every((pd) => pd >= 0.59 && pd <= 0.61)).toBe(true)
    expect(obs.trackInitAtS).toBeNull()
    expect(a.stableTrackAtS).toBeNull()
    // The same geometry initiates as soon as the test lowers the TRACK threshold under 0.68.
    const eased = { ...scenario, requirements: { ...scenario.requirements, pdTrackCumulative: 0.65 } }
    expect(assessThreat(eased, uasId).sensorObservations![0].trackInitAtS).toBe(2)
  })

  it('a rate below DT counts one scan per step: initiation at the third step', () => {
    const { sensorId, spec } = placeScanRadar({ updateRateS: 0.1 })
    const { uasId, scenario } = flyTangent(rangeAtPd(spec, 0.85) - 1)
    const obs = assessThreat(scenario, uasId).sensorObservations!.find((o) => o.sensorId === sensorId)!
    expect(obs.firstDetectS).toBe(0)
    expect(obs.trackInitAtS).toBe(1)
  })

  /**
   * Planning-basis radar (range test, no Pd model, so M-of-N is a count) with
   * a 1 km ring. The Mavic starts at x = 497 m, flies east at 10 m/s to
   * 1000 + d and back, so it leaves the ring after t = 50.3 and re-enters at
   * t = (503 + 2d) / 10. Scans fall at whole seconds from the t = 0 detection.
   */
  function flyOutAndBack(d: number, sensor: Partial<SpecModel['sensor']> = {}) {
    const { sensorId } = placeScanRadar({
      rangeBasis: 'planning',
      detectRangeM: 1000,
      updateRateS: 1,
      ...sensor,
    })
    const st = useStore.getState()
    st.addEntityFromModel('lib-mavic3', { x: 497, y: 0 })
    const uasId = useStore.getState().scenario.entities.at(-1)!.id
    useStore.getState().updateEntity(uasId, { altitudeFt: FIXTURE_ALT_FT })
    useStore.getState().beginPath(uasId)
    useStore.getState().addDraftPoint({ x: 1000 + d, y: 0 })
    useStore.getState().addDraftPoint({ x: 497, y: 0 })
    useStore.getState().finishPath()
    const scenario = useStore.getState().scenario
    const a = assessThreat(
      { ...scenario, paths: scenario.paths.map((p) => ({ ...p, speedMps: 10 })) },
      uasId,
    )
    return a.sensorObservations!.find((o) => o.sensorId === sensorId)!
  }

  it('a 3 s gap coasts through three missed scans and keeps one hold interval', () => {
    // Out at 50.5, turn at 51.8, back inside at 53.3: scans 51, 52, 53 miss, 54 detects.
    const obs = flyOutAndBack(15)
    expect(obs.firstDetectS).toBe(0)
    expect(obs.pdSeries).toBeUndefined()
    // Count rule: three detected scans at 0, 1, 2 s initiate at 2 s.
    expect(obs.trackInitAtS).toBe(2)
    expect(obs.coastIntervals).toEqual([[51, 53.5]])
    expect(obs.intervals).toHaveLength(1)
    expect(obs.intervals[0][0]).toBe(0)
    expect(obs.intervals[0][1]).toBeGreaterThan(100)
    // Coast is no measurement: lastDetectS is the detected scan after the gap or later.
    expect(obs.lastDetectS).toBeGreaterThanOrEqual(54)
  })

  it('a 6 s gap drops at the fifth missed scan and splits the hold', () => {
    // Out at 50.5, turn at 53.3, back inside at 56.3: scans 51 to 56 miss;
    // the fifth miss (55) drops the track, 57 detects into a new interval.
    const obs = flyOutAndBack(30)
    expect(obs.trackInitAtS).toBe(2)
    expect(obs.coastIntervals).toEqual([[51, 54.5]])
    expect(obs.intervals).toHaveLength(2)
    expect(obs.intervals[0]).toEqual([0, 54.5])
    expect(obs.intervals[1][0]).toBe(57)
  })

  it('trackDropMisses on the spec moves the drop: 3 misses drop inside the 3 s gap', () => {
    const obs = flyOutAndBack(15, { trackDropMisses: 3 })
    expect(obs.coastIntervals).toEqual([[51, 52.5]])
    expect(obs.intervals).toHaveLength(2)
    expect(obs.intervals[0]).toEqual([0, 52.5])
    expect(obs.intervals[1][0]).toBe(54)
  })

  it('a threshold radar without updateRateS keeps the role table and writes trackInitAtS', () => {
    const { radarId } = placeKillChain()
    const uasId = placeThreat()
    // KuRFS is Pd-modeled and would scan at SCAN_S 0.5 s under M-of-N; a
    // planning basis keeps the per-step hold and the role table.
    const st = useStore.getState().scenario
    const scenario = {
      ...st,
      library: st.library.map((m) =>
        m.id === 'lib-kurfs'
          ? { ...m, sensor: { ...m.sensor!, rangeBasis: 'planning' as const } }
          : m,
      ),
    }
    const a = assessThreat(scenario, uasId)
    const obs = a.sensorObservations!.find((o) => o.sensorId === radarId)!
    expect(obs.trackInitAtS).not.toBeNull()
    expect(obs.trackInitAtS).toBe(a.stableTrackAtS)
    expect(obs.trackInitAtS).toBe(obs.intervals[0][0] + TRACK_INIT_S['fire-control'])
    expect(obs.coastIntervals).toEqual([])
  })

  it('a threshold scan radar cues a camera through its carried hold only, never off-scan', () => {
    // Planning-basis radar at the origin, 4 km, period 4 s: scans at 0, 4, 8,
    // ... (phase 0, no path delay). A narrow cued camera (HD CMR, 3 km,
    // classification role) sits at x = 3800. The Mavic flies west from
    // x = 4005 at 10 m/s at the mount height, so slant equals ground range:
    //   t = 0 (scan):     x 4005, outside 4 km, the scan misses
    //   t = 1 (off-scan): x 3995, inside 4 km, but no scan: no radar hit
    //   t = 4 (scan):     x 3965, the first detected scan
    // The camera is 205 m from the target from t = 0, so only the cue gates
    // it: the hold from the scan at 4 s is the one cue, so both observations
    // start at 4 and the radar keeps the credit. Between scans (4.5 to 7.5)
    // the carried hold keeps the camera on the target.
    const { sensorId: radarId } = placeScanRadar({ updateRateS: 4, rangeBasis: 'planning' })
    useStore.getState().addEntityFromModel('lib-hdcmr', { x: 3800, y: 0 })
    const cameraId = useStore.getState().scenario.entities.at(-1)!.id
    useStore.getState().addEntityFromModel('lib-mavic3', { x: 4005, y: 0 })
    const uasId = useStore.getState().scenario.entities.at(-1)!.id
    useStore.getState().updateEntity(uasId, { altitudeFt: FIXTURE_ALT_FT })
    useStore.getState().beginPath(uasId)
    useStore.getState().addDraftPoint({ x: 3000, y: 0 })
    useStore.getState().finishPath()
    const st = useStore.getState().scenario
    const scenario = {
      ...st,
      paths: st.paths.map((p) => (p.entityId === uasId ? { ...p, speedMps: 10 } : p)),
    }
    const a = assessThreat(scenario, uasId)
    expect(a.firstDetectS).toBe(4)
    expect(a.firstDetectSensorId).toBe(radarId)
    const radar = a.sensorObservations!.find((o) => o.sensorId === radarId)!
    const camera = a.sensorObservations!.find((o) => o.sensorId === cameraId)!
    expect(radar.intervals[0][0]).toBe(4)
    expect(camera.firstDetectS).toBe(4)
    expect(camera.intervals[0][0]).toBe(4)
    expect(camera.intervals[0][1]).toBeGreaterThanOrEqual(8)
    // The board view (a bare sweep, every step a scan step) sees the radar hit at t = 1.
    const at1 = detectionsAt(scenario, 1).get(uasId)!
    expect(at1.map((h) => h.sensorType).sort()).toEqual(['eo-ir', 'radar'])
  })
})

describe('one draw per scan', () => {
  /** Threat altitude equal to the phase-center height, so slant range equals ground range. */
  const ALT_FT = MOUNT_HEIGHT_M / FT_TO_M

  /**
   * Hand-built Pd-modeled radar at the origin (4 km against 0.01 m2, PF
   * placard Pd 0.5 / Pfa 1e-6, period 4 s unless overridden) and one quad
   * (0.01 m2, Swerling 1 pinned) on `path`. Environment off, so Pd is the
   * bare closed form.
   */
  function scanScenario(f: {
    radar?: Partial<SensorSpec>
    heading?: number
    path: Vec2[]
    speedMps: number
    startDelayS?: number
    formationCount?: number
  }) {
    const s = legacyScenario()
    s.environment = { ...s.environment, apply: false }
    const spec: SensorSpec = {
      sensorType: 'radar',
      role: 'surveillance',
      detectRangeM: 4000,
      refRcsM2: 0.01,
      classifyRangeM: null,
      sectorDeg: 360,
      updateRateS: 4,
      ...f.radar,
    }
    s.library.push(
      {
        id: 'tst-scan-radar',
        name: 'Scan radar',
        kind: 'sensor',
        description: '',
        color: '#0f0',
        builtin: false,
        sensor: spec,
      },
      {
        id: 'tst-scan-uas',
        name: 'Scan quad',
        kind: 'uas',
        description: '',
        color: '#f00',
        builtin: false,
        uas: {
          group: 1,
          airframe: 'quad',
          cruiseSpeedMps: f.speedMps,
          maxSpeedMps: f.speedMps,
          enduranceMin: 60,
          altBandFt: [0, 400],
          navMode: 'gps',
          emissionsNote: '',
          rcsM2: 0.01,
          swerling: 1,
        },
      },
    )
    const sensorId = 'e-scan-radar'
    const uasId = 'e-scan-uas'
    const common = { color: null, notes: '' }
    s.entities.push(
      {
        id: sensorId,
        name: 'R1',
        kind: 'sensor',
        specId: 'tst-scan-radar',
        pos: { x: 0, y: 0 },
        headingDeg: f.heading ?? 0,
        ...common,
      },
      {
        id: uasId,
        name: 'T1',
        kind: 'uas',
        specId: 'tst-scan-uas',
        pos: f.path[0],
        headingDeg: 0,
        altitudeFt: ALT_FT,
        formation: f.formationCount
          ? { shape: 'line', count: f.formationCount, spacingM: 10 }
          : null,
        ...common,
      },
    )
    s.paths.push({
      id: 'p-scan',
      entityId: uasId,
      points: f.path,
      speedMps: f.speedMps,
      startDelayS: f.startDelayS ?? 0,
    })
    return { scenario: s, sensorId, uasId, spec }
  }

  /** A policy that counts detect calls and never detects; kill and jam are mass, phase 0. */
  function countingPolicy(): DrawPolicy & { calls: number; pds: number[] } {
    const p: DrawPolicy & { calls: number; pds: number[] } = {
      calls: 0,
      pds: [],
      detect(pd) {
        p.calls += 1
        p.pds.push(pd)
        return false
      },
      kill: (pk) => pk,
      jam: (x) => x,
      phase: () => 0,
      param: () => 0.5,
      falseAlarm: () => 0.5,
      latency: () => 0.5,
    }
    return p
  }

  it('(a) draws once per admitted member per scan: members * scans detect calls', () => {
    // Tangent at the range where Pd is 0.45: 100 m north to south at 5 m/s is
    // 20 s, so the sweep runs t = 0 .. 20 and the 4 s period lands scans at
    // 0, 4, 8, 12, 16, 20: six scans. Three ships in line abreast.
    const spec = scanScenario({ path: [{ x: 0, y: 0 }], speedMps: 1 }).spec
    const r45 = rangeForPd(radarCalibration(spec), 0.01, 0.45, 1, 1)
    const { scenario, uasId } = scanScenario({
      path: [
        { x: r45, y: -50 },
        { x: r45, y: 50 },
      ],
      speedMps: 5,
      formationCount: 3,
    })
    const policy = countingPolicy()
    const a = assessThreat(scenario, uasId, policy)
    expect(a.firstDetectS).toBeNull()
    expect(policy.calls).toBe(3 * 6)
    // Ten metres of formation offset at 4.2 km moves the Pd by well under 0.02.
    for (const pd of policy.pds) expect(Math.abs(pd - 0.45)).toBeLessThan(0.02)
  })

  it('(b) a deterministic run first-detects on a scan time; the board view holds each step', () => {
    // Approach along the x axis at 90 m/s after a 1.5 s delay: x(t) = -8000 +
    // 90 (t - 1.5). Pd reaches 0.5 at 4000 m, t - 1.5 = 44.44 s (grid step
    // 46.0 with x = -3995). Scans at 1.5 + 4k: k = 11 (t = 45.5, x = -4040)
    // misses, k = 12 (t = 49.5, x = -3680) detects.
    const delayS = 1.5
    const { scenario, uasId, sensorId } = scanScenario({
      path: [
        { x: -8000, y: 0 },
        { x: 0, y: 0 },
      ],
      speedMps: 90,
      startDelayS: delayS,
    })
    const a = assessThreat(scenario, uasId)
    expect(a.firstDetectS).toBe(49.5)
    expect(((a.firstDetectS! - delayS) % 4 + 4) % 4).toBeLessThan(1e-6)
    const obs = a.sensorObservations!.find((o) => o.sensorId === sensorId)!
    expect(obs.pdSeriesStartS).toBe(delayS)
    // Between scans the board view (no steering: every step is a scan step)
    // holds the target at 46.0 s, where the sweep took no scan.
    expect(detectionsAt(scenario, 46).get(uasId)).toHaveLength(1)
    expect(obs.intervals[0][0]).toBe(49.5)
  })

  it('(c) the M-of-N window opens at the first admitted scan, not at the first scan', () => {
    // 90 deg wedge facing north; the quad flies west to east 2000 m north of
    // the radar from x = -6100 at 100 m/s and enters the wedge at x = -2000
    // (t = 41 s). Scans at 0, 4, ..., 40 see nothing admitted (Pd 0, out of
    // the window); the first admitted scan is 44 s, and with M = 3 the third
    // detected scan initiates at 52 s. Had the 11 pre-admission misses
    // entered the window, the mean Pd over the last five scans would hold
    // initiation to the fifth detected scan (60 s).
    const { scenario, uasId, sensorId } = scanScenario({
      radar: { sectorDeg: 90, detectRangeM: 8000 },
      path: [
        { x: -6100, y: -2000 },
        { x: 0, y: -2000 },
      ],
      speedMps: 100,
    })
    const a = assessThreat(scenario, uasId)
    const obs = a.sensorObservations!.find((o) => o.sensorId === sensorId)!
    expect(a.firstDetectS).toBe(44)
    expect(obs.trackInitAtS).toBe(52)
    expect(obs.trackInitAtS!).toBeGreaterThanOrEqual(44 + 2 * 4)
    expect(obs.pdSeriesStartS).toBe(0)
    expect(obs.pdSeries![0]).toBe(0)
    expect(obs.pdSeries![Math.round(44 / 0.5)]).toBeGreaterThan(0.9)
  })
})
