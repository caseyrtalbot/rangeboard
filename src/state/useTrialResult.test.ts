import { afterEach, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { mixedTrial } from '../playback/__fixtures__/trialFixture'
import { freshPlayback, IDLE_TRIAL } from './runState'
import { useStore } from './store'
import { useTrialResult } from './useTrialResult'

const original = useStore.getState()
afterEach(() => {
  useStore.setState(original)
  Object.assign(useStore.getInitialState(), original)
})

function readHook() {
  let value: ReturnType<typeof useTrialResult> | undefined
  function Probe() {
    value = useTrialResult()
    return null
  }
  Object.assign(useStore.getInitialState(), useStore.getState())
  renderToStaticMarkup(createElement(Probe))
  return value!
}

it('keeps unavailable and unstarted states empty, then shares the raw observation bound', () => {
  const { scenario, manifest, result } = mixedTrial()
  const playback = { ...freshPlayback(1), runId: manifest.runId, simTimeS: 50, observedThroughS: 1.99 }
  useStore.setState({ scenario, playback, trial: IDLE_TRIAL })
  expect(readHook()).toMatchObject({ selection: { status: 'idle' }, horizon: 0 })
  useStore.setState({ trial: { ...IDLE_TRIAL, status: 'preparing', scenario, manifest } })
  expect(readHook().snapshot).toBeUndefined()
  useStore.setState({ trial: { ...IDLE_TRIAL, status: 'ready', scenario, manifest, result } })
  expect(readHook()).toMatchObject({ selection: { status: 'ready' }, horizon: 0 })
  expect(readHook().series).toBeUndefined()
  useStore.setState({ playback: { ...playback, startedAtMs: 1 } })
  const ready = readHook()
  expect(ready.horizon).toBe(1.99)
  expect(ready.snapshot?.counts.preArrivalHardKills).toBe(0)
  expect(ready.series?.observedThroughS).toBe(1.99)
  useStore.setState({ scenario: { ...scenario, seed: 98765 } })
  expect(readHook()).toMatchObject({ selection: { status: 'idle' }, horizon: 0 })
  expect(readHook().series).toBeUndefined()
})
