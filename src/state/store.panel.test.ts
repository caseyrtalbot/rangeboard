import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushViewWrites } from '../io/viewState'
import { VIEW_KEY } from '../io/storageKeys'
import { emptyScenario } from '../model/seed'
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
    flushViewWrites()
    const saved = storage.get(VIEW_KEY) ?? ''
    expect(saved).toContain('showFieldHelp')
    for (const key of ['validityOpen', 'openSections', 'selectionOrigin', 'panelRequest'])
      expect(saved).not.toContain(key)
    expect(useStore.getState().ui.validityOpen).toBe(true)
  })
})
