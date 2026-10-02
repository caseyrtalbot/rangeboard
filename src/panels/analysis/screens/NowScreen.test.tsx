import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../../../state/store'
import { IDLE_TRIAL } from '../../../state/runState'
import { installTrial, observeTrial, unstartTrial } from '../trialTestState'
import * as forecast from '../../../analysis/impact'
import { trialKpisAt } from '../../../analysis/liveStats'
import { trialResultOf } from '../../../analysis/trialResult'
import { NowScreen } from './NowScreen'

type KeyHandler = (event: { key: string; preventDefault: () => void }) => void
// Static markup runs no handlers, so the rendered row and header handlers are captured
// here and called directly; useState keeps its value across renders.
const interaction = vi.hoisted(() => ({
  cursor: 0,
  states: [] as unknown[],
  rows: new Map<string, { onClick: () => void; onKeyDown: KeyHandler }>(),
  headers: new Map<string, () => void>(),
}))
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return {
    ...actual,
    useState: (initial: unknown) => {
      const index = interaction.cursor++
      if (!(index in interaction.states))
        interaction.states[index] = typeof initial === 'function' ? initial() : initial
      return [
        interaction.states[index],
        (value: unknown) => {
          interaction.states[index] = value
        },
      ]
    },
  }
})
vi.mock('react/jsx-dev-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react/jsx-dev-runtime')>()
  const jsxDEV: typeof actual.jsxDEV = (type, props, key, ...rest) => {
    const p = props as { children?: unknown; onClick?: () => void; onKeyDown?: KeyHandler }
    if (type === 'tr' && key != null && p.onClick && p.onKeyDown)
      interaction.rows.set(String(key), { onClick: p.onClick, onKeyDown: p.onKeyDown })
    if (type === 'button' && typeof p.children === 'string' && p.onClick)
      interaction.headers.set(p.children, p.onClick)
    return actual.jsxDEV(type, props, key, ...rest)
  }
  return { ...actual, jsxDEV }
})

function render() {
  Object.assign(useStore.getInitialState(), useStore.getState())
  interaction.cursor = 0
  interaction.rows.clear()
  interaction.headers.clear()
  return renderToStaticMarkup(<NowScreen />)
}

beforeEach(() => {
  interaction.states = []
})
afterEach(() => vi.restoreAllMocks())

// A status line inside role="status" renders as an EmptyRow; the State markup is not matched.
const emptyRow = (sentence: string) =>
  new RegExp(
    `<div role="status"><p class="empty-row">(?:(?!</p>).)*${sentence.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</span></p></div>`,
  )

const row = (html: string, name: string) => {
  const start = html.indexOf(`<td class="mono" title="${name}">`)
  expect(start).toBeGreaterThan(-1)
  return html.slice(start, html.indexOf('</tr>', start))
}
const cell = (html: string, key: string) => {
  const start = html.indexOf(`<div class="mon-f-k">${key}</div>`)
  return html.slice(html.lastIndexOf('<div', start - 1), html.indexOf('</small>', start))
}

// Execute holds the Play control, so the placeholder carries it inline.
const nowPlay =
  '<p class="muted small">No trial yet. Press <button type="button" class="mini">Play</button> to run one.</p>'

