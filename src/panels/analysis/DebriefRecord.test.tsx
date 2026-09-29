import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildAarSummary } from '../../analysis/aar'
import { engagementPicture } from '../../analysis/impact'
import { exportRunRecord } from '../../io/persist'
import { useStore } from '../../state/store'
import { IDLE_TRIAL } from '../../state/runState'
import { runReplicates } from '../../playback/mcRun'
import { scenarioDurationS } from '../../model/scenario'
import { DebriefRecord } from './DebriefRecord'
import { installTrial } from './trialTestState'

const actions = vi.hoisted(() => ({ export: undefined as (() => void) | undefined }))
vi.mock('../../io/persist', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../io/persist')>()),
  exportRunRecord: vi.fn(),
}))
// Capture the real rendered button handler while keeping React's server render intact.
vi.mock('react/jsx-dev-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react/jsx-dev-runtime')>()
  const jsxDEV: typeof actual.jsxDEV = (type, props, ...rest) => {
    const button = props as { children?: unknown; onClick?: () => void }
    if (type === 'button' && button.children === 'Export debrief JSON')
      actions.export = button.onClick
    return actual.jsxDEV(type, props, ...rest)
  }
  return { ...actual, jsxDEV }
})

function render() {
  const scenario = useStore.getState().scenario
  const { assessments, report, impacts } = engagementPicture(scenario)
  const aar = buildAarSummary(scenario, assessments, report, impacts)
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(
    <DebriefRecord
      scenario={scenario}
      assessments={assessments}
      report={report}
      aar={aar}
      durationS={scenarioDurationS(scenario)}
    />,
  )
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

describe('DebriefRecord', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    actions.export = undefined
    complete()
  })

  it('keeps the completed records after rewind without repeating the outcome grid', () => {
    const html = render()
    const trial = html.slice(
      html.indexOf('aria-label="Completed simulated trial record"'),
      html.indexOf('class="debrief-actions"'),
    )
    expect(html).not.toContain('Pre-arrival hard kills')
    expect(html).toContain('Export debrief JSON')
    expect(html).toContain('Capture final PNG')
    expect(trial).toContain('Trial engagement event ledger · 8 events')
    expect(trial).toContain('Jam succeeded')
    expect(trial).toContain('Jam failed')
    expect(trial).toContain('Trial system and component record')
    expect(trial).toContain('0 now · 1 seen')
    expect(trial).toContain('nominal-aleatory')
    expect(trial).toContain('mixed-fixed-trial')
    expect(trial).toContain('Build revision unavailable')
    expect(trial).not.toMatch(/E\[k\]|E\[n\]|planning envelope|ALL GATES MET|REQUIREMENTS NOT MET/)
  })

  it('labels forecast requirements separately from the trial record', () => {
    const html = render()
    expect(html).toContain('aria-label="Forecast requirements"')
    expect(html).toContain('Forecast · requirement record')
    // The caveat keeps its words behind a 24 px (i).
    expect(html).toContain(
      'aria-label="About forecast requirements" title="Deterministic planning envelope · these gates do not adjudicate the simulated trial."',
    )
    const forecast = html.slice(html.indexOf('aria-label="Forecast requirements"'))
    expect(forecast).not.toContain('class="muted small"')
    expect(html.indexOf('Completed simulated trial record')).toBeLessThan(
      html.indexOf('Forecast · requirement record'),
    )
  })

  it('exports the matching completed trial with unchanged forecast inputs and ensemble selections', () => {
    const { view } = complete()
    render()
    expect(actions.export).toBeTypeOf('function')
    actions.export!()
    const args = vi.mocked(exportRunRecord).mock.calls[0]
    expect(args[7]).toBe(view)
    expect(args[3]).toBe(engagementPicture(useStore.getState().scenario).report)
    expect(args[3]).not.toBe(view.attrition)
    expect(args.slice(5, 7)).toEqual([null, null])
  })

  it.each(['idle', 'preparing', 'error'] as const)(
    'keeps the legacy completed export without a trial when %s',
    (status) => {
      const trial = useStore.getState().trial
      useStore.setState({
        trial:
          status === 'idle'
            ? IDLE_TRIAL
            : {
                ...trial,
                status,
                error: status === 'error' ? 'Trial failed' : null,
              },
      })
      const html = render()
      expect(html).not.toContain('aria-label="Completed simulated trial record"')
      expect(html).toMatch(/class="empty-row">.*· completed trial record unavailable<\/span>/)
      actions.export!()
      expect(vi.mocked(exportRunRecord).mock.calls[0][7]).toBeNull()
    },
  )

  it.each(['incomplete', 'run mismatch', 'basis mismatch', 'unstarted'] as const)(
    'rechecks %s at export click time',
    (change) => {
      render()
      const state = useStore.getState()
      if (change === 'incomplete')
        useStore.setState({
          playback: { ...state.playback, observedThroughS: 3, completedAtMs: null },
        })
      if (change === 'run mismatch')
        useStore.setState({ playback: { ...state.playback, runId: 'another-run' } })
      if (change === 'basis mismatch')
        useStore.setState({ scenario: { ...state.scenario, entities: [] } })
      if (change === 'unstarted')
        useStore.setState({ playback: { ...state.playback, startedAtMs: null } })
      actions.export!()
      expect(vi.mocked(exportRunRecord).mock.calls[0][7]).toBeNull()
    },
  )

  it('preserves a current ensemble in export independently of the trial', () => {
    const { scenario, view } = complete()
    const summary = runReplicates({ ...scenario, replicates: 2 })
    const state = useStore.getState()
    useStore.setState({ mc: { ...state.mc, status: 'done', runId: state.playback.runId, summary } })
    render()
    actions.export!()
    expect(vi.mocked(exportRunRecord).mock.calls[0][5]).toBe(summary)
    expect(vi.mocked(exportRunRecord).mock.calls[0][7]).toBe(view)
  })

  it('excludes a ready result whose retained observation does not cover the trial duration', () => {
    const trial = useStore.getState().trial
    const result = { ...trial.result!, observedThroughS: 3 }
    useStore.setState({ trial: { ...trial, result } })
    const html = render()
    expect(html).not.toContain('aria-label="Completed simulated trial record"')
    expect(html).toMatch(/class="empty-row">.*· completed trial record unavailable<\/span>/)
    actions.export!()
    expect(vi.mocked(exportRunRecord).mock.calls[0][7]).toBeNull()
  })

  it('does not mount an incomplete record', () => {
    installTrial(3)
    expect(render()).toBe('')
    expect(actions.export).toBeUndefined()
  })
})
