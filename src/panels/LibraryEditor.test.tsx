import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LibraryEditor } from './LibraryEditor'
import { emptyScenario } from '../model/seed'
import { useStore } from '../state/store'

// Node has no DOM renderer. A test fires a button by its text, and with `keep` set
// local state carries from one static render to the next.
const harness = vi.hoisted(() => ({
  buttons: new Map<string, () => void>(),
  keep: false,
  slots: [] as unknown[],
  next: 0,
}))
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  function useState<T>(init: T | (() => T)) {
    if (!harness.keep) return actual.useState(init)
    const i = harness.next++
    if (!(i in harness.slots)) harness.slots[i] = init instanceof Function ? init() : init
    const set = (v: T | ((prev: T) => T)) => {
      harness.slots[i] = v instanceof Function ? v(harness.slots[i] as T) : v
    }
    return [harness.slots[i] as T, set] as const
  }
  return { ...actual, useState }
})
vi.mock('react/jsx-dev-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react/jsx-dev-runtime')>()
  const jsxDEV: typeof actual.jsxDEV = (type, props, ...rest) => {
    const p = props as { children?: unknown; onClick?: () => void }
    if (type === 'button' && typeof p.children === 'string' && p.onClick) {
      harness.buttons.set(p.children, p.onClick)
    }
    return actual.jsxDEV(type, props, ...rest)
  }
  return { ...actual, jsxDEV }
})

// zustand 5 gives react-dom/server the store's initial state, not the live one,
// so every static render of a store-reading panel needs the two in step.
function render(modelId?: string): string {
  harness.buttons.clear()
  harness.next = 0
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<LibraryEditor modelId={modelId} />)
}

describe('LibraryEditor sources', () => {
  beforeEach(() => {
    useStore.getState().replaceScenario(emptyScenario())
  })

  afterEach(() => {
    harness.keep = false
    harness.slots = []
  })

  it('opens an entity-scoped duplicate in the model library drawer', () => {
    harness.keep = true
    const seq = useStore.getState().ui.libraryRequest.seq
    render('lib-giraffe1x')
    harness.buttons.get('Duplicate')!()
    const copy = useStore.getState().scenario.library.at(-1)!
    expect(render('lib-giraffe1x')).toContain(`Added ${copy.name} to the library.`)

    harness.buttons.get('Open duplicate in model library')!()
    expect(useStore.getState().ui.libraryRequest).toEqual({
      seq: seq + 1,
      kind: 'sensor',
      modelId: copy.id,
    })
    expect(useStore.getState().selection.libraryId).toBe(copy.id)
  })

  it('edits an explicit model without changing selection or using the selected library model', () => {
    const store = useStore.getState()
    store.addEntityFromModel('lib-giraffe1x', { x: 0, y: 0 })
    const entity = useStore.getState().scenario.entities[0]
    store.select({ entityIds: [entity.id], libraryId: 'lib-mavic3' })
    const selection = useStore.getState().selection
    const html = render('lib-giraffe1x')
    expect(html).toContain('href="https://www.saab.com/products/giraffe-1x"')
    expect(html).toContain('Sensor capability')
    expect(html).not.toContain('Threat flight profile')
    expect(useStore.getState().selection).toBe(selection)
  })

  it('does not fall back to a selected model when the explicit model is missing', () => {
    useStore.getState().select({ libraryId: 'lib-giraffe1x' })
    const html = render('missing-model')
    expect(html).toContain('Model unavailable')
    expect(html).not.toContain('Sensor capability')
    expect(html).not.toContain('source-entries')
  })

  it('shows the seed rows of a builtin model and no add form', () => {
    useStore.getState().select({ libraryId: 'lib-giraffe1x' })
    const html = render()
    expect(html).toContain('source-entries')
    expect(html).toContain('updateRateS')
    expect(html).toContain('href="https://www.saab.com/products/giraffe-1x"')
    expect(html).toContain('Reset to seed')
    expect(html).not.toContain('src-add')
  })

  it('keeps every source field in a native disclosure with readable label/value pairs', () => {
    useStore.getState().select({ libraryId: 'lib-giraffe1x' })
    const html = render()
    const entries = [...html.matchAll(/<details class="source-entry">([\s\S]*?)<\/details>/g)]
    const rows = useStore
      .getState()
      .scenario.library.find((model) => model.id === 'lib-giraffe1x')!.provenance!
    expect(entries).toHaveLength(rows.length)
    for (const [index, entry] of entries.entries()) {
      for (const field of ['Field', 'Value', 'Basis', 'Spread', 'Source', 'Date']) {
        expect(entry[1]).toContain(`<dt>${field}</dt>`)
      }
      expect(entry[1]).toContain(`<dd class="mono">${rows[index].field}</dd>`)
      expect(entry[1]).toContain(`<dd class="mono">${rows[index].date}</dd>`)
      expect(entry[1]).toContain('class="prov-mark"')
    }
    expect(html).not.toContain('<table')
  })

  it('reads the spread of every source row of a builtin model', () => {
    useStore.getState().select({ libraryId: 'lib-giraffe1x' })
    const html = render()
    expect(html).toContain('<dt>Spread</dt>')
    // detectRangeM takes the PF table lognormal; updateRateS carries no spread.
    expect(html).toContain('<dd class="mono">±3 dB</dd>')
    expect(html).toContain('<dd class="mono">none</dd>')
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
    expect(html).toContain('<dd class="mono">pinned</dd>')
    expect(html).toContain('<dd class="mono">-20% to +30%</dd>')
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
    expect(html).toContain('class="prov-mark" title="datasheet · a maker page · 2026-09-04')
  })
})
