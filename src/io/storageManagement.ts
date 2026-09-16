import * as storageKeys from './storageKeys'

export interface StorageEntry {
  key: string
  kind: 'live' | 'recovery'
  /** UTF-16 bytes for the key and value; browser quota accounting can differ. */
  bytes: number
}

export interface StorageReadout {
  entries: StorageEntry[]
  error: string | null
}

// Every export of storageKeys.ts is a live key or a `_RECOVERY_PREFIX` namespace.
const recoveryPrefixes = Object.entries(storageKeys)
  .filter(([name]) => name.endsWith('_RECOVERY_PREFIX'))
  .map(([, prefix]) => prefix)
const liveKeys = Object.entries(storageKeys)
  .filter(([name]) => !name.endsWith('_RECOVERY_PREFIX'))
  .map(([, key]) => key)

function isRecoveryKey(key: string): boolean {
  return recoveryPrefixes.some((prefix) => key.startsWith(prefix) && key.length > prefix.length)
}

/** Read only RangeBoard's documented live keys and its recovery namespaces. */
export function readStorageUsage(): StorageReadout {
  try {
    const keys = new Set<string>(liveKeys)
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && isRecoveryKey(key)) keys.add(key)
    }
    const entries: StorageEntry[] = []
    for (const key of keys) {
      const raw = localStorage.getItem(key)
      entries.push({
        key,
        kind: isRecoveryKey(key) ? 'recovery' : 'live',
        bytes: raw === null ? 0 : 2 * (key.length + raw.length),
      })
    }
    return { entries: entries.sort((a, b) => a.key.localeCompare(b.key)), error: null }
  } catch {
    return {
      entries: [],
      error: 'Browser storage could not be read. Check browser storage permissions.',
    }
  }
}

/** Export the exact unreadable text, without parsing or repairing the copy. */
export function downloadRecoveryCopy(key: string): void {
  if (!isRecoveryKey(key)) throw new Error('Only recovery copies can be downloaded here.')
  let raw: string | null
  try {
    raw = localStorage.getItem(key)
  } catch {
    throw new Error('The recovery copy could not be read. Check browser storage permissions.')
  }
  if (raw === null)
    throw new Error('The recovery copy is no longer in browser storage. Refresh the list.')
  const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }))
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = `${key}.json`
    a.click()
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Explicit per-key deletion never changes a live save or its autosave pause. */
export function deleteRecoveryCopy(key: string): void {
  if (!isRecoveryKey(key)) throw new Error('Only recovery copies can be deleted here.')
  try {
    localStorage.removeItem(key)
    if (localStorage.getItem(key) !== null) throw new Error('Deletion was not verified')
  } catch {
    throw new Error('The recovery copy could not be deleted. Check browser storage permissions.')
  }
}
