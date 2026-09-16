import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TrialResultView } from '../analysis/trialResult'
import { mixedTrial } from '../playback/__fixtures__/trialFixture'
import { freshPlayback, IDLE_TRIAL } from '../state/runState'
import { useStore } from '../state/store'
import { CanvasStage } from './CanvasStage'

vi.mock('react-konva', () => ({
  Stage: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Layer: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Rect: () => null,
}))
vi.mock('../analysis/impact', () => ({
  engagementPicture: () => {
    throw new Error('Canvas must not request forecast outcomes')
  },
}))
vi.mock('./layers/GridLayer', () => ({ GridLayer: () => null }))
vi.mock('./layers/TileLayer', () => ({ TileLayer: () => null }))
vi.mock('./layers/UnderlayLayer', () => ({ UnderlayLayer: () => null }))
vi.mock('./layers/HudLayer', () => ({ HudLayer: () => null }))
vi.mock('./ContextMenu', () => ({ ContextMenu: () => null }))
vi.mock('./ConnectSuggestPopup', () => ({ ConnectSuggestPopup: () => null }))

function Probe({ trial, horizonS }: { trial: TrialResultView | null; horizonS: number | null }) {
  return (
    <span
      data-run={trial?.manifest.runId ?? 'configuration'}
      data-horizon={horizonS ?? 'unobserved'}
    />
  )
}
vi.mock('./LiveScene', () => ({
  LiveScene: (props: Parameters<typeof Probe>[0]) => <Probe {...props} />,
  renderedTrialGeometry: vi.fn(),
}))
vi.mock('./StaticScene', () => ({
  StaticScene: (props: Parameters<typeof Probe>[0]) => <Probe {...props} />,
}))
vi.mock('./TrackFileReadout', () => ({
  TrackFileReadout: (props: Parameters<typeof Probe>[0]) => <Probe {...props} />,
}))

const original = useStore.getState()
afterEach(() => {
  useStore.setState(original)
  Object.assign(useStore.getInitialState(), original)
})
function render() {
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<CanvasStage />)
}

describe('CanvasStage trial selection boundary', () => {
  it.each(['idle', 'preparing', 'error', 'cancelled'] as const)(
    'passes no outcome identity for %s',
    (status) => {
      const { scenario, manifest, result } = mixedTrial()
      useStore.setState({
        scenario,
        playback: {
          ...freshPlayback(1),
          runId: manifest.runId,
          simTimeS: 50,
          observedThroughS: 20,
          startedAtMs: 1,
        },
        trial: {
          ...IDLE_TRIAL,
          scenario,
          manifest,
          result,
          status,
          error: status === 'error' ? 'Failed preparation' : null,
        },
      })
      const html = render()
      expect(html.match(/data-run="configuration"/g)).toHaveLength(3)
      expect(html.match(/data-horizon="unobserved"/g)).toHaveLength(3)
    },
  )

  it('passes the same ready identity and raw bounded horizon to both scenes and selected telemetry', () => {
    const { scenario, manifest, result } = mixedTrial()
    const playback = {
      ...freshPlayback(1),
      runId: manifest.runId,
      simTimeS: 50,
      observedThroughS: 1.99,
      startedAtMs: 1,
    }
    useStore.setState({
      scenario,
      playback,
      trial: { ...IDLE_TRIAL, scenario, manifest, result, status: 'ready' },
    })
    const html = render()
    expect(html.match(/data-run="mixed-fixed-trial"/g)).toHaveLength(3)
    expect(html.match(/data-horizon="1.99"/g)).toHaveLength(3)
    useStore.setState({ playback: { ...playback, startedAtMs: null } })
    expect(render().match(/data-horizon="unobserved"/g)).toHaveLength(3)
  })
})
