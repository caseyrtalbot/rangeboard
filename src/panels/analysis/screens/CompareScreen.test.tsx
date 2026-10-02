import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BandSeries, McSummary, Stat } from '../../../playback/mcRun'
import { DT } from '../../../playback/clock'
import { emptyScenario } from '../../../model/seed'
import type { Entity, Scenario } from '../../../model/types'
import { createRunManifest } from '../../../model/runRecord'
import type { RunRecord } from '../../../model/runRecord'
import { useStore } from '../../../state/store'
import { IDLE_TRIAL } from '../../../state/runState'
import { installTrial, unstartTrial } from '../trialTestState'
import { CompareScreen, SavedRunDelta } from './CompareScreen'

const interaction = vi.hoisted(() => ({ buttons: new Map<string, () => void>() }))
vi.mock('react/jsx-dev-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react/jsx-dev-runtime')>()
  const jsxDEV: typeof actual.jsxDEV = (type, props, ...rest) => {
    const button = props as { children?: unknown; onClick?: () => void }
    if (type === 'button' && typeof button.children === 'string' && button.onClick)
      interaction.buttons.set(button.children, button.onClick)
    return actual.jsxDEV(type, props, ...rest)
  }
  return { ...actual, jsxDEV }
})

function stat(mean: number, lo: number, hi: number, n = 40): Stat {
  return {
    mean,
    lo,
    hi,
    n,
    total: 40,
    sd: 1,
    se: 0.1,
    conf: 0.95,
    interval: 't',
    p10: NaN,
    p90: NaN,
    p025: NaN,
    p975: NaN,
    defined: { p: n / 40, lo: 0.8, hi: 1 },
  }
}
function band(mean: number, lo: number, hi: number): BandSeries {
  const values = (value: number) => Array.from({ length: 60 / DT + 1 }, () => value)
  return {
    mean: values(mean),
    lo: values(lo),
    hi: values(hi),
    p10: values(NaN),
    p90: values(NaN),
    p025: values(NaN),
    p975: values(NaN),
  }
}
function complete() {
  const fixture = installTrial(60)
  const mc: McSummary = {
    seed: 7,
    replicates: 40,
    durationS: 60,
    kills: band(2.5, 2, 3),
    leakers: band(2, 1, 2.5),
    detected: band(1, 0, 2),
    tracked: band(1, 0, 2),
    engaged: band(1, 0, 2),
    firstDetectS: stat(2, 1, 3),
    firmTrackS: stat(3, 2, 4),
    minWarningS: stat(4, 2, 6),
    perThreat: Object.fromEntries(
      fixture.view.attrition.threats.map((row) => [
        row.uasId,
        {
          shipCount: row.shipCount,
          killed: stat(1, 0, 2),
          leaked: stat(1, 0, 2),
          firstDetectS: stat(2, 1, 3),
          arrivalS: null,
          residual: band(1, 0, 2),
        },
      ]),
    ),
    perEffector: {
      gun: { salvos: stat(4, 3, 5), kills: stat(2, 1, 3) },
      jammer: { salvos: stat(4, 2, 6), kills: stat(1, 0, 2) },
    },
    elapsedMs: 1,
    stopped: { rule: 'replicates', at: 40 },
  }
  useStore.setState({
    playback: { ...useStore.getState().playback, phase: 'complete', completedAtMs: 2, simTimeS: 0 },
    mc: { ...useStore.getState().mc, status: 'done', runId: fixture.manifest.runId, summary: mc },
  })
  return mc
}
function render() {
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<CompareScreen />)
}
function row(html: string, label: string) {
  const start = html.indexOf(`<div class="cmp-dp" title="${label} · `)
  expect(start).toBeGreaterThan(-1)
  const next = html.indexOf('<div class="cmp-dp"', start + 1)
  return html.slice(start, next === -1 ? html.indexOf('</section>', start) : next)
}
const SECTION_HEAD =
  '<section class="psec"><div class="psec-head"><h3 class="psec-title">Trial against ensemble</h3>'

