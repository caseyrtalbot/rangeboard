import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { dismissRecoveryNotice, getRecoveryNotices, subscribeRecoveryNotices } from '../io/recovery'
import { deleteRecoveryCopy, downloadRecoveryCopy, readStorageUsage } from '../io/storageManagement'
import { State } from './kit'

/** Storage is sampled on open, refresh and cross-tab changes; no autosave polling. */
export function StoragePanel({ onRequestClose }: { onRequestClose: () => void }) {
  const refreshRef = useRef<HTMLButtonElement>(null)
  const [readout, setReadout] = useState(readStorageUsage)
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const notices = useSyncExternalStore(
    subscribeRecoveryNotices,
    getRecoveryNotices,
    getRecoveryNotices,
  )
  const refresh = () => {
    setReadout(readStorageUsage())
    setPendingDelete(null)
  }
  useEffect(() => {
    // The panel may arrive after the popover's open effect because its chunk is lazy.
    refreshRef.current?.focus()
    const onStorage = () => {
      setReadout(readStorageUsage())
      setPendingDelete(null)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
  function act(action: () => void) {
    try {
      action()
      setError(null)
      refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The storage operation failed.')
    }
  }
  const total = readout.entries.reduce((sum, entry) => sum + entry.bytes, 0)
  return (
    <section
      id="storage-panel"
      role="dialog"
      aria-label="Storage"
      className="tb-menu-panel tb-menu-right surface-float"
      style={{
        width: 'min(520px, calc(100vw - 28px))',
        maxHeight: '75vh',
        overflowY: 'auto',
        padding: 'var(--panel-pad)',
      }}
    >
      <div className="inspector-actions">
        <strong>Storage</strong>
        <button ref={refreshRef} type="button" onClick={refresh}>
          Refresh
        </button>
        <button type="button" onClick={onRequestClose}>
          Close
        </button>
      </div>
      {notices.map((notice) => (
        <div key={notice.id}>
          <State
            tone="warning"
            role="status"
            style={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}
          >
            {notice.message}
          </State>
          <button type="button" onClick={() => dismissRecoveryNotice(notice.id)}>
            Dismiss notice
          </button>
        </div>
      ))}
      {(error || readout.error) && (
        <State tone="critical" role="status">
          {error || readout.error}
        </State>
      )}
      {!readout.error && (
        <p className="muted small">
          {total.toLocaleString()} bytes across RangeBoard keys. UTF-16 key and value estimate;
          browser quota accounting varies. Refresh after saving.
        </p>
      )}
      {(['live', 'recovery'] as const).map((kind) => (
        <section key={kind} aria-label={kind === 'live' ? 'Live storage' : 'Recovery copies'}>
          <h3>{kind === 'live' ? 'Live storage' : 'Recovery copies'}</h3>
          {kind === 'recovery' &&
            !readout.error &&
            !readout.entries.some((entry) => entry.kind === kind) && (
              <p className="muted small">No recovery copies.</p>
            )}
          {readout.entries
            .filter((entry) => entry.kind === kind)
            .map((entry) => (
              <div
                key={entry.key}
                style={{ borderTop: '1px solid var(--rule)', paddingBlock: 'var(--space-2)' }}
              >
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--type-machine-size)',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {entry.key}
                </div>
                <span className="muted small">{entry.bytes.toLocaleString()} bytes</span>
                {kind === 'recovery' && (
                  <div className="inspector-actions">
                    <button
                      type="button"
                      onClick={() => act(() => downloadRecoveryCopy(entry.key))}
                    >
                      Download
                    </button>
                    {pendingDelete === entry.key ? (
                      <>
                        <State tone="warning">Delete this recovery copy?</State>
                        <button
                          type="button"
                          className="danger"
                          onClick={() => act(() => deleteRecoveryCopy(entry.key))}
                        >
                          Confirm delete
                        </button>
                        <button type="button" onClick={() => setPendingDelete(null)}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button type="button" onClick={() => setPendingDelete(entry.key)}>
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
        </section>
      ))}
    </section>
  )
}
