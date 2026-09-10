import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyScenario } from '../../model/seed'
import type { McSummary } from '../../playback/mcRun'
import type { PoolProgress } from '../../playback/mcTypes'
import type { McState } from '../../state/runState'
import { IDLE_MC } from '../../state/runState'
import { useStore } from '../../state/store'
import { RunControl } from './RunControl'

// The control has no local state; the button is keyed by its label and the
// switch by its checked attribute in the markup.
const interaction = vi.hoisted(() => ({
  buttons: new Map<string, { disabled?: boolean; onClick: () => void }>(),
  checks: [] as Array<(event: { target: { checked: boolean } }) => void>,
}))
vi.mock('react/jsx-dev-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react/jsx-dev-runtime')>()
  const jsxDEV: typeof actual.jsxDEV = (type, props, ...rest) => {
    const p = props as {
      children?: unknown
      type?: string
      disabled?: boolean
      onClick?: () => void
      onChange?: (event: { target: { checked: boolean } }) => void
    }
    if (type === 'button' && typeof p.children === 'string' && p.onClick) {
      interaction.buttons.set(p.children, { disabled: p.disabled, onClick: p.onClick })
    }
    if (type === 'input' && p.type === 'checkbox' && p.onChange) interaction.checks.push(p.onChange)
    return actual.jsxDEV(type, props, ...rest)
  }
  return { ...actual, jsxDEV }
})

function render(): string {
  interaction.buttons.clear()
  interaction.checks = []
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<RunControl />)
}

function setMc(patch: Partial<McState>): void {
  useStore.setState({ mc: { ...IDLE_MC, runId: useStore.getState().playback.runId, ...patch } })
}

function pool(patch: Partial<PoolProgress>): PoolProgress {
  return { workers: 4, done: 40, total: 100, stopRule: 'replicates', elapsedMs: 900, perWorkerDone: [10, 10, 10, 10], ...patch }
}

/** Only the fields the progress line reads. */
function summary(replicates: number, rule: McSummary['stopped']['rule']): McSummary {
  return { replicates, stopped: { rule, at: replicates } } as McSummary
}

describe('RunControl', () => {
  beforeEach(() => {
    useStore.getState().replaceScenario(emptyScenario())
    useStore.setState({ mc: IDLE_MC })
  })

  it('offers Run beside an unchecked Deterministic switch under Monte Carlo', () => {
    const html = render()

    expect(html).toContain('role="switch"')
    expect(html).toContain('Deterministic')
    expect(html).not.toContain('checked=""')
    expect(html).toContain('>Run<')
    expect(interaction.buttons.get('Run')!.disabled).toBe(false)
  })

  it('starts a run and stops a live one', () => {
    const start = vi.fn()
    const cancel = vi.fn()
    useStore.setState({ runMonteCarlo: start, cancelMonteCarlo: cancel })

    render()
    interaction.buttons.get('Run')!.onClick()
    expect(start).toHaveBeenCalledOnce()

    setMc({ status: 'running', progress: 40, total: 100 })
    render()
    interaction.buttons.get('Stop')!.onClick()
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('toggles the run mode through patchScenario and closes the button in deterministic mode', () => {
    render()
    interaction.checks[0]({ target: { checked: true } })
    expect(useStore.getState().scenario.runMode).toBe('deterministic')

    const html = render()
    expect(html).toContain('checked=""')
    expect(interaction.buttons.get('Run')!.disabled).toBe(true)
    expect(html).toContain('Deterministic mode computes one expected-value envelope, not replicates.')

    interaction.checks[0]({ target: { checked: false } })
    expect(useStore.getState().scenario.runMode).toBe('monte-carlo')
  })

  it('names the stop rule and the pool size while a pooled run is live', () => {
    setMc({ status: 'running', progress: 40, total: 100, pool: pool({}) })
    expect(render()).toContain('40 of 100 replicates · 4 workers')

    setMc({ status: 'running', pool: pool({ stopRule: 'halfWidth', total: null, done: 62, workers: 1 }) })
    expect(render()).toContain('62 replicates · stop on half-width, floor 30, cap 2000 · 1 worker')
  })

  it('names the stop rule from the settings on the single-worker path', () => {
    setMc({ status: 'running', progress: 40, total: 100 })
    expect(render()).toContain('40 of 100 replicates · stop on half-width, floor 30, cap 2000')

    // A scenario edit resets the run, so the cleared rule is set before the progress.
    useStore.getState().patchScenario({ targetHalfWidth: null })
    setMc({ status: 'running', progress: 40, total: 100 })
    expect(render()).toContain('40 of 100 replicates · stop on the replicate count')
  })

  it('keeps the line after the run, naming the rule that ended it', () => {
    setMc({ status: 'done', summary: summary(46, 'halfWidth') })
    expect(render()).toContain('46 of 100 replicates · stop on half-width, floor 30, cap 2000')

    setMc({ status: 'done', summary: summary(100, 'replicates') })
    expect(render()).toContain('100 of 100 replicates · stop on the replicate count')
  })

  it('shows no progress line before the first run', () => {
    expect(render()).not.toContain('run-progress')
  })
})
