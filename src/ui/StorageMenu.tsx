import { lazy, Suspense, useRef, useSyncExternalStore } from 'react'
import { getRecoveryNotices, subscribeRecoveryNotices } from '../io/recovery'
import { State } from './kit'
import { usePopover } from './usePopover'

const StoragePanel = lazy(() =>
  import('./StoragePanel').then((module) => ({ default: module.StoragePanel })),
)

/** Shared Board/Ops entry, with startup notices visible before the panel loads. */
export function StorageMenu() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const { open, setOpen, toggle } = usePopover(wrapRef, buttonRef)
  const notices = useSyncExternalStore(
    subscribeRecoveryNotices,
    getRecoveryNotices,
    getRecoveryNotices,
  )
  return (
    <div className="tb-menu-wrap" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="storage-panel"
        onClick={toggle}
      >
        {notices.length > 0 ? (
          <State tone="warning" role="status">
            Storage · {notices.length} recovery notices
          </State>
        ) : (
          'Storage'
        )}
      </button>
      {open && (
        <Suspense
          fallback={
            <State tone="inactive" role="status">
              Loading storage…
            </State>
          }
        >
          <StoragePanel onRequestClose={() => setOpen(false)} />
        </Suspense>
      )}
    </div>
  )
}
