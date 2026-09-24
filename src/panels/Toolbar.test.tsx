import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import fixture from '../../docs/field-te/evidence/onboarding-2026-09-04/firing-scenario.json'
import { parseAutosave } from '../io/persist'
import { emptyScenario } from '../model/seed'
import { useStore } from '../state/store'
import { RangeSetupMenuPanel } from './RangeSetupMenu'
import { BoardTools, FileActions, Toolbar } from './Toolbar'
import { ViewMenuPanel } from './ViewMenu'
import { SettingsPanel } from './SettingsPanel'

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
    expect(html).toContain('title="Settings (requirements, run, systems, physics and view)"')
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

  it('orders canvas tools before range, view and history', () => {
    const html = render(<BoardTools />)
    const labels = [
      '>Select</button>',
      '>Boundary</button>',
      '>Connect</button>',
      '>Path</button>',
      'aria-controls="range-setup-menu-panel"',
      'aria-controls="view-menu-panel"',
      'History',
    ]
    const positions = labels.map((label) => html.indexOf(label))

    expect(html).toContain('class="board-tools" role="toolbar" aria-label="Board tools"')
    expect(positions.every((position) => position >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
    expect(html).not.toContain('Calibrate scale')
    expect(html).not.toContain('Range setup')
    expect(html).not.toContain('Declutter')
    expect(html).not.toContain('aria-label="Preset"')
  })

  it('titles each drawing tool and opens Range and View from chevron triggers', () => {
    const html = render(<BoardTools />)

    // No drawing tool has a shortcut, so no title carries a key.
    for (const [label, hint] of [
      ['Select', 'Move, pan, edit'],
      ['Boundary', 'Draw airspace and range polygons'],
      ['Connect', 'Link sensor to C2 to effector'],
      ['Path', 'Draw a UAS flight path'],
    ]) {
      expect(html).toMatch(new RegExp(`title="${hint}"[^>]*>${label}</button>`))
    }
    for (const [label, panel] of [
      ['Range', 'range-setup-menu-panel'],
      ['View', 'view-menu-panel'],
    ]) {
      expect(html).toMatch(
        new RegExp(
          `class="tb-menu "[^>]*aria-controls="${panel}"[^>]*>${label}<span class="tb-caret" aria-hidden="true"><svg`,
        ),
      )
    }
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
        'range-setup-menu-panel',
      ]) {
        expect(html).not.toContain(hidden)
      }
      for (const kept of ['view-menu-panel', 'aria-label="Undo"', 'aria-label="Redo"']) {
        expect(html).toContain(kept)
      }
    }
  })

  it('writes status chips in sentence case and makes the spawn chip a button', () => {
    useStore.getState().replaceScenario(parseAutosave(JSON.stringify(fixture)))
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

    expect(html).toMatch(/<button type="button" class="status-chip"[^>]*>.*Spawn in ring 1</)
    expect(html).not.toContain('Spawn In Ring')
    expect(html).not.toContain('WEZ On')
    expect(html).not.toContain('Env Derate')
  })

  it('draws undo and redo as icons', () => {
    const html = render(<BoardTools />)
    expect(html).toMatch(/title="Undo \(⌘Z\)" aria-label="Undo"[^>]*><svg/)
    expect(html).toMatch(/title="Redo \(⇧⌘Z\)" aria-label="Redo"[^>]*><svg/)
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
    expect(html).not.toContain('aria-label="Preset"')
  })
})
