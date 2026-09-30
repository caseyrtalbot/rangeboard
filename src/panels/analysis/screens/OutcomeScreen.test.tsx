import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { trialKpisAt } from '../../../analysis/liveStats'
import type { McSummary } from '../../../playback/mcRun'
import { createTrialManifest } from '../../../playback/trialTypes'
import { analysisBasisSignature } from '../../../state/analysisBasis'
import { useOverrides } from '../../../state/overrides'
import { useStore } from '../../../state/store'
import { IDLE_TRIAL } from '../../../state/runState'
import { installTrial, observeTrial, unstartTrial } from '../trialTestState'
import { OutcomeScreen } from './OutcomeScreen'

const interaction = vi.hoisted(() => ({
  sort: { column: 'track', descending: false },
  trackView: 'strip' as 'strip' | 'table',
  buttons: new Map<string, () => void>(),
  saved: [] as unknown[],
}))
vi.mock('../../../io/runStore', () => ({
  saveRun: (record: unknown) => {
    interaction.saved.push(record)
    return Promise.resolve({ evicted: [] })
  },
  listRuns: () => Promise.resolve([]),
  getRun: () => Promise.resolve(null),
  deleteRun: () => Promise.resolve(),
}))
// Exercise header handlers and their next render in the repository's server-render harness.
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return {
    ...actual,
    useState: (initial: unknown) => {
      if (typeof initial === 'object' && initial != null && 'column' in initial) {
        return [
          interaction.sort,
          (value: typeof interaction.sort) => {
            interaction.sort = value
          },
        ]
      }
      if (initial === 'strip') return [interaction.trackView, () => {}]
      return actual.useState(initial)
    },
  }
})
vi.mock('react/jsx-dev-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react/jsx-dev-runtime')>()
  const jsxDEV: typeof actual.jsxDEV = (type, props, ...rest) => {
    const button = props as { children?: unknown; onClick?: () => void; className?: string }
    if (type === 'button' && typeof button.children === 'string' && button.onClick) {
      interaction.buttons.set(button.children, button.onClick)
    }
    if (type === 'button' && button.className === 'pstat out-gates' && button.onClick)
      interaction.buttons.set('Gates met', button.onClick)
    return actual.jsxDEV(type, props, ...rest)
  }
  return { ...actual, jsxDEV }
})

function render() {
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<OutcomeScreen />)
}

function complete() {
  const fixture = installTrial(60)
  useStore.setState({
    playback: {
      ...useStore.getState().playback,
      phase: 'complete',
      completedAtMs: 2,
      observedThroughS: fixture.view.durationS,
      simTimeS: 0,
    },
  })
  return fixture
}

function stat(html: string, label: string) {
  const start = html.indexOf(`<div class="pstat-l">${label}</div>`)
  expect(start).toBeGreaterThan(-1)
  return html.slice(start, html.indexOf('</div></div>', start))
}

function tracks(html: string) {
  const body = html.slice(html.indexOf('<tbody>'), html.indexOf('</tbody>'))
  return [...body.matchAll(/<tr[^>]*><td[^>]*>([^<]+)<\/td>/g)].map((match) => match[1])
}

const segments = (html: string, kind: string) =>
  (html.match(new RegExp(`<i class="${kind}"></i>`, 'g')) ?? []).length

