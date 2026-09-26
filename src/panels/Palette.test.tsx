import type { ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PALETTE_COLLAPSED_KEY, PALETTE_WIDTH_KEY } from '../io/storageKeys'
import { emptyScenario } from '../model/seed'
import { useStore } from '../state/store'
import { Palette } from './Palette'

const settings = new Map<string, string>()

type Props = Record<string, unknown>

// Node has no DOM renderer. A test fires a handler from the props recorded by
// aria-label, runs the collected effects, and with `keep` set carries local state
// from one static render to the next.
const harness = vi.hoisted(() => ({
  props: new Map<string, Record<string, unknown>>(),
  effects: [] as Array<() => void>,
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
  const useEffect = (effect: () => void) => void harness.effects.push(effect)
  return { ...actual, useState, useEffect }
})
vi.mock('react/jsx-dev-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react/jsx-dev-runtime')>()
  const jsxDEV: typeof actual.jsxDEV = (type, props, ...rest) => {
    const label = (props as Props)['aria-label']
    if (typeof label === 'string') harness.props.set(label, props as Props)
    return actual.jsxDEV(type, props, ...rest)
  }
  return { ...actual, jsxDEV }
})

function fire(label: string, handler: string, event?: unknown): void {
  ;(harness.props.get(label)![handler] as (event?: unknown) => void)(event)
}

function render(props?: ComponentProps<typeof Palette>): string {
  harness.props.clear()
  harness.effects = []
  harness.next = 0
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<Palette {...props} />)
}

