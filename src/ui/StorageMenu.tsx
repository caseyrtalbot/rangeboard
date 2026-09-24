import { lazy, Suspense, useSyncExternalStore } from 'react'
import { getRecoveryNotices, subscribeRecoveryNotices } from '../io/recovery'
import { State } from './kit'

const StoragePanel = lazy(() =>
  import('./StoragePanel').then((module) => ({ default: module.StoragePanel })),
)

/** Startup recovery notices, readable before the Storage panel chunk loads. */
function useRecoveryNotices() {
  return useSyncExternalStore(subscribeRecoveryNotices, getRecoveryNotices, getRecoveryNotices)
}

/** The Storage entry, last in the scenario ⋯ menu, with the notice count as a warning. */
export function StorageMenuItem({ onOpen }: { onOpen: () => void }) {
  const notices = useRecoveryNotices()
  return (
    <button
      type="button"
      className="tb-menu-item"
      aria-haspopup="dialog"
      aria-controls="storage-panel"
      onClick={onOpen}
    >
      Storage
      {notices.length > 0 && (
        <State tone="warning" role="status">
          {notices.length} recovery notices
        </State>
      )}
    </button>
  )
}

/** The Storage panel, opened in place of the ⋯ menu that holds its entry. */
export function StorageDialog({ onRequestClose }: { onRequestClose: () => void }) {
  return (
    <Suspense
      fallback={
        <State tone="inactive" role="status">
          Loading storage…
        </State>
      }
    >
      <StoragePanel onRequestClose={onRequestClose} />
    </Suspense>
  )
}
