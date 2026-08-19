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
