import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import fixture from '../../playback/__fixtures__/detection-outside-rings.json'
import { engagementPicture } from '../../analysis/impact'
import type { ComponentTelemetry, SystemTelemetryGroup } from '../../analysis/systemTelemetry'
import { systemTelemetryAt } from '../../analysis/systemTelemetry'
import { parseAutosave } from '../../io/persist'
import { detectionsAt } from '../../playback/detection'
import { STATE_LABEL, stateTone, SystemList } from './SystemStatus'

const scenario = parseAutosave(JSON.stringify(fixture))
scenario.paths.forEach((path) => {
  path.startDelayS += 20
})
const { assessments, report } = engagementPicture(scenario)
const groupsAt = (t: number) =>
  systemTelemetryAt(scenario, assessments, report, t, detectionsAt(scenario, t))

function component(patch: Partial<ComponentTelemetry>): ComponentTelemetry {
  return {
    entityId: 'id',
    name: 'name',
    kind: 'sensor',
    purpose: 'purpose',
    active: true,
    state: 'ready',
    tracksNow: 0,
    tracksSeen: 0,
    classifications: 0,
    trackSeconds: 0,
    holdSeconds: 0,
    targetsNow: 0,
    salvosAssigned: 0,
    effectsLanded: 0,
    expectedKills: 0,
    capacityRemaining: null,
    capacityTotal: null,
    downstreamEffectors: 0,
    ...patch,
  }
}

function group(components: ComponentTelemetry[]): SystemTelemetryGroup {
  return {
    id: 'g',
    name: 'Group',
    activeComponents: components.length,
    componentCount: components.length,
    tracksNow: 0,
    tracksSeen: 0,
    salvosAssigned: 0,
    effectsLanded: 0,
    expectedKills: 0,
    components,
  }
}

describe('SystemList', () => {
  it('groups Sensors, C2 and Effectors with a state word and a per-kind readout', () => {
    const html = renderToStaticMarkup(
      <SystemList
        groups={[
          group([
            component({
              entityId: 'e1',
              name: 'Coyote',
              kind: 'effector',
              state: 'ready',
              capacityRemaining: 3,
              capacityTotal: 4,
            }),
            component({ entityId: 'e2', name: 'Jammer', kind: 'effector', state: 'target' }),
            component({
              entityId: 'c1',
              name: 'FAAD C2',
              kind: 'c2',
              state: 'routing',
              tracksSeen: 2,
            }),
            component({
              entityId: 's1',
              name: 'Radar',
              kind: 'sensor',
              state: 'tracking',
              tracksNow: 2,
              holdSeconds: 42,
            }),
          ]),
        ]}
      />,
    )
    const order = [...html.matchAll(/<div class="sys-group">([^<]+)<\/div>/g)].map((m) => m[1])
    expect(order).toEqual(['Sensors', 'C2', 'Effectors'])
    expect(html).toContain('<span class="sys-nm">FAAD C2</span>')
    expect(html).toContain('<span class="sys-w">ROUTING</span>')
    expect(html).toContain('<span class="sys-rd">2 routed</span>')
    expect(html).toContain('<span class="sys-rd">2 held · 0:42</span>')
    expect(html).toContain(
      '<span class="sys-mag" aria-hidden="true"><i class="full"></i><i class="full"></i><i class="full"></i><i></i></span>3/4',
    )
    expect(html).toContain('<span class="sys-rd">cont.</span>')
    // The row title keeps the state word that drops under 360 px.
    expect(html).toContain('title="FAAD C2 · ROUTING · purpose')
  })

  it('reads real telemetry and keeps the shared state table', () => {
    const html = renderToStaticMarkup(<SystemList groups={groupsAt(2000)} />)
    expect(html).toContain('class="sys-row"')
    expect(STATE_LABEL.depleted).toBe('EMPTY')
    expect(stateTone('tracking')).toBe('nominal')
  })

  it('states an empty board', () => {
    expect(renderToStaticMarkup(<SystemList groups={[]} />)).toContain(
      'No sensors, C2, or effectors placed.',
    )
  })
})
