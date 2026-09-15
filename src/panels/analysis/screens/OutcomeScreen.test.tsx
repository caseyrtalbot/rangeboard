import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { formatTime } from '../../../geometry/geo'
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
  buttons: new Map<string, () => void>(),
  save: null as null | { enabled: boolean; run: () => Promise<{ evicted: string[] }> },
  saved: [] as unknown[],
}))
vi.mock('../../../io/runStore', () => ({
  saveRun: (record: unknown) => { interaction.saved.push(record); return Promise.resolve({ evicted: [] }) },
  listRuns: () => Promise.resolve([]),
  getRun: () => Promise.resolve(null),
  deleteRun: () => Promise.resolve(),
}))
// Exercise header handlers and their next render in the repository's server-render harness.
vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>()
  return { ...actual, useState: (initial: unknown) => {
    if (typeof initial === 'object' && initial != null && 'column' in initial) {
      return [interaction.sort, (value: typeof interaction.sort) => { interaction.sort = value }]
    }
    return actual.useState(initial)
  } }
})
vi.mock('react/jsx-dev-runtime', async importOriginal => {
  const actual = await importOriginal<typeof import('react/jsx-dev-runtime')>()
  const jsxDEV: typeof actual.jsxDEV = (type, props, ...rest) => {
    const button = props as { children?: unknown; onClick?: () => void }
    if (type === 'button' && typeof button.children === 'string' && button.onClick) {
      interaction.buttons.set(button.children, button.onClick)
    }
    if (typeof type === 'function' && type.name === 'RunHistory') interaction.save = (props as { save: typeof interaction.save }).save
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
  useStore.setState({ playback: { ...useStore.getState().playback, phase: 'complete',
    completedAtMs: 2, observedThroughS: fixture.view.durationS, simTimeS: 0 } })
  return fixture
}

function tile(html: string, label: string) {
  const start = html.indexOf(`<span class="tl">${label}</span>`)
  expect(start).toBeGreaterThan(-1)
  return html.slice(start, html.indexOf('</div></div>', start))
}

function tracks(html: string) {
  const body = html.slice(html.indexOf('<tbody>'), html.indexOf('</tbody>'))
  return [...body.matchAll(/<tr><td[^>]*>([^<]+)<\/td>/g)].map(match => match[1])
}

describe('OutcomeScreen', () => {
  beforeEach(() => {
    interaction.sort = { column: 'track', descending: false }
    interaction.buttons.clear()
    complete()
  })

  it.each(['idle', 'cancelled', 'unstarted'] as const)('keeps the one-line pre-Play placeholder for %s', state => {
    if (state === 'unstarted') unstartTrial()
    else useStore.setState({ trial: state === 'idle' ? IDLE_TRIAL : { ...useStore.getState().trial, status: state } })
    expect(render()).toBe('<p class="muted small">No trial yet. Press Play in Execute to run one.</p>')
  })

  it.each(['preparing', 'error'] as const)('does not reveal results while %s', status => {
    useStore.setState({ trial: { ...useStore.getState().trial, status, error: status === 'error' ? 'Trial failed' : null } })
    const html = render()
    expect(html).toContain(status === 'preparing' ? 'Preparing trial' : 'Trial failed')
    expect(html).not.toContain('tiles c3')
    expect(html).not.toContain('<table')
  })

  it('requires completed playback and a fully observed retained result', () => {
    installTrial(3)
    const partial = render()
    expect(partial).toContain('T+0:03 of 1:00 observed')
    expect(partial).toContain('Complete playback in Execute')
    expect(partial).not.toContain('tiles c3')
    observeTrial(60)
    expect(render()).not.toContain('tiles c3')
    complete()
    const trial = useStore.getState().trial
    const result = { ...trial.result!, observedThroughS: 3 }
    useStore.setState({ trial: { ...trial, result } })
    expect(render()).not.toContain('tiles c3')
  })

  it('renders exactly six full-horizon tiles once after completion, even after rewind', () => {
    const { manifest, view } = complete()
    const html = render()
    expect(html).toContain(`simulated trial · one draw · seed ${manifest.seed} · T+1:00 of 1:00 observed`)
    expect(html.match(/class="tiles c3"/g)).toHaveLength(1)
    expect(html.match(/class="tile"/g)).toHaveLength(6)
    expect(html).not.toContain('outcome-grid')
    expect(tile(html, 'Defeated before arrival')).toContain('>3<small>/9 members</small>')
    expect(tile(html, 'Arrived undefeated')).toContain('>3<small>/9 members</small>')
    expect(tile(html, 'Late kills')).toContain('>2<small>/9 members</small>')
    expect(tile(html, 'First detect')).toContain('T+0:01')
    expect(tile(html, 'First effect')).toContain('T+0:02')
    expect(tile(html, 'Salvos')).toContain('>8<small')
    expect(tile(html, 'Salvos')).toContain('4 kinetic · 4 EW')
    expect(html.match(new RegExp(`by T\\+${formatTime(view.durationS)}`, 'g'))).toHaveLength(6)
    expect(html).toContain('font-size:var(--type-dense-size)')
    expect(tracks(html)).toEqual(['flyby', 'moving', 'swarm'])
    expect(html).not.toContain('Trial threat record')
  })

  it.each([
    ['Track', ['swarm', 'moving', 'flyby'], ['flyby', 'moving', 'swarm']],
    ['D', ['swarm', 'moving', 'flyby'], ['flyby', 'moving', 'swarm']],
    ['ID', ['flyby', 'swarm', 'moving'], ['moving', 'swarm', 'flyby']],
    ['ENG', ['moving', 'swarm', 'flyby'], ['swarm', 'moving', 'flyby']],
    ['FX', ['moving', 'swarm', 'flyby'], ['moving', 'swarm', 'flyby']],
    ['Slv', ['flyby', 'moving', 'swarm'], ['swarm', 'moving', 'flyby']],
    ['Result', ['flyby', 'moving', 'swarm'], ['swarm', 'flyby', 'moving']],
  ])('sorts the rendered table through the %s header in both directions', (header, first, second) => {
    const trial = useStore.getState().trial
    const result = trial.result!
    const assessments = result.assessments.map(a => a.uasId === 'moving' || a.uasId === 'flyby'
      ? { ...a, firstDetectS: a.uasId === 'moving' ? 2 : 10,
        classificationAtS: { ...a.classificationAtS, hostileAtS: a.uasId === 'moving' ? 11 : 2 } }
      : a)
    useStore.setState({ trial: { ...trial, result: { ...result, assessments } } })
    render()
    interaction.buttons.get(header as string)!()
    const sorted = render()
    expect(tracks(sorted)).toEqual(first)
    expect(sorted).toContain('aria-sort="' + (header === 'Track' ? 'descending' : 'ascending') + '"')
    interaction.buttons.get(header as string)!()
    expect(tracks(render())).toEqual(second)
  })

  it('keeps existing ledger, manifest, component and validity content in closed record rows', () => {
    const html = render()
    expect(html).toContain('<summary>Event ledger · 8 events</summary>')
    expect(html).toContain('<summary>Manifest · 3 components</summary>')
    expect(html).toContain('<summary>Validity · ')
    expect(html).toMatch(/ · \d+ findings<\/summary>/)
    expect(html.match(/class="event-ledger"/g)).toHaveLength(1)
    expect(html).toContain('Jam succeeded')
    expect(html).toContain('Jam failed')
    expect(html).toContain('mixed-fixed-trial')
    expect(html).toContain('Build revision unavailable')
    expect(html).toContain('No trial validity assessment was captured')
    expect(html).toContain('Export debrief JSON')
    expect(html).toContain('Capture final PNG')
    expect(html).toContain('Forecast · requirement record')
    expect(html).not.toContain('class="analysis-disclosure" open')
  })

  it('keeps missing detection/effect and no-asset leakage undefined', () => {
    const state = useStore.getState()
    const scenario = { ...state.scenario, entities: state.scenario.entities.filter(entity => entity.kind !== 'asset') }
    const manifest = createTrialManifest(scenario, state.playback.runId, analysisBasisSignature(scenario))
    const result = { ...state.trial.result!, manifest,
      assessments: state.trial.result!.assessments.map(a => ({ ...a, firstDetectS: null, arrivalS: null })),
      report: { ...state.trial.result!.report, events: [] }, jamDecisions: [] }
    useStore.setState({ scenario, trial: { ...state.trial, scenario, manifest, result } })
    const html = render()
    expect(tile(html, 'Arrived undefeated')).toContain('>—<small>/9 members</small>')
    expect(tile(html, 'First detect')).toContain('>—<small')
    expect(tile(html, 'First effect')).toContain('>—<small')
    expect(html).toContain('No defended asset · arrival and leakage unavailable')
  })
})

describe('Save to history', () => {
  it('records the overrides the run applied at launch in the manifest, not those in force at the save', async () => {
    // The override store is empty at the save; the run kept its own list.
    useOverrides.getState().resetAll()
    complete()
    const scenario = useStore.getState().scenario
    const model = scenario.library[0]
    const applied = { modelId: model.id, field: 'pk', value: 0.8333, reason: 'Calibrated from counts', date: '2026-09-15T00:00:00.000Z' }
    const signature = analysisBasisSignature(scenario)
    useStore.setState({ mc: { ...useStore.getState().mc, status: 'done', runId: 'run-1', basisSignature: signature,
      summary: {} as McSummary, overrides: [applied] } })
    interaction.saved.length = 0
    render()
    expect(interaction.save?.enabled).toBe(true)
    await interaction.save!.run()
    const record = interaction.saved[0] as { manifest: { overrides: unknown[] } }
    expect(record.manifest.overrides).toEqual([applied])
    expect(useOverrides.getState().overrides).toEqual([])
  })
})
