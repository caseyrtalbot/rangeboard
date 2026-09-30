import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { trialForecast } from '../../analysis/trialResult'
import { exportRunRecord } from '../../io/persist'
import { exportRunCsv } from '../../io/exportCsv'
import type { McSummary } from '../../playback/mcRun'
import { analysisBasisSignature } from '../../state/analysisBasis'
import { useStore } from '../../state/store'
import { ExportMenu, ExportMenuItems } from './DebriefRecord'
import { installTrial } from './trialTestState'

const idleMc = useStore.getState().mc
const actions = vi.hoisted(() => ({ buttons: new Map<string, () => void>() }))
vi.mock('../../io/persist', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../io/persist')>()),
  exportRunRecord: vi.fn(),
}))
vi.mock('../../io/exportCsv', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../io/exportCsv')>()),
  exportRunCsv: vi.fn(() => true),
}))
// The menu renders open, so its items mount in the server render.
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return {
    ...actual,
    useState: (initial: unknown) =>
      initial === false ? [true, () => {}] : actual.useState(initial),
  }
})
// Capture each rendered menu item's handler by its first text child.
vi.mock('react/jsx-dev-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react/jsx-dev-runtime')>()
  const jsxDEV: typeof actual.jsxDEV = (type, props, ...rest) => {
    const button = props as { children?: unknown; onClick?: () => void }
    const first = Array.isArray(button.children) ? button.children[0] : button.children
    if (type === 'button' && typeof first === 'string' && button.onClick)
      actions.buttons.set(first, button.onClick)
    return actual.jsxDEV(type, props, ...rest)
  }
  return { ...actual, jsxDEV }
})

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

function items() {
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(
    <ExportMenuItems onJson={() => {}} onPng={() => {}} onCsv={() => {}} />,
  )
}

function finishEnsemble(signature: string, status: 'done' | 'running' = 'done') {
  const state = useStore.getState()
  useStore.setState({
    mc: {
      ...state.mc,
      status,
      runId: state.playback.runId,
      basisSignature: signature,
      summary: status === 'done' ? ({} as McSummary) : null,
    },
  })
}

describe('Export menu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    actions.buttons.clear()
    useStore.setState({ mc: idleMc })
    complete()
  })

  it('holds the debrief record, the final frame and two CSV tables', () => {
    const html = items()
    expect(html).toContain('Debrief record<span class="out-fmt">JSON</span>')
    expect(html).toContain('Final board frame<span class="out-fmt">PNG</span>')
    expect(html).toContain('Per-threat table<span class="out-fmt">CSV</span>')
    expect(html).toContain('Per-effector table<span class="out-fmt">CSV</span>')
  })

  it('disables the CSV items with the reason until an ensemble finishes on the current basis', () => {
    expect(items().match(/disabled="" title="Run Monte Carlo to export the tables"/g)).toHaveLength(
      2,
    )
    const signature = analysisBasisSignature(useStore.getState().scenario)
    finishEnsemble(signature, 'running')
    expect(items()).toContain('title="The ensemble is still running"')
    finishEnsemble('another-basis')
    expect(items()).toContain('title="The scenario changed after the ensemble ran"')
    finishEnsemble(signature)
    const html = items()
    expect(html).not.toContain('disabled')
    expect(html).not.toContain('title=')
  })

  it('exports the completed trial with the forecast the trial ran and the current ensemble', () => {
    const { view } = complete()
    Object.assign(useStore.getInitialState(), useStore.getState())
    renderToStaticMarkup(<ExportMenu view={view} />)
    actions.buttons.get('Debrief record')!()
    const args = vi.mocked(exportRunRecord).mock.calls[0]
    expect(args[0]).toBe(view.scenario)
    expect(args[3]).toEqual(trialForecast(view).report)
    expect(args[3]).not.toBe(view.attrition)
    expect(args.slice(5, 7)).toEqual([null, null])
    expect(args[7]).toBe(view)
  })

  it('exports a CSV table from the record Save writes', () => {
    const { view } = complete()
    finishEnsemble(analysisBasisSignature(useStore.getState().scenario))
    Object.assign(useStore.getInitialState(), useStore.getState())
    renderToStaticMarkup(<ExportMenu view={view} />)
    actions.buttons.get('Per-threat table')!()
    const [record, name] = vi.mocked(exportRunCsv).mock.calls[0]
    expect(name).toBe('per-threat')
    expect(record.scenario).toBe(useStore.getState().scenario)
  })
})
