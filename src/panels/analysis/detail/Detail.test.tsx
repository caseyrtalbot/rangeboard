import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { emptyScenario } from '../../../model/seed'
import type { Connection, Entity, EntityKind } from '../../../model/types'
import { useStore } from '../../../state/store'
import { DetailPane, hasDetailPane } from './index'

function entityOf(kind: EntityKind): Entity {
  const entity = useStore.getState().scenario.entities.find((e) => e.kind === kind)
  if (!entity) throw new Error(`no ${kind} placed`)
  return entity
}

// zustand 5 gives react-dom/server the store's initial state, not the live one,
// so every static render of a store-reading pane needs the two in step.
function render(entityId: string): string {
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<DetailPane entityId={entityId} />)
}

/** The markup of one section, from its `data-section` to the next one or the end. */
function section(html: string, key: string): string {
  const start = html.indexOf(`data-section="${key}"`)
  expect(start).toBeGreaterThan(-1)
  const next = html.indexOf('data-section="', start + 1)
  return html.slice(start, next === -1 ? undefined : next)
}

function bodyRows(html: string): number {
  const body = html.slice(html.indexOf('<tbody>'))
  return (body.match(/<tr>/g) ?? []).length
}

function expectSections(html: string, keys: Array<[string, string]>): void {
  for (const [key, title] of keys) {
    expect(html).toContain(`data-section="${key}"`)
    expect(html).toContain(`<span class="wg-t">${title}</span>`)
  }
}

function expectNoControls(html: string): void {
  expect(html).not.toContain('<input')
  expect(html).not.toContain('<select')
}

