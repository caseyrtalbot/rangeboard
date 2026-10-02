import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushViewWrites } from '../io/viewState'
import { VIEW_KEY } from '../io/storageKeys'
import { emptyScenario } from '../model/seed'
import type { OptimizeResult } from '../playback/optimizeTypes'
import { useStore } from './store'

describe('right panel UI state', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  beforeEach(() => {
    useStore.getState().replaceScenario(emptyScenario())
    useStore.getState().clearSelection()
    useStore.setState((st) => ({
      ui: { ...st.ui, selectionOrigin: 'board', openSections: {}, validityOpen: false },
    }))
  })

  it('records a board selection by default and a panel row by its origin (D7)', () => {
    const { select } = useStore.getState()
    select({ entityIds: ['a'] })
    expect(useStore.getState().ui.selectionOrigin).toBe('board')
    select({ entityIds: ['b'] }, false, 'panel')
    expect(useStore.getState().ui.selectionOrigin).toBe('panel')
    expect(useStore.getState().selection.entityIds).toEqual(['b'])
    // A board click on the object a panel row selected keeps the selection and moves the origin.
    const selection = useStore.getState().selection
    select({ entityIds: ['b'] })
    expect(useStore.getState().selection).toBe(selection)
    expect(useStore.getState().ui.selectionOrigin).toBe('board')
  })

  it('keeps the ui identity when neither the selection nor the origin changes', () => {
    useStore.getState().select({ entityIds: ['a'] })
    const ui = useStore.getState().ui
    useStore.getState().select({ entityIds: ['c'] })
    expect(useStore.getState().ui).toBe(ui)
  })

  it('opens sections by id and sets every listed section', () => {
    const st = useStore.getState()
    st.setSectionOpen('prepare-environment', true)
    expect(useStore.getState().ui.openSections).toEqual({ 'prepare-environment': true })
    st.setAllSections(false, ['prepare-environment', 'prepare-doctrine'])
    expect(useStore.getState().ui.openSections).toEqual({
      'prepare-environment': false,
      'prepare-doctrine': false,
    })
    const ui = useStore.getState().ui
    st.setAllSections(false, ['prepare-doctrine'])
    expect(useStore.getState().ui).toBe(ui)
  })

  it('closes the Validity line on a phase change (D1)', () => {
    const st = useStore.getState()
    st.setBoardPhase('prepare')
    st.setValidityOpen(true)
    st.setBoardPhase('execute')
    expect(useStore.getState().ui.validityOpen).toBe(false)
    // The status-bar button opens it in Execute without a phase change.
    st.setValidityOpen(true)
    expect(useStore.getState().ui.validityOpen).toBe(true)
    st.setBoardPhase('prepare')
  })

  it('keeps a placement preview out of the scenario and the undo history (R3)', () => {
    const st = useStore.getState()
    // Two edits and an undo leave one step on each stack.
    st.patchScenario({ name: 'Edit 1' })
    st.patchScenario({ name: 'Edit 2' })
    st.undo()
    const { scenario, past, future } = useStore.getState()
    expect([past.length, future.length]).toEqual([1, 1])
    // Only the source's identity matters to the store.
    const preview = { rank: 1, positions: { a: { x: 10, y: 20 } }, source: {} as OptimizeResult }
    st.setPlacementPreview(preview)
    expect(useStore.getState().ui.placementPreview).toBe(preview)
    expect(useStore.getState().scenario).toBe(scenario)
    expect(useStore.getState().past).toBe(past)
    expect(useStore.getState().future).toBe(future)
    st.setPlacementPreview(null)
    expect(useStore.getState().ui.placementPreview).toBeNull()
    expect(useStore.getState().scenario).toBe(scenario)
  })

  it('clears the placement preview on a replace and on a phase change (R3)', () => {
    const st = useStore.getState()
    const preview = { rank: 2, positions: {}, source: {} as OptimizeResult }
    st.setBoardPhase('prepare')
    st.setPlacementPreview(preview)
    st.replaceScenario(emptyScenario())
    expect(useStore.getState().ui.placementPreview).toBeNull()
    st.setPlacementPreview(preview)
    st.setBoardPhase('execute')
    expect(useStore.getState().ui.placementPreview).toBeNull()
    st.setBoardPhase('prepare')
  })

  it('moves the panel request sequence on every call', () => {
    const seq = useStore.getState().ui.panelRequest.seq
    const request = { phase: 'prepare', screen: 'inputs', section: 'prepare-doctrine' } as const
    useStore.getState().requestPanel(request)
    useStore.getState().requestPanel(request)
    expect(useStore.getState().ui.panelRequest).toEqual({ ...request, seq: seq + 2 })
  })

  it('persists none of the new fields', () => {
    // The node test env has no Web Storage, so the view key needs a stand-in.
    const storage = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => void storage.set(k, v),
      removeItem: (k: string) => void storage.delete(k),
    })
    const st = useStore.getState()
    st.setValidityOpen(true)
    st.setSectionOpen('prepare-run', false)
    st.select({ entityIds: ['a'] }, false, 'panel')
    st.requestPanel({ phase: 'analyze', screen: null, section: null })
    st.setShowFieldHelp(!st.ui.showFieldHelp)
    st.setPlacementPreview({ rank: 1, positions: {}, source: {} as OptimizeResult })
    flushViewWrites()
    const saved = storage.get(VIEW_KEY) ?? ''
    expect(saved).toContain('showFieldHelp')
    for (const key of [
      'validityOpen',
      'openSections',
      'selectionOrigin',
      'panelRequest',
      'placementPreview',
    ])
      expect(saved).not.toContain(key)
    expect(useStore.getState().ui.validityOpen).toBe(true)
  })
})
