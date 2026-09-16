import { mixedTrial } from '../../playback/__fixtures__/trialFixture'
import { freshPlayback, IDLE_TRIAL } from '../../state/runState'
import { useStore } from '../../state/store'

export function installTrial(horizonS = 3) {
  const fixture = mixedTrial()
  const { scenario, manifest, result } = fixture
  useStore.setState({
    scenario,
    playback: {
      ...freshPlayback(1),
      runId: manifest.runId,
      startedAtMs: 1,
      phase: 'paused',
      simTimeS: 50,
      observedThroughS: horizonS,
    },
    trial: { ...IDLE_TRIAL, status: 'ready', scenario, manifest, result },
  })
  return fixture
}

export function observeTrial(horizonS: number, cursorS = 50) {
  const playback = useStore.getState().playback
  useStore.setState({ playback: { ...playback, observedThroughS: horizonS, simTimeS: cursorS } })
}

export function unstartTrial() {
  const playback = useStore.getState().playback
  useStore.setState({ playback: { ...playback, startedAtMs: null, observedThroughS: 0 } })
}
