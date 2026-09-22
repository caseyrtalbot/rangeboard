import type { ReactNode } from 'react'
import { useEffect, useSyncExternalStore } from 'react'
import { exportScenario } from '../io/persist'
import {
  armOverrideFault,
  clearOverrideFault,
  readOverrideFault,
  subscribeOverrideFault,
} from '../state/overrideFault'
import { useStore } from '../state/store'
import { ErrorBoundary } from './ErrorBoundary'

/**
 * Rethrows a subscriber throw during render so the override boundary contains it.
 * Unmount drops the held throw, and Try again mounts this child again.
 */
function OverrideSubscriber() {
  const fault = useSyncExternalStore(subscribeOverrideFault, readOverrideFault, readOverrideFault)
  // Returned as the effect cleanup: unmount drops the throw so Try again can render.
  useEffect(() => {
    return clearOverrideFault
  }, [])
  if (fault) throw fault.error
  return null
}

/**
 * Stays mounted while the boundary shows its alert. The throwing child unmounts
 * with that alert, so this shell is what keeps a later throw inside setState.
 */
function OverrideFaultArm({ children }: { children: ReactNode }) {
  useEffect(() => armOverrideFault(), [])
  return children
}

/** The boundary around the override subscriber. A healthy render is empty. */
export function OverrideSubscriberBoundary() {
  return (
    <OverrideFaultArm>
      <ErrorBoundary
        label="Override updates"
        onExport={() => exportScenario(useStore.getState().scenario)}
      >
        <OverrideSubscriber />
      </ErrorBoundary>
    </OverrideFaultArm>
  )
}
