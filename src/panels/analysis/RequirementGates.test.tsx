import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import fixture from '../../../docs/field-te/evidence/onboarding-2026-09-04/firing-scenario.json'
import { EMPTY_HORIZON, FORECAST_IN_ANALYZE } from '../../analysis/horizon'
import { engagementPicture } from '../../analysis/impact'
import { buildRequirementGateReport } from '../../analysis/requirements'
import { assessRunValidity } from '../../analysis/runValidity'
import { parseAutosave } from '../../io/persist'
import { RequirementGates } from './RequirementGates'

const scenario = parseAutosave(JSON.stringify(fixture))
const { assessments, report } = engagementPicture(scenario)
const gates = buildRequirementGateReport(scenario, assessments, report, assessRunValidity(scenario, assessments))

describe('RequirementGates visibility', () => {
  it('defaults evidence mounts to the full report', () => {
    const html = renderToStaticMarkup(<RequirementGates report={gates} />)
    expect(html).toContain('requirements-verdict')
    expect(html).toContain('Survival limit')
    expect(html).toContain(`${gates.met}/${gates.required}`)
  })

  it.each([{ scoped: true, horizonS: 1 }, EMPTY_HORIZON])('omits verdict, failures and hover details at %j', (horizon) => {
    const html = renderToStaticMarkup(<RequirementGates report={gates} horizon={horizon} />)
    expect(html).toBe(`<p class="muted small">${FORECAST_IN_ANALYZE}</p>`)
    expect(html).not.toContain('title=')
  })
})
