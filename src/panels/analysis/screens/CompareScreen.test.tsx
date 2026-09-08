import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BandSeries, McSummary, Stat } from '../../../playback/mcRun'
import { DT } from '../../../playback/clock'
import { useStore } from '../../../state/store'
import { IDLE_TRIAL } from '../../../state/runState'
import { installTrial, unstartTrial } from '../widgets/trialTestState'
import { CompareScreen } from './CompareScreen'

const interaction = vi.hoisted(() => ({ buttons: new Map<string, () => void>() }))
vi.mock('react/jsx-dev-runtime', async importOriginal => {
  const actual = await importOriginal<typeof import('react/jsx-dev-runtime')>()
  const jsxDEV: typeof actual.jsxDEV = (type, props, ...rest) => {
    const button = props as { children?: unknown; onClick?: () => void }
    if (type === 'button' && typeof button.children === 'string' && button.onClick) interaction.buttons.set(button.children, button.onClick)
    return actual.jsxDEV(type, props, ...rest)
  }
  return { ...actual, jsxDEV }
})

function stat(mean: number, lo: number, hi: number, n = 40): Stat {
  return { mean, lo, hi, n, total: 40, sd: 1, se: 0.1, conf: 0.95, interval: 't',
    p10: NaN, p90: NaN, p025: NaN, p975: NaN, defined: { p: n / 40, lo: 0.8, hi: 1 } }
}
function band(mean: number, lo: number, hi: number): BandSeries {
  const values = (value: number) => Array.from({ length: 60 / DT + 1 }, () => value)
  return { mean: values(mean), lo: values(lo), hi: values(hi), p10: values(NaN), p90: values(NaN), p025: values(NaN), p975: values(NaN) }
}
function complete() {
  const fixture = installTrial(60)
  const mc: McSummary = { seed: 7, replicates: 40, durationS: 60, kills: band(2.5, 2, 3), leakers: band(2, 1, 2.5),
    detected: band(1, 0, 2), tracked: band(1, 0, 2), engaged: band(1, 0, 2), firstDetectS: stat(2, 1, 3),
    firmTrackS: stat(3, 2, 4), minWarningS: stat(4, 2, 6),
    perThreat: Object.fromEntries(fixture.view.attrition.threats.map(row => [row.uasId, {
      shipCount: row.shipCount, killed: stat(1, 0, 2), leaked: stat(1, 0, 2), firstDetectS: stat(2, 1, 3), arrivalS: null, residual: band(1, 0, 2),
    }])), perEffector: { gun: { salvos: stat(4, 3, 5), kills: stat(2, 1, 3) }, jammer: { salvos: stat(4, 2, 6), kills: stat(1, 0, 2) } },
    elapsedMs: 1, stopped: { rule: 'replicates', at: 40 } }
  useStore.setState({ playback: { ...useStore.getState().playback, phase: 'complete', completedAtMs: 2, simTimeS: 0 },
    mc: { ...useStore.getState().mc, status: 'done', runId: fixture.manifest.runId, summary: mc } })
  return mc
}
function render() {
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<CompareScreen />)
}
function row(html: string, label: string) {
  const start = html.indexOf(`>${label}</th>`)
  expect(start).toBeGreaterThan(-1)
  return html.slice(start, html.indexOf('</tr>', start))
}

describe('CompareScreen', () => {
  beforeEach(() => {
    interaction.buttons.clear()
    complete()
  })

  it.each(['idle', 'cancelled', 'unstarted'] as const)('preserves the single pre-Play placeholder for %s', status => {
    if (status === 'unstarted') unstartTrial()
    else useStore.setState({ trial: status === 'idle' ? IDLE_TRIAL : { ...useStore.getState().trial, status } })
    expect(render()).toBe('<p class="muted small">No trial yet. Press Play in Execute to run one.</p>')
  })

  it.each(['idle', 'stale', 'running', 'wrong-run'] as const)('shows only the launch line with no current ensemble (%s)', status => {
    const run = vi.fn()
    useStore.setState({ runMonteCarlo: run, mc: { ...useStore.getState().mc,
      status: status === 'wrong-run' ? 'done' : status, runId: status === 'wrong-run' ? 'another-run' : useStore.getState().playback.runId } })
    const html = render()
    expect(html).toContain('Run Monte Carlo')
    expect(html).not.toContain('<section')
    expect(html).not.toContain('<table')
    expect(html).not.toContain('No pinned baseline')
    if (status !== 'running') {
      interaction.buttons.get('Run Monte Carlo')!()
      expect(run).toHaveBeenCalledOnce()
    }
    else expect(html).toContain('disabled=""')
  })

  it('renders the chart and five comparable quantities from a completed trial, including after rewind', () => {
    const html = render()
    expect(html).toContain('Monte Carlo · 40 replicates · Aleatory uncertainty · seed 7 · 95 % band')
    expect(html).toContain('role="img" aria-label="Kills before arrival, members of 9.')
    expect(html).toContain('class="tb tb-dense"')
    expect(row(html, 'Kills')).toContain('>3 /9 members</td>')
    expect(row(html, 'Kills')).toContain('state nominal')
    expect(row(html, 'Leakers')).toContain('state warning')
    expect(row(html, 'First detect')).toContain('1.1 s from T0')
    expect(row(html, 'First detect')).toContain('inside')
    expect(row(html, 'Min warning')).toContain('>—</td>')
    expect(row(html, 'Salvos')).toContain('>8 salvos</td>')
    expect(row(html, 'Salvos')).toContain('Unavailable')
    expect(row(html, 'Salvos')).not.toContain('state nominal')
    expect(html).toContain('First detect: MC conditional mean')
    expect(html).toContain('detected in 40 of 40')
    expect(html).toContain('No pinned baseline')
    expect(html).toContain('disabled="">Pin</button>')
  })

  it('does not compare incomplete playback or a partially retained trial', () => {
    useStore.setState({ playback: { ...useStore.getState().playback, completedAtMs: null } })
    expect(render()).not.toContain('<table')
    complete()
    const trial = useStore.getState().trial
    const result = { ...trial.result!, observedThroughS: 3 }
    useStore.setState({ trial: { ...trial, result } })
    expect(render()).not.toContain('<table')
  })

  it('keeps unavailable means, bands and conditional time sample counts explicit', () => {
    const mc = complete()
    useStore.setState({ mc: { ...useStore.getState().mc, summary: { ...mc, kills: band(NaN, NaN, NaN), firstDetectS: stat(2, 1, 3, 4) } } })
    const html = render()
    expect(row(html, 'Kills')).toContain('Unavailable')
    expect(row(html, 'Kills')).not.toContain('inside')
    expect(row(html, 'First detect')).toContain('Unavailable')
    expect(html).toContain('detected in 4 of 40')
  })

  it('renders disagreement findings with one action per row', () => {
    const mc = complete()
    useStore.setState({ mc: { ...useStore.getState().mc, summary: { ...mc, kills: band(1, 0, 2) } } })
    const html = render()
    expect(html).toContain('simulated trial 3/9 members; ensemble 95 % mean band 0 to 2/9 members')
    const findings = html.split('class="validity-finding"').slice(1)
    for (const finding of findings) expect(finding.slice(0, finding.indexOf('</section>')).match(/<button/g)).toHaveLength(1)
    interaction.buttons.get('Review tracks in Prepare')!()
    expect(useStore.getState().ui.boardPhase).toBe('prepare')
  })
})
