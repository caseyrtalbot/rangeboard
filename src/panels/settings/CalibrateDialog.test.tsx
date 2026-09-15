import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyScenario } from '../../model/seed'
import type { SpecModel } from '../../model/types'
import { activeOverrides, useOverrides } from '../../state/overrides'
import { useStore } from '../../state/store'
import { createTrialManifest } from '../../playback/trialTypes'
import { CalibrateDialog, CalibrateForm } from './CalibrateDialog'
import type { CalibrateDraft } from './CalibrateDialog'
import { SystemsTab } from './SystemsTab'

const interaction = vi.hoisted(() => ({
  submit: undefined as undefined | ((event: { preventDefault: () => void }) => void),
  accept: undefined as undefined | { disabled: boolean },
}))
vi.mock('react/jsx-dev-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react/jsx-dev-runtime')>()
  const jsxDEV: typeof actual.jsxDEV = (type, props, ...rest) => {
    const p = props as { role?: string; type?: string; children?: unknown; disabled: boolean; onSubmit: (event: { preventDefault: () => void }) => void }
    if (type === 'form' && p.role === 'dialog') interaction.submit = p.onSubmit
    if (type === 'button' && p.type === 'submit' && p.children === 'Accept') interaction.accept = p
    return actual.jsxDEV(type, props, ...rest)
  }
  return { ...actual, jsxDEV }
})

const scenario = emptyScenario()
const coyote = scenario.library.find((m) => m.id === 'lib-coyote') as SpecModel
const noop = () => {}
const EMPTY_DRAFT: CalibrateDraft = { successes: '', trials: '', form: 'sample', times: '', n: '', mean: '', variance: '' }

function renderForm(field: string, family: 'proportion' | 'time', value: number, draft: Partial<CalibrateDraft>) {
  interaction.submit = undefined
  interaction.accept = undefined
  return renderToStaticMarkup(
    <CalibrateForm model={coyote} field={field} family={family} value={value} unit={family === 'proportion' ? 'fraction' : 's'}
      draft={{ ...EMPTY_DRAFT, ...draft }} onDraft={noop} onClose={noop} />,
  )
}

describe('CalibrateDialog', () => {
  beforeEach(() => useOverrides.getState().resetAll())
  afterEach(() => useOverrides.getState().resetAll())

  it('shows prior, count and posterior side by side and writes the beta mean on accept', () => {
    const html = renderForm('pk', 'proportion', 0.85, { successes: '17', trials: '20' })
    expect(html).toContain('aria-label="Calibrate pk on Coyote Block 2 interceptor"')
    expect(html).toContain('<th>Prior</th><th>Observed</th><th>Posterior</th>')
    // Jeffreys (0.5, 0.5) + 17 of 20 = Beta(17.5, 3.5), mean 17.5 / 21 = 0.8333.
    expect(html).toContain('<td class="prose">Beta a</td><td>0.5</td><td>—</td><td>17.5</td>')
    expect(html).toContain('<td class="prose">Beta b</td><td>0.5</td><td>—</td><td>3.5</td>')
    expect(html).toContain('<td>17 of 20</td>')
    expect(html).toContain('<td>0.85</td><td>0.8333</td>')
    expect(html).toContain('0.6514 to 0.9559')
    expect(interaction.accept?.disabled).toBe(false)

    interaction.submit!({ preventDefault: noop })
    const overrides = useOverrides.getState().overrides
    expect(overrides).toHaveLength(1)
    expect(overrides[0]).toMatchObject({ modelId: 'lib-coyote', field: 'pk', value: 17.5 / 21 })
    expect(overrides[0].reason).toContain('posterior Beta(17.5, 3.5)')
    const manifest = createTrialManifest(scenario, 'trial', 'basis', { overrides: activeOverrides(overrides, scenario) })
    expect(manifest.overrides).toHaveLength(1)
  })

  it('keeps Accept disabled while the count is incomplete or inconsistent', () => {
    expect(renderForm('pk', 'proportion', 0.85, { successes: '17' })).toContain('Type the observation to see the posterior.')
    expect(interaction.accept?.disabled).toBe(true)
    renderForm('pk', 'proportion', 0.85, { successes: '21', trials: '20' })
    expect(interaction.accept?.disabled).toBe(true)
    interaction.submit!({ preventDefault: noop })
    expect(useOverrides.getState().overrides).toHaveLength(0)
  })

  it('reduces pasted times to the summary and writes the posterior mu in seconds', () => {
    const html = renderForm('engageTimeS', 'time', 60, { form: 'sample', times: '48, 50\n52 54\n56' })
    // Prior from the PF triangular spread: beta0 = 19 (calibrate.test.ts). Times: n 5,
    // mean 52, variance 40 / 4 = 10. Posterior mu = (60 + 260) / 6 = 53.33, kappa 6,
    // alpha 3.5, beta = 19 + 40 / 2 + 5 * 64 / 12 = 65.67.
    expect(html).toContain('<td class="prose">mu (s)</td><td>60</td><td>—</td><td>53.33</td>')
    expect(html).toContain('<td class="prose">beta</td><td>19</td><td>—</td><td>65.67</td>')
    expect(html).toContain('<td class="prose">n</td><td>—</td><td>5</td>')
    expect(html).toContain('<td class="prose">Variance (s2)</td><td>—</td><td>10</td>')
    interaction.submit!({ preventDefault: noop })
    const [override] = useOverrides.getState().overrides
    expect(override.field).toBe('engageTimeS')
    expect(override.value).toBeCloseTo(53.3333, 4)
    expect(override.reason).toContain('observed times n 5, mean 52 s, variance 10 s2')
  })

  it('takes the summary form as n, mean and variance', () => {
    const html = renderForm('engageTimeS', 'time', 60, { form: 'summary', n: '5', mean: '52', variance: '16' })
    expect(html).toContain('aria-label="Count"')
    expect(html).toContain('<td class="prose">beta</td><td>19</td><td>—</td><td>77.67</td>')
    expect(html).toContain('48.79 to 57.88')
  })

  it('mounts from the Systems tab beside a proportion or time field only', () => {
    useStore.getState().replaceScenario(emptyScenario())
    useStore.getState().addEntityFromModel('lib-coyote', { x: 0, y: 0 })
    Object.assign(useStore.getInitialState(), useStore.getState())
    Object.assign(useOverrides.getInitialState(), useOverrides.getState())
    const html = renderToStaticMarkup(<SystemsTab />)
    expect(html).toContain('aria-label="Calibrate pk on Coyote Block 2 interceptor"')
    expect(html).toContain('aria-label="Calibrate engageTimeS on Coyote Block 2 interceptor"')
    expect(html).not.toContain('aria-label="Calibrate maxRangeM on')
    expect(html).not.toContain('role="dialog"')
    // The dialog itself starts empty.
    const dialog = renderToStaticMarkup(
      <CalibrateDialog model={coyote} field="pk" family="proportion" value={0.85} unit="fraction" onClose={noop} />,
    )
    expect(dialog).toContain('role="dialog"')
    expect(dialog).toContain('Type the observation to see the posterior.')
  })
})
