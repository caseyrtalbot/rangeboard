/**
 * A throw from the override subscriber.
 * The shell arms containment for its lifetime. The child subscribes, reads the
 * fault, and rethrows it during render. With the shell unmounted the same throw
 * leaves `setState`. While the alert is up the child is gone, so a later throw
 * is contained and not stored: nothing is mounted to rethrow it.
 */

interface OverrideFault {
  readonly error: unknown
}

let armed = false
let fault: OverrideFault | null = null
const subscribers = new Set<() => void>()

/** The fault the override boundary reads. The same object until the next report. */
export function readOverrideFault(): OverrideFault | null {
  return fault
}

/** The boundary shell is mounted. Returns the disarm. */
export function armOverrideFault(): () => void {
  armed = true
  return () => {
    armed = false
  }
}

/** Subscribe the throwing child. Returns the unsubscribe. */
export function subscribeOverrideFault(listener: () => void): () => void {
  subscribers.add(listener)
  return () => {
    subscribers.delete(listener)
  }
}

/**
 * Hand a subscriber throw to the mounted child.
 * Rethrows when the shell is not mounted. Drops the throw when the shell is up
 * and the child is not, because the alert is already showing.
 */
export function reportOverrideFault(error: unknown): void {
  if (!armed) throw error
  if (subscribers.size === 0) return
  fault = { error }
  for (const listener of subscribers) listener()
}

/** Drop a held throw. The next mount reads none, so Try again can render. */
export function clearOverrideFault(): void {
  fault = null
}
