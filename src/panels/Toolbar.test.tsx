import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import { useStore } from '../state/store'
import { useTeStore } from '../te/state/teStore'
import { RangeSetupMenuPanel } from './RangeSetupMenu'
import { BoardTools, FileActions, Toolbar } from './Toolbar'
import { ViewMenuPanel } from './ViewMenu'

function render(node: ReactNode): string {
  Object.assign(useStore.getInitialState(), useStore.getState())
  Object.assign(useTeStore.getInitialState(), useTeStore.getState())
  return renderToStaticMarkup(node)
}

describe('Board toolbar grouping', () => {
  beforeEach(() => {
    useStore.getState().replaceScenario(emptyScenario())
    useStore.getState().setTool('select')
    useStore.getState().setTheme('system')
    useTeStore.getState().setWorkspace('board')
    useTeStore.setState({ activeCampaignId: null })
  })

  it('keeps Board identity, scenario, file trigger and status in the top bar', () => {
    const html = render(<Toolbar />)

    expect(html).toContain('Rangeboard')
    expect(html).toContain('aria-label="Workspace"')
    expect(html).toContain('aria-label="Scenario name"')
    expect(html).toContain('aria-label="More actions"')
    expect(html).toContain('aria-label="Status"')
    expect(html).not.toContain('aria-label="Board tools"')
    expect(html).not.toContain('aria-label="Theme"')
  })

  it('keeps the T&amp;E Ops branch theme control', () => {
    useTeStore.getState().setWorkspace('ops')
    const html = render(<Toolbar />)

    expect(html).toContain('T&amp;E Ops')
    expect(html).toContain('aria-label="Theme"')
    expect(html).not.toContain('aria-label="Scenario name"')
  })

  it('orders canvas tools before range setup, view and history', () => {
    const html = render(<BoardTools />)
    const labels = ['Select', 'Boundary', 'Connect', 'Path', 'Range setup', 'View', 'History']
    const positions = labels.map((label) => html.indexOf(label))

    expect(html).toContain('class="board-tools" role="toolbar" aria-label="Board tools"')
    expect(positions.every((position) => position >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
    expect(html).not.toContain('Calibrate scale')
  })

  it('preserves every file action, including campaign frame capture', () => {
    useTeStore.setState({ activeCampaignId: 'campaign-test' })
    const html = render(<FileActions onRequestClose={() => {}} />)

    for (const action of ['New', 'Import', 'Export', 'Capture frame']) {
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
    const html = render(<ViewMenuPanel onRequestClose={() => {}} />)
    const layerCount = Object.keys(useStore.getState().ui.layers).length
    const renderedLayerToggles = html.match(/class="tb-menu-item" aria-pressed=/g) ?? []

    expect(html).toContain('role="dialog" aria-label="View controls"')
    expect(html).toContain('aria-label="Theme"')
    expect(html).toContain('aria-label="Layer preset"')
    expect(html).toContain('aria-label="Basemap"')
    expect(html).toContain('aria-label="Units"')
    expect(renderedLayerToggles).toHaveLength(layerCount)
    for (const rangeControl of ['Scenario scope', 'Location…', 'Image…', 'Calibrate scale', 'Move image', 'Opacity']) {
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
