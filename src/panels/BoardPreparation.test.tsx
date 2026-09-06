import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import { useStore } from '../state/store'
import { BoardPreparation } from './BoardPreparation'

// Zustand 5 gives react-dom/server the initial state, so keep it aligned with
// the live store before each static render of a store-reading panel.
function render(): string {
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<BoardPreparation />)
}

describe('BoardPreparation', () => {
  beforeEach(() => {
    const store = useStore.getState()
    store.replaceScenario(emptyScenario())
    store.addEntityFromModel('lib-mavic3', { x: 0, y: -3000 })
    store.clearSelection()
    store.setRightTab('analysis')
  })

  it('renders the real run scope, complete validity finding fields, and routes', () => {
    const entity = useStore.getState().scenario.entities[0]
    const html = render()

    expect(html).toContain('inspector-body board-preparation')
    expect(html).toContain('Scenario and run scope')
    expect(html).toContain('RUN-0001')
    expect(html).toContain(useStore.getState().playback.runId)
    expect(html).toContain('<summary>Environment</summary>')
    expect(html).toContain('<summary>Fire doctrine</summary>')
    expect(html).toContain('<summary>Requirement inputs</summary>')
    expect(html).toContain('data-role="roe"')
    expect(html).toContain('Detect: single-scan Pd')
    expect(html).toContain('Apply environment effects to sensors and threats')
    expect(html).toContain('threat-without-path')
    expect(html).toContain('DETECT · TRACK · IDENTIFY · TARGET · ENGAGE · EFFECT')
    expect(html).toContain(`${entity.name} · ${entity.id}`)
    expect(html).toContain('class="board-object prepare-entity"')
    expect(html).toContain('type="button"')
    expect(html).toContain(`aria-label="Inspect ${entity.name}"`)
    expect(html).toContain('Open Test cards')
    expect(html).toContain('Open Library')
  })
})
