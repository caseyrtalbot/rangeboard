import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { Inspector } from './Inspector'
import { emptyScenario } from '../model/seed'
import { useStore } from '../state/store'

// zustand 5 gives react-dom/server the store's initial state, not the live one,
// so every static render of a store-reading panel needs the two in step.
function render(): string {
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<Inspector />)
}

describe('Inspector provenance tags', () => {
  beforeEach(() => {
    const st = useStore.getState()
    st.replaceScenario(emptyScenario())
    st.addEntityFromModel('lib-giraffe1x', { x: 0, y: 0 })
    const sensor = useStore.getState().scenario.entities.find((e) => e.kind === 'sensor')!
    useStore.getState().select({ entityIds: [sensor.id] })
  })

  it('marks a sourced field SRC with its basis, source and date', () => {
    const html = render()
    const tag = /<span class="pf src" title="([^"]*)"/.exec(html)
    expect(tag).not.toBeNull()
    expect(tag![1]).toMatch(/^(datasheet|reference) · .+ · \d{4}-\d{2}-\d{2}$/)
  })

  it('marks an unsourced field PF', () => {
    expect(render()).toContain('<span class="pf" title="planning factor">')
  })
})
