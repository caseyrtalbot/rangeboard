import type { ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PALETTE_WIDTH_KEY } from '../io/storageKeys'
import { emptyScenario } from '../model/seed'
import { useStore } from '../state/store'
import { Palette } from './Palette'

const settings = new Map<string, string>()

function render(props?: ComponentProps<typeof Palette>): string {
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
  })

  afterEach(() => vi.unstubAllGlobals())

  it('opens at the new default width with an accessible close and focused search target', () => {
    const html = render()

    expect(html).toContain('style="width:306px"')
    expect(html).toContain('aria-label="Close library"')
    expect(html).toContain('type="search" aria-label="Search library"')
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

  it('renders tactics as real buttons that retain the existing action labels', () => {
    const html = render()
    const tactic = html.match(/<button[^>]*title="[^"]*study [^"]*"[^>]*>[\s\S]*?<\/button>/)?.[0]

    expect(tactic).toContain('palette-item')
    expect(tactic).toContain('RUS-LR-01')
  })
})
