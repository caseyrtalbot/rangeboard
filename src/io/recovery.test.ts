import { afterEach, describe, expect, it, vi } from 'vitest'
import { SCENARIO_KEY, SCENARIO_RECOVERY_PREFIX } from './storageKeys'
import {
  allowAutosave,
  dismissRecoveryNotice,
  getRecoveryNotices,
  notifyRecovery,
  stashUnreadableSave,
  subscribeRecoveryNotices,
} from './recovery'

// The lifecycle around these helpers (read, admit, debounce, flush) is in autosave.test.ts.
function storage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
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
  it('detects an interrupted or silently truncated recovery copy', () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValueOnce(null).mockReturnValue('truncated'),
      setItem: vi.fn(),
    })
    expect(stashUnreadableSave('entire raw record', SCENARIO_RECOVERY_PREFIX)).toBeNull()
  })
})