describe('NowScreen cursor telemetry', () => {
  it('ready: retains exactly one pre-Play placeholder', () => {
    installTrial()
    unstartTrial()
    expect(render()).toBe(nowPlay)
    useStore.setState({ trial: IDLE_TRIAL })
    expect(render()).toBe(nowPlay)
  })

  it('mid-run: counts the funnel, holds, chain pips, TTA and the systems without inputs', () => {
    installTrial(3)
    const spy = vi.spyOn(forecast, 'engagementPicture')
    const html = render()
    // The clock, bar, replicate, seed and speed card is gone.
    expect(html).not.toContain('live-')
    expect(html).not.toContain('Replicate')
    expect(cell(html, 'DET')).toContain('title="Detected: 1 of 3 tracks"')
    expect(cell(html, 'ENG')).toContain('title="Engaged: salvo assigned: 2 of 3 tracks"')
    expect(cell(html, 'DEF')).toContain('of 9 members"')
    expect(cell(html, 'LEAK')).toContain('of 9 members"')
    expect(html).toContain('>swarm</td>')
    expect(html).toContain('>moving</td>')
    expect(html).toContain('>flyby</td>')
    expect(html).not.toContain('>parked</td>')
    expect(html).toContain('>radar</td>')
    expect(row(html, 'moving')).toContain('class="mon-pips"')
    expect(html).toContain('<div class="sys-group">Sensors</div>')
    expect(html).toContain('<div class="sys-group">Effectors</div>')
    expect(html).toContain('7/10')
    expect(html).toContain('cont.')
    expect(html).toContain('1 held · 0:02')
    for (const excluded of [
      'New run',
      'Forecast and analysis',
      'Fire doctrine',
      'Environment',
      'Requirement',
      'Sensitivity',
      'Forecast available in Analyze',
      '<input',
      '<select',
    ]) {
      expect(html).not.toContain(excluded)
    }
    expect(spy).not.toHaveBeenCalled()
  })

  it('counts DEF and LEAK in members as trialKpisAt does', () => {
    installTrial(60)
    observeTrial(60, 60)
    const html = render()
    const state = useStore.getState()
    const trial = state.trial
    const view = trialResultOf(trial.scenario!, trial.manifest!, trial.result!)
    const kpis = trialKpisAt(view, 60)
    expect(cell(html, 'DEF')).toContain(`Defeated before arrival: ${kpis.kills} of 9 members"`)
    expect(cell(html, 'DEF')).toContain(`<div class="mon-f-v">${kpis.kills}<small>/9`)
    expect(cell(html, 'LEAK')).toContain(`<div class="mon-f-v">${kpis.reportedLeakers}<small>/9`)
  })

  it('sorts by TTA ascending, tones it by D13, and reads arrived after arrival', () => {
    installTrial(3)
    const html = render()
    const order = [...html.matchAll(/<td class="mono" title="([^"]+)">/g)].map((m) => m[1])
    const arrivals = new Map(
      useStore.getState().trial.result!.assessments.map((a) => [a.uasId, a.arrivalS]),
    )
    const tta = order.map((id) => (arrivals.get(id) ?? Infinity) - 3)
    expect(tta).toEqual([...tta].sort((a, b) => a - b))
    // A 60 s fixture puts every arrival under the critical threshold.
    expect(html).toContain('class="mono mon-c-tta tta-critical"')
    observeTrial(60, 60)
    expect(render()).toContain('tta-critical">arrived</td>')
  })

  it('selects a track from its row with origin panel and keeps the tab', () => {
    installTrial(3)
    useStore.setState(({ ui }) => ({
      ui: { ...ui, rightTab: 'analysis', selectionOrigin: 'board' },
    }))
    const html = render()
    expect(html).toContain('class="mon-row" tabindex="0"')
    expect(html).not.toContain('aria-current')
    // A click selects with origin panel and leaves the tab alone (D7).
    interaction.rows.get('moving')!.onClick()
    let state = useStore.getState()
    expect(state.selection.entityIds).toEqual(['moving'])
    expect(state.ui.selectionOrigin).toBe('panel')
    expect(state.ui.rightTab).toBe('analysis')
    expect(row(render(), 'moving')).not.toContain('aria-current')
    const selectedRow = render().match(/<tr class="mon-row on"[^>]*>/)?.[0]
    expect(selectedRow).toContain('aria-current="true"')
    expect(render().match(/aria-current/g)).toHaveLength(1)
    // Enter and Space select through the key handler; other keys do nothing.
    const preventDefault = vi.fn()
    useStore.setState(({ ui }) => ({ ui: { ...ui, selectionOrigin: 'board' } }))
    interaction.rows.get('swarm')!.onKeyDown({ key: 'a', preventDefault })
    expect(useStore.getState().selection.entityIds).toEqual(['moving'])
    expect(preventDefault).not.toHaveBeenCalled()
    interaction.rows.get('swarm')!.onKeyDown({ key: 'Enter', preventDefault })
    state = useStore.getState()
    expect(state.selection.entityIds).toEqual(['swarm'])
    expect(state.ui.selectionOrigin).toBe('panel')
    interaction.rows.get('flyby')!.onKeyDown({ key: ' ', preventDefault })
    state = useStore.getState()
    expect(state.selection.entityIds).toEqual(['flyby'])
    expect(preventDefault).toHaveBeenCalledTimes(2)
    expect(state.ui.rightTab).toBe('analysis')
  })

  it('sorts State ascending from the least advanced stage, like every other column', () => {
    installTrial(60)
    observeTrial(60, 60)
    render()
    interaction.headers.get('State')!()
    const states = (html: string) =>
      [...html.matchAll(/<td class="mon-c-state">.*?>(\w+)<\/span><\/td>/g)].map((m) => m[1])
    const ascending = render()
    expect(ascending).toContain('aria-sort="ascending"><button type="button">State')
    const rank = (words: string[]) =>
      words.map((w) =>
        [
          'undetected',
          'detected',
          'tracked',
          'identified',
          'targeted',
          'engaged',
          'defeated',
          'leaked',
        ].indexOf(w),
      )
    const up = rank(states(ascending)).map((n) => Math.min(n, 6))
    expect(up.length).toBeGreaterThan(1)
    expect(up).toEqual([...up].sort((a, b) => a - b))
    interaction.headers.get('State')!()
    const down = rank(states(render())).map((n) => Math.min(n, 6))
    expect(down).toEqual([...down].sort((a, b) => b - a))
  })

  it('lists the last five salvo and identification events, newest first', () => {
    installTrial(60)
    observeTrial(60, 60)
    const html = render()
    const feed = html.slice(html.indexOf('class="mon-feed"'))
    const times = [...feed.matchAll(/<span class="mon-ev-t">([^<]+)<\/span>/g)].map((m) => m[1])
    expect(times).toHaveLength(5)
    const seconds = times.map((t) => {
      const [m, s] = t.split(':').map(Number)
      return m * 60 + s
    })
    expect(seconds).toEqual([...seconds].sort((a, b) => b - a))
    expect(feed).toMatch(/salvo \d/)
  })

  it('uses the requested state inks at reached milestones', () => {
    installTrial(1.2)
    useStore.setState(({ trial }) => ({
      trial: {
        ...trial,
        result: {
          ...trial.result!,
          assessments: trial.result!.assessments.map((a) =>
            a.uasId === 'flyby' ? { ...a, windowS: [1, 2] as [number, number] } : a,
          ),
        },
      },
    }))
    expect(render()).toContain('class="state warning"')
    const { result } = installTrial(60)
    // Keep the retained scenario and draw identity; isolate two row-state boundaries.
    const assessments = result.assessments.map((a) =>
      a.uasId === 'flyby'
        ? { ...a, classificationAtS: { ...a.classificationAtS, hostileAtS: 2 } }
        : a,
    )
    const movingEvent = result.report.events[0]
    const events = [
      ...result.report.events,
      { ...movingEvent, shipIdx: 0 },
      { ...movingEvent, shipIdx: 1 },
    ]
    useStore.setState(({ trial }) => ({
      trial: { ...trial, result: { ...result, assessments, report: { ...result.report, events } } },
    }))
    const html = render()
    expect(html).toContain('class="state-square hollow"')
    expect(html).toContain('>identified</span>')
    expect(html).toContain('style="color:var(--ghost)"')
    expect(html).toContain('>defeated</span>')
  })

  it('reads a late kill as leaked with its own word, never defeated', () => {
    const { result } = installTrial(60)
    const swarmLate = result.report.events.find((e) => e.uasId === 'swarm' && e.tEffectS === 8)!
    // swarm's last ship falls at 10 s, after its 5 s arrival.
    const events = [...result.report.events, { ...swarmLate, tS: 9, tEffectS: 10, shipIdx: 0 }]
    useStore.setState(({ trial }) => ({
      trial: { ...trial, result: { ...result, report: { ...result.report, events } } },
    }))
    const html = render()
    const swarm = row(html, 'swarm')
    expect(swarm).toContain('>leaked</span>')
    expect(html).toContain('title="swarm · leaked · late kill T+0:10')
    expect(swarm).toContain('class="state critical"')
    expect(swarm).toContain('class="mon-pips leak"')
    expect(swarm).not.toContain('defeated')
    expect(swarm).not.toContain('defeat')
    expect(swarm).toMatch(/title="[^"]*› leaked" aria-label="[^"]*› leaked"/)
    // The pips still fill all six.
    expect(swarm.match(/<i class="(on|now)"><\/i>/g)).toHaveLength(6)
  })

  it('scrubbing a completed run back hides future effects and identification', () => {
    installTrial(60)
    observeTrial(60, 1)
    const html = render()
    expect(cell(html, 'DEF')).toContain('<div class="mon-f-v">0<small>/9')
    expect(cell(html, 'ID')).toContain('<div class="mon-f-v">0<small>/3')
    expect(html).toContain('9/10')
    expect(html).not.toContain('identified hostile')
  })

  it('preserves preparation and error states without populating results', () => {
    installTrial()
    const trial = useStore.getState().trial
    useStore.setState({ trial: { ...trial, status: 'preparing' } })
    expect(render()).toMatch(emptyRow('Preparing trial'))
    useStore.setState({ trial: { ...trial, status: 'error', error: 'Preparation failed' } })
    expect(render()).toMatch(emptyRow('Preparation failed'))
    expect(render()).not.toContain('<table')
  })
})
