/** A failed recovery must never let autosave destroy the only unreadable copy. */
const blockedAutosaves = new Map<string, string>()

/** The bytes a failed rescue still has to copy before that lane may write. */
const pendingRescues = new Map<string, { raw: string; prefix: string }>()

const PRESERVE =
  'Autosave paused to preserve an unreadable save. Export current work and free browser storage. The next edit retries the copy.'

export function blockAutosave(key: string, reason: string): void {
  blockedAutosaves.set(key, reason)
}
export function allowAutosave(key: string): void {
  blockedAutosaves.delete(key)
  pendingRescues.delete(key)
}
export function assertAutosaveAllowed(key: string): void {
  const reason = blockedAutosaves.get(key)
  if (reason) throw new Error(reason)
}

/** A rescue already holding these exact bytes, so a later load does not write another key. */
function rescueHolding(raw: string, prefix: string): string | null {
  if (typeof localStorage.key !== 'function') return null
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(prefix) && localStorage.getItem(key) === raw) return key
  }
  return null
}

/** Returns a verified recovery key. Never replaces a prior recovery at the same millisecond. */
export function stashUnreadableSave(raw: string, prefix: string): string | null {
  try {
    const existing = rescueHolding(raw, prefix)
    if (existing) return existing
    const stem = `${prefix}${Date.now()}`
    let key = stem
    let suffix = 0
    while (localStorage.getItem(key) !== null) key = `${stem}.${++suffix}`
    localStorage.setItem(key, raw)
    if (localStorage.getItem(key) !== raw) return null
    return key
  } catch {
    return null
  }
}

export function recoverUnreadableSave(raw: string, liveKey: string, prefix: string): string | null {
  const key = stashUnreadableSave(raw, prefix)
  if (key) allowAutosave(liveKey)
  else {
    pendingRescues.set(liveKey, { raw, prefix })
    blockAutosave(liveKey, PRESERVE)
  }
  return key
}

/** Retry a failed rescue. A verified copy admits the lane; a miss leaves the block. */
export function resumeAutosave(liveKey: string): void {
  const pending = pendingRescues.get(liveKey)
  if (!pending) return
  if (!stashUnreadableSave(pending.raw, pending.prefix)) return
  allowAutosave(liveKey)
}

export interface RecoveryNotice {
  id: number
  message: string
}

// Recovery can run before React mounts. Keep notices until the user dismisses them.
let notices: RecoveryNotice[] = []
let nextNoticeId = 0
const listeners = new Set<() => void>()

export function getRecoveryNotices(): RecoveryNotice[] {
  return notices
}
export function subscribeRecoveryNotices(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
export function dismissRecoveryNotice(id: number): void {
  notices = notices.filter((notice) => notice.id !== id)
  listeners.forEach((listener) => listener())
}

/** Startup notice includes the actual validation failure and copy result. */
export function notifyRecovery(what: string, key: string | null, reason?: string): void {
  const where = key
    ? `A copy is kept in browser storage under "${key}".`
    : 'A recovery copy could not be verified. The original is retained; autosave is paused. Export current work and free browser storage. The next edit retries the copy.'
  notices = [
    ...notices,
    {
      id: ++nextNoticeId,
      message: `The saved ${what} could not be read and was not loaded. ${reason ?? ''} ${where}`,
    },
  ]
  listeners.forEach((listener) => listener())
}
