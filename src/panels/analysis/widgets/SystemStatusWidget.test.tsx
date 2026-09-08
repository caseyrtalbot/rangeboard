import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import fixture from '../../../playback/__fixtures__/detection-outside-rings.json'
import { EMPTY_HORIZON, FULL_RUN, type ExecutionHorizon } from '../../../analysis/horizon'
import { parseAutosave } from '../../../io/persist'
import { useStore } from '../../../state/store'
import { SystemStatusWidget } from './SystemStatusWidget'

function render(horizon: ExecutionHorizon) {
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<SystemStatusWidget horizon={horizon} id="systems" params={{}} collapsed={false} customize={false} index={0} count={1} />)
}

describe('SystemStatusWidget visibility', () => {
  beforeEach(() => {
    const scenario = parseAutosave(JSON.stringify(fixture))
    scenario.paths.forEach((path) => { path.startDelayS += 20 })
    useStore.getState().replaceScenario(scenario)
    useStore.getState().advanceRun(1)
    useStore.getState().pauseRun()
    useStore.getState().scrubTo(2000)
  })

  it('retains cursor telemetry, salvos and effect details when unscoped', () => {
    const html = render(FULL_RUN)
    expect(html).toContain('system-telemetry-head')
    expect(html).toMatch(/[1-9]\d* salvos/)
    expect(html).toMatch(/[1-9]\d* effects/)
    expect(html).toContain('online')
  })

  it('clamps group summaries and hover detail before the first detection or assignment', () => {
    const html = render({ scoped: true, horizonS: 1 })
    expect(html).toContain('0 tracks · 0 salvos')
    expect(html).toContain('0 now · 0 seen')
    expect(html).toContain('0 salvos · 0 effects · E[k] 0.00')
    expect(html).not.toMatch(/[1-9]\d* (salvos|effects|seen|tracks)/)
  })

  it('shows an empty system list for EMPTY_HORIZON', () => {
    const html = render(EMPTY_HORIZON)
    expect(html).toContain('No system telemetry yet.')
    expect(html).not.toContain('system-telemetry-head')
    expect(html).not.toContain('component-telemetry-row')
  })
})
