import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { emptyScenario } from '../../../model/seed'
import type { Entity, Scenario } from '../../../model/types'
import { sampleCount } from '../../../analysis/series'
import type { BandSeries, McSummary, Stat } from '../../../playback/mcRun'
import { DEFAULT_KPI_TILES, KPI_KEYS } from '../../../state/analysisLayout'
import { IDLE_MC, useStore } from '../../../state/store'
import { KpiTilesWidget } from './KpiTilesWidget'
import { KPI_LABELS } from './labels'

/** One builtin quadcopter with a straight flight path, so the run has a track. */
function threatScenario(): Scenario {
  const scenario = emptyScenario()
  const uas: Entity = {
    id: 'uas-1',
    name: 'Mavic 1',
    kind: 'uas',
    specId: 'lib-mavic3',
    pos: { x: -3000, y: 0 },
    headingDeg: 90,
    color: null,
    notes: '',
  }
  scenario.entities = [uas]
  scenario.paths = [
    { id: 'path-1', entityId: uas.id, points: [{ x: -3000, y: 0 }, { x: 3000, y: 0 }], speedMps: 20, startDelayS: 0 },
  ]
  return scenario
}

/** The same laydown plus a defended asset and a radar, so a warning time exists. */
function warningScenario(): Scenario {
  const scenario = threatScenario()
  const at = (id: string, kind: Entity['kind'], specId: string, x: number, y: number): Entity => ({
    id, name: id.toUpperCase(), kind, specId, pos: { x, y }, headingDeg: 0, color: null, notes: '',
  })
  scenario.entities = [
    ...scenario.entities,
    at('a1', 'asset', 'lib-asset', 0, 0),
    at('s1', 'sensor', 'lib-giraffe1x', 0, 2000),
  ]
  return scenario
}

/** A flat band on the scenario grid: mean, p10 and p90 constant over every step. */
function band(n: number, mean: number, p10: number, p90: number): BandSeries {
  const fill = (v: number) => new Array<number>(n).fill(v)
  return {
    mean: fill(mean), lo: fill(p10), hi: fill(p90),
    p10: fill(p10), p90: fill(p90), p025: fill(p10), p975: fill(p90),
  }
}

/**
 * A time Stat with mean 12 s, a 10 to 14 interval (half-width 2 s) and
 * `n` finite samples of 100 replicates.
 */
function timeStat(n: number): Stat {
  return {
    mean: 12, sd: 10, se: 1, lo: 10, hi: 14, conf: 0.95,
    p10: 10, p90: 15, p025: 9, p975: 16, n, total: 100,
    defined: { p: n / 100, lo: 0, hi: 1 },
  }
}

/** A hand-built summary of 100 replicates over the current scenario's grid. */
function summaryOf(scenario: Scenario, detectedIn = 100): McSummary {
  const n = sampleCount(scenario)
  const stat = timeStat(detectedIn)
  return {
    seed: 4821,
    replicates: 100,
    stopped: { rule: 'replicates', at: 100 },
    durationS: (n - 1) * 0.5,
    kills: band(n, 0.8, 0, 1),
    leakers: band(n, 0.2, 0, 1),
    detected: band(n, 4.5, 4, 5),
    tracked: band(n, 4, 4, 4),
    engaged: band(n, 1, 1, 1),
    firstDetectS: stat,
    minWarningS: stat,
    perThreat: {},
    perEffector: {},
    elapsedMs: 0,
  }
}

/** Install a summary in the mc slice for the current run id under `status`. */
function setMc(status: 'done' | 'stale', detectedIn = 100): void {
  const st = useStore.getState()
  useStore.setState({
    mc: {
      ...IDLE_MC,
      status,
      runId: st.playback.runId,
      summary: summaryOf(st.scenario, detectedIn),
      basisSignature: 'test',
      total: 100,
      progress: 100,
    },
  })
}

// zustand 5 gives react-dom/server the store's initial state, not the live one,
// so every static render of a store-reading widget needs the two in step.
function render(params: Record<string, unknown>, customize = false): string {
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(
    <KpiTilesWidget
      id="rs-kpi"
      params={params}
      collapsed={false}
      customize={customize}
      index={0}
      count={1}
    />,
  )
}

