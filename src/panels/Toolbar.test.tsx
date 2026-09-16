import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import { useStore } from '../state/store'
import { RangeSetupMenuPanel } from './RangeSetupMenu'
import { BoardTools, FileActions, Toolbar } from './Toolbar'
import { ViewMenuPanel } from './ViewMenu'
import { SettingsPanel } from './SettingsPanel'
import { activeLayerPreset, DEFAULT_LAYERS, LAYER_PRESETS } from '../state/layers'
import type { LayerPreset } from '../state/layers'

function render(node: ReactNode): string {
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(node)
}

describe('Board toolbar grouping', () => {
  beforeEach(() => {
    useStore.getState().replaceScenario(emptyScenario())
    useStore.getState().setTool('select')
    useStore.getState().setTheme('system')
  })

  it('keeps Board identity, scenario, file trigger and status in the top bar', () => {
    const html = render(
      <Toolbar
        drawerOpen
        onToggleDrawer={() => {}}
        boardPhase="prepare"
        runSeq={1}
        runPhase="idle"
        onOpenPhase={() => {}}
      />,
    )

    expect(html).toContain('Rangeboard')
    expect(html).toContain('aria-label="Scenario name"')
    expect(html).toContain('aria-label="More actions"')
    expect(html).toContain('aria-label="Status"')
    expect(html).toContain('title="Settings (all scenario, run and view settings)"')
    expect(html).toContain('title="ROE · click to change"')
    expect(html).toContain(
      'aria-controls="board-workspace-panel" aria-expanded="true" aria-label="Workspace drawer"',
    )
    expect(html).not.toContain('aria-label="Board tools"')
    expect(html).not.toContain('aria-label="Theme"')

    // The lifecycle tabs and the run status moved into the bar; the phase row is gone.
    expect(html).toContain('role="tablist" aria-label="Lifecycle views"')
    expect(html).toContain('id="board-phase-prepare" role="tab" aria-selected="true"')
    expect(html).toContain('class="board-run-context"')
    const order = ['Rangeboard', 'Lifecycle views', 'board-run-context', 'Workspace drawer'].map(
      (mark) => html.indexOf(mark),
    )
    expect(order.every((position) => position >= 0)).toBe(true)
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })

  it('orders canvas tools before range setup, view and history', () => {
    const html = render(<BoardTools />)
    const labels = [
      'Select',
      'Boundary',
      'Connect',
      'Path',
      'Range setup',
      'View',
      'Declutter',
      'History',
    ]
    const positions = labels.map((label) => html.indexOf(label))

    expect(html).toContain('class="board-tools" role="toolbar" aria-label="Board tools"')
    expect(positions.every((position) => position >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
    expect(html).not.toContain('Calibrate scale')
  })

  it('preserves every file action', () => {
    const html = render(<FileActions onRequestClose={() => {}} />)

    for (const action of ['New', 'Import', 'Export']) {
      expect(html).toContain(`>${action}</button>`)
    }
    expect(html).toContain('role="dialog" aria-label="File actions"')
  })
})

describe('Board menu scope', () => {
  beforeEach(() => {
    useStore.getState().replaceScenario(emptyScenario())
    useStore.getState().setTool('select')
    useStore.getState().setTheme('system')
  })

  it('keeps View limited to saved display controls and every layer toggle', () => {
    const html = render(<ViewMenuPanel />)
    const layerCount = Object.keys(useStore.getState().ui.layers).length
    const renderedLayerToggles = html.match(/class="tb-menu-item" aria-pressed=/g) ?? []

    expect(html).toContain('role="dialog" aria-label="View controls"')
    expect(html).toContain('aria-label="Theme"')
    expect(html).not.toContain('aria-label="Layer preset"')
    expect(html).not.toContain('aria-label="Declutter"')
    expect(html).toContain('aria-label="Basemap"')
    expect(html).toContain('aria-label="Units"')
    expect(renderedLayerToggles).toHaveLength(layerCount)
    for (const rangeControl of [
      'Scenario scope',
      'Location…',
      'Image…',
      'Calibrate scale',
      'Move image',
      'Opacity',
    ]) {
      expect(html).not.toContain(rangeControl)
    }
  })

  it('labels range geometry as scenario scope and keeps all underlay actions together', () => {
    const html = render(<RangeSetupMenuPanel onRequestClose={() => {}} />)

    expect(html).toContain('role="dialog" aria-label="Range setup"')
    expect(html).toContain('Range geometry')
    expect(html).toContain('Scenario scope')
    for (const control of ['Location…', 'Image…', 'Calibrate scale', 'Move image', 'Opacity']) {
      expect(html).toContain(control)
    }
    expect(html).toContain('aria-label="Image opacity"')
    expect(html).not.toContain('aria-label="Theme"')
    expect(html).not.toContain('aria-label="Basemap"')
  })

  it('keeps opacity updates in scenario history', () => {
    const before = useStore.getState().scenario.underlay.opacity
    const past = useStore.getState().past.length

    useStore.getState().updateUnderlay({ opacity: 0.4 })
    expect(useStore.getState().scenario.underlay.opacity).toBe(0.4)
    expect(useStore.getState().past).toHaveLength(past + 1)

    useStore.getState().undo()
    expect(useStore.getState().scenario.underlay.opacity).toBe(before)
  })
})

describe('Declutter selection', () => {
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
    const html = render(<BoardTools />)
    expect(html).toMatch(/aria-pressed="true" class="active">Planning<\/button>/)
    expect(useStore.getState().ui.layers).toEqual(LAYER_PRESETS.planning)
    expect(useStore.getState().past).toHaveLength(past)
    expect(useStore.getState().scenario).toBe(scenario)
  })
})

describe('Settings sections', () => {
  it('opens Scenario by default with the existing scenario forms', () => {
    const html = render(<SettingsPanel onRequestClose={() => {}} />)
    expect(html).toContain('role="dialog" aria-modal="true" aria-labelledby="settings-title"')
    const positions = ['Fire doctrine', 'Environment', 'Requirement inputs'].map((label) =>
      html.indexOf(`aria-label="${label}"`),
    )
    expect(positions.every((position) => position >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
    expect(html).toContain('data-role="roe"')
  })

  it('opens Run directly with the canonical run controls', () => {
    const html = render(<SettingsPanel initialSection="run" onRequestClose={() => {}} />)
    // The Run tab replaced the popover, so the controls carry their plain-language names.
    for (const control of [
      'Deterministic',
      'Monte Carlo',
      'What varies',
      'Repeat key · seed',
      'How many runs · replicates',
    ]) {
      expect(html).toContain(control)
    }
    expect(html).not.toContain('aria-label="Fire doctrine"')
  })

  it('opens View directly with shared display controls and no preset duplication', () => {
    const html = render(<SettingsPanel initialSection="view" onRequestClose={() => {}} />)
    const positions = ['Theme', 'Units', 'Basemap', 'Sensor layers'].map((label) =>
      html.indexOf(`aria-label="${label}"`),
    )
    expect(positions.every((position) => position >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
    expect(html).toContain('System')
    expect(html).toContain('Dark')
    expect(html).toContain('Light')
    expect(html).not.toContain('aria-label="Declutter"')
  })
})
