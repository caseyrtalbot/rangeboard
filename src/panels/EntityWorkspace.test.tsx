import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import { useStore } from '../state/store'
import { EntityWorkspace, type EntityWorkspaceSection } from './EntityWorkspace'

function render(entityId: string, section: EntityWorkspaceSection): string {
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(
    <EntityWorkspace
      entityId={entityId}
      section={section}
      onSectionChange={() => {}}
      onOverview={() => {}}
    />,
  )
}

describe('EntityWorkspace', () => {
  beforeEach(() => {
    const store = useStore.getState()
    store.replaceScenario(emptyScenario())
    store.addEntityFromModel('lib-giraffe1x', { x: 0, y: 0 })
    store.addEntityFromModel('lib-giraffe1x', { x: 200, y: 0 })
    const entities = useStore.getState().scenario.entities
    store.updateEntity(entities[0].id, { name: 'North radar' })
    store.updateEntity(entities[1].id, { name: 'South radar' })
    store.select({ entityIds: [entities[0].id] })
  })

  it('shows the shared model scope, fidelity, sources and specification without changing selection', () => {
    const state = useStore.getState()
    const entity = state.scenario.entities[0]
    const html = render(entity.id, 'model')
    expect(html).toContain('Edits to this model affect all 2 linked instances.')
    expect(html).toContain('<li>North radar</li>')
    expect(html).toContain('<li>South radar</li>')
    expect(html).not.toContain(entity.id)
    expect(html).toContain('Model fidelity')
    expect(html).toContain('Radar scan · physics · analytic')
    expect(html).not.toContain('radarPd.test.ts</p>')
    expect(html).toContain('Sensor capability')
    expect(html).toContain('source-entries')
    expect(html).toContain('href="https://www.saab.com/products/giraffe-1x"')
    expect(html).toContain('Spread')
    expect(useStore.getState().selection).toBe(state.selection)
    expect(useStore.getState().scenario).toBe(state.scenario)
  })

  it('keeps the section navigation outside the sole workspace scroll region', () => {
    const html = render(useStore.getState().scenario.entities[0].id, 'configure')
    expect(html.match(/class="entity-workspace-scroll"/g)).toHaveLength(1)
    expect(html.indexOf('role="tablist"')).toBeLessThan(
      html.indexOf('class="entity-workspace-scroll"'),
    )
    expect(html).toContain('id="entity-section-telemetry"')
    expect(html).toContain('id="entity-section-configure" role="tab" aria-selected="true"')
    expect(html).toContain('aria-labelledby="entity-section-configure"')
    expect(html).toContain('Placard Pd')
    expect(html).toContain('Connect from here')
  })

  it('retains the selected instance after its shared model is deleted and shows no-model guidance', () => {
    const state = useStore.getState()
    const entityId = state.scenario.entities[0].id
    state.deleteModel('lib-giraffe1x')
    const html = render(entityId, 'model')
    expect(html).toContain('No linked model')
    expect(html).toContain('Open Configure')
    expect(html).not.toContain('source-entries')
    expect(useStore.getState().selection.entityIds).toEqual([entityId])
    expect(useStore.getState().scenario.entities.every((entity) => entity.specId === null)).toBe(
      true,
    )
  })

  it('leaves the existing shared scope intact when a library duplicate is created', () => {
    const state = useStore.getState()
    const copyId = state.duplicateModel('lib-giraffe1x')
    const html = render(state.scenario.entities[0].id, 'model')
    expect(html).toContain('Edits to this model affect all 2 linked instances.')
    expect(html).not.toContain('(copy)')
    expect(useStore.getState().scenario.entities.some((entity) => entity.specId === copyId)).toBe(
      false,
    )
    expect(useStore.getState().selection).toBe(state.selection)
  })

  it('keeps the existing telemetry and contextual overview control with the entity selected', () => {
    const store = useStore.getState()
    store.addEntityFromModel('lib-mavic3', { x: 0, y: -3000 })
    const threat = useStore.getState().scenario.entities.find((entity) => entity.kind === 'uas')!
    store.beginPath(threat.id)
    store.addDraftPoint({ x: 0, y: -100 })
    store.finishPath()
    store.select({ entityIds: [useStore.getState().scenario.entities[0].id] })
    const state = useStore.getState()
    const html = render(state.scenario.entities[0].id, 'telemetry')
    expect(html).not.toContain('No trial yet. Press Play in Execute to run one.')
    expect(html).not.toContain('class="analysis-scope"')
    expect(html).toContain('aria-label="Back to overview"')
    expect(html).not.toContain('aria-label="Back to the lens stack"')
    expect(useStore.getState().selection).toBe(state.selection)
  })

  it('shows empty telemetry for an entity without a dedicated telemetry pane', () => {
    const state = useStore.getState()
    const entityId = state.scenario.entities[0].id
    state.updateEntity(entityId, { kind: 'marker', specId: null })
    expect(render(entityId, 'telemetry')).toContain('No telemetry for this entity')
    expect(render(entityId, 'model')).toContain('No linked model')
  })

  it('shows an unavailable entity without falling back to another selected object', () => {
    const html = render('missing-entity', 'configure')
    expect(html).toContain('Entity unavailable')
    expect(html).not.toContain('North radar')
    expect(html).not.toContain('Placard Pd')
  })
})
