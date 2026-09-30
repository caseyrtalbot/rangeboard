import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../../../state/store'
import { IDLE_TRIAL } from '../../../state/runState'
import { installTrial, observeTrial, unstartTrial } from '../trialTestState'
import * as forecast from '../../../analysis/impact'
import { trialKpisAt } from '../../../analysis/liveStats'
import { trialResultOf } from '../../../analysis/trialResult'
import { NowScreen } from './NowScreen'

function render() {
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<NowScreen />)
}

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
  '<p class="muted small">No trial yet. Press <button class="mini">Play</button> to run one.</p>'

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
    const html = render()
    expect(html).toContain('class="mon-row" tabindex="0"')
    useStore.getState().select({ entityIds: ['moving'] }, false, 'panel')
    expect(useStore.getState().ui.selectionOrigin).toBe('panel')
    expect(render()).toContain('class="mon-row on"')
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