describe('OutcomeScreen', () => {
  beforeEach(() => {
    interaction.sort = { column: 'track', descending: false }
    interaction.trackView = 'strip'
    interaction.buttons.clear()
    complete()
  })

  it.each(['idle', 'cancelled', 'unstarted'] as const)(
    'keeps the one-line pre-Play placeholder for %s',
    (state) => {
      if (state === 'unstarted') unstartTrial()
      else
        useStore.setState({
          trial: state === 'idle' ? IDLE_TRIAL : { ...useStore.getState().trial, status: state },
        })
      // A first-run instruction is an empty-state row, never a muted sentence.
      expect(render()).toBe(
        '<p class="empty-row"><span class="state warning"><i class="state-square hollow" aria-hidden="true"></i>No trial yet. Press Play in Execute to run one.</span></p>',
      )
    },
  )

  it.each(['preparing', 'error'] as const)('does not reveal results while %s', (status) => {
    useStore.setState({
      trial: {
        ...useStore.getState().trial,
        status,
        error: status === 'error' ? 'Trial failed' : null,
      },
    })
    const html = render()
    expect(html).toContain(status === 'preparing' ? 'Preparing trial' : 'Trial failed')
    expect(html).not.toContain('out-resbar')
    expect(html).not.toContain('<table')
  })

  it('requires completed playback and a fully observed retained result', () => {
    installTrial(3)
    const partial = render()
    expect(partial).toContain('Complete playback in Execute')
    expect(partial).toMatch(
      /class="empty-row">.*Trial in progress\. Complete playback in Execute to see the outcome\./,
    )
    expect(partial).not.toContain('muted')
    expect(partial).not.toContain('out-resbar')
    observeTrial(60)
    expect(render()).not.toContain('out-resbar')
    complete()
    const trial = useStore.getState().trial
    const result = { ...trial.result!, observedThroughS: 3 }
    useStore.setState({ trial: { ...trial, result } })
    expect(render()).not.toContain('out-resbar')
  })

  it('states the provenance once, the result bar against trialKpisAt and the stat row', () => {
    const { manifest, view } = complete()
    const html = render()
    expect(html).toContain(
      `<span title="One simulated draw">Trial · seed ${manifest.seed} · T+1:00</span>`,
    )
    expect(html).not.toContain('simulated trial · one draw')
    expect(html).not.toContain('by T+')
    const kpis = trialKpisAt(view, view.durationS)
    expect([kpis.kills, kpis.lateKills, kpis.reportedLeakers]).toEqual([3, 2, 3])
    // A late kill is a leaker: leaked alone is the leakers less the late kills.
    expect(segments(html, 'def')).toBe(kpis.kills)
    expect(segments(html, 'late')).toBe(kpis.lateKills)
    expect(segments(html, 'leak')).toBe(kpis.reportedLeakers! - kpis.lateKills)
    expect(segments(html, 'na')).toBe(9 - kpis.kills - kpis.reportedLeakers!)
    expect(html).toContain(
      'aria-label="3 defeated before arrival, 2 late kills, 1 leaked of 9 members"',
    )
    expect(stat(html, 'First detect')).toContain('T+0:01')
    // No threat lost every member: the first death is unreached.
    expect(stat(html, 'First effect')).toContain('pstat-v">—')
    expect(html).toContain('title="4 kinetic · 4 EW · 0 DE"')
    expect(stat(html, 'Salvos')).toContain('pstat-v">8')
    expect(html).toMatch(/<span class="pstat-v">\d+<small>\/6<\/small><\/span>/)
    expect(html).not.toContain('Trial threat record')
  })

  it('opens Prepare, Inputs, Requirements from Gates met', () => {
    const request = vi.spyOn(useStore.getState(), 'requestPanel')
    const original = useStore.getState().requestPanel
    useStore.setState({ requestPanel: request as typeof original })
    const html = render()
    expect(html).toContain('class="pstat out-gates"')
    interaction.buttons.get('Gates met')!()
    expect(request).toHaveBeenCalledWith({
      phase: 'prepare',
      screen: 'inputs',
      section: 'prepare-requirements',
    })
    useStore.setState({ requestPanel: original })
  })

  it('draws strips on one axis by default and the table on toggle', () => {
    const strips = render()
    expect(strips).toContain('class="out-strips"')
    expect(strips.match(/class="out-strip"/g)).toHaveLength(3)
    expect(strips).toContain('class="out-mk det"')
    expect(strips).toContain('class="out-mk eng"')
    expect(strips).toContain('class="out-mk arr"')
    expect(strips).toContain('>1:00</span>')
    expect(strips).not.toContain('<table')
    interaction.trackView = 'table'
    const table = render()
    expect(tracks(table)).toEqual(['flyby', 'moving', 'swarm'])
    for (const label of ['Detect', 'ID', 'Engage', 'Effect', 'Slv', 'Result'])
      expect(table).toContain(`>${label}</button>`)
    expect(table).toContain('<th scope="col" class="out-c-fx"')
  })

  it.each([
    ['Track', ['swarm', 'moving', 'flyby'], ['flyby', 'moving', 'swarm']],
    ['Detect', ['swarm', 'moving', 'flyby'], ['flyby', 'moving', 'swarm']],
    ['ID', ['flyby', 'swarm', 'moving'], ['moving', 'swarm', 'flyby']],
    ['Engage', ['moving', 'swarm', 'flyby'], ['swarm', 'moving', 'flyby']],
    ['Effect', ['swarm', 'moving', 'flyby'], ['swarm', 'moving', 'flyby']],
    ['Slv', ['flyby', 'moving', 'swarm'], ['swarm', 'moving', 'flyby']],
    ['Result', ['flyby', 'moving', 'swarm'], ['swarm', 'flyby', 'moving']],
  ])(
    'sorts the rendered table through the %s header in both directions',
    (header, first, second) => {
      const trial = useStore.getState().trial
      const result = trial.result!
      const assessments = result.assessments.map((a) =>
        a.uasId === 'moving' || a.uasId === 'flyby'
          ? {
              ...a,
              firstDetectS: a.uasId === 'moving' ? 2 : 10,
              classificationAtS: {
                ...a.classificationAtS,
                hostileAtS: a.uasId === 'moving' ? 11 : 2,
              },
            }
          : a,
      )
      useStore.setState({ trial: { ...trial, result: { ...result, assessments } } })
      interaction.trackView = 'table'
      render()
      interaction.buttons.get(header as string)!()
      const sorted = render()
      expect(tracks(sorted)).toEqual(first)
      expect(sorted).toContain(
        'aria-sort="' + (header === 'Track' ? 'descending' : 'ascending') + '"',
      )
      interaction.buttons.get(header as string)!()
      expect(tracks(render())).toEqual(second)
    },
  )

  it('keeps the ledger, the systems and the manifest as closed records, and nothing else', () => {
    const html = render()
    expect(html).toContain('<summary>Event ledger · 8 events</summary>')
    expect(html).toContain('<summary>Systems at end of run · 3 components</summary>')
    expect(html).toContain('<summary>Manifest · ')
    expect(html.match(/class="event-ledger"/g)).toHaveLength(1)
    expect(html).toContain('Jam succeeded')
    expect(html).toContain('mixed-fixed-trial')
    expect(html).toContain('class="sys-list"')
    expect(html).not.toContain('class="analysis-disclosure" open')
    for (const removed of [
      'Evidence products',
      'evidence-products',
      'New clean run',
      'Forecast · requirement record',
      '<summary>Validity',
      'Run history',
      'Save to history',
      'Export debrief JSON',
    ])
      expect(html).not.toContain(removed)
    expect(html).toContain('>Save run</button>')
    expect(html).toContain('>Export</button>')
  })

  it('reads FX and First effect at the death, and a late kill as its own word', () => {
    const state = useStore.getState()
    const report = state.trial.result!.report
    const [moving] = report.events.filter((e) => e.uasId === 'moving')
    const swarmLate = report.events.find((e) => e.uasId === 'swarm' && e.tEffectS === 8)!
    // moving loses all three ships at 2 s; swarm's last ship falls after arrival.
    const events = [
      ...report.events,
      { ...moving, shipIdx: 0 },
      { ...moving, shipIdx: 1 },
      { ...swarmLate, tS: 9, tEffectS: 10, shipIdx: 0 },
    ].sort((a, b) => a.tS - b.tS)
    const result = { ...state.trial.result!, report: { ...report, events } }
    useStore.setState({ trial: { ...state.trial, result } })
    interaction.trackView = 'table'
    const html = render()
    const cells = (id: string) => {
      const start = html.indexOf(`<td class="mono" title="${id}">`)
      return html.slice(start, html.indexOf('</tr>', start))
    }
    expect(cells('moving')).toContain(
      '<td class="mono out-c-fx">0:02</td><td class="mono out-c-slv">3</td>',
    )
    expect(cells('moving')).toContain('defeated (hard)')
    expect(cells('swarm')).toContain(
      '<td class="mono out-c-fx">—</td><td class="mono out-c-slv">8</td>',
    )
    expect(cells('swarm')).toContain('>leaked</span>')
    expect(cells('swarm')).toContain('late kill T+0:10')
    expect(cells('swarm')).not.toContain('>defeated')
    expect(stat(html, 'First effect')).toContain('0:02')
  })

  it('keeps missing detection/effect and no-asset leakage undefined', () => {
    const state = useStore.getState()
    const scenario = {
      ...state.scenario,
      entities: state.scenario.entities.filter((entity) => entity.kind !== 'asset'),
    }
    const manifest = createTrialManifest(
      scenario,
      state.playback.runId,
      analysisBasisSignature(scenario),
    )
    const result = {
      ...state.trial.result!,
      manifest,
      assessments: state.trial.result!.assessments.map((a) => ({
        ...a,
        firstDetectS: null,
        arrivalS: null,
      })),
      report: { ...state.trial.result!.report, events: [] },
      jamDecisions: [],
    }
    useStore.setState({ scenario, trial: { ...state.trial, scenario, manifest, result } })
    const html = render()
    expect(stat(html, 'First detect')).toContain('pstat-v">—')
    expect(stat(html, 'First effect')).toContain('pstat-v">—')
    expect(html).toContain('No defended asset · arrival is not measurable')
    expect(html).toContain('aria-label="0 defeated of 9 members; arrival is not measurable"')
    expect(segments(html, 'leak')).toBe(0)
    expect(segments(html, 'na')).toBe(9)
  })
})

describe('Save to history', () => {
  it('records the overrides the run applied at launch in the manifest, not those in force at the save', async () => {
    // The override store is empty at the save; the run kept its own list.
    useOverrides.getState().resetAll()
    complete()
    const scenario = useStore.getState().scenario
    const model = scenario.library[0]
    const applied = {
      modelId: model.id,
      field: 'pk',
      value: 0.8333,
      reason: 'Calibrated from counts',
      date: '2026-09-15T00:00:00.000Z',
    }
    const signature = analysisBasisSignature(scenario)
    useStore.setState({
      mc: {
        ...useStore.getState().mc,
        status: 'done',
        runId: 'run-1',
        basisSignature: signature,
        summary: {} as McSummary,
        overrides: [applied],
      },
    })
    interaction.saved.length = 0
    interaction.buttons.clear()
    const html = render()
    expect(html).toContain('title="Save this ensemble to the run history">Save run</button>')
    interaction.buttons.get('Save run')!()
    await Promise.resolve()
    const record = interaction.saved[0] as { manifest: { overrides: unknown[] } }
    expect(record.manifest.overrides).toEqual([applied])
    expect(useOverrides.getState().overrides).toEqual([])
  })
})
