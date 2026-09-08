import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { emptyScenario } from '../../model/seed'
import type { McState } from '../../state/runState'
import { useStore } from '../../state/store'
import { IDLE_MC } from '../../state/runState'
import { runSettings } from '../../model/types'
import { LiveStrip, McPopover } from './LiveStrip'

// zustand 5 gives react-dom/server the store's initial state, not the live one,
// so every static render of a store-reading panel needs the two in step.
function render(): string {
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<LiveStrip />)
}

function setMc(patch: Partial<McState>): void {
  useStore.setState({ mc: { ...IDLE_MC, runId: useStore.getState().playback.runId, ...patch } })
}

/** The popover rendered on its own; the strip keeps it closed in static markup. */
function renderPopover(): string {
  Object.assign(useStore.getInitialState(), useStore.getState())
  const st = useStore.getState()
  return renderToStaticMarkup(<McPopover run={runSettings(st.scenario)} mc={st.mc} />)
}

/** The run button of the popover. */
function runButton(html: string): string {
  return html.match(/<button class="mc-run"[^>]*>[^<]*<\/button>/)?.[0] ?? ''
}

/** The chip element: the one button with a `chip` class. */
function chip(html: string): string {
  return html.match(/<button class="chip[^"]*"[^>]*>[^<]*<\/button>/)?.[0] ?? ''
}

describe('LiveStrip mode chip', () => {
  beforeEach(() => {
    const st = useStore.getState()
    st.replaceScenario(emptyScenario())
    st.addEntityFromModel('lib-giraffe1x', { x: 0, y: 0 })
    st.addEntityFromModel('lib-mavic3', { x: 0, y: -3000 })
    const uas = useStore.getState().scenario.entities.find((e) => e.kind === 'uas')!
    useStore.getState().beginPath(uas.id)
    useStore.getState().addDraftPoint({ x: 0, y: -100 })
    useStore.getState().finishPath()
    useStore.setState({ mc: IDLE_MC })
  })

  it('shows DET as a closed popover button under the deterministic mode', () => {
    const el = chip(render())
    expect(el).toContain('class="chip det"')
    expect(el).toContain('>DET<')
    expect(el).toContain('aria-expanded="false"')
    expect(render()).toContain('<span class="chip-meta">envelope · Pd threshold</span>')
    expect(render()).not.toContain('mc-pop')
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
    expect(render()).toContain(
      '<span class="chip-meta">estimate · 100 replicates · total</span>',
    )
  })

  it('warns when the configuration changed since the replicates ran', () => {
    useStore.getState().patchScenario({ runMode: 'monte-carlo' })
    setMc({ status: 'stale', progress: 100, total: 100 })
    const el = chip(render())
    expect(el).toContain('class="chip mc warn"')
    expect(el).toContain('MC 100 · stale')
  })

  it('retains an unscoped forward preview time', () => {
    useStore.getState().setBoardPhase('analyze')
    useStore.getState().advanceRun(1)
    useStore.getState().scrubTo(60)
    const html = render()
    expect(html).toContain('T+1:00')
    expect(html).toContain('>Preview<')
  })

  it('caps Execute time text after forward and backward scrubs', () => {
    useStore.getState().setBoardPhase('execute')
    useStore.getState().advanceRun(1)
    useStore.getState().scrubTo(60)
    const html = render()
    expect(html).toContain('T+0:01')
    expect(html).not.toContain('1:00')
    useStore.getState().advanceRun(60)
    useStore.getState().scrubTo(1)
    expect(render()).toContain('observed through 0:01')
    expect(render()).not.toContain('1:00')
  })

  it('shows an empty Execute clock before Play', () => {
    useStore.getState().setBoardPhase('execute')
    const html = render()
    expect(html).toContain('T+0:00')
    expect(html).toContain('>Ready<')
    expect(html).toContain('no prior-run telemetry')
  })

})

describe('McPopover run button', () => {
  beforeEach(() => {
    useStore.getState().replaceScenario(emptyScenario())
    useStore.setState({ mc: IDLE_MC })
  })

  it('offers a run while idle and a stop while a run is live', () => {
    useStore.getState().patchScenario({ runMode: 'monte-carlo' })
    expect(runButton(renderPopover())).toContain('>Run replicates<')
    setMc({ status: 'running', progress: 40, total: 100 })
    const live = runButton(renderPopover())
    expect(live).toContain('>Stop<')
    expect(live).not.toContain('disabled')
  })

  it('stays disabled under the deterministic mode', () => {
    expect(runButton(renderPopover())).toContain('disabled')
  })
})
