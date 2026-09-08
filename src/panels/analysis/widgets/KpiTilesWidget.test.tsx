import { EMPTY_HORIZON, FORECAST_IN_ANALYZE, FULL_RUN, type ExecutionHorizon } from '../../../analysis/horizon'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import firingFixture from '../../../../docs/field-te/evidence/onboarding-2026-09-04/firing-scenario.json'
import { engagementPicture } from '../../../analysis/impact'
import { formatTime } from '../../../geometry/geo'
import { parseAutosave } from '../../../io/persist'
import { emptyScenario } from '../../../model/seed'
import type { Entity, Scenario } from '../../../model/types'
import * as liveStats from '../../../analysis/liveStats'
import { sampleCount } from '../../../analysis/series'
import type { BandSeries, McSummary, Stat } from '../../../playback/mcRun'
import { DEFAULT_KPI_TILES, KPI_KEYS } from '../../../state/analysisLayout'
import { useStore } from '../../../state/store'
import { IDLE_MC } from '../../../state/runState'
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

// zustand 5 gives react-dom/server the store's initial state, not the live one,
// so every static render of a store-reading widget needs the two in step.
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

describe('KpiTilesWidget', () => {
  beforeEach(() => {
    useStore.getState().replaceScenario(threatScenario())
  })

  it('renders the six default tiles by label when params name no tile', () => {
    const html = render({})
    for (const key of DEFAULT_KPI_TILES) expect(html).toContain(key === 'killEk' ? 'Expected neutralization' : KPI_LABELS[key].label)
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
    for (const key of KPI_KEYS) expect(html).toContain(key === 'killEk' ? 'Expected neutralization' : KPI_LABELS[key].label)
    expect(html).not.toContain('tiles c3')
  })

  it('reads the replicate mean and the half-width sub from a finished summary', () => {
    useStore.getState().advanceRun(1)
    useStore.getState().pauseRun()
    setMc('done')
    const html = render({ tiles: ['detect', 'killEk', 'firstDetect'] })
    expect(html).toContain('4.5<small>/1</small>')
    // Count bands carry lo 4, hi 5 (and 0, 1), printed as the two ends over 100 replicates.
    expect(html).toContain('4 to 5 (95% mean CI) · n=100')
    expect(html).not.toContain('p10 to p90')
    expect(html).toContain('3 of 13 · 100 replicates · basis per tile')
    // This statistic covers the entire run, explicitly separate from cursor counts.
    expect(html).toContain('full-run · MC conditional mean')
    useStore.setState({ mc: IDLE_MC })
  })

  it('reads the half-width sub and the defined count on a time Stat tile', () => {
    // Cursor past the 12 s mean, so the time tile shows its value and sub.
    useStore.getState().advanceRun(13)
    useStore.getState().pauseRun()
    setMc('done')
    const full = render({ tiles: ['firstDetect'] })
    expect(full).toContain('first single-scan hit · ±2.0 s (95% mean CI) · n=100')
    expect(full).toContain('detected in 100 of 100 · 0% to 100% (95% Wilson)')
    setMc('done', 98)
    const partial = render({ tiles: ['firstDetect'] })
    expect(partial).toContain('±2.0 s (95% mean CI) · n=98 · detected in 98 of 100')
    // Under 30 defined replicates the mean CI is not claimed.
    setMc('done', 12)
    const few = render({ tiles: ['firstDetect'] })
    expect(few).toContain('mean CI unavailable under 30 defined · n=12 · detected in 12 of 100')
    expect(few).not.toContain('(95% mean CI)')
    useStore.setState({ mc: IDLE_MC })
  })

  it('words undefined warning replicates explicitly, including n 0', () => {
    // A replicate with no warning time had no defended asset, which is
    // not a detection miss. The tile needs an arrival, so the laydown gains a
    // defended asset and a radar; the threat crosses the 500 m boundary at
    // 125 s, so the cursor sits past it.
    useStore.getState().replaceScenario(warningScenario())
    useStore.getState().advanceRun(130)
    useStore.getState().pauseRun()
    setMc('done', 40)
    const partial = render({ tiles: ['minWarning'] })
    expect(partial).toContain('arrival minus first single-scan hit · ±2.0 s (95% mean CI) · n=40 · warning time in 40 of 100')
    expect(partial).not.toContain('detected in')
    setMc('done', 0)
    const none = render({ tiles: ['minWarning'] })
    expect(none).toContain('MC estimate unavailable · warning time in 0 of 100')
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


  it.each(['stale', 'running', 'error'] as const)('labels deterministic fallback during %s without MC values', (status) => {
    useStore.getState().advanceRun(130)
    useStore.getState().pauseRun()
    setMc(status)
    const html = render({ tiles: ['detect', 'firstDetect', 'minWarning'] })
    expect(html).toContain('planning envelope')
    expect(html).not.toContain('MC conditional mean')
    expect(html).not.toContain('mean CI')
  })

  it('labels deterministic-only tiles individually alongside MC tiles', () => {
    useStore.getState().advanceRun(13)
    useStore.getState().pauseRun()
    setMc('done')
    const html = render({ tiles: ['detect', 'idClass', 'targetNow', 'salvos', 'lateEk', 'firstEffect', 'detectToEffect'] })
    expect(html.match(/class="ts">planning envelope/g)).toHaveLength(6)
    expect(html).toContain('MC mean')
    expect(html).not.toContain('mean of')
  })

  it('shows a full-run MC warning even when the envelope has no detected arrival', () => {
    const scenario = warningScenario()
    scenario.entities = scenario.entities.filter((entity) => entity.kind !== 'sensor')
    useStore.getState().replaceScenario(scenario)
    useStore.getState().advanceRun(1)
    useStore.getState().pauseRun()
    setMc('done')
    const html = render({ tiles: ['minWarning'] })
    expect(html).toContain('full-run · MC conditional mean')
    expect(html).not.toContain('not yet')
  })

  it('keeps 0.952 expected pre-arrival and late counts fractional', () => {
    useStore.getState().replaceScenario(warningScenario())
    useStore.getState().advanceRun(1)
    useStore.getState().pauseRun()
    const actual = liveStats.liveKpisAt
    const spy = vi.spyOn(liveStats, 'liveKpisAt').mockImplementationOnce((timeline, t) => ({
      ...actual(timeline, t), expectedKills: 0.952, lateKills: 0.952,
    }))
    try {
      const html = render({ tiles: ['killEk', 'lateEk'] })
      expect(html.match(/class="tv">0.95</g)).toHaveLength(2)
      expect(html).toContain('Expected kills')
      expect(html).toContain('Expected late kills')
      expect(html).toContain('planning envelope')
      expect(html).not.toContain('>1.0<')
    } finally {
      spy.mockRestore()
    }
  })

  it('keeps no-asset labels and unavailable metrics with no asset placed', () => {
    const scenario = threatScenario()
    useStore.getState().replaceScenario(scenario)
    useStore.getState().advanceRun(130)
    useStore.getState().pauseRun()
    setMc('done')
    const html = render({ tiles: ['killEk', 'leakEn', 'minWarning'] })
    expect(html).toContain('Expected neutralization')
    expect(html).not.toContain('>Expected kills<')
    expect(html.match(/class="tv">—</g)).toHaveLength(2)
    expect(html).toContain('no defended asset placed')
    expect(html).not.toContain('0.0%')
  })

  it('says so when no threat has a flight path', () => {
    useStore.getState().replaceScenario(emptyScenario())
    expect(render({})).toContain('No threats with flight paths.')
  })
})


describe('KPI execution visibility', () => {
  beforeEach(() => {
    const scenario = warningScenario()
    scenario.paths[0].startDelayS = 20
    useStore.getState().replaceScenario(scenario)
    useStore.getState().setBoardPhase('execute')
    useStore.getState().advanceRun(1)
    useStore.getState().pauseRun()
    useStore.getState().scrubTo(150)
  })

  it('clamps event prefixes and deterministic time tiles before the first detection', () => {
    const html = render({ tiles: [...KPI_KEYS] }, false, { scoped: true, horizonS: 1 })
    expect(html).toContain('0<small>/1</small>')
    expect(html).toContain('class="tv">0.00<')
    expect(html).toContain('not yet')
    expect(html).not.toMatch(/class="tv">\d+:\d+/)
    expect(html).not.toContain('class="wg-m"')
  })

  it('uses only reached MC samples, including between grid points, and withholds full-run scalars', () => {
    setMc('done')
    const summary = useStore.getState().mc.summary!
    for (const band of [summary.detected, summary.tracked, summary.engaged, summary.kills, summary.leakers]) {
      for (const values of Object.values(band)) values.fill(9.7).fill(0, 0, 3)
    }
    const html = render({ tiles: [...KPI_KEYS] }, false, { scoped: true, horizonS: 1.4 })
    expect(html).toContain('0 to 0 (95% mean CI)')
    expect(html).not.toContain('9.7')
    expect(html.match(/title="Forecast available in Analyze"/g)).toHaveLength(2)
    expect(html).not.toContain('MC conditional mean')
    expect(html).not.toContain('defined in')
  })

  it('shows zero counts and dashes for EMPTY_HORIZON despite a forward cursor and finished MC', () => {
    setMc('done')
    const html = render({ tiles: [...KPI_KEYS] }, false, EMPTY_HORIZON)
    expect(html).toContain('0<small>/1</small>')
    expect(html).toContain('class="tv">0.00<')
    expect(html).toContain('class="tv">—<')
    expect(html).not.toContain('mean CI')
    expect(html.match(/title="Forecast available in Analyze"/g)).toHaveLength(2)
    expect(html).not.toMatch(/class="tv">\d+:\d+/)
  })

  it('releases scalar statistics at the full-duration boundary only', () => {
    setMc('done')
    const durationS = useStore.getState().mc.summary!.durationS
    const params = { tiles: ['firstDetect', 'minWarning'] }
    expect(render(params, false, { scoped: true, horizonS: durationS - 0.5 })).toContain(FORECAST_IN_ANALYZE)
    const full = render(params, false, { scoped: true, horizonS: durationS })
    expect(full).toContain('full-run · MC conditional mean')
    expect(full).not.toContain(FORECAST_IN_ANALYZE)
  })
})


it('keeps assigned kills and first-effect times pending until the effect lands', () => {
  const scenario = parseAutosave(JSON.stringify(firingFixture))
  useStore.getState().replaceScenario(scenario)
  useStore.getState().advanceRun(1)
  useStore.getState().scrubTo(250)
  const { report } = engagementPicture(useStore.getState().scenario)
  const first = report.events.find((event) => event.killDelta > 0)!
  expect(first.tEffectS).toBeGreaterThan(first.tS)
  const params = { tiles: ['salvos', 'killEk', 'firstEffect', 'detectToEffect'] }
  const pending = render(params, false, { scoped: true, horizonS: first.tS })
  expect(pending).toContain('class="tv">0.00<')
  expect(pending).not.toContain(formatTime(first.tEffectS))
  expect(pending.match(/class="tv">—</g)).toHaveLength(2)
  const landed = render(params, false, { scoped: true, horizonS: first.tEffectS })
  expect(landed).toContain(formatTime(first.tEffectS))
  expect(landed).not.toContain('class="tv">0.00<')
})
