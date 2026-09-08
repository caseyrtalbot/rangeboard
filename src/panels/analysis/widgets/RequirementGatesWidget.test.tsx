import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import fixture from '../../../../docs/field-te/evidence/onboarding-2026-09-04/firing-scenario.json'
import { EMPTY_HORIZON, FORECAST_IN_ANALYZE, FULL_RUN, type ExecutionHorizon } from '../../../analysis/horizon'
import { parseAutosave } from '../../../io/persist'
import { useStore } from '../../../state/store'
import { RequirementGatesWidget } from './RequirementGatesWidget'

function render(horizon: ExecutionHorizon, collapsed = false) {
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<RequirementGatesWidget horizon={horizon} id="gates" params={{ gates: ['detect', 'effect'] }} collapsed={collapsed} customize={false} index={0} count={1} />)
}

describe('RequirementGatesWidget visibility', () => {
  beforeEach(() => {
    useStore.getState().replaceScenario(parseAutosave(JSON.stringify(fixture)))
  })

  it('retains unscoped verdicts, gate details and threshold disclosure', () => {
    const html = render(FULL_RUN)
    expect(html).toContain('requirements-verdict')
    expect(html).toContain('Survival limit')
    expect(html).toContain('Thresholds')
    expect(html).toContain('met · planning envelope')
  })

  it.each([{ scoped: true, horizonS: 1 }, EMPTY_HORIZON])('withholds full reports and metadata at %j', (horizon) => {
    const html = render(horizon)
    expect(html).toContain(FORECAST_IN_ANALYZE)
    expect(html).not.toContain('requirements-verdict')
    expect(html).not.toContain('gate-metric')
    expect(html).not.toContain('Thresholds')
    expect(html).not.toContain('class="wg-m"')
    expect(render(horizon, true)).not.toContain('met · planning envelope')
  })
})
