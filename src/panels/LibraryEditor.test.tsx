import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { LibraryEditor } from './LibraryEditor'
import { emptyScenario } from '../model/seed'
import { useStore } from '../state/store'

// zustand 5 gives react-dom/server the store's initial state, not the live one,
// so every static render of a store-reading panel needs the two in step.
function render(): string {
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<LibraryEditor />)
}

describe('LibraryEditor sources', () => {
  beforeEach(() => {
    useStore.getState().replaceScenario(emptyScenario())
  })

  it('shows the seed rows of a builtin model and no add form', () => {
    useStore.getState().select({ libraryId: 'lib-giraffe1x' })
    const html = render()
    expect(html).toContain('src-tb')
    expect(html).toContain('updateRateS')
    expect(html).toContain('href="https://www.saab.com/products/giraffe-1x"')
    expect(html).toContain('Reset to seed')
    expect(html).not.toContain('src-add')
  })

  it('reads the spread of every source row of a builtin model', () => {
    useStore.getState().select({ libraryId: 'lib-giraffe1x' })
    const html = render()
    expect(html).toContain('<th>Spread</th>')
    // detectRangeM takes the PF table lognormal; updateRateS carries no spread.
    expect(html).toContain('<td class="mono">±3 dB</td>')
    expect(html).toContain('<td class="mono">none</td>')
  })

  it('reads a pinned row and a triangular spread on a custom model', () => {
    const id = useStore.getState().addModel('effector')
    useStore.getState().updateModel(id, {
      provenance: [
        {
          field: 'pk',
          value: '0.7',
          source: 'a test report',
          url: null,
          date: '2026-09-04',
          basis: 'pf',
          spread: null,
        },
        {
          field: 'engageTimeS',
          value: '3 s',
          source: 'a maker page',
          url: 'https://example.test/x',
          date: '2026-09-04',
          basis: 'datasheet',
        },
      ],
    })
    useStore.getState().select({ libraryId: id })
    const html = render()
    expect(html).toContain('<td class="mono">pinned</td>')
    expect(html).toContain('<td class="mono">-20% to +30%</td>')
  })

  it('edits the flyout speed of an effector model', () => {
    useStore.getState().select({ libraryId: 'lib-skyranger30' })
    const html = render()
    expect(html).toContain('Flyout speed (m/s)')
    expect(html).toContain('value="1075"')
  })

  it('offers the add form and the empty line on a custom model', () => {
    const id = useStore.getState().addModel('sensor')
    useStore.getState().select({ libraryId: id })
    const html = render()
    expect(html).toContain('src-add')
    expect(html).toContain('No source is recorded. Every value is a planning factor.')
    expect(html).not.toContain('Reset to seed')
  })

  it('shows a delete button per row on a custom model', () => {
    const id = useStore.getState().addModel('sensor')
    useStore.getState().updateModel(id, {
      provenance: [
        {
          field: 'detectRangeM',
          value: '4000 m',
          source: 'a maker page',
          url: 'https://example.test/x',
          date: '2026-09-04',
          basis: 'datasheet',
        },
      ],
    })
    useStore.getState().select({ libraryId: id })
    const html = render()
    expect(html).toContain('aria-label="Delete source for detectRangeM"')
    expect(html).toContain('class="pf src"')
  })
})
