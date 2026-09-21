/**
 * One autosave lifecycle for both stores: the read, the recovery of an unreadable
 * record, the write gate, the debounce, the browser events and the flush. An
 * adapter supplies the key, the parser, the selection, the adoption and the status.
 */

import {
  allowAutosave,
  assertAutosaveAllowed,
  blockAutosave,
  notifyRecovery,
  recoverUnreadableSave,
  resumeAutosave,
} from './recovery'

/** Write delay after a store change. A hide or unload flush never waits for it. */
const DEBOUNCE_MS = 500

/** A read that throws leaves a record that may still be readable later. */
const READ_BLOCKED =
  'Autosave paused: existing browser storage could not be read. Export current work and reload when storage is available.'
const READ_PAUSED =
  'Autosave paused: browser storage could not be read. Export current work and reload when storage is available.'

/** Everything one store's autosave does differently. */
export interface AutosaveAdapter<R> {
  /** Live storage key. Never renamed: existing saves are read by it. */
  key: string
  /** Prefix of a recovery copy of an unreadable record. */
  recoveryPrefix: string
  /** What a recovery notice calls this record ('scenario', 'baseline'). */
  label: string
  /** Parse a raw record. Throws a path and reason on invalid JSON or shape. */
  parse: (raw: string) => R
  /** Put a restored record into the owning store. */
  adopt: (record: R) => void
  /**
   * Subscribe the owning store and report every record worth writing. Returns the
   * unsubscribe. The comparison that decides "worth writing" belongs here.
   */
  subscribe: (changed: (record: R) => void) => () => void
  /** Stamp a completed write in the owning store's time format. */
  reportSaved: () => void
  /**
   * Keep the previous stamp and show why autosave is paused. The status string is
   * shared: a pause fills it only while no lane has reported an error (`pauseStatus`).
   */
  reportPaused: (message: string) => void
  /** Keep the previous stamp and render a failed write in the store's words. */
  reportWriteFailure: (error: unknown) => void
  /** True when no write may precede `restore()`, so a restore off the first-paint path
   * can never be overwritten by an untouched store. */
  deferred?: boolean
}

export interface Autosave<R> {
  /** Read the saved record without adopting it. */
  read: () => R | null
  /** Read the saved record into the store and admit later writes. Runs at most once. */
  restore: () => R | null
  /** Subscribe the store and the browser hide and unload events. Call once at startup. */
  observe: () => void
  /** Write a pending record now. */
  flush: () => void
  /** Drop the pending record and release the subscription and the browser events. */
  stop: () => void
}

/**
 * Shared status is one string. A pause fills an empty status and leaves another
 * lane's error until that lane clears it.
 */
export function pauseStatus(current: string | null, message: string): string | null {
  return current ?? message
}

/** Each call owns its own timer, pending record and restore latch. */
export function createAutosave<R>(adapter: AutosaveAdapter<R>): Autosave<R> {
  let timer: number | undefined
  let pending: R | null = null
  let restored = false
  let unsubscribe: (() => void) | undefined

  /** Read failure and failed recovery both prevent a subsequent autosave overwrite. */
  function read(): R | null {
    let raw: string | null
    try {
      raw = localStorage.getItem(adapter.key)
    } catch {
      blockAutosave(adapter.key, READ_BLOCKED)
      adapter.reportPaused(READ_PAUSED)
      return null
    }
    if (raw === null) {
      allowAutosave(adapter.key)
      return null
    }
    try {
      const record = adapter.parse(raw)
      allowAutosave(adapter.key)
      return record
    } catch (error) {
      notifyRecovery(
        adapter.label,
        recoverUnreadableSave(raw, adapter.key, adapter.recoveryPrefix),
        (error as Error).message,
      )
      return null
    }
  }

  function flush(): void {
    window.clearTimeout(timer)
    timer = undefined
    const record = pending
    pending = null
    if (!record) return
    try {
      // A failed rescue stays blocked until this copy verifies, then the edit writes.
      resumeAutosave(adapter.key)
      assertAutosaveAllowed(adapter.key)
      localStorage.setItem(adapter.key, JSON.stringify(record))
      adapter.reportSaved()
    } catch (error) {
      // Storage full or unavailable: the saved stamp must not keep showing a
      // time that is no longer true.
      adapter.reportWriteFailure(error)
    }
  }

  function onVisibilityChange(): void {
    if (document.visibilityState === 'hidden') flush()
  }

  return {
    read,
    restore() {
      if (restored) return null
      const record = read()
      if (record) adapter.adopt(record)
      restored = true
      return record
    },
    observe() {
      unsubscribe = adapter.subscribe((record) => {
        if (adapter.deferred && !restored) return
        pending = record
        window.clearTimeout(timer)
        timer = window.setTimeout(flush, DEBOUNCE_MS)
      })
      window.addEventListener('pagehide', flush)
      document.addEventListener('visibilitychange', onVisibilityChange)
    },
    flush,
    stop() {
      window.clearTimeout(timer)
      timer = undefined
      pending = null
      unsubscribe?.()
      unsubscribe = undefined
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    },
  }
}