describe('Palette drawer', () => {
  beforeEach(() => {
    settings.clear()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => settings.get(key) ?? null,
      setItem: (key: string, value: string) => settings.set(key, value),
    })
    useStore.getState().replaceScenario(emptyScenario())
    useStore.setState((s) => ({
      ui: { ...s.ui, libraryRequest: { seq: 0, kind: null, modelId: null } },
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    harness.keep = false
    harness.slots = []
  })

  it('opens at the new default width with an accessible close and focused search target', () => {
    const html = render()

    expect(html).toContain('style="width:306px"')
    expect(html).toMatch(/aria-label="Close library" title="Close library \(Esc\)"/)
    expect(html).toContain('type="search" aria-label="Search library"')
  })

  it('holds the library file actions behind one header button and has no footer', () => {
    const html = render()
    const header = html.slice(html.indexOf('palette-header'), html.indexOf('palette-filter'))

    expect(header).toContain('aria-label="Library actions"')
    expect(header).toContain('aria-haspopup="dialog"')
    expect(header).toContain('aria-controls="library-actions-panel"')
    expect(header.indexOf('Library actions')).toBeLessThan(header.indexOf('Close library'))
    expect(html).not.toContain('palette-footer')
    expect(html).not.toContain('>Export library<')
  })

  it('labels each group toggle with its action and expanded state', () => {
    settings.set(PALETTE_COLLAPSED_KEY, JSON.stringify({ effector: true }))
    const html = render()

    expect(html).toContain('aria-label="Collapse Sensors" aria-expanded="true"')
    expect(html).toContain('aria-label="Expand Effectors" aria-expanded="false"')
  })

  it('splits a vendor parenthetical from the name onto the mono second line', () => {
    const html = render()
    const place = html.indexOf('aria-label="Place Giraffe 1X 3D radar (Saab)"')
    const row = html.slice(place, html.indexOf('</button>', place))

    expect(row).toContain('title="Giraffe 1X 3D radar (Saab)">Giraffe 1X 3D radar</span>')
    expect(row).toContain('<span class="palette-meta">Saab · Radar</span>')
  })

  it('retains a valid saved width and stays mounted while closed', () => {
    settings.set(PALETTE_WIDTH_KEY, '412')
    const html = render({ open: false })

    expect(html).toContain('style="width:412px"')
    expect(html).toContain('hidden=""')
    expect(html).toContain('Filter models…')
  })

  it('exposes model and system placement as keyboard buttons', () => {
    const html = render()

    expect(html).toContain('aria-label="Place FS-LIDS fixed site"')
    expect(html).toContain('aria-label="Place Giraffe 1X 3D radar (Saab)"')
    expect(html).toContain('aria-label="Open Giraffe 1X 3D radar (Saab) model basis"')
  })

  it('keeps custom-system placement and deletion as sibling buttons', () => {
    const store = useStore.getState()
    store.addEntityFromModel('lib-giraffe1x', { x: 0, y: 0 })
    store.addEntityFromModel('lib-faadc2', { x: 100, y: 0 })
    const entityIds = useStore.getState().scenario.entities.map((entity) => entity.id)
    useStore.getState().select({ entityIds })
    useStore.getState().saveSelectionAsSystem('Field set')
    const html = render()
    const place = html.indexOf('aria-label="Place Field set"')
    const placeClose = html.indexOf('</button>', place)
    const remove = html.indexOf('aria-label="Delete Field set system preset"')

    expect(place).toBeGreaterThan(-1)
    expect(remove).toBeGreaterThan(placeClose)
    expect(html.slice(place, placeClose)).not.toContain('<button')
  })

  it('provides a keyboard-resizable vertical separator', () => {
    const html = render()

    expect(html).toContain('role="separator"')
    expect(html).toContain('aria-orientation="vertical"')
    expect(html).toContain('aria-valuenow="306"')
    expect(html).toContain('aria-valuemin="180"')
    expect(html).toContain('aria-valuemax="480"')
    expect(html).toContain('tabindex="0"')
  })

  it('shows a model editor in place of the list, at no less than 408 px, with a way back', () => {
    const tab = useStore.getState().ui.rightTab
    useStore.getState().openLibrary('sensor', 'lib-giraffe1x')
    const html = render()

    expect(useStore.getState().selection.libraryId).toBe('lib-giraffe1x')
    expect(useStore.getState().ui.rightTab).toBe(tab)
    expect(html).toContain('style="width:408px"')
    expect(html).toContain('aria-label="Back to library" title="Back to library"')
    expect(html).toContain('aria-label="Close library"')
    expect(html).toContain('Giraffe 1X 3D radar (Saab)')
    expect(html).not.toContain('aria-label="Search library"')
    expect(html).not.toContain('aria-label="Library actions"')
  })

  it('fixes the editor width and keeps the saved list width while the editor shows', () => {
    harness.keep = true
    render()
    fire('Resize library', 'onKeyDown', { key: 'ArrowLeft', preventDefault() {} })
    expect(settings.get(PALETTE_WIDTH_KEY)).toBe('294')

    useStore.getState().openLibrary('sensor', 'lib-giraffe1x')
    const editor = render()
    expect(editor).toContain('style="width:408px"')
    expect(editor).not.toContain('role="separator"')
    expect(harness.props.has('Resize library')).toBe(false)
    expect(settings.get(PALETTE_WIDTH_KEY)).toBe('294')

    fire('Back to library', 'onClick')
    const list = render()
    expect(list).toContain('style="width:294px"')
    expect(list).toContain('aria-valuenow="294"')
  })

  it('opens the editor from Model basis and from a group add button', () => {
    harness.keep = true
    const seq = useStore.getState().ui.libraryRequest.seq
    render()
    fire('Open Giraffe 1X 3D radar (Saab) model basis', 'onClick')
    expect(useStore.getState().ui.libraryRequest).toEqual({
      seq: seq + 1,
      kind: 'sensor',
      modelId: 'lib-giraffe1x',
    })
    expect(render()).toContain('aria-label="Back to library"')

    fire('Back to library', 'onClick')
    render()
    fire('New Effectors model', 'onClick')
    const added = useStore.getState().scenario.library.at(-1)!
    expect(added.kind).toBe('effector')
    expect(useStore.getState().ui.libraryRequest).toEqual({
      seq: seq + 2,
      kind: 'effector',
      modelId: added.id,
    })
    expect(render()).toContain('aria-label="Back to library"')
  })

  it('expands and focuses the group of a kind request for this session only', () => {
    harness.keep = true
    settings.set(PALETTE_COLLAPSED_KEY, JSON.stringify({ sensor: true }))
    expect(render()).toContain('aria-label="Expand Sensors" aria-expanded="false"')

    useStore.getState().openLibrary('sensor')
    render()
    const html = render()
    expect(html).toContain('aria-label="Collapse Sensors" aria-expanded="true"')

    const toggle = { scrollIntoView: vi.fn(), focus: vi.fn() }
    const aside = { querySelector: vi.fn(() => toggle), closest: () => null }
    ;(harness.props.get('Model library')!.ref as { current: unknown }).current = aside
    for (const effect of harness.effects) effect()
    expect(aside.querySelector).toHaveBeenCalledWith('#library-group-sensor .palette-toggle')
    expect(toggle.focus).toHaveBeenCalledOnce()
    expect(settings.get(PALETTE_COLLAPSED_KEY)).toBe(JSON.stringify({ sensor: true }))
  })

  it('keeps the list for a kind request and a closed drawer, with an id on each group', () => {
    useStore.getState().openLibrary('asset')
    const listed = render()
    expect(listed).toContain('id="library-group-asset"')
    expect(listed).toContain('aria-label="Search library"')
    expect(listed).not.toContain('Back to library')
    expect(useStore.getState().selection.libraryId).toBeNull()

    useStore.getState().openLibrary('sensor', 'lib-giraffe1x')
    expect(render({ open: false })).not.toContain('Back to library')
  })

  it('renders tactics as real buttons that retain the existing action labels', () => {
    const html = render()
    const tactic = html.match(/<button[^>]*title="[^"]*study [^"]*"[^>]*>[\s\S]*?<\/button>/)?.[0]

    expect(tactic).toContain('palette-item')
    expect(tactic).toContain('RUS-LR-01')
  })
})
