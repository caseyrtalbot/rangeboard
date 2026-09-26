import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyScenario } from '../../model/seed'
import type { McSummary } from '../../playback/mcRun'
import type { PoolProgress } from '../../playback/mcTypes'
import type { BoardPhase, McState } from '../../state/runState'
import { IDLE_MC } from '../../state/runState'
import { useStore } from '../../state/store'
import { RunControl } from './RunControl'

// The control has no local state; the button is keyed by its label and the
// switch by its checked attribute in the markup.
const interaction = vi.hoisted(() => ({
  buttons: new Map<string, { disabled?: boolean; onClick: () => void }>(),
  checks: [] as Array<(event: { target: { checked: boolean } }) => void>,
  effects: [] as Array<() => void | (() => void)>,
}))
// Effects do not run under renderToStaticMarkup; collect them so a test can mount one.
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return {
    ...actual,
    useEffect: (effect: () => void | (() => void)) => {
      interaction.effects.push(effect)
    },
  }
})
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
    // The run button's children are its label, then the key hint.
    const text = Array.isArray(p.children) ? p.children[0] : p.children
    if (type === 'button' && typeof text === 'string' && p.onClick) {
      interaction.buttons.set(text, { disabled: p.disabled, onClick: p.onClick })
    }
    if (type === 'input' && p.type === 'checkbox' && p.onChange) interaction.checks.push(p.onChange)
    return actual.jsxDEV(type, props, ...rest)
  }
  return { ...actual, jsxDEV }
})

function render(phase?: BoardPhase): string {
  interaction.buttons.clear()
  interaction.checks = []
  interaction.effects = []
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<RunControl phase={phase} />)
}

function setMc(patch: Partial<McState>): void {
  useStore.setState({ mc: { ...IDLE_MC, runId: useStore.getState().playback.runId, ...patch } })
}

function pool(patch: Partial<PoolProgress>): PoolProgress {
  return {
    workers: 4,
    done: 40,
    total: 100,
    stopRule: 'replicates',
    elapsedMs: 900,
    perWorkerDone: [10, 10, 10, 10],
    stopping: false,
    discarded: 0,
    ...patch,
  }
}

/** Only the fields the progress line reads. */
function summary(replicates: number, rule: McSummary['stopped']['rule']): McSummary {
  return { replicates, stopped: { rule, at: replicates } } as McSummary
}

/** A Stat carrying only what the floor stamp reads: the mean over n samples. */
function stat(mean: number, n: number): McSummary['operatorDecisions'] {
  return { mean, n } as NonNullable<McSummary['operatorDecisions']>
}

