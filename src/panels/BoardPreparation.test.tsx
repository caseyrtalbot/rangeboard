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

  it('surfaces setup consequences by severity and selects each affected threat', () => {
    const store = useStore.getState()
    store.addEntityFromModel('lib-giraffe1x', { x: 0, y: 0 })
    store.addEntityFromModel('lib-mavic3', { x: 0, y: -3500 })
    const threats = useStore.getState().scenario.entities.filter((entity) => entity.kind === 'uas')
    for (const threat of threats) {
      store.beginPath(threat.id)
      store.addDraftPoint({ x: 0, y: -100 })
      store.finishPath()
    }
    store.clearSelection()
    const before = useStore.getState()
    const html = render()
    const disclosure = html.indexOf('<details class="prepare-validity-disclosure">')
    const detection = `First detection not assessed: ${threats.map((threat) => threat.name).join(', ')} ${threats.length === 1 ? 'starts' : 'start'} inside detection coverage.`
    const missingAsset = 'No defended asset is placed. Warning time, arrival and leakage are not measurable.'

    expect(html).toContain(detection)
    expect(html).toContain(missingAsset)
    expect(html.indexOf(detection)).toBeLessThan(html.indexOf(missingAsset))
    expect(html.indexOf(missingAsset)).toBeLessThan(disclosure)
    expect(html.indexOf('Point values from the threshold envelope.')).toBeGreaterThan(disclosure)
    expect(html.indexOf('These models are not validated:')).toBeGreaterThan(disclosure)
    for (const threat of threats) {
      expect(html).toContain(`<button class="mini" type="button">Select ${threat.name}</button>`)
      expect(html.indexOf(`Select ${threat.name}`)).toBeLessThan(disclosure)
    }
    expect(html.match(/>Select /g)).toHaveLength(threats.length)
    expect(html.match(/First detection not assessed:/g)).toHaveLength(1)
    expect(useStore.getState().scenario).toBe(before.scenario)
    expect(useStore.getState().selection).toBe(before.selection)
    expect(useStore.getState().playback).toBe(before.playback)
  })

  it('shows pathless threats up front without a spawn selection action', () => {
    const html = render()
    expect(html.indexOf('These threats have no flight path')).toBeLessThan(
      html.indexOf('<details class="prepare-validity-disclosure">'),
    )
    expect(html).not.toContain('>Select ')
  })
})
