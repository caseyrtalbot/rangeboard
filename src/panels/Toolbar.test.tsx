import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import fixture from '../../docs/field-te/evidence/onboarding-2026-09-04/firing-scenario.json'
import { parseAutosave } from '../io/persist'
import { dismissRecoveryNotice, getRecoveryNotices, notifyRecovery } from '../io/recovery'
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
    useStore.getState().setBoardPhase('prepare')
  })

  it('orders brand, name, tabs, the primary action, Settings, the ⋯ menu and the drawer', () => {
    const html = render(
      <Toolbar drawerOpen onToggleDrawer={() => {}} boardPhase="prepare" onOpenPhase={() => {}} />,
    )

    expect(html).toContain('aria-label="Scenario name" title="Scenario name (F2)"')
    expect(html).toContain('class="scenario-name-edit" aria-hidden="true"><svg')
    expect(html).toMatch(/class="tb-icon" aria-label="Settings" title="Settings"[^>]*><svg/)
    expect(html).toMatch(/aria-label="More actions" title="More actions"><svg/)
    expect(html).toMatch(/aria-label="Workspace drawer" title="Close drawer \(]\)"><svg/)
    expect(html).not.toContain('aria-label="Board tools"')
    expect(html).not.toContain('aria-label="Theme"')

    // The scenario name renders once, and one primary action sits in the bar.
    expect(html.match(/Scenario name/g)).toHaveLength(2)
    expect(html.match(/class="mc-run primary"/g)).toHaveLength(1)
    expect(html).toContain('role="tablist" aria-label="Lifecycle views"')
    expect(html).toContain('id="board-phase-prepare" role="tab" aria-selected="true"')
    const order = [
      'Rangeboard',
      'Scenario name',
      'Lifecycle views',
      '>Run<',
      'aria-label="Settings"',
      'aria-label="More actions"',
      'Workspace drawer',
    ].map((mark) => html.indexOf(mark))
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

  it('hides the editing tools outside Prepare, returns the tool to Select, and keeps view and history', () => {
    for (const phase of ['execute', 'analyze'] as const) {
      // A drawing tool chosen in Prepare does not survive the phase change.
      useStore.getState().setBoardPhase('prepare')
      useStore.getState().setTool('boundary')
      useStore.getState().setBoardPhase(phase)
      expect(useStore.getState().ui.tool).toBe('select')
      const html = render(<BoardTools />)

      expect(html).toContain('aria-label="Board tools"')
      for (const hidden of [
        'Drawing tools',
        'Select',
        'Boundary',
        'Connect',
        'Path',
        'Range setup',
      ]) {
        expect(html).not.toContain(hidden)
      }
      for (const kept of ['View', 'Declutter', 'aria-label="Undo"', 'aria-label="Redo"']) {
        expect(html).toContain(kept)
      }
    }
  })

  it('leaves the run status and the status chips to the status bar', () => {
    useStore.getState().replaceScenario(parseAutosave(JSON.stringify(fixture)))
    const html = render(
      <Toolbar drawerOpen onToggleDrawer={() => {}} boardPhase="prepare" onOpenPhase={() => {}} />,
    )

    for (const moved of ['board-run-context', 'aria-label="Status"', 'ROE', 'Spawn in ring']) {
      expect(html).not.toContain(moved)
    }
    expect(html).not.toContain('aria-controls="storage-panel"')
    expect(html).not.toContain('tb-icon-mark')
  })

  it('draws undo and redo as icons', () => {
    const html = render(<BoardTools />)
    expect(html).toMatch(/aria-label="Undo"[^>]*><svg/)
    expect(html).toMatch(/aria-label="Redo"[^>]*><svg/)
  })

  it('preserves every file action and ends the ⋯ menu with Storage', () => {
    const html = render(<FileActions onRequestClose={() => {}} onOpenStorage={() => {}} />)

    for (const action of ['New', 'Import', 'Export']) {
      expect(html).toContain(`>${action}</button>`)
    }
    expect(html).toContain('role="dialog" aria-label="File actions"')
    expect(html).toMatch(
      />Export<\/button><hr class="tb-menu-sep"\/><button[^>]*>Storage<\/button><\/div>$/,
    )
    expect(html).toContain('aria-haspopup="dialog" aria-controls="storage-panel"')
  })

  it('shows recovery notices as a warning on Storage and a mark on the ⋯ trigger', () => {
    notifyRecovery('scenario', 'rangeboard.recovery.test')
    const notice = getRecoveryNotices().at(-1)!
    try {
      const menu = render(<FileActions onRequestClose={() => {}} onOpenStorage={() => {}} />)
      expect(menu).toMatch(/>Storage<span class="state warning" role="status">.*1 recovery notices/)
      const bar = render(
        <Toolbar
          drawerOpen
          onToggleDrawer={() => {}}
          boardPhase="prepare"
          onOpenPhase={() => {}}
        />,
      )
      expect(bar).toContain('title="More actions: 1 recovery notices"')
      expect(bar).toContain('class="tb-icon-mark" aria-hidden="true"')
    } finally {
      dismissRecoveryNotice(notice.id)
    }
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
  it('opens Scenario by default and links Fire doctrine and Environment to Prepare > Inputs', () => {
    const html = render(<SettingsPanel onRequestClose={() => {}} />)
    expect(html).toContain('role="dialog" aria-modal="true" aria-labelledby="settings-title"')
    const positions = ['Fire doctrine and Environment', 'Requirement inputs'].map((label) =>
      html.indexOf(`aria-label="${label}"`),
    )
    expect(positions.every((position) => position >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
    // Prepare > Inputs is the one editor; Settings holds only the link.
    expect(html).toContain('Open Prepare &gt; Inputs')
    expect(html).not.toContain('data-role="roe"')
    expect(html).not.toContain('Apply effects')
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