describe('RunControl', () => {
  beforeEach(() => {
    useStore.getState().replaceScenario(emptyScenario())
    useStore.setState({ mc: IDLE_MC })
  })

  it('offers Run with no Deterministic switch under Monte Carlo', () => {
    const html = render()

    expect(html).not.toContain('role="switch"')
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

  it('closes the button in deterministic mode with the reason in its title', () => {
    useStore.getState().patchScenario({ runMode: 'deterministic' })

    const html = render()
    expect(interaction.buttons.get('Run')!.disabled).toBe(true)
    expect(html).toContain(
      'Deterministic mode computes one expected-value envelope, not replicates.',
    )
  })

  it('names the stop rule and the pool size while a pooled run is live', () => {
    setMc({ status: 'running', progress: 40, total: 100, pool: pool({}) })
    expect(render()).toContain('40 of 100 replicates · 4 workers')

    setMc({
      status: 'running',
      pool: pool({ stopRule: 'halfWidth', total: null, done: 62, workers: 1 }),
    })
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
    expect(render()).toContain('46 of 2000 replicates · stop on half-width, floor 30, cap 2000')

    // A fixed count ends at the replicate count; the loop end follows the cleared rule.
    useStore.getState().patchScenario({ targetHalfWidth: null })
    setMc({ status: 'done', summary: summary(100, 'replicates') })
    expect(render()).toContain('100 of 100 replicates · stop on the replicate count')
  })

  it('stamps the operator floor on a finished run, and only when the floor caught a decision', () => {
    // 0.7 floored of 2 decisions a replicate over 20 replicates: 14 of 40.
    setMc({
      status: 'done',
      summary: {
        ...summary(20, 'replicates'),
        operatorDecisions: stat(2, 20),
        operatorFlooredDecisions: stat(0.7, 20),
      },
    })
    expect(render()).toContain('operator wait floored in 14 of 40 decisions')

    // Nothing floored: the line stays as it was.
    setMc({
      status: 'done',
      summary: {
        ...summary(20, 'replicates'),
        operatorDecisions: stat(2, 20),
        operatorFlooredDecisions: stat(0, 20),
      },
    })
    expect(render()).not.toContain('operator wait floored')

    // A summary written before the stamp existed carries no counts at all.
    setMc({ status: 'done', summary: summary(20, 'replicates') })
    expect(render()).not.toContain('operator wait floored')
  })

  it('says stopped by the user once a cancelled run has finished', () => {
    useStore.getState().patchScenario({ targetHalfWidth: null })
    setMc({ status: 'done', summary: summary(12, 'cancelled') })
    const html = render()
    expect(html).toContain('>Run<')
    expect(html).toContain('12 of 100 replicates · stopped by the user')
    expect(html).not.toContain('stopping')
  })

  it('shows no progress line before the first run', () => {
    expect(render()).not.toContain('run-progress')
  })

  it('says Stopping and refuses another click once the pool is ending', () => {
    const cancel = vi.fn()
    useStore.setState({ cancelMonteCarlo: cancel })
    setMc({
      status: 'running',
      pool: pool({ stopping: true, stopRule: 'cancelled', total: null, done: 12 }),
    })
    const html = render()
    expect(html).toContain('>Stopping<')
    expect(html).not.toContain('>Stop<')
    expect(html).toContain('This run is already stopping.')
    expect(interaction.buttons.get('Stopping')!.disabled).toBe(true)
    interaction.buttons.get('Stopping')!.onClick()
    expect(cancel).not.toHaveBeenCalled()
    expect(html).toContain('12 replicates · stopping · 4 workers')
  })

  it('names completed rows a stop dropped, on the live line and after the summary', () => {
    setMc({
      status: 'running',
      pool: pool({
        done: 15,
        total: null,
        stopRule: 'budget',
        stopping: true,
        discarded: 1,
        workers: 3,
      }),
    })
    expect(render()).toContain(
      '15 replicates · stop on the execution budget · 3 workers · 1 completed row dropped',
    )

    useStore.getState().patchScenario({ targetHalfWidth: null })
    setMc({
      status: 'done',
      summary: summary(15, 'budget'),
      pool: pool({ done: 15, discarded: 3, stopping: true, stopRule: 'budget' }),
    })
    expect(render()).toContain(
      '15 of 100 replicates · stop on the execution budget · 3 completed rows dropped',
    )
  })

  it('pauses and resumes playback in Execute', () => {
    const command = vi.fn()
    useStore.setState({ playbackCommand: command })
    useStore.setState((s) => ({ playback: { ...s.playback, playing: true } }))
    expect(render('execute')).toContain('>Pause<')
    interaction.buttons.get('Pause')!.onClick()
    expect(command).toHaveBeenCalledWith({ type: 'toggle' })

    useStore.setState((s) => ({ playback: { ...s.playback, playing: false, phase: 'ready' } }))
    expect(render('execute')).toContain('>Play<')
    useStore.setState((s) => ({ playback: { ...s.playback, playing: false, phase: 'paused' } }))
    const html = render('execute')
    expect(html).toContain('>Resume<')
    expect(interaction.buttons.get('Resume')!.disabled).toBe(false)
  })

  it('runs the ensemble again in Analyze', () => {
    const start = vi.fn()
    useStore.setState({ runMonteCarlo: start })
    setMc({ status: 'done', summary: summary(20, 'replicates') })
    expect(render('analyze')).toContain('>Run again<')
    interaction.buttons.get('Run again')!.onClick()
    expect(start).toHaveBeenCalledOnce()

    setMc({ status: 'running', progress: 4, total: 100 })
    expect(render('analyze')).toContain('>Stop<')
  })

  it('shows the key hint and ends every enabled title with it', () => {
    const html = render()
    expect(html).toContain('title="Run (⌘↵)"')
    expect(html).toContain('>Run<kbd class="kbd run-key">⌘↵</kbd></button>')
    setMc({ status: 'running', progress: 4, total: 100 })
    expect(render()).toContain('title="Stop (⌘↵)"')
    setMc({ status: 'done', summary: summary(20, 'replicates') })
    expect(render('analyze')).toContain('title="Run again (⌘↵)"')
    useStore.setState((s) => ({ playback: { ...s.playback, playing: true } }))
    expect(render('execute')).toContain('title="Pause (⌘↵)"')
  })
})

describe('RunControl keyboard shortcut', () => {
  class FakeElement {
    isContentEditable = false
  }
  class FakeInput extends FakeElement {}
  class FakeTextArea extends FakeElement {}
  class FakeSelect extends FakeElement {}
  const key = (patch: Partial<KeyboardEvent> = {}) => {
    const preventDefault = vi.fn()
    return {
      event: {
        key: 'Enter',
        metaKey: true,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        repeat: false,
        target: new FakeElement() as unknown as EventTarget,
        preventDefault,
        ...patch,
      },
      preventDefault,
    }
  }

  type Key = ReturnType<typeof key>['event']
  /** Mounts the control's effect on a stub window and returns the listener it added. */
  const listener = (phase?: BoardPhase) => {
    const add = vi.fn()
    vi.stubGlobal('window', { addEventListener: add, removeEventListener: vi.fn() })
    render(phase)
    interaction.effects.forEach((effect) => effect())
    const onKey = add.mock.calls[0][1] as (event: Key) => void
    return (event: Key) => onKey(event)
  }
  const handleRunKey = (event: Key, phase: BoardPhase) => {
    const handled = vi.fn()
    listener(phase)({
      ...event,
      preventDefault: () => {
        handled()
        event.preventDefault()
      },
    })
    return handled.mock.calls.length > 0
  }

  beforeEach(() => {
    vi.stubGlobal('HTMLElement', FakeElement)
    vi.stubGlobal('HTMLInputElement', FakeInput)
    vi.stubGlobal('HTMLTextAreaElement', FakeTextArea)
    vi.stubGlobal('HTMLSelectElement', FakeSelect)
    useStore.getState().replaceScenario(emptyScenario())
    useStore.setState({ mc: IDLE_MC })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('mounts one window keydown listener and removes it on unmount', () => {
    const add = vi.fn()
    const remove = vi.fn()
    vi.stubGlobal('window', { addEventListener: add, removeEventListener: remove })
    render()
    expect(interaction.effects).toHaveLength(1)
    const cleanup = interaction.effects[0]()
    expect(add).toHaveBeenCalledOnce()
    expect(add.mock.calls[0][0]).toBe('keydown')
    ;(cleanup as () => void)()
    expect(remove).toHaveBeenCalledWith('keydown', add.mock.calls[0][1])
  })

  it('runs the phase primary action on Meta+Enter or Ctrl+Enter', () => {
    const start = vi.fn()
    const cancel = vi.fn()
    useStore.setState({ runMonteCarlo: start, cancelMonteCarlo: cancel })
    const meta = key()
    expect(handleRunKey(meta.event, 'prepare')).toBe(true)
    expect(meta.preventDefault).toHaveBeenCalledOnce()
    expect(start).toHaveBeenCalledOnce()
    expect(handleRunKey(key({ metaKey: false, ctrlKey: true }).event, 'analyze')).toBe(true)
    expect(start).toHaveBeenCalledTimes(2)
    setMc({ status: 'running', progress: 4, total: 100 })
    handleRunKey(key().event, 'prepare')
    expect(cancel).toHaveBeenCalledOnce()

    const command = vi.fn()
    useStore.setState({ playbackCommand: command })
    handleRunKey(key().event, 'execute')
    expect(command).toHaveBeenCalledWith({ type: 'toggle' })
  })

  it('ignores the key in a text field, without the modifier, and while the run is closed', () => {
    const start = vi.fn()
    useStore.setState({ runMonteCarlo: start })
    const editable = Object.assign(new FakeElement(), { isContentEditable: true })
    for (const target of [new FakeInput(), new FakeTextArea(), new FakeSelect(), editable]) {
      const typed = key({ target: target as unknown as EventTarget })
      expect(handleRunKey(typed.event, 'prepare')).toBe(false)
      expect(typed.preventDefault).not.toHaveBeenCalled()
    }
    expect(handleRunKey(key({ metaKey: false }).event, 'prepare')).toBe(false)
    expect(handleRunKey(key({ key: 'a' }).event, 'prepare')).toBe(false)
    expect(start).not.toHaveBeenCalled()

    useStore.getState().patchScenario({ runMode: 'deterministic' })
    handleRunKey(key().event, 'prepare')
    expect(start).not.toHaveBeenCalled()
  })
})
