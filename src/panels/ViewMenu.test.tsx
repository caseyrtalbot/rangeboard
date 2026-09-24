import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import { useStore } from '../state/store'
import { activeLayerPreset, DEFAULT_LAYERS, LAYER_PRESETS } from '../state/layers'
import type { LayerPreset } from '../state/layers'
import { ViewMenuPanel } from './ViewMenu'

function render(node: ReactNode): string {
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(node)
}

describe('View menu Preset', () => {
  beforeEach(() => {
    useStore.getState().replaceScenario(emptyScenario())
    useStore.getState().setTheme('system')
  })

  it('renders Preset first and marks the Layers section for the rail', () => {
    const html = render(<ViewMenuPanel />)
    const positions = ['Preset', 'Theme', 'Units', 'Basemap', 'Sensor layers'].map((label) =>
      html.indexOf(`aria-label="${label}"`),
    )

    expect(html).toContain('id="view-menu-panel"')
    expect(positions.every((position) => position >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
    expect(html).toMatch(/id="view-menu-layers"><div role="group" aria-label="Sensor layers">/)
    for (const preset of ['Full', 'Planning', 'Engagement', 'Clean']) {
      expect(html).toContain(`>${preset}</button>`)
    }
    expect(html).not.toContain('Declutter')
  })

  it('recognizes every exact preset and rejects a custom combination', () => {
    for (const name of Object.keys(LAYER_PRESETS) as LayerPreset[]) {
      expect(activeLayerPreset({ ...LAYER_PRESETS[name] })).toBe(name)
    }
    expect(activeLayerPreset(DEFAULT_LAYERS)).toBeNull()
    expect(activeLayerPreset({ ...LAYER_PRESETS.clean, threatWez: true })).toBeNull()
  })

  it('marks the applied preset without adding scenario history', () => {
    const past = useStore.getState().past.length
    const scenario = useStore.getState().scenario
    useStore.getState().applyLayerPreset('planning')
    const html = render(<ViewMenuPanel />)
    expect(html).toMatch(/aria-pressed="true" class="active">Planning<\/button>/)
    expect(useStore.getState().ui.layers).toEqual(LAYER_PRESETS.planning)
    expect(useStore.getState().past).toHaveLength(past)
    expect(useStore.getState().scenario).toBe(scenario)
  })
})
