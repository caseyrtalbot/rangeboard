import { EMPTY_HORIZON, FULL_RUN, type ExecutionHorizon } from '../../../analysis/horizon'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Scenario } from '../../../model/types'
import { sampleCount } from '../../../analysis/projection'
import type { BandSeries, McSummary, Stat } from '../../../playback/mcRun'
import { DEFAULT_KPI_TILES, KPI_KEYS } from '../../../state/analysisLayout'
import { useStore } from '../../../state/store'
import { IDLE_MC } from '../../../state/runState'
import { KpiTilesWidget } from './KpiTilesWidget'
import { TRIAL_KPI_LABELS as KPI_LABELS } from './labels'
import { installTrial, observeTrial, unstartTrial } from './trialTestState'

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
    mean: 12, sd: 10, se: 1, lo: 10, hi: 14, conf: 0.95, interval: 't',
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
    firmTrackS: stat,
    minWarningS: stat,
    perThreat: {},
    perEffector: {},
    elapsedMs: 0,
  }
}

/** Install a summary in the mc slice for the current run id under `status`. */
function setMc(status: 'done' | 'stale' | 'running' | 'error', detectedIn = 100): void {
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

function render(params: Record<string, unknown>, customize = false, horizon: ExecutionHorizon = FULL_RUN): string {
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(
    <KpiTilesWidget
      horizon={horizon}
      id="rs-kpi"
      params={params}
      collapsed={false}
      customize={customize}
      index={0}
      count={1}
    />,
  )
}

describe('KpiTilesWidget trial counts', () => {
  beforeEach(() => { installTrial() })

  it('preserves default tile keys and the three-column layout', () => {
    const html = render({})
    for (const key of DEFAULT_KPI_TILES) expect(html).toContain(KPI_LABELS[key].label)
    expect(html).toContain('tiles c3')
    expect(html).not.toContain(KPI_LABELS.minWarning.label)
  })

  it('drops unknown keys, preserves params and uses two columns for four or fewer tiles', () => {
    const params = { tiles: ['detect', 'bogus', 'minWarning'] }
    const before = structuredClone(params)
    const html = render(params)
    expect(html).toContain('tiles c2')
    expect(html).toContain(KPI_LABELS.detect.label)
    expect(html).toContain(KPI_LABELS.minWarning.label)
    expect(html.match(/class="tile"/g)).toHaveLength(2)
    expect(params).toEqual(before)
  })

  it('keeps all saved keys selectable in customization before Play', () => {
    unstartTrial()
    const html = render({}, true)
    expect(html).toContain('class="params"')
    for (const key of KPI_KEYS) expect(html).toContain(KPI_LABELS[key].label)
    expect(html.match(/type="checkbox"/g)).toHaveLength(KPI_KEYS.length)
  })

  it.each(['done', 'stale', 'running', 'error'] as const)('never substitutes a %s MC summary for realized counts', status => {
    const before = render({ tiles: [...KPI_KEYS] })
    setMc(status)
    expect(render({ tiles: [...KPI_KEYS] })).toBe(before)
    expect(before).toContain('trial count')
    expect(before).not.toMatch(/E\[|Expected|planning envelope|mean CI|MC/)
  })

  it('reports integer pre-arrival, late and arrival counts independently', () => {
    observeTrial(9)
    const html = render({ tiles: ['killEk', 'lateEk', 'leakEn'] })
    expect(html).toContain('Pre-arrival defeats</span><span class="tv">3<')
    expect(html).toContain('Late defeats</span><span class="tv">2<')
    expect(html).toContain('Arrived undefeated</span><span class="tv bad">3<')
    expect(html).toContain('T+0:09 observed')
  })

  it('keeps kills and milestone times pending until their exact effect boundary', () => {
    observeTrial(1.99)
    const params = { tiles: ['killEk', 'firstEffect', 'detectToEffect'] }
    const pending = render(params)
    expect(pending).toContain('class="tv">0<')
    expect(pending.match(/class="tv">—</g)).toHaveLength(2)
    observeTrial(2)
    const landed = render(params)
    expect(landed).toContain('class="tv">2<')
    expect(landed).toContain('class="tv">0:02<')
    expect(landed).not.toContain('not yet')
  })

  it('uses retained held/coasting tracks, then drops them after their interval', () => {
    observeTrial(3.5)
    expect(render({ tiles: ['trackNow'] })).toContain('1<small>/3</small>')
    observeTrial(5)
    expect(render({ tiles: ['trackNow'] })).toContain('0<small>/3</small>')
  })

  it('caps all views at observation and honors a backward scrub', () => {
    const at3 = render({ tiles: [...KPI_KEYS] })
    observeTrial(3, 40)
    expect(render({ tiles: [...KPI_KEYS] })).toBe(at3)
    observeTrial(3, 1)
    expect(render({ tiles: ['killEk'] })).toContain('class="tv">0<')
  })

  it('shows no outcomes before Play even with a prepared trial, a forward cursor and finished MC', () => {
    unstartTrial()
    setMc('done')
    const html = render({ tiles: [...KPI_KEYS] }, false, EMPTY_HORIZON)
    expect(html).toContain('Simulated trial · ready')
    expect(html).not.toContain('class="tile"')
    expect(html).not.toMatch(/T\+|mean CI|class="tv"/)
  })
})