describe('KpiTilesWidget', () => {
  beforeEach(() => {
    useStore.getState().replaceScenario(threatScenario())
  })

  it('renders the six default tiles by label when params name no tile', () => {
    const html = render({})
    for (const key of DEFAULT_KPI_TILES) expect(html).toContain(KPI_LABELS[key].label)
    expect(html).toContain('tiles c3')
    expect(html).toContain(`${DEFAULT_KPI_TILES.length} of ${KPI_KEYS.length}`)
    expect(html).not.toContain(KPI_LABELS.minWarning.label)
  })

  it('drops unknown keys and lays four or fewer tiles in two columns', () => {
    const html = render({ tiles: ['detect', 'bogus', 'minWarning'] })
    expect(html).toContain('tiles c2')
    expect(html).toContain(KPI_LABELS.detect.label)
    expect(html).toContain(KPI_LABELS.minWarning.label)
    expect(html).toContain('2 of 13')
  })

  it('reads a dash and "not yet" on time tiles before the first play', () => {
    const html = render({ tiles: ['firstDetect'] })
    expect(html).toContain('not yet')
  })

  it('shows the checkbox grid over every key in customize mode', () => {
    const html = render({}, true)
    expect(html).toContain('class="params"')
    for (const key of KPI_KEYS) expect(html).toContain(KPI_LABELS[key].label)
    expect(html).not.toContain('tiles c3')
  })

  it('reads the replicate mean and the half-width sub from a finished summary', () => {
    useStore.getState().advanceRun(1)
    useStore.getState().pauseRun()
    setMc('done')
    const html = render({ tiles: ['detect', 'killEk', 'firstDetect'] })
    expect(html).toContain('4.5<small>/1</small>')
    // Count bands carry lo 4, hi 5 (and 0, 1): half-width 0.5 over 100 replicates.
    expect(html).toContain('±0.5 (95%) · 100')
    expect(html).not.toContain('p10 to p90')
    expect(html).toContain('3 of 13 · mean of 100')
    // A time tile stays "not yet" until the cursor reaches the mean.
    expect(html).toContain('not yet')
    useStore.setState({ mc: IDLE_MC })
  })

  it('reads the half-width sub and the defined count on a time Stat tile', () => {
    // Cursor past the 12 s mean, so the time tile shows its value and sub.
    useStore.getState().advanceRun(13)
    useStore.getState().pauseRun()
    setMc('done')
    const full = render({ tiles: ['firstDetect'] })
    expect(full).toContain('±2.0 s (95%) · 100')
    expect(full).not.toContain('detected in')
    setMc('done', 98)
    const partial = render({ tiles: ['firstDetect'] })
    expect(partial).toContain('±2.0 s (95%) · 98 · detected in 98 of 100')
    useStore.setState({ mc: IDLE_MC })
  })

  it('words an undefined warning replicate as warning time, and drops the sub at n 0', () => {
    // R-F-13: a replicate with no warning time had no defended asset, which is
    // not a detection miss. The tile needs an arrival, so the laydown gains a
    // defended asset and a radar; the threat crosses the 500 m boundary at
    // 125 s, so the cursor sits past it.
    useStore.getState().replaceScenario(warningScenario())
    useStore.getState().advanceRun(130)
    useStore.getState().pauseRun()
    setMc('done', 40)
    const partial = render({ tiles: ['minWarning'] })
    expect(partial).toContain('±2.0 s (95%) · 40 · warning time in 40 of 100')
    expect(partial).not.toContain('detected in')
    setMc('done', 0)
    const none = render({ tiles: ['minWarning'] })
    expect(none).not.toContain('warning time in')
    expect(none).not.toContain('(95%)')
    useStore.setState({ mc: IDLE_MC })
  })

  it('draws no sub and no replicate meta from a stale summary', () => {
    setMc('stale')
    const html = render({ tiles: ['detect'] })
    expect(html).not.toContain('p10 to p90')
    expect(html).not.toContain('mean of')
    expect(html).toContain('1 of 13')
    useStore.setState({ mc: IDLE_MC })
  })

  it('says so when no threat has a flight path', () => {
    useStore.getState().replaceScenario(emptyScenario())
    expect(render({})).toContain('No threats with flight paths.')
  })
})