describe('CompareScreen', () => {
  beforeEach(() => {
    interaction.buttons.clear()
    useStore.setState({ baseline: null })
    complete()
  })

  it.each(['idle', 'cancelled', 'unstarted'] as const)(
    'keeps the single pre-Play placeholder in the trial section for %s',
    (status) => {
      if (status === 'unstarted') unstartTrial()
      else
        useStore.setState({
          trial: status === 'idle' ? IDLE_TRIAL : { ...useStore.getState().trial, status },
        })
      // Saved runs render nothing until the run store answers.
      expect(render()).toBe(
        `<section class="analysis-primary" aria-label="Compare">${SECTION_HEAD}</div><div class="psec-body"><p class="empty-row"><span class="state warning"><i class="state-square hollow" aria-hidden="true"></i>No trial yet. Press Play in Execute to run one.</span></p></div></section></section>`,
      )
    },
  )

  it.each(['idle', 'stale', 'running', 'wrong-run'] as const)(
    'shows only the status line with no current ensemble, and no body run button (%s)',
    (status) => {
      useStore.setState({
        mc: {
          ...useStore.getState().mc,
          status: status === 'wrong-run' ? 'done' : status,
          runId: status === 'wrong-run' ? 'another-run' : useStore.getState().playback.runId,
        },
      })
      const html = render()
      expect(html).toContain(
        status === 'running' ? 'Running ensemble.' : 'No current ensemble result.',
      )
      // The header Run control starts a run (D4); Compare draws no button of its own.
      expect(html).not.toContain('Run Monte Carlo')
      expect(html).not.toContain('<button')
      expect(html).not.toContain('cmp-dp')
      expect(html).not.toContain('No baseline.')
    },
  )

  it('draws the chart and one interval row per quantity from a completed trial', () => {
    const html = render()
    expect(html).toContain(
      '<span class="psec-readout">40 runs<span class="cmp-seed"> · seed 7</span></span>',
    )
    expect(html).toContain('role="img" aria-label="Kills before arrival, members of 9.')
    expect(html).not.toContain('<table')
    expect(html.match(/<div class="cmp-dp" /g)).toHaveLength(5)
    expect(row(html, 'Kills')).toContain(
      'Kills · trial 3 /9 members · ensemble mean 2.5 /9 members',
    )
    expect(row(html, 'Kills')).toContain('95 % CI of mean 2 to 3 /9 members')
    expect(row(html, 'Kills')).toContain('<small>0–9 mem</small>')
    expect(row(html, 'Kills')).toContain('<span class="cmp-tv" aria-hidden="true">3</span>')
    expect(row(html, 'Kills')).toContain('state nominal')
    expect(row(html, 'Leakers')).toContain('state warning')
    expect(row(html, 'First detect')).toContain('trial 1.1 s from T0')
    expect(row(html, 'First detect')).toContain('detected in 40 of 40')
    expect(row(html, 'First detect')).toContain('>inside</span>')
    expect(row(html, 'Min warning')).toContain('<span class="cmp-tv" aria-hidden="true">—</span>')
    expect(row(html, 'Salvos')).toContain('<span class="cmp-tv" aria-hidden="true">8</span>')
    expect(row(html, 'Salvos')).toContain('95 % CI of mean unavailable')
    expect(row(html, 'Salvos')).toContain('Aggregate interval unavailable')
    expect(row(html, 'Salvos')).not.toContain('class="state')
    expect(html).toContain('No baseline.')
    expect(html).not.toContain('disabled="" title="Needs a finished ensemble')
    expect(html).not.toContain('>Clear</button>')
    expect(html).not.toContain('cmp-base"')
  })

  it('gives each row a spoken description since the head row and plot are hidden', () => {
    const kills = row(render(), 'Kills')
    expect(kills).toContain(
      '<span class="r2b-sr">Kills · trial 3 /9 members · ensemble mean 2.5 /9 members · 95 % CI of mean 2 to 3 /9 members · trial inside the 95 % CI</span>',
    )
    expect(kills).toContain('<span class="cmp-q" aria-hidden="true">')
    expect(kills).toContain('<span class="cmp-flag" aria-hidden="true">')
    expect(row(render(), 'Leakers')).toMatch(
      /<span class="r2b-sr">Leakers · trial [^<]*· trial outside the 95 % CI<\/span>/,
    )
  })

  it('places the band, the mean and the trial dot on the row scale', () => {
    const kills = row(render(), 'Kills')
    // Kills run 0 to 9 members: band 2 to 3, mean 2.5, trial 3.
    expect(kills).toContain(
      'class="cmp-band" style="left:22.22%;width:calc(33.33% - 22.22% + 2px)"',
    )
    expect(kills).toContain('class="cmp-mean" style="left:27.78%"')
    expect(kills).toContain('class="cmp-trial" style="left:33.33%"')
  })

  it('moves the interval method to the head (i) and drops the Findings section', () => {
    const html = render()
    expect(html).toContain('aria-label="About Trial against ensemble"')
    expect(html).toContain('Bands are 95 % intervals on the ensemble mean, not replicate ranges')
    expect(html).toContain('against the ensemble: 40 replicates, aleatory uncertainty, seed 7')
    expect(html).not.toContain('Findings')
    expect(html).not.toContain('validity-finding')
    expect(html).not.toContain('Interval and definedness details')
  })

  it('pins the current ensemble, draws its tick and clears it from the Baseline row', () => {
    let html = render()
    interaction.buttons.get('Pin current')!()
    const pinned = useStore.getState().baseline!
    expect(pinned.mc.seed).toBe(7)
    expect(pinned.scenario).toBe(useStore.getState().scenario)
    expect(pinned.label).toContain(useStore.getState().scenario.name)
    // A different current ensemble against the pinned one: one more kill.
    const mc = useStore.getState().mc.summary!
    useStore.setState({
      mc: { ...useStore.getState().mc, summary: { ...mc, kills: band(3.5, 3, 4) } },
    })
    html = render()
    expect(html).toContain(`Baseline · ${pinned.label}`)
    expect(html).not.toContain('<span class="muted small"> pinned')
    expect(html).toContain('Baseline mean, dashed')
    expect(html.match(/class="cmp-base"/g)).toHaveLength(5)
    expect(row(html, 'Kills')).toContain('baseline mean 2.5 /9 members')
    expect(row(html, 'Kills')).toContain('class="cmp-base" style="left:27.78%"')
    expect(html).toContain('The dashed tick is the pinned baseline mean')
    expect(html).not.toContain('>Pin current</button>')
    useStore.setState({ baseline: { ...pinned, label: 'Reference' } })
    expect(render()).toContain('Baseline · Reference<span class="muted small"> pinned ')
    useStore.setState({ baseline: pinned })
    render()
    interaction.buttons.get('Clear')!()
    expect(useStore.getState().baseline).toBeNull()
    html = render()
    expect(html).toContain('No baseline.')
    expect(html).not.toContain('class="cmp-base"')
  })

  it('disables Pin current when the done summary belongs to another basis', () => {
    useStore.setState({ mc: { ...useStore.getState().mc, basisSignature: 'another basis' } })
    const html = render()
    expect(html).toContain(
      'disabled="" title="Needs a finished ensemble for the current scenario">Pin current</button>',
    )
    interaction.buttons.get('Pin current')!()
    expect(useStore.getState().baseline).toBeNull()
  })

  it('does not compare incomplete playback or a partially retained trial', () => {
    useStore.setState({ playback: { ...useStore.getState().playback, completedAtMs: null } })
    let html = render()
    expect(html).not.toContain('cmp-dp')
    expect(html).toContain('Trial in progress. Complete playback in Execute to compare.')
    expect(html).not.toContain('aria-label="Export chart as PNG"')
    complete()
    const trial = useStore.getState().trial
    const result = { ...trial.result!, observedThroughS: 3 }
    useStore.setState({ trial: { ...trial, result } })
    html = render()
    expect(html).not.toContain('cmp-dp')
  })

  it('keeps unavailable means, bands and conditional time sample counts explicit', () => {
    const mc = complete()
    useStore.setState({
      mc: {
        ...useStore.getState().mc,
        summary: { ...mc, kills: band(NaN, NaN, NaN), firstDetectS: stat(2, 1, 3, 4) },
      },
    })
    const html = render()
    expect(row(html, 'Kills')).toContain('ensemble mean — · 95 % CI of mean unavailable')
    expect(row(html, 'Kills')).not.toContain('cmp-band')
    expect(row(html, 'Kills')).not.toContain('class="state')
    expect(row(html, 'First detect')).toContain('95 % CI of mean unavailable')
    expect(row(html, 'First detect')).toContain('detected in 4 of 40')
  })

  it('offers a PNG export icon in the section head', () => {
    const html = render()
    expect(html).toContain('aria-label="Export chart as PNG" title="Export chart as PNG"')
    expect(html.indexOf('aria-label="Export chart as PNG"')).toBeLessThan(
      html.indexOf('class="psec-body"'),
    )
  })
})

