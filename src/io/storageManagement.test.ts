import { afterEach, describe, expect, it, vi } from 'vitest'
import { allowAutosave, assertAutosaveAllowed, blockAutosave } from './recovery'
import { SCENARIO_KEY, SCENARIO_RECOVERY_PREFIX, TE_KEY, TE_RECOVERY_PREFIX } from './storageKeys'
import { deleteRecoveryCopy, downloadRecoveryCopy, readStorageUsage } from './storageManagement'

function storage(initial: Record<string, string>) {
  const data = new Map(Object.entries(initial))
  vi.stubGlobal('localStorage', {
    get length() { return data.size },
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (key: string) => data.get(key) ?? null,
    removeItem: (key: string) => data.delete(key),
  })
  return data
}

afterEach(() => { allowAutosave(SCENARIO_KEY); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('storage management', () => {
  it('accounts for every documented live key and both recovery namespaces in UTF-16 bytes', () => {
    const key = `${SCENARIO_RECOVERY_PREFIX}123`
    storage({ [SCENARIO_KEY]: '😀', [key]: '{bad', [`${TE_RECOVERY_PREFIX}456`]: '', unrelated: 'secret' })
    const result = readStorageUsage()
    expect(result.error).toBeNull()
    expect(result.entries.find(entry => entry.key === SCENARIO_KEY)?.bytes).toBe(2 * (SCENARIO_KEY.length + 2))
    expect(result.entries.find(entry => entry.key === key)).toEqual({ key, kind: 'recovery', bytes: 2 * (key.length + 4) })
    expect(result.entries.find(entry => entry.key === TE_KEY)?.bytes).toBe(0)
    expect(result.entries.filter(entry => entry.kind === 'recovery')).toHaveLength(2)
    expect(result.entries.some(entry => entry.key === 'unrelated')).toBe(false)
  })

  it.each(['', '{not json\nΩ'])('downloads recovery text exactly, including empty/malformed saves', async raw => {
    const key = `${TE_RECOVERY_PREFIX}123`
    const data = storage({ [key]: raw })
    let blob: Blob | undefined
    vi.spyOn(URL, 'createObjectURL').mockImplementation(value => { blob = value as Blob; return 'blob:test' })
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const anchor = { href: '', download: '', click: vi.fn() }
    vi.stubGlobal('document', { createElement: () => anchor })
    downloadRecoveryCopy(key)
    expect(await blob!.text()).toBe(raw)
    expect(anchor.download).toBe(`${key}.json`)
    expect(anchor.click).toHaveBeenCalledOnce()
    expect(revoke).toHaveBeenCalledWith('blob:test')
    expect(data.get(key)).toBe(raw)
  })

  it('deletes only the selected recovery copy and retains the autosave pause', () => {
    const key = `${SCENARIO_RECOVERY_PREFIX}123`
    const other = `${SCENARIO_RECOVERY_PREFIX}124`
    const data = storage({ [SCENARIO_KEY]: 'original', [key]: 'bad', [other]: 'older' })
    blockAutosave(SCENARIO_KEY, 'Keep original')
    deleteRecoveryCopy(key)
    expect(data.has(key)).toBe(false)
    expect(data.get(other)).toBe('older')
    expect(data.get(SCENARIO_KEY)).toBe('original')
    expect(() => assertAutosaveAllowed(SCENARIO_KEY)).toThrow('Keep original')
    expect(() => deleteRecoveryCopy(SCENARIO_KEY)).toThrow('Only recovery')
    expect(() => downloadRecoveryCopy(SCENARIO_KEY)).toThrow('Only recovery')
  })

  it('reports denied reads and deletions without throwing from the readout', () => {
    vi.stubGlobal('localStorage', {
      get length() { throw new Error('Denied') },
      getItem: () => { throw new Error('Denied') },
      removeItem: () => { throw new Error('Denied') },
    })
    expect(readStorageUsage()).toEqual({ entries: [], error: expect.stringContaining('could not be read') })
    const key = `${SCENARIO_RECOVERY_PREFIX}123`
    expect(() => downloadRecoveryCopy(key)).toThrow('could not be read')
    expect(() => deleteRecoveryCopy(key)).toThrow('could not be deleted')
  })

  it('detects silent deletion failure and a copy removed by another tab', () => {
    const key = `${SCENARIO_RECOVERY_PREFIX}123`
    vi.stubGlobal('localStorage', { removeItem: () => {}, getItem: () => 'retained' })
    expect(() => deleteRecoveryCopy(key)).toThrow('could not be deleted')
    storage({})
    expect(() => downloadRecoveryCopy(key)).toThrow('no longer')
  })
})
