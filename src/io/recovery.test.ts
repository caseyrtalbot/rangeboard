import { afterEach, describe, expect, it, vi } from 'vitest'
import { emptyScenario } from '../model/seed'
import { useStore } from '../state/store'
import { emptyCampaign } from '../te/model/empty'
import { useTeStore } from '../te/state/teStore'
import { loadTeAutosave, restoreTeAutosave, startTeAutosave } from '../te/io/persistTe'
import { loadAutosave, startAutosave } from './persist'
import { SCENARIO_KEY, SCENARIO_RECOVERY_PREFIX, TE_KEY, TE_RECOVERY_PREFIX } from './storageKeys'
import { allowAutosave, assertAutosaveAllowed, dismissRecoveryNotice, getRecoveryNotices,
  notifyRecovery, stashUnreadableSave, subscribeRecoveryNotices } from './recovery'

function storage(initial: Record<string, string> = {}, fail?: (key: string) => boolean) {
  const data = new Map(Object.entries(initial))
  const setItem = vi.fn((key: string, value: string) => {
    if (fail?.(key)) throw new DOMException('Storage unavailable', 'QuotaExceededError')
    data.set(key, value)
  })
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem })
  return { data, setItem }
}

function browser() {
  const events = new Map<string, () => void>()
  vi.stubGlobal('window', {
    alert: vi.fn(), setTimeout: vi.fn(() => 1), clearTimeout: vi.fn(),
    addEventListener: (key: string, callback: () => void) => events.set(key, callback),
  })
  vi.stubGlobal('document', { visibilityState: 'hidden', addEventListener: (key: string, callback: () => void) => events.set(key, callback) })
  return events
}

afterEach(() => {
  getRecoveryNotices().forEach(notice => dismissRecoveryNotice(notice.id))
  allowAutosave(SCENARIO_KEY); allowAutosave(TE_KEY)
  vi.restoreAllMocks(); vi.unstubAllGlobals()
})

describe('recovery durability', () => {
  it('retains notices before React or window exists and publishes dismissals', () => {
    const listener = vi.fn()
    notifyRecovery('scenario', 'rangeboard.scenario.recovered.1', 'Invalid scenario')
    const before = getRecoveryNotices()
    expect(before.at(-1)?.message).toContain('Invalid scenario')
    const unsubscribe = subscribeRecoveryNotices(listener)
    dismissRecoveryNotice(before.at(-1)!.id)
    expect(listener).toHaveBeenCalledOnce()
    expect(getRecoveryNotices()).toHaveLength(0)
    unsubscribe()
  })
  it('does not overwrite an earlier recovery created in the same millisecond', () => {
    vi.spyOn(Date, 'now').mockReturnValue(123)
    const { data } = storage()
    const a = stashUnreadableSave('first', SCENARIO_RECOVERY_PREFIX)
    const b = stashUnreadableSave('second', SCENARIO_RECOVERY_PREFIX)
    expect(a).not.toBe(b); expect(data.get(a!)).toBe('first'); expect(data.get(b!)).toBe('second')
  })
  it('detects an interrupted or silently truncated recovery copy', () => {
    vi.stubGlobal('localStorage', { getItem: vi.fn().mockReturnValueOnce(null).mockReturnValue('truncated'), setItem: vi.fn() })
    expect(stashUnreadableSave('entire raw record', SCENARIO_RECOVERY_PREFIX)).toBeNull()
  })
  it.each([
    ['Board', SCENARIO_KEY, SCENARIO_RECOVERY_PREFIX, loadAutosave],
    ['T&E', TE_KEY, TE_RECOVERY_PREFIX, loadTeAutosave],
  ] as const)('%s retains corrupt and empty raw records and surfaces failed recovery', (_label, key, prefix, load) => {
    for (const raw of ['', '{partial']) {
      const { data } = storage({ [key]: raw }, k => k.startsWith(prefix)); browser()
      expect(load()).toBeNull(); expect(data.get(key)).toBe(raw)
      expect(() => assertAutosaveAllowed(key)).toThrow('preserve')
      expect(getRecoveryNotices().at(-1)?.message).toContain('autosave is paused')
      expect(window.alert).not.toHaveBeenCalled()
    }
  })
  it.each([[SCENARIO_KEY, loadAutosave], [TE_KEY, loadTeAutosave]] as const)('fails closed after a denied read of %s', (key, load) => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new DOMException('Denied', 'SecurityError') } })
    expect(load()).toBeNull(); expect(() => assertAutosaveAllowed(key)).toThrow('could not be read')
  })
  it('suppresses Board autosave after recovery failure even if live-key writes would succeed', () => {
    const raw = JSON.stringify({ ...emptyScenario(), entities: null })
    const { data } = storage({ [SCENARIO_KEY]: raw }, key => key.startsWith(SCENARIO_RECOVERY_PREFIX))
    const events = browser(); loadAutosave()
    let notify!: Parameters<typeof useStore.subscribe>[0]
    vi.spyOn(useStore, 'subscribe').mockImplementation(callback => { notify = callback; return () => {} })
    startAutosave()
    const prev = useStore.getState(); notify({ ...prev, scenario: emptyScenario() }, prev)
    events.get('pagehide')!()
    expect(data.get(SCENARIO_KEY)).toBe(raw)
    expect(useStore.getState().save.error).toContain('preserve')
  })
  it('suppresses T&E autosave after recovery failure on visibility flush', () => {
    const raw = JSON.stringify({ schemaVersion: 1, campaigns: [{ cards: null }] })
    const { data } = storage({ [TE_KEY]: raw }, key => key.startsWith(TE_RECOVERY_PREFIX))
    const events = browser()
    let notify!: Parameters<typeof useTeStore.subscribe>[0]
    vi.spyOn(useTeStore, 'subscribe').mockImplementation(callback => { notify = callback; return () => {} })
    restoreTeAutosave(); startTeAutosave()
    const prev = useTeStore.getState(); notify({ ...prev, campaigns: [emptyCampaign('New', 'N')] }, prev)
    events.get('visibilitychange')!()
    expect(data.get(TE_KEY)).toBe(raw); expect(useTeStore.getState().saveError).toContain('preserve')
  })
  it('flushes the latest Board edit on pagehide and preserves the prior record on quota failure', () => {
    const original = JSON.stringify(emptyScenario()); let full = false
    const { data } = storage({ [SCENARIO_KEY]: original }, () => full)
    const events = browser(); loadAutosave()
    let notify!: Parameters<typeof useStore.subscribe>[0]
    vi.spyOn(useStore, 'subscribe').mockImplementation(callback => { notify = callback; return () => {} })
    startAutosave()
    const prev = useStore.getState()
    notify({ ...prev, scenario: { ...emptyScenario(), name: 'Latest' } }, prev)
    events.get('pagehide')!()
    expect(JSON.parse(data.get(SCENARIO_KEY)!).name).toBe('Latest')
    const saved = data.get(SCENARIO_KEY); full = true
    notify({ ...prev, scenario: { ...emptyScenario(), name: 'Cannot save' } }, prev)
    events.get('pagehide')!()
    expect(data.get(SCENARIO_KEY)).toBe(saved)
    expect(useStore.getState().save.error).toContain('Storage unavailable')
  })
})