function entity(id: string, name: string, kind: Entity['kind']): Entity {
  return {
    id,
    name,
    kind,
    specId: null,
    pos: { x: 0, y: 0 },
    headingDeg: 0,
    color: null,
    notes: '',
  }
}
const savedScenario: Scenario = {
  ...emptyScenario(),
  name: 'Camp Able',
  entities: [
    entity('asset-1', 'HQ', 'asset'),
    entity('uas-1', 'Raid A', 'uas'),
    entity('gun-1', 'Gun 1', 'effector'),
  ],
}

/** One saved record with hand-chosen ensemble means; `ships` sets the count denominator. */
function saved(id: string, ships: number, mc: Partial<McSummary>): RunRecord {
  return {
    id,
    savedAt: '2026-09-15T12:00:00.000Z',
    label: `Camp Able · ${id}`,
    manifest: createRunManifest(savedScenario, `sim-${id}`, `basis-${id}`),
    scenario: savedScenario,
    scenarioHash: `basis-${id}`,
    sensitivity: null,
    mc: {
      seed: 7,
      replicates: 40,
      durationS: 60,
      kills: band(0, 0, 0),
      leakers: band(0, 0, 0),
      detected: band(0, 0, 0),
      tracked: band(0, 0, 0),
      engaged: band(0, 0, 0),
      firstDetectS: stat(0, 0, 0),
      firmTrackS: stat(0, 0, 0),
      minWarningS: stat(0, 0, 0),
      perThreat: {
        'uas-1': {
          shipCount: ships,
          killed: stat(1, 0, 2),
          leaked: stat(1, 0, 2),
          firstDetectS: stat(2, 1, 3),
          arrivalS: null,
          residual: band(1, 0, 2),
        },
      },
      perEffector: { 'gun-1': { salvos: stat(4, 3, 5), kills: stat(2, 1, 3) } },
      elapsedMs: 1,
      stopped: { rule: 'replicates', at: 40 },
      ...mc,
    },
  }
}
const runA = saved('run-a', 9, {
  kills: band(2.5, 2, 3),
  leakers: band(2, 1, 2.5),
  firstDetectS: stat(2, 1, 3),
  minWarningS: stat(4, 2, 6),
  perEffector: { 'gun-1': { salvos: stat(4, 3, 5), kills: stat(2, 1, 3) } },
})
const runB = saved('run-b', 6, {
  kills: band(1.5, 1, 2),
  leakers: band(3, 2, 4),
  firstDetectS: stat(3, 2, 4),
  minWarningS: stat(5, 3, 7),
  perEffector: { 'gun-1': { salvos: stat(6, 5, 7), kills: stat(3, 2, 4) } },
})
function delta(a: RunRecord = runA, b: RunRecord = runB) {
  return renderToStaticMarkup(<SavedRunDelta a={a} b={b} />)
}
function deltaRow(html: string, label: string) {
  const start = html.indexOf(`>${label}</th>`)
  expect(start).toBeGreaterThan(-1)
  return html.slice(start, html.indexOf('</tr>', start))
}

