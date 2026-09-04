import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { emptyScenario } from '../../../model/seed'
import { useStore } from '../../../state/store'
import { RunValidityWidget } from './RunValidityWidget'

// zustand 5 gives react-dom/server the store's initial state, not the live one,
// so every static render of a store-reading widget needs the two in step.
function render(): string {
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(
    <RunValidityWidget
      id="rs-validity"
      params={{}}
      collapsed={false}
      customize={false}
      index={0}
      count={1}
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
  })
})
