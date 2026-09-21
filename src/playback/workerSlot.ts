/**
 * One worker slot. A slot holds at most one live worker; `start` replaces
 * whatever runs, `cancel` asks the worker to stop and gives it a grace period,
 * `dispose` terminates it now. A callback from a replaced or disposed worker is
 * dropped, and a construction or post failure lands as one terminal error in
 * the protocol's own error shape. The protocol owns decoding and identity.
 */

/** Wall time a cancelled worker gets to post its summary before it is terminated. */
export const CANCEL_GRACE_MS = 2000

/** The error a cancelled worker reports when it stays silent past the grace period. */
export const CANCEL_TIMEOUT_MESSAGE = 'Cancel timed out; the worker was stopped'

/** How one protocol reads its worker. */
export interface SlotProtocol<M> {
  /** Construct the worker. A synchronous throw becomes one terminal error. */
  spawn: () => Worker
  /** Posted once the worker exists. */
  request: unknown
  /** Read one raw message; null drops it without releasing the slot. */
  decode: (data: unknown) => M | null
  /** Shape a transport or startup failure as a message of this protocol. */
  errorOf: (message: string) => M
  /** A terminal message releases the worker before it is delivered. */
  terminal: (m: M) => boolean
  onMessage: (m: M) => void
}

export interface WorkerSlot {
  /**
   * Replace whatever runs with `protocol`. Returns false when the environment
   * has no Worker (node and vitest) so the caller can report the request as
   * unavailable; nothing is started and no callback fires in that case.
   */
  start: <M>(protocol: SlotProtocol<M>) => boolean
  /**
   * Post `message` to the live worker and give it CANCEL_GRACE_MS to answer
   * with its own terminal message. A worker still silent after that is
   * terminated and reports CANCEL_TIMEOUT_MESSAGE. Returns false with nothing
   * live or a cancel already in flight.
   */
  cancel: (message: unknown) => boolean
  /** Terminate now. Callbacks the worker already queued are dropped by exact ownership. */
  dispose: () => void
}

interface Live<M> {
  worker: Worker
  protocol: SlotProtocol<M>
  grace: ReturnType<typeof setTimeout> | null
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function createWorkerSlot(): WorkerSlot {
  // The type parameter is per start; the slot only compares identity.
  let current: Live<unknown> | null = null

  const release = (live: Live<unknown>): void => {
    if (current !== live) return
    current = null
    if (live.grace != null) clearTimeout(live.grace)
    live.grace = null
    live.worker.onmessage = null
    live.worker.onerror = null
    live.worker.onmessageerror = null
    live.worker.terminate()
  }

  const start = <M>(protocol: SlotProtocol<M>): boolean => {
    dispose()
    if (typeof Worker === 'undefined') return false
    let worker: Worker
    try {
      worker = protocol.spawn()
    } catch (error) {
      protocol.onMessage(protocol.errorOf(messageOf(error)))
      return true
    }
    const live: Live<M> = { worker, protocol, grace: null }
    current = live as Live<unknown>
    const deliver = (m: M): void => {
      if (current !== live) return
      // Release first: a terminal callback may synchronously start the next request.
      if (protocol.terminal(m)) release(live as Live<unknown>)
      protocol.onMessage(m)
    }
    worker.onmessage = (e: MessageEvent<unknown>) => {
      if (current !== live) return
      const m = protocol.decode(e.data)
      if (m != null) deliver(m)
    }
    worker.onerror = (e: ErrorEvent) => deliver(protocol.errorOf(e.message || 'Worker failed'))
    worker.onmessageerror = () => deliver(protocol.errorOf('Worker response could not be decoded'))
    try {
      worker.postMessage(protocol.request)
    } catch (error) {
      deliver(protocol.errorOf(messageOf(error)))
    }
    return true
  }

  const cancel = (message: unknown): boolean => {
    const live = current
    if (live == null || live.grace != null) return false
    live.worker.postMessage(message)
    live.grace = setTimeout(() => {
      if (current !== live) return
      release(live)
      live.protocol.onMessage(live.protocol.errorOf(CANCEL_TIMEOUT_MESSAGE))
    }, CANCEL_GRACE_MS)
    return true
  }

  const dispose = (): void => {
    if (current != null) release(current)
  }

  return { start, cancel, dispose }
}