describe('DetailPane', () => {
  beforeEach(() => {
    const store = useStore.getState()
    store.replaceScenario(emptyScenario())
    store.addEntityFromModel('lib-giraffe1x', { x: 0, y: 0 })
    store.addEntityFromModel('lib-coyote', { x: 1697, y: -1697 })
    store.addEntityFromModel('lib-faadc2', { x: -500, y: 0 })
    store.addEntityFromModel('lib-mavic3', { x: 0, y: -3000 })
    const uas = entityOf('uas')
    store.beginPath(uas.id)
    store.addDraftPoint({ x: 0, y: -100 })
    store.finishPath()
    const sensor = entityOf('sensor')
    const c2 = entityOf('c2')
    const effector = entityOf('effector')
    const connections: Connection[] = [
      { id: 'con-1', fromId: sensor.id, toId: c2.id, label: '', latencyS: 2 },
      { id: 'con-2', fromId: c2.id, toId: effector.id, label: '', latencyS: 3 },
    ]
    store.patchScenario({ connections })
  })

  it('names the four kinds that have a pane', () => {
    expect(hasDetailPane('sensor')).toBe(true)
    expect(hasDetailPane('effector')).toBe(true)
    expect(hasDetailPane('uas')).toBe(true)
    expect(hasDetailPane('c2')).toBe(true)
    expect(hasDetailPane('asset')).toBe(false)
    expect(hasDetailPane('marker')).toBe(false)
  })

  it('renders nothing for an asset and for an unknown id', () => {
    const asset: Entity = {
      id: 'ent-asset',
      name: 'Asset 1',
      kind: 'asset',
      specId: 'lib-asset',
      pos: { x: 0, y: 0 },
      headingDeg: 0,
      color: null,
      notes: '',
    }
    const store = useStore.getState()
    store.patchScenario({ entities: [...store.scenario.entities, asset] })
    expect(render('ent-asset')).toBe('')
    expect(render('ent-missing')).toBe('')
  })

  it('renders the sensor pane with one gate row per threat', () => {
    const sensor = entityOf('sensor')
    const html = render(sensor.id)
    expect(html).toContain('data-detail="sensor"')
    expect(html).toContain('aria-label="Back to the lens stack"')
    expect(html).toContain('‹ Back')
    expect(html).toContain(sensor.name)
    expect(html).toContain('<span class="state inactive"><i class="state-square" aria-hidden="true"></i>SEARCH<')
    expect(html).toContain('surveillance')
    expectSections(html, [
      ['pd', 'Pd per track'],
      ['slant', 'Slant range per track'],
      ['ladder', 'Track ladder'],
      ['load', 'Load and hold'],
      ['gates', 'Gates by threat'],
    ])
    expect(bodyRows(section(html, 'gates'))).toBe(1)
    expect(section(html, 'load')).toContain('Tracks per scan')
    // The models behind this sensor, tier and validation status on each chip.
    expect(html).toContain('class="fid-tags"')
    expect(html).toContain('data-tier="physics" data-validation="analytic"')
    expect(html).toContain('Horizon · physics · analytic')
    expect(html).not.toContain('Kinetic Pk ·')
    expectNoControls(html)
  })

  it('renders the effector pane', () => {
    const effector = entityOf('effector')
    const html = render(effector.id)
    expect(html).toContain('data-detail="effector"')
    expect(html).toContain('<span class="state inactive"><i class="state-square" aria-hidden="true"></i>READY<')
    expect(html).toContain('interceptor')
    expectSections(html, [
      ['pk', 'Pk per track'],
      ['magazine', 'Magazine'],
      ['release', 'Release and effect'],
      ['doctrine', 'Doctrine by threat'],
      ['capacity', 'Capacity'],
    ])
    expect(bodyRows(section(html, 'doctrine'))).toBe(1)
    expect(section(html, 'capacity')).toContain('BDA dwell')
    expect(html).toContain('Kinetic Pk · planning · none')
    expectNoControls(html)
  })

  it('renders the threat pane with the track file rows', () => {
    const uas = entityOf('uas')
    const html = render(uas.id)
    expect(html).toContain('data-detail="threat"')
    expect(html).toContain('<span class="state inactive" style="color:')
    expect(html).toContain('quad')
    expectSections(html, [
      ['file', 'Track file'],
      ['phase', 'Phase'],
      ['pd', 'Pd by sensor'],
      ['survival', 'Survival'],
    ])
    const file = section(html, 'file')
    for (const label of ['Altitude', 'Speed', 'Held by', 'Engage', 'Arrival', 'CPA', 'RCS', 'Swerling']) {
      expect(file).toContain(`<span class="rl">${label}</span>`)
    }
    expect(file).toContain('no defended asset placed')
    expectNoControls(html)
  })

  it('names the missing fire-control source when a typed route blocks the Coyote', () => {
    // The beforeEach links are untyped, so the route does not bind the gate.
    const uas = entityOf('uas')
    const before = section(render(uas.id), 'file')
    expect(before).not.toContain('no fire-control source')
    // Typed links (a confidence is what types a hop) make Giraffe 1X to FAAD C2
    // to Coyote a fully typed route with no fire-control sensor: no-fc-uplink.
    const store = useStore.getState()
    store.patchScenario({
      connections: store.scenario.connections.map((c) => ({ ...c, confidence: 'documented' as const })),
    })
    const file = section(render(uas.id), 'file')
    expect(file).toContain('<span class="rl">Engage</span>')
    expect(file).toContain('no fire-control source on the route')
    expect(file).toContain('needs a fire-control track from')
    expect(file).toContain('KuRFS')
  })

  it('renders the system pane with the hop through this node', () => {
    const c2 = entityOf('c2')
    const html = render(c2.id)
    expect(html).toContain('data-detail="system"')
    expect(html).toContain('command and control')
    expectSections(html, [
      ['hops', 'Kill-chain hops'],
      ['timing', 'Detect to effect'],
      ['coverage', 'Route coverage'],
    ])
    expect(bodyRows(section(html, 'hops'))).toBe(1)
    expect(section(html, 'hops')).toContain('untyped')
    expect(bodyRows(section(html, 'timing'))).toBe(1)
    expectNoControls(html)
  })
})
