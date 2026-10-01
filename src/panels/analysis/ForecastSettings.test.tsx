import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyScenario } from '../../model/seed'
import { useStore } from '../../state/store'
import { IDLE_MC } from '../../state/runState'
import { ForecastSettings } from './ForecastSettings'

// The Mode segments have no local state; their click handlers are captured from the markup.
const segments = vi.hoisted(() => new Map<string, () => void>())
vi.mock('react/jsx-dev-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react/jsx-dev-runtime')>()
  const jsxDEV: typeof actual.jsxDEV = (type, props, ...rest) => {
    const p = props as { 'aria-pressed'?: boolean; onClick?: () => void; children?: unknown }
    if (
      type === 'button' &&
      p['aria-pressed'] != null &&
      p.onClick &&
      typeof p.children === 'string'
    )
      segments.set(p.children, p.onClick)
    return actual.jsxDEV(type, props, ...rest)
  }
  return { ...actual, jsxDEV }
})

// zustand 5 gives react-dom/server the store's initial state, not the live one,
// so every static render of a store-reading panel needs the two in step.
function render(): string {
  segments.clear()
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<ForecastSettings />)
}

describe('ForecastSettings, the Run section body', () => {
  beforeEach(() => {
    useStore.getState().replaceScenario({ ...emptyScenario(), runMode: 'monte-carlo' })
    useStore.setState({ mc: IDLE_MC })
    useStore.getState().setShowFieldHelp(false)
  })

  it('puts Mode over two columns and Runs and Seed over one column each', () => {
    const html = render()
    expect(html).toContain(
      '<div class="pgrid"><div class="pg-2"><div class="field"><span>Mode</span>',
    )
    expect(html).toContain('aria-label="Run mode"')
    expect(html).toMatch(/aria-pressed="true" class="active">Monte Carlo<\/button>/)
    expect(html).toMatch(
      /<div class="pg-1"><label class="field"><span>Runs<\/span><input[^>]*value="100"/,
    )
    expect(html).toMatch(
      /<div class="pg-1"><label class="field"><span>Seed<\/span><input[^>]*value="4821"/,
    )
    // The forecast line, the Deterministic checkbox and the MC progress are gone.
    expect(html).not.toContain('forecast-line')
    expect(html).not.toContain('type="checkbox"')
    expect(html).not.toContain('MC 0 / 100')
  })

  it('replaces Runs and Seed with the one-pass note under the deterministic mode', () => {
    useStore.getState().patchScenario({ runMode: 'deterministic' })
    const html = render()
    expect(html).toMatch(/aria-pressed="true" class="active">Deterministic<\/button>/)
    expect(html).toContain('One expected-value pass. Fragility and Placement need Monte Carlo.')
    expect(html).not.toContain('<span>Runs</span>')
    expect(html).not.toContain('<span>Seed</span>')
  })

  it('switches the run mode from the Mode segments', () => {
    render()
    segments.get('Deterministic')?.()
    expect(useStore.getState().scenario.runMode).toBe('deterministic')
    render()
    segments.get('Monte Carlo')?.()
    expect(useStore.getState().scenario.runMode).toBe('monte-carlo')
  })

  it('names what stays in Settings only as a field help line', () => {
    const note = 'Stop rule, what varies and sensitivity depth stay in Settings, Run.'
    expect(render()).not.toContain(note)
    useStore.getState().setShowFieldHelp(true)
    expect(render()).toContain(`<p class="field-help">${note}</p>`)
  })
})
