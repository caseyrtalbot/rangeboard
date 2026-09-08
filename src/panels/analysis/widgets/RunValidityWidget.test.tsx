import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { emptyScenario } from '../../../model/seed'
import { useStore } from '../../../state/store'
import { RunValidityWidget } from './RunValidityWidget'
import type { WidgetProps } from './registry'

// zustand 5 gives react-dom/server the store's initial state, not the live one,
// so every static render of a store-reading widget needs the two in step.
function render(onOpenPreparation?: WidgetProps['onOpenPreparation']): string {
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(
    <RunValidityWidget
      id="rs-validity"
      params={{}}
      collapsed={false}
      customize={false}
      index={0}
      count={1}
      onOpenPreparation={onOpenPreparation}
    />,
  )
}

describe('RunValidityWidget', () => {
  beforeEach(() => {
    const store = useStore.getState()
    store.replaceScenario(emptyScenario())
    store.addEntityFromModel('lib-giraffe1x', { x: 0, y: 0 })
    store.addEntityFromModel('lib-coyote', { x: 1697, y: -1697 })
    store.addEntityFromModel('lib-mavic3', { x: 0, y: -3000 })
    const uas = useStore.getState().scenario.entities.find((e) => e.kind === 'uas')!
    store.beginPath(uas.id)
    store.addDraftPoint({ x: 0, y: -100 })
    store.finishPath()
  })

  it('draws one fidelity chip per used model, with its tier and status', () => {
    const html = render()
    expect(html).toContain('class="fid-tags"')
    expect(html).toContain('Horizon · physics · analytic')
    expect(html).toContain('Kinetic Pk · planning · none')
    expect(html).toContain('data-tier="planning" data-validation="none"')
    expect(html).not.toContain('Acoustic range ·')
  })

  it('reports the deterministic envelope and the unvalidated models as caveats', () => {
    const html = render()
    expect(html).toContain('Point values from the threshold envelope.')
    expect(html).toContain(
      'These models are not validated: Environment, Doctrine, Kinetic Pk.',
    )
    // The spawn sits inside the radar ring, so one invalidating finding stands
    // beside the three limiting ones.
    expect(html).toContain('1 invalidating · 3 limiting')
    expect(html).toContain('<details class="analysis-disclosure validity-details">')
    expect(html).toContain('<summary>Findings and model fidelity')
    expect(html).toContain('Gates: detect.')
    expect(html).toContain('Tracks: DJI Mavic 3 (G1 quad) 1.')
    expect(html.indexOf('>INVALID</span>')).toBeLessThan(html.indexOf('<details'))
  })

  it('names lost measurements and offers threat selection without a Prepare callback', () => {
    const before = useStore.getState()
    const threat = before.scenario.entities.find((entity) => entity.kind === 'uas')!
    const html = render()

    expect(html).toContain(`First detection not assessed: ${threat.name} starts inside detection coverage.`)
    expect(html).toContain('No defended asset is placed. Warning time, arrival and leakage are not measurable.')
    expect(html).toContain(`<button class="mini" type="button">Select ${threat.name}</button>`)
    expect(html.match(/>Select /g)).toHaveLength(1)
    expect(useStore.getState().scenario).toBe(before.scenario)
    expect(useStore.getState().selection).toBe(before.selection)
    expect(useStore.getState().playback).toBe(before.playback)
  })

  it('keeps the environment and requirement routes into Prepare', () => {
    const scenario = useStore.getState().scenario
    useStore.getState().replaceScenario({
      ...scenario,
      environment: { ...scenario.environment, apply: false, precipitation: 'rain' },
    })
    const html = render(() => {})

    expect(html).toContain('Review environment in Prepare</button>')
    expect(html).toContain('Review requirement inputs in Prepare</button>')
    expect(html).toContain('>Select DJI Mavic 3 (G1 quad) 1</button>')
    expect(render()).not.toContain('Review environment in Prepare</button>')
  })
})
