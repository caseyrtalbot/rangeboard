import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from '../state/store'
import { emptyScenario } from '../model/seed'
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

describe('engagement policy and jammer limits', () => {
  beforeEach(reset)

  it('confirmed policy blocks a single-technology chain', () => {
    placeKillChain()
    const uasId = placeThreat()
    useStore.getState().patchScenario({ engageOn: 'confirmed' })
    const a = assessThreat(useStore.getState().scenario, uasId)
    expect(a.status).toBe('not-confirmed')
    expect(a.firstConfirmS).toBeNull()
  })

  it('a second technology confirms the track and restores engageability', () => {
    placeKillChain()
    const uasId = placeThreat()
    useStore.getState().addEntityFromModel('lib-rf360', { x: 0, y: 0 }) // omni RF, 2 km
    useStore.getState().patchScenario({ engageOn: 'confirmed' })
    const a = assessThreat(useStore.getState().scenario, uasId)
    expect(a.firstConfirmS).not.toBeNull()
    expect(a.status).toBe('engageable')
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
