/**
 * Keep a copy of a save that cannot be loaded. The autosave subscriber
 * overwrites the live key on the first edit, so an unreadable save that is
 * not copied first is destroyed. Returns the recovery key, or null when the
 * copy itself could not be written.
 */
export function stashUnreadableSave(raw: string, prefix: string): string | null {
  const key = `${prefix}${Date.now()}`
  try {
    localStorage.setItem(key, raw)
  } catch {
    return null
  }
  return key
}

/** One-time startup notice; window.alert is what every other load error in this app uses. */
export function notifyRecovery(what: string, key: string | null): void {
  if (typeof window === 'undefined' || typeof window.alert !== 'function') return
  const where = key
    ? `A copy is kept in browser storage under "${key}".`
    : 'A copy could not be kept: browser storage is full.'
  window.alert(`The saved ${what} could not be read and was not loaded. ${where}`)
}
