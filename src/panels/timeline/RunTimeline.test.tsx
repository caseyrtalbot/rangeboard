import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import type { RunTimelineRow } from '../../analysis/runTimeline'
import { xOf } from '../../charts/timeViewport'
import { formatTime } from '../../geometry/geo'
import { durationOf } from '../../state/selectors'
import type { RunTimelineUi } from '../../state/store'
import { useStore } from '../../state/store'
import { installTrial, observeTrial, unstartTrial } from '../analysis/trialTestState'
import { Axis } from './Axis'
import { LaneItems } from './LaneMarks'
import { panPx, spanBox } from './layout'
import { Overview } from './Overview'
import { Plot } from './Plot'
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

  it('holds the Analyze horizon at the observed end while the cursor scrubs back', () => {
    observeTrial(60, 5)
    expect(render()).toContain('>Shown through T+0:05<')
    useStore.getState().setBoardPhase('analyze')
    const html = render()
    expect(html).toContain('>Shown through T+1:00<')
    // The fixture run is 60 s long, so T+1:00 is the whole record.
    expect(html).toContain('aria-label="Run timeline. Complete. Shown through T+1:00"')
  })

  it('updates the accessible name as the horizon moves', () => {
    observeTrial(60, 20)
    expect(render()).toContain('aria-label="Run timeline. Shown through T+0:20"')
    observeTrial(60, 45)
    expect(render()).toContain('aria-label="Run timeline. Shown through T+0:45"')
  })

  it('names the record complete only once the horizon reaches the run end', () => {
    const endS = durationOf(useStore.getState().scenario)
    useStore.getState().setBoardPhase('analyze')
    observeTrial(endS - 20, 5)
    const cut = `T+${formatTime(endS - 20)}`
    expect(render()).toContain(`aria-label="Run timeline. Shown through ${cut}"`)
    observeTrial(endS, 5)
    const end = `T+${formatTime(endS)}`
    const html = render()
    expect(html).toContain(`aria-label="Run timeline. Complete. Shown through ${end}"`)
    expect(html).toContain(`>Shown through ${end}<`)
  })

  it('puts the axis and the overview under the scrolling rows, as the mockup does', () => {
    const html = render()
    const at = ['runtl-head', 'runtl-scroll', 'runtl-axis', 'runtl-over'].map((c) =>
      html.indexOf(`class="${c}"`),
    )
    expect(at.every((i) => i >= 0)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
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

  it('makes each entity row label a button', () => {
    session({ openGroups: ['threat'] })
    const html = render()
    expect(count(html, 'class="runtl-name runtl-select"')).toBe(3)
    expect(html).toContain('class="runtl-name runtl-select" title="swarm">swarm</button>')
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
    // The sub-lane label is a button that selects the track's threat.
    expect(open).toContain(
      'class="runtl-line runtl-sub"><button type="button" class="runtl-name runtl-select" title="swarm">swarm</button>',
    )
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

describe('RunTimeline transforms', () => {
  const base = { t0S: 30, winS: 60 }
  const glide = 'transition:transform 100ms linear'
  const still = 'transition:none'

  it('draws axis ticks at absolute run-time x inside the rows pan, gliding only with Follow', () => {
    const html = renderToStaticMarkup(
      <Axis base={base} follow={false} durationS={300} widthPx={600} pxPerS={10} />,
    )
    expect(html).toContain(`style="transform:translateX(${panPx(30, 10)}px);${still}"`)
    expect(
      renderToStaticMarkup(
        <Axis base={base} follow={true} durationS={300} widthPx={600} pxPerS={10} />,
      ),
    ).toContain(glide)
    // One window either side of the shown one, clipped at 0: ticks 0 to 150 s every 10 s.
    expect(html).toContain('x1="0"')
    expect(html).toContain('x1="600"')
    expect(html).toContain('x1="1500"')
    expect(html).not.toContain('x1="1600"')
  })

  it('moves the overview window with the same transition', () => {
    const model = { durationS: 300, horizonS: 300, groups: [] }
    const html = renderToStaticMarkup(
      <Overview model={model} base={base} follow={false} widthPx={600} />,
    )
    expect(html).toContain(`style="transform:translateX(60px);${still}" x="0"`)
    expect(
      renderToStaticMarkup(<Overview model={model} base={base} follow={true} widthPx={600} />),
    ).toContain(glide)
  })

  it('keeps the playhead inside the plot at the run end, unrounded like the pan', () => {
    installTrial(300)
    observeTrial(300, 300)
    // A server render reads the initial state, as render() arranges.
    const plot = (t0S: number) => {
      Object.assign(useStore.getInitialState(), useStore.getState())
      return renderToStaticMarkup(
        <Plot
          lines={[]}
          heightPx={100}
          widthPx={600}
          pxPerS={5}
          base={{ t0S, winS: 120 }}
          follow={false}
          durationS={300}
          horizonS={300}
          selected={new Set()}
          onItemClick={() => {}}
          onItemHover={() => {}}
        />,
      )
    }
    const row: RunTimelineRow = {
      key: 'threat:t1',
      kind: 'threat',
      label: 't1',
      meta: '',
      entityId: 't1',
      spans: [],
      marks: [],
    }
    const selected = renderToStaticMarkup(
      <Plot
        lines={[{ t: 'row', key: row.key, row, open: false, inFold: false, y: 18, h: 18 }]}
        heightPx={36}
        widthPx={600}
        pxPerS={5}
        base={{ t0S: 0, winS: 120 }}
        follow={false}
        durationS={300}
        horizonS={300}
        selected={new Set([row.key])}
        onItemClick={() => {}}
        onItemHover={() => {}}
      />,
    )
    expect(selected).toContain('class="runtl-ground-selected" x="0" y="18" width="600" height="18"')
    const end = plot(180)
    expect(end).toContain(`class="runtl-pan" style="transform:translateX(-900px);${still}"`)
    // 1499 - 900 = 599: the playhead's one pixel is the plot's last column.
    expect(end).toContain(`class="runtl-playhead" style="transform:translateX(1499px);${glide}"`)
    observeTrial(300, 100.1)
    expect(plot(10.3)).toContain('translateX(-51.5px)')
    expect(plot(10.3)).toContain('translateX(500.5px)')
  })
})
