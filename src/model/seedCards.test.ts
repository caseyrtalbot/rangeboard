import { describe, expect, it } from 'vitest'
import { emptyScenario } from './seed'
import type { Entity, Scenario } from './types'
import { controlledVarsText, describeConfiguration, describeThreats } from './seedCards'

let n = 0
function ent(kind: Entity['kind'], specId: string | null, extra?: Partial<Entity>): Entity {
  n += 1
  return {
    id: `e${n}`,
    name: `e${n}`,
    kind,
    specId,
    pos: { x: 0, y: 0 },
    headingDeg: 0,
    color: null,
    notes: '',
    ...extra,
  }
}

function link(s: Scenario, fromId: string, toId: string) {
  s.connections.push({ id: `c${s.connections.length}`, fromId, toId, label: '' })
}

describe('describeConfiguration', () => {
  it('returns empty for a scenario without blue entities', () => {
    expect(describeConfiguration(emptyScenario())).toBe('')
  })

  it('counts models, reports kill-chain state and ROE', () => {
    const s = emptyScenario()
    const r1 = ent('sensor', 'lib-rps42')
    const r2 = ent('sensor', 'lib-rps42')
    const c2 = ent('c2', 'lib-faadc2')
    const eff = ent('effector', 'lib-coyote')
    s.entities.push(r1, r2, c2, eff)
    expect(describeConfiguration(s)).toBe(
      '2x RPS-42 radar panel (RADA MHR), 1x FAAD C2 (Northrop Grumman), ' +
        '1x Coyote Block 2 interceptor, kill chain not connected, ROE tight',
    )
    link(s, r1.id, c2.id)
    link(s, c2.id, eff.id)
    expect(describeConfiguration(s)).toContain('kill chain connected')
  })

  it('skips disabled entities and uses the entity name without a model', () => {
    const s = emptyScenario()
    s.entities.push(ent('sensor', 'lib-rps42', { enabled: false }))
    s.entities.push(ent('sensor', null, { name: 'Mystery sensor' }))
    expect(describeConfiguration(s)).toBe('1x Mystery sensor, kill chain not connected, ROE tight')
  })
})

describe('describeThreats', () => {
  it('returns empty without UAS entities', () => {
    expect(describeThreats(emptyScenario())).toBe('')
  })

  it('groups by designator with ship counts, group, altitude band, and cruise speed', () => {
    const s = emptyScenario()
    s.entities.push(ent('uas', 'lib-mavic3', { formation: { count: 3, shape: 'line', spacingM: 50 } }))
    // 12 m/s cruise rounds to 23 kt.
    expect(describeThreats(s)).toBe(
      '3x THR-G1-Q-01, Group 1, 50-1200 ft AGL, cruise 23 kt, 1 formation',
    )
  })

  it('sums ships across entities of the same model', () => {
    const s = emptyScenario()
    s.entities.push(ent('uas', 'lib-mavic3'))
    s.entities.push(ent('uas', 'lib-mavic3'))
    expect(describeThreats(s)).toMatch(/^2x THR-G1-Q-01, Group 1/)
    expect(describeThreats(s)).not.toContain('formation')
  })
})

describe('controlledVarsText', () => {
  it('lists the environment facts for a standard day', () => {
    const s = emptyScenario()
    expect(controlledVarsText(s.environment)).toBe(
      'wind calm, day, clear, rural EM, air temp 15 C, field elevation 1000 ft',
    )
  })

  it('formats wind in knots with direction', () => {
    const s = emptyScenario()
    s.environment.windSpeedMps = 10
    s.environment.light = 'night'
    expect(controlledVarsText(s.environment)).toBe(
      'wind 19 kt from 270 deg, night, clear, rural EM, air temp 15 C, field elevation 1000 ft',
    )
  })
})
