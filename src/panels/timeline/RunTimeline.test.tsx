import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import type { RunTimelineRow } from '../../analysis/runTimeline'
import { xOf } from '../../charts/timeViewport'
import type { RunTimelineUi } from '../../state/store'
import { useStore } from '../../state/store'
import { installTrial, observeTrial, unstartTrial } from '../analysis/trialTestState'
import { LaneItems } from './LaneMarks'
import { panPx, spanBox } from './layout'
import { RunTimeline } from './RunTimeline'

function render() {
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<RunTimeline />)
}

function session(patch: Partial<RunTimelineUi>) {
  const ui = useStore.getState().ui
  useStore.setState({ ui: { ...ui, runTimeline: { ...ui.runTimeline, ...patch } } })
}

const count = (html: string, needle: string) => html.split(needle).length - 1

describe('RunTimeline states', () => {
  beforeEach(() => {
    installTrial(3)
    useStore.getState().setBoardPhase('execute')
  })

  it('renders one status line and the unobserved name before Play', () => {
    unstartTrial()
    const html = render()
    expect(html).toContain('No trial yet. Press Play in Execute to run one.')
    expect(html).toContain('id="run-timeline"')
    expect(html).toContain('role="group"')
    expect(html).toContain('aria-label="Run timeline. No outcomes observed yet"')
    expect(html).not.toContain('runtl-line')
  })

  it.each([
    ['preparing', 'Preparing trial'],
    ['error', 'Trial preparation failed'],
    ['cancelled', 'Trial cancelled'],
  ] as const)('renders no rows when %s', (status, text) => {
    const trial = useStore.getState().trial
    useStore.setState({
      trial: { ...trial, status, error: status === 'error' ? 'Trial preparation failed' : null },
    })
    const html = render()
    expect(html).toContain(text)
    expect(html).not.toContain('runtl-line')
  })

  it('names the horizon in the header and the accessible name', () => {
    const html = render()
    expect(html).toContain('aria-label="Run timeline. Shown through T+0:03"')
    expect(html).toContain('>Shown through T+0:03<')
    expect(html).toContain('T+ from run start')
  })
})

describe('RunTimeline rows', () => {
  beforeEach(() => {
    installTrial(3)
    useStore.getState().setBoardPhase('execute')
  })

  it('starts with every group collapsed to its summary row', () => {
    const html = render()
    for (const name of ['All sensors', 'All effectors', 'All threats']) expect(html).toContain(name)
    expect(count(html, 'aria-expanded="false"')).toBe(3)
    expect(html).not.toContain('aria-label="Hide')
    expect(count(html, 'class="runtl-summary"')).toBe(3)
  })

  it('expands a group to its member rows with hide controls', () => {
    session({ openGroups: ['threat'] })
    const html = render()
    expect(html).not.toContain('All threats')
    expect(html).toContain('All sensors')
    for (const id of ['swarm', 'moving', 'flyby']) expect(html).toContain(`aria-label="Hide ${id}"`)
    expect(html).not.toContain('aria-label="Hide radar"')
  })

  it('expands a sensor row to one sub-lane per held track', () => {
    session({ openGroups: ['sensor'] })
    const closed = render()
    expect(closed).toContain('aria-label="Tracks held by radar"')
    expect(closed).not.toContain('runtl-sub')
    useStore.getState().toggleRunTimelineSensor('sensor:radar')
    const open = render()
    expect(open).toMatch(/aria-expanded="true" aria-label="Tracks held by radar"/)
    expect(count(open, 'class="runtl-line runtl-sub"')).toBe(1)
    expect(open).toContain('title="swarm">swarm</div>')
  })

  it('hides a row for the session and restores it with Show all', () => {
    session({ openGroups: ['threat'] })
    useStore.getState().hideRunTimelineRow('threat:swarm')
    const hidden = render()
    expect(hidden).not.toContain('aria-label="Hide swarm"')
    expect(hidden).toContain('Show all (1 hidden)')
    expect(hidden).toContain('2 · 1 hidden')
    useStore.getState().showAllRunTimelineRows()
    const shown = render()
    expect(shown).toContain('aria-label="Hide swarm"')
    expect(shown).not.toContain('Show all')
  })

  it('draws no item past the horizon, through the model', () => {
    session({ openGroups: ['effector', 'threat'] })
    const early = render()
    expect(early).not.toContain('runtl-m-miss"')
    expect(early).not.toContain('runtl-m-arrival')
    expect(early).toContain('>9 left<')
    expect(early).not.toContain('>6 left<')
    observeTrial(60)
    const late = render()
    expect(late).toContain('runtl-m-miss"')
    expect(late).toContain('runtl-m-arrival')
    expect(late).toContain('>6 left<')
  })
})

describe('RunTimeline viewport mapping', () => {
  const row: RunTimelineRow = {
    key: 'effector:gun',
    kind: 'effector',
    label: 'Gun',
    meta: '',
    entityId: 'gun',
    spans: [{ kind: 'flight', startS: 40, endS: 52 }],
    marks: [{ kind: 'release', tS: 40, after: '3 left' }],
  }

  it('maps a span to absolute pixels that the pan shifts onto the viewport', () => {
    const viewport = { t0S: 30, winS: 60 }
    const widthPx = 600
    const pxPerS = widthPx / viewport.winS
    const box = spanBox(row.spans[0], pxPerS)
    expect(box).toEqual({ x: 400, w: 120 })
    const x = xOf(viewport, widthPx)
    expect(box.x + panPx(viewport.t0S, pxPerS)).toBeCloseTo(x(40), 9)
    expect(box.x + box.w + panPx(viewport.t0S, pxPerS)).toBeCloseTo(x(52), 9)
    const html = renderToStaticMarkup(
      <svg>
        <LaneItems row={row} y={0} h={18} pxPerS={pxPerS} hatch="url(#h)" />
      </svg>,
    )
    expect(html).toContain('x="400" y="4" width="120" height="10"')
    expect(html).toContain('>12 s<')
    expect(html).toContain('>3 left<')
  })

  it('prints a duration only on a span at least 44 px wide', () => {
    const html = renderToStaticMarkup(
      <svg>
        <LaneItems row={row} y={0} h={18} pxPerS={3} hatch="url(#h)" />
      </svg>,
    )
    expect(html).toContain('width="36"')
    expect(html).not.toContain('>12 s<')
  })
})
