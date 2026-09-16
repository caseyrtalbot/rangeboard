import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { emptyScenario } from '../../model/seed'
import type { McState } from '../../state/runState'
import { useStore } from '../../state/store'
import { IDLE_MC } from '../../state/runState'
import type { Scenario } from '../../model/types'
import { ForecastSettings } from './ForecastSettings'

// zustand 5 gives react-dom/server the store's initial state, not the live one,
// so every static render of a store-reading panel needs the two in step.
function render(): string {
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<ForecastSettings />)
}

/** The fresh scenario runs Monte Carlo; these tests start from the envelope mode and switch explicitly. */
function deterministicScenario(): Scenario {
  return {
    ...emptyScenario(),
    runMode: 'deterministic',
    uncertainty: 'aleatory',
    targetHalfWidth: null,
  }
}

function setMc(patch: Partial<McState>): void {
  useStore.setState({ mc: { ...IDLE_MC, runId: useStore.getState().playback.runId, ...patch } })
}

/** The forecast mode metadata chip. */
function chip(html: string): string {
  return html.match(/<span class="chip[^"]*"[^>]*>[^<]*<\/span>/)?.[0] ?? ''
}

describe('ForecastSettings mode metadata', () => {
  beforeEach(() => {
    const st = useStore.getState()
    st.replaceScenario(deterministicScenario())
    st.addEntityFromModel('lib-giraffe1x', { x: 0, y: 0 })
    st.addEntityFromModel('lib-mavic3', { x: 0, y: -3000 })
    const uas = useStore.getState().scenario.entities.find((e) => e.kind === 'uas')!
    useStore.getState().beginPath(uas.id)
    useStore.getState().addDraftPoint({ x: 0, y: -100 })
    useStore.getState().finishPath()
    useStore.setState({ mc: IDLE_MC })
  })

  it('shows DET in the forecast settings under the deterministic mode', () => {
    const el = chip(render())
    expect(el).toContain('class="chip det"')
    expect(el).toContain('>DET<')
    expect(render()).toContain('<span class="chip-meta">envelope · Pd threshold</span>')
    expect(render()).toContain('Forecast and analysis')
    expect(render()).not.toContain('freezes the shared seed')
  })

  it('shows the replicate count and the seed while idle under Monte Carlo', () => {
    useStore.getState().patchScenario({ runMode: 'monte-carlo' })
    const el = chip(render())
    expect(el).toContain('class="chip mc"')
    expect(el).toContain('MC 100 · seed 4821')
    expect(el).toContain('Not run yet')
    expect(render()).toContain('<span class="chip-meta">estimate · 100 replicates</span>')
  })

  it('shows the progress while running', () => {
    useStore.getState().patchScenario({ runMode: 'monte-carlo' })
    setMc({ status: 'running', progress: 40, total: 100 })
    const el = chip(render())
    expect(el).toContain('class="chip mc"')
    expect(el).toContain('MC 100 · 40/100')
  })

  it('names the total uncertainty in the chip, its title and the meta', () => {
    useStore.getState().patchScenario({ runMode: 'monte-carlo', uncertainty: 'total' })
    const el = chip(render())
    expect(el).toContain('MC 100 · total · seed 4821')
    expect(el).toContain('Monte Carlo, 100 replicates, seed 4821, total uncertainty')
    expect(render()).toContain('<span class="chip-meta">estimate · 100 replicates · total</span>')
  })

  it('warns when the configuration changed since the replicates ran', () => {
    useStore.getState().patchScenario({ runMode: 'monte-carlo' })
    setMc({ status: 'stale', progress: 100, total: 100 })
    const el = chip(render())
    expect(el).toContain('class="chip mc warn"')
    expect(el).toContain('MC 100 · stale')
  })
})

describe('ForecastSettings run control', () => {
  beforeEach(() => {
    useStore.getState().replaceScenario(deterministicScenario())
    useStore.setState({ mc: IDLE_MC })
  })

  // The popover is gone: the settings are in the Run tab and the header carries
  // the one Run button beside its Deterministic switch. RunControl.test.tsx owns
  // the button's own behaviour.
  it('renders the one run control and no popover', () => {
    useStore.getState().patchScenario({ runMode: 'monte-carlo' })
    const html = render()
    expect(html).toContain('class="run-control"')
    expect(html).toContain('>Run<')
    expect(html).toContain('Deterministic')
    expect(html).not.toContain('mc-pop')
    expect(html).not.toContain('Run replicates')
    expect(html).not.toContain('Target half-width')
  })

  it('closes the run button under the deterministic mode', () => {
    expect(render()).toContain('<button type="button" class="mc-run" disabled=""')
  })
})
