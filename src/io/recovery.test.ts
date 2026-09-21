import { afterEach, describe, expect, it, vi } from 'vitest'
import { SCENARIO_KEY, SCENARIO_RECOVERY_PREFIX } from './storageKeys'
import {
  allowAutosave,
  assertAutosaveAllowed,
  dismissRecoveryNotice,
  getRecoveryNotices,
  notifyRecovery,
  recoverUnreadableSave,
  resumeAutosave,
  stashUnreadableSave,
  subscribeRecoveryNotices,
} from './recovery'

// The lifecycle around these helpers (read, admit, debounce, flush) is in autosave.test.ts.
function storage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    key: (index: number) => [...data.keys()][index] ?? null,
    get length() {
      return data.size
    },
  })
  return { data }
}

afterEach(() => {
  getRecoveryNotices().forEach((notice) => dismissRecoveryNotice(notice.id))
  allowAutosave(SCENARIO_KEY)
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
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
    expect(a).not.toBe(b)
    expect(data.get(a!)).toBe('first')
    expect(data.get(b!)).toBe('second')
  })
  it('reuses a rescue that already holds the same bytes', () => {
    vi.spyOn(Date, 'now').mockReturnValue(123)
    const { data } = storage()
    const first = stashUnreadableSave('same', SCENARIO_RECOVERY_PREFIX)
    const second = stashUnreadableSave('same', SCENARIO_RECOVERY_PREFIX)
    expect(second).toBe(first)
    expect([...data.keys()]).toEqual([first])
  })
  it('resumes a blocked lane once the rescue copy verifies', () => {
    let fail = true
    const data = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (fail && key.startsWith(SCENARIO_RECOVERY_PREFIX))
          throw new DOMException('full', 'QuotaExceededError')
        data.set(key, value)
      },
      key: (index: number) => [...data.keys()][index] ?? null,
      get length() {
        return data.size
      },
    })
    expect(recoverUnreadableSave('bad', SCENARIO_KEY, SCENARIO_RECOVERY_PREFIX)).toBeNull()
    expect(() => assertAutosaveAllowed(SCENARIO_KEY)).toThrow(/preserve/)
    fail = false
    resumeAutosave(SCENARIO_KEY)
    expect(() => assertAutosaveAllowed(SCENARIO_KEY)).not.toThrow()
    expect([...data.values()]).toEqual(['bad'])
    resumeAutosave(SCENARIO_KEY)
    expect(data.size).toBe(1)
  })
  it('detects an interrupted or silently truncated recovery copy', () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValueOnce(null).mockReturnValue('truncated'),
      setItem: vi.fn(),
    })
    expect(stashUnreadableSave('entire raw record', SCENARIO_RECOVERY_PREFIX)).toBeNull()
  })
})