describe('SavedRunDelta', () => {
  it('differences the five quantities, with the interval under each mean and none on the difference', () => {
    const html = delta()
    expect(html).toContain('aria-label="Saved run A against saved run B"')
    // Kills 2.5 of 9 against 1.5 of 6: the means differ by 1 member.
    expect(deltaRow(html, 'Kills')).toContain('>2.5<small>2–3</small></td>')
    expect(deltaRow(html, 'Kills')).toContain('>1.5<small>1–2</small></td>')
    expect(deltaRow(html, 'Kills')).toContain('title="+1 members">+1 mem</td>')
    // Leakers 2 against 3, first detect 2 s against 3 s, min warning 4 s against 5 s.
    expect(deltaRow(html, 'Leakers')).toContain('>-1 mem</td>')
    expect(deltaRow(html, 'First detect')).toContain('>2<small>1–3</small></td>')
    expect(deltaRow(html, 'First detect')).toContain('title="-1 s">-1 s</td>')
    expect(deltaRow(html, 'Min warning')).toContain('>-1 s</td>')
    // One effector each, so the aggregate salvo interval is that effector's: 4 against 6.
    expect(deltaRow(html, 'Salvos')).toContain('>4<small>3–5</small></td>')
    expect(deltaRow(html, 'Salvos')).toContain('>-2 slv</td>')
    expect(html).toContain('No interval is claimed on the difference of two independent runs.')
    // The difference cell never carries an interval.
    for (const label of ['Kills', 'Leakers', 'First detect', 'Min warning', 'Salvos'])
      expect(deltaRow(html, label).match(/<small>/g)).toHaveLength(2)
  })

  it('states each record basis in its column title and the differing populations', () => {
    const html = delta()
    expect(html).toContain(
      'title="A · Camp Able · run-a · 40 replicates · Total uncertainty · seed 7 · full run T+1:00 · 9 members"',
    )
    expect(html).toContain(
      'title="B · Camp Able · run-b · 40 replicates · Total uncertainty · seed 7 · full run T+1:00 · 6 members"',
    )
    expect(html).toContain('Populations differ, 9 against 6 members; count deltas are in members.')
    expect(delta(runA, runA)).not.toContain('Populations differ')
  })

  it('leaves leakage and warning unavailable on a record with no defended asset', () => {
    const noAsset = {
      ...runB,
      scenario: {
        ...savedScenario,
        entities: savedScenario.entities.filter((e) => e.kind !== 'asset'),
      },
    }
    const html = delta(runA, noAsset)
    expect(deltaRow(html, 'Leakers')).toContain(
      'title="mean unavailable · 95 % CI unavailable · No defended asset; unavailable.">—<small>no CI</small>',
    )
    expect(deltaRow(html, 'Leakers')).toContain('>—</td>')
    expect(deltaRow(html, 'Min warning')).toContain('>—</td>')
  })
})
