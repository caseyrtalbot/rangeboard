import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import fixture from '../../playback/__fixtures__/detection-outside-rings.json'
import { EMPTY_HORIZON, FORECAST_IN_ANALYZE } from '../../analysis/horizon'
import { engagementPicture } from '../../analysis/impact'
import { systemTelemetryAt } from '../../analysis/systemTelemetry'
import { parseAutosave } from '../../io/persist'
import { detectionsAt } from '../../playback/detection'
import { SystemStatus } from './SystemStatus'

const scenario = parseAutosave(JSON.stringify(fixture))
scenario.paths.forEach((path) => {
  path.startDelayS += 20
})
const { assessments, report } = engagementPicture(scenario)
const groupsAt = (t: number) =>
  systemTelemetryAt(scenario, assessments, report, t, detectionsAt(scenario, t))

describe('SystemStatus visibility', () => {
  it('defaults DebriefRecord mounts to full-run telemetry', () => {
    const html = renderToStaticMarkup(<SystemStatus groups={groupsAt(2000)} expanded endOfRun />)
    expect(html).toContain('final sampled instant')
    expect(html).toMatch(/[1-9]\d* salvos/)
    expect(html).toMatch(/[1-9]\d* effects/)
  })

  it('uses reached groups in collapsed buttons and expanded hover detail', () => {
    const props = { groups: groupsAt(1), horizon: { scoped: true, horizonS: 1 }, sampledAtS: 1 }
    const collapsed = renderToStaticMarkup(<SystemStatus {...props} expanded={false} />)
    expect(collapsed).toContain('0 tracks · 0 salvos')
    expect(collapsed).not.toContain('component-telemetry-row')
    const open = renderToStaticMarkup(<SystemStatus {...props} />)
    expect(open).toContain('0 salvos · 0 effects · E[k] 0.00')
    expect(open).not.toMatch(/[1-9]\d* (salvos|effects|seen)/)
  })

  it('has no telemetry rows for EMPTY_HORIZON', () => {
    const html = renderToStaticMarkup(
      <SystemStatus groups={groupsAt(2000)} horizon={EMPTY_HORIZON} />,
    )
    expect(html).toContain('No system telemetry yet.')
    expect(html).not.toContain('system-telemetry-head')
  })

  it('rejects unreached or unspecified samples for scoped custom mounts', () => {
    for (const sampledAtS of [undefined, 250]) {
      const html = renderToStaticMarkup(
        <SystemStatus
          groups={groupsAt(2000)}
          horizon={{ scoped: true, horizonS: 1 }}
          sampledAtS={sampledAtS}
        />,
      )
      expect(html).toContain(FORECAST_IN_ANALYZE)
      expect(html).not.toContain('system-telemetry-head')
    }
  })
})
