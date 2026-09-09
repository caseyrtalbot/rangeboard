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

  it('renders the run header, the input forms, validity gates and the register', () => {
    const entity = useStore.getState().scenario.entities[0]
    const html = render()

    expect(html).toContain('inspector-body board-preparation')
    expect(html).toContain('Forecast and analysis')
    expect(html).toContain('Run replicates')
    expect(html).toContain('RUN-0001')
    expect(html).not.toContain(useStore.getState().playback.runId)
    expect(html).not.toContain('Scenario and run scope')
    expect(html).toContain('<summary>Environment</summary>')
    expect(html).toContain('<summary>Fire doctrine</summary>')
    expect(html).toContain('<summary>Requirement inputs</summary>')
    expect(html).toContain('data-role="roe"')
    expect(html).toContain('Detect: single-scan Pd')
    expect(html).toContain('Apply environment effects to sensors and threats')
    expect(html).not.toContain('threat-without-path')
    expect(html).not.toContain('DETECT · TRACK · IDENTIFY · TARGET · ENGAGE · EFFECT')
    expect(html).toContain(`>${entity.name}<`)
    expect(html).not.toContain(entity.id)
    expect(html).toContain('class="board-object prepare-entity"')
    expect(html).toContain('type="button"')
    expect(html).toContain(`aria-label="Inspect ${entity.name}"`)
    expect(html).not.toContain('Open Test cards')
    expect(html).not.toContain('Open Library')
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
    const detection = `First detection not assessed: ${threats.map((threat) => threat.name).join(', ')} ${threats.length === 1 ? 'starts' : 'start'} inside detection coverage.`
    const missingAsset = 'No defended asset is placed. Warning time, arrival and leakage are not measurable.'
    const caveat = 'Point values from the threshold envelope.'

    expect(html).toContain(detection)
    expect(html).toContain(missingAsset)
    expect(html.indexOf(detection)).toBeLessThan(html.indexOf(missingAsset))
    expect(html.indexOf(missingAsset)).toBeLessThan(html.indexOf(caveat))
    expect(html).toContain('These models are not validated:')
    expect(html).not.toContain('prepare-validity-disclosure')
    expect(html).toContain('Gates: DETECT</span>')
    for (const threat of threats) {
      expect(html).toContain(`<button class="mini" type="button">Select ${threat.name}</button>`)
    }
    expect(html.match(/>Select /g)).toHaveLength(threats.length)
    expect(html.match(/First detection not assessed:/g)).toHaveLength(1)
    expect(html.match(/These models are not validated:/g)).toHaveLength(1)
    expect(useStore.getState().scenario).toBe(before.scenario)
    expect(useStore.getState().selection).toBe(before.selection)
    expect(useStore.getState().playback).toBe(before.playback)
  })

  it('shows pathless threats first without a spawn selection action', () => {
    const html = render()
    expect(html.indexOf('These threats have no flight path')).toBeLessThan(
      html.indexOf('Point values from the threshold envelope.'),
    )
    expect(html).not.toContain('>Select ')
  })
})
