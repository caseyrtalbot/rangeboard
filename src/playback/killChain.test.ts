import { beforeEach, expect, it } from 'vitest'
import { useStore } from '../state/store'
import { emptyScenario } from '../model/seed'
import { connectedEffectorIds, killChainRoutes } from './killChain'

beforeEach(() => useStore.getState().replaceScenario(emptyScenario()))

it('routes sensor -> c2 -> effector with summed link latency and drops with a disabled C2', () => {
  const st = useStore.getState()
  st.addEntityFromModel('lib-kurfs', { x: 0, y: 0 })
  st.addEntityFromModel('lib-faadc2', { x: 500, y: 0 })
  st.addEntityFromModel('lib-coyote', { x: 1000, y: 0 })
  const [radar, c2, eff] = useStore.getState().scenario.entities
  st.beginConnect(radar.id)
  st.completeConnect(c2.id)
  useStore.getState().beginConnect(c2.id)
  useStore.getState().completeConnect(eff.id)
  const scenario = useStore.getState().scenario
  const routes = killChainRoutes(scenario, new Set([radar.id]))
  const route = routes.get(eff.id)!
  expect(route.viaC2Ids).toEqual([c2.id])
  expect(route.sourceSensorIds).toEqual([radar.id])
  const linkSum = scenario.connections.reduce((s, c) => s + (c.latencyS ?? 0), 0)
  expect(route.latencyS).toBeCloseTo(linkSum, 9)
  expect(connectedEffectorIds(scenario, new Set([radar.id]))).toEqual(new Set(routes.keys()))
  useStore.getState().updateEntity(c2.id, { enabled: false })
  expect(killChainRoutes(useStore.getState().scenario, new Set([radar.id])).has(eff.id)).toBe(false)
})
