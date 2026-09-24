import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { emptyScenario } from '../../model/seed'
import type { McState } from '../../state/runState'
import { useStore } from '../../state/store'
import { IDLE_MC } from '../../state/runState'
import type { Scenario } from '../../model/types'
import { runSettings } from '../../model/types'
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
    expect(el).toContain('>DET · Pd threshold<')
    expect(render()).not.toContain('chip-meta')
    expect(render()).toMatch(
      /<span class="chip det"[^>]*>[^<]*<\/span><label[^>]*><input[^>]*checked=""[^>]*\/>Deterministic \(fixed seed\)<\/label>/,
    )
    expect(render()).toContain('Forecast and analysis')
    expect(render()).not.toContain('freezes the shared seed')
  })

  it('shows the replicate count and the seed while idle under Monte Carlo', () => {
    useStore.getState().patchScenario({ runMode: 'monte-carlo' })
    const el = chip(render())
    expect(el).toContain('class="chip mc"')
    expect(el).toContain('>MC 0 / 100 · seed 4821<')
    expect(el).toContain('Not run yet. Stops on the replicate count.')
  })

  it('shows the progress while running', () => {
    useStore.getState().patchScenario({ runMode: 'monte-carlo' })
    setMc({ status: 'running', progress: 40, total: 100 })
    const el = chip(render())
    expect(el).toContain('class="chip mc"')
    expect(el).toContain('>MC 40 / 100 · seed 4821<')
  })

  it('names the total uncertainty in the line and its title', () => {
    useStore.getState().patchScenario({ runMode: 'monte-carlo', uncertainty: 'total' })
    const el = chip(render())
    expect(el).toContain('MC 0 / 100 · total · seed 4821')
    expect(el).toContain('Monte Carlo, 100 replicates, seed 4821, total uncertainty')
  })

  it('collapses a finished half-width run into one line with the rule in its title', () => {
    useStore.getState().patchScenario({ runMode: 'monte-carlo', targetHalfWidth: 0.05 })
    const cap = runSettings(useStore.getState().scenario).stopCap
    setMc({
      status: 'done',
      summary: { replicates: 80, elapsedMs: 12, stopped: { rule: 'halfWidth' } },
    } as unknown as Partial<McState>)
    const el = chip(render())
    expect(el).toContain(`>MC 80 / ${cap} · seed 4821<`)
    expect(el).toContain('stopped at 80 by the half-width rule')
    expect(render().match(/class="chip/g)).toHaveLength(1)
  })

  it('warns when the configuration changed since the replicates ran', () => {
    useStore.getState().patchScenario({ runMode: 'monte-carlo' })
    setMc({ status: 'stale', progress: 100, total: 100 })
    const el = chip(render())
    expect(el).toContain('class="chip mc warn"')
    expect(el).toContain('>MC 0 / 100 · seed 4821 · stale<')
  })
})

describe('ForecastSettings run control', () => {
  beforeEach(() => {
    useStore.getState().replaceScenario(deterministicScenario())
    useStore.setState({ mc: IDLE_MC })
  })

  // The popover and the body Run button are gone: the settings are in the Run tab
  // and the top bar carries the one RunControl. RunControl.test.tsx owns the button.
  it('renders no run control and no popover', () => {
    useStore.getState().patchScenario({ runMode: 'monte-carlo' })
    const html = render()
    expect(html).not.toContain('class="run-control"')
    expect(html).not.toContain('mc-pop')
    expect(html).not.toContain('Run replicates')
    expect(html).not.toContain('Target half-width')
  })
})
