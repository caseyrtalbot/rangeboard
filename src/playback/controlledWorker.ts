import { vi } from 'vitest'

/**
 * Test double for the global `Worker`, shared by every slot test (replicate,
 * sensitivity and trial). It records the posted request, delivers messages and
 * errors on demand, keeps its handlers reachable after termination so a queued
 * callback from a replaced worker can still be fired, and can fail on
 * construction or on post. Install it with `ControlledWorker.install()` in a
 * `beforeEach`; the test's `afterEach` calls `vi.unstubAllGlobals()`.
 */
export class ControlledWorker {
  static instances: ControlledWorker[] = []
  /** When set, the constructor throws this message. */
  static constructionError: string | null = null
  /** When set, `postMessage` throws this message. */
  static postError: string | null = null

  onmessage: ((event: { data: unknown }) => void) | null = null
  onerror: ((event: { message: string }) => void) | null = null
  onmessageerror: (() => void) | null = null
  request: unknown = null
  terminated = false
  postMessage = vi.fn((request: unknown) => {
    if (ControlledWorker.postError != null) throw new Error(ControlledWorker.postError)
    this.request = request
  })
  terminate = vi.fn(() => {
    this.terminated = true
  })

  constructor() {
    if (ControlledWorker.constructionError != null)
      throw new Error(ControlledWorker.constructionError)
    ControlledWorker.instances.push(this)
  }

  /** Deliver one message as the worker would. */
  send(data: unknown): void {
    this.onmessage?.({ data })
  }
  /** Raise a native worker error. */
  fail(message: string): void {
    this.onerror?.({ message })
  }

  /** The worker constructed most recently. */
  static latest(): ControlledWorker {
    return ControlledWorker.instances.at(-1)!
  }

  /** Stub the global and clear every record and failure flag. */
  static install(): void {
    vi.stubGlobal('Worker', ControlledWorker)
    ControlledWorker.instances = []
    ControlledWorker.constructionError = null
    ControlledWorker.postError = null
  }
}
