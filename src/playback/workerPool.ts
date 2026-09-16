/**
 * The browser worker pool for a replicate run. One pool holds at most one live
 * run, as `workerSlot.ts` holds one live worker: `start` replaces whatever
 * runs, `cancel` asks every live worker to stop and gives it CANCEL_GRACE_MS,
 * `dispose` terminates now, and the callbacks of a replaced or disposed run
 * are dropped by exact ownership. The pool speaks the replicate protocol of
 * `mcClient.ts` outward (`progress`, `done`, `error`) and the range protocol
 * below to its workers.
 *
 * Work is handed out by replicate index. The coordinator keeps a cursor over
 * 0..target and gives each worker a contiguous chunk; a worker that finishes a
 * chunk gets the next one, so a slow core never holds the run back. Replicate
 * i is a pure function of i (the keyed draw policy), so the merged partial is
 * the sequential loop's rows whatever order the chunks land in.
 *
 * Chunk size, with `size` workers:
 * - under a half-width target, `max(1, min(25, ceil(stopFloor / size)))`, so
 *   every worker starts busy, the rule is checked several times before the
 *   floor, and a stop wastes at most one chunk per worker;
 * - otherwise `min(ceil(replicates / size), 50)`, so a fixed count is one
 *   round of chunks when it is small and stays streamable when it is large.
 * At the defaults (floor 30, cap 2000, 8 workers) a target run uses chunks of
 * 4; a 1000-replicate fixed run uses chunks of 50; a 40-replicate fixed run on
 * 3 workers uses chunks of 14.
 *
 * Stop rules. With `targetHalfWidth` null the pool runs exactly `replicates`
 * indices and reports 'replicates'. With a target it runs until
 * `halfWidthReached` holds on the contiguous prefix of the merged indices,
 * checked after every merged chunk, or until `stopCap` indices are done. A
 * half-width stop, and a cancel, cancel the chunks in flight and wait for
 * their partials; the summary is then finished on the contiguous prefix only,
 * so the run is always the replicates 0..m-1 with no holes.
 */
import type { McSettings, Scenario } from '../model/types'
import { runSettings } from '../model/types'
import type { McPartial, McWorkerMessage, StopRule } from './mcRun'
import { finishSummary, halfWidthReached } from './mcRun'
import type { PoolProgress } from './mcTypes'
import { contiguousPrefix, mergePartials } from './mergeSummaries'
import { CANCEL_GRACE_MS, CANCEL_TIMEOUT_MESSAGE } from './workerSlot'

/** Most workers the pool builds, whatever the machine reports. */
export const MAX_POOL_WORKERS = 8

/** Longest chunk under a half-width target: the rule is checked at every merge. */
const TARGET_CHUNK_MAX = 25

/** Longest chunk with a fixed replicate count. */
const PLAIN_CHUNK_MAX = 50

/**
 * One replicate range for one worker. The worker drives `replicateRangeLoop`
 * over `start..end-1` and posts the partial; it never applies the half-width
 * rule, which the coordinator owns.
 */
export interface McRangeRequest {
  type: 'run-range'
  runId: string
  scenario: Scenario
  start: number
  end: number
}

/** Every request the pool posts; the worker's union is `McRequest | PoolRequest`. */
export type PoolRequest = McRangeRequest

/**
 * Messages of a range run. `done` and `total` count replicates within the
 * range. A cancelled range still posts `range-done` with the partial it
 * reached, so the coordinator can merge the work already paid for.
 */
export type PoolMessage =
  | { type: 'range-progress'; runId: string; done: number; total: number }
  | { type: 'range-done'; runId: string; partial: McPartial }
  | { type: 'range-error'; runId: string; message: string }

/** Construction and sizing hooks; a test passes its own worker and pool size. */
export interface PoolOptions {
  /** Construct one worker. A synchronous throw becomes one terminal error. */
  spawn?: () => Worker
  /** Workers to build, before the replicate count caps it. Default `poolSize()`. */
  size?: number
}

export interface WorkerPool {
  /**
   * Replace whatever runs with a pooled replicate run of `scenario`. Returns
   * false when the environment has no Worker (node and vitest) so the caller
   * can report the run as unavailable; nothing is started and no callback
   * fires in that case.
   */
  start: (
    scenario: Scenario,
    runId: string,
    onMessage: (m: McWorkerMessage) => void,
    onPool: (p: PoolProgress) => void,
  ) => boolean
  /**
   * Ask every worker holding a chunk to stop at its next checkpoint and give
   * the pool CANCEL_GRACE_MS to answer. The run then finishes on the
   * contiguous prefix with `stopped.rule` 'cancelled'. Returns false with no
   * live run, a cancel already in flight, or a `runId` that is not the live
   * one.
   */
  cancel: (runId?: string) => boolean
  /** Terminate every worker now. Callbacks already queued are dropped by exact ownership. */
  dispose: () => void
}

/**
 * Workers for this machine: one per core less the one the page runs on,
 * capped at MAX_POOL_WORKERS and never below one. A missing or unusable
 * `hardwareConcurrency` means one worker.
 */
export function poolSize(): number {
  const cores = typeof navigator === 'undefined' ? NaN : navigator.hardwareConcurrency
  if (typeof cores !== 'number' || !Number.isFinite(cores)) return 1
  return Math.max(1, Math.min(Math.floor(cores) - 1, MAX_POOL_WORKERS))
}

/** The chunk rule; see the module comment for the numbers it gives. */
export function chunkSize(settings: McSettings, size: number): number {
  if (settings.targetHalfWidth != null) {
    return Math.max(1, Math.min(TARGET_CHUNK_MAX, Math.ceil(settings.stopFloor / size)))
  }
  return Math.max(1, Math.min(PLAIN_CHUNK_MAX, Math.ceil(settings.replicates / size)))
}

/** Indices the pool runs at most: the configured count, or the cap under a target. */
function targetOf(settings: McSettings): number {
  return settings.targetHalfWidth == null ? settings.replicates : settings.stopCap
}

interface PoolWorker {
  worker: Worker
  /** Replicates settled by the chunks this worker finished. */
  settled: number
  /** Replicates the worker reports done inside the chunk it holds. */
  progress: number
  /** True while a chunk is in flight. */
  busy: boolean
}

interface Run {
  id: string
  scenario: Scenario
  settings: McSettings
  onMessage: (m: McWorkerMessage) => void
  onPool: (p: PoolProgress) => void
  workers: PoolWorker[]
  /** Indices the run may hand out: `replicates`, or `stopCap` under a target. */
  target: number
  chunk: number
  /** Next index to hand out. */
  cursor: number
  parts: McPartial[]
  t0: number
  /** The rule the run will report once the chunks in flight land; null while it runs. */
  ending: StopRule | null
  grace: ReturnType<typeof setTimeout> | null
  /** True once the run posted its terminal message or was released. */
  over: boolean
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Read one raw message of this run; anything else is dropped. */
function decode(runId: string, data: unknown): PoolMessage | null {
  if (data === null || typeof data !== 'object') return null
  const m = data as { type?: unknown; runId?: unknown }
  if (m.runId !== runId) return null
  if (m.type === 'range-progress' || m.type === 'range-done' || m.type === 'range-error') {
    return data as PoolMessage
  }
  return null
}

export function createWorkerPool(options: PoolOptions = {}): WorkerPool {
  const spawn =
    options.spawn ??
    (() => new Worker(new URL('./mc.worker.ts', import.meta.url), { type: 'module' }))
  let current: Run | null = null

  /** Detach and terminate every worker of `run`, and give up ownership. */
  const release = (run: Run): void => {
    run.over = true
    if (run.grace != null) clearTimeout(run.grace)
    run.grace = null
    for (const w of run.workers) {
      w.worker.onmessage = null
      w.worker.onerror = null
      w.worker.onmessageerror = null
      w.worker.terminate()
    }
    if (current === run) current = null
  }

  /** One terminal error for the whole run; every worker is terminated. */
  const fail = (run: Run, message: string): void => {
    if (run.over) return
    release(run)
    run.onMessage({ type: 'error', runId: run.id, message })
  }

  const idle = (run: Run): boolean => run.workers.every((w) => !w.busy)

  /** Give `w` the next chunk. False when nothing is left to hand out. */
  const handOut = (run: Run, w: PoolWorker): boolean => {
    if (run.ending != null || run.cursor >= run.target) return false
    const start = run.cursor
    const end = Math.min(start + run.chunk, run.target)
    run.cursor = end
    w.busy = true
    w.progress = 0
    const request: McRangeRequest = {
      type: 'run-range',
      runId: run.id,
      scenario: run.scenario,
      start,
      end,
    }
    try {
      w.worker.postMessage(request)
    } catch (error) {
      fail(run, messageOf(error))
      return false
    }
    return true
  }

  /**
   * Stop handing out work and ask every busy worker to end at its next
   * checkpoint. A worker still silent after CANCEL_GRACE_MS is terminated and
   * the run reports CANCEL_TIMEOUT_MESSAGE, exactly as the slot does.
   */
  const beginEnding = (run: Run, rule: StopRule): void => {
    run.ending = rule
    for (const w of run.workers) {
      if (w.busy) w.worker.postMessage({ type: 'cancel', runId: run.id })
    }
    run.grace = setTimeout(() => {
      if (current !== run || run.over) return
      fail(run, CANCEL_TIMEOUT_MESSAGE)
    }, CANCEL_GRACE_MS)
  }

  /** Finish on the contiguous prefix of what landed, or fail when nothing did. */
  const finish = (run: Run, rule: StopRule): void => {
    if (run.over) return
    const prefix = run.parts.length > 0 ? contiguousPrefix(mergePartials(run.parts)) : null
    if (prefix == null || prefix.indices.length === 0) {
      fail(run, 'The run stopped before any replicate finished')
      return
    }
    const summary = finishSummary(
      run.scenario,
      prefix,
      { rule, at: prefix.indices.length },
      Math.round(performance.now() - run.t0),
    )
    // Release first: a terminal callback may synchronously start the next run.
    release(run)
    run.onMessage({ type: 'done', runId: run.id, summary })
  }

  /** Report the replicates merged so far to both callbacks. */
  const report = (run: Run, done: number): void => {
    const { replicates, targetHalfWidth } = run.settings
    run.onMessage({ type: 'progress', runId: run.id, done, total: run.target })
    run.onPool({
      workers: run.workers.length,
      done,
      total: targetHalfWidth == null ? replicates : null,
      stopRule: targetHalfWidth == null ? 'replicates' : 'halfWidth',
      elapsedMs: Math.round(performance.now() - run.t0),
      perWorkerDone: run.workers.map((w) => w.settled + w.progress),
    })
  }

  /** One chunk landed: merge, report, then either hand out more or end the run. */
  const settle = (run: Run, w: PoolWorker, partial: McPartial): void => {
    w.busy = false
    w.settled += partial.indices.length
    w.progress = 0
    run.parts.push(partial)
    const merged = mergePartials(run.parts)
    report(run, merged.indices.length)
    // A callback may have cancelled or disposed the run.
    if (current !== run || run.over) return
    if (run.ending == null) {
      if (
        run.settings.targetHalfWidth != null &&
        halfWidthReached(run.scenario, contiguousPrefix(merged))
      ) {
        beginEnding(run, 'halfWidth')
      } else {
        handOut(run, w)
        if (run.over) return
      }
    }
    if (!idle(run)) return
    if (run.ending != null) finish(run, run.ending)
    else if (run.cursor >= run.target) finish(run, 'replicates')
  }

  /** Wire one worker to this run; a message of a replaced run is dropped. */
  const attach = (run: Run, w: PoolWorker): void => {
    const deliver = (m: PoolMessage): void => {
      if (current !== run || run.over) return
      if (m.type === 'range-progress') w.progress = m.done
      else if (m.type === 'range-error') fail(run, m.message)
      else settle(run, w, m.partial)
    }
    w.worker.onmessage = (e: MessageEvent<unknown>) => {
      if (current !== run || run.over) return
      const m = decode(run.id, e.data)
      if (m != null) deliver(m)
    }
    w.worker.onerror = (e: ErrorEvent) => {
      if (current !== run || run.over) return
      fail(run, e.message || 'Worker failed')
    }
    w.worker.onmessageerror = () => {
      if (current !== run || run.over) return
      fail(run, 'Worker response could not be decoded')
    }
  }

  const dispose = (): void => {
    if (current != null) release(current)
  }

  const start = (
    scenario: Scenario,
    runId: string,
    onMessage: (m: McWorkerMessage) => void,
    onPool: (p: PoolProgress) => void,
  ): boolean => {
    dispose()
    if (typeof Worker === 'undefined') return false
    const settings = runSettings(scenario)
    const target = targetOf(settings)
    // Never more workers than indices to hand out; the rest would sit idle.
    const size = Math.max(1, Math.min(options.size ?? poolSize(), target))
    const run: Run = {
      id: runId,
      scenario,
      settings,
      onMessage,
      onPool,
      workers: [],
      target,
      chunk: chunkSize(settings, size),
      cursor: 0,
      parts: [],
      t0: performance.now(),
      ending: null,
      grace: null,
      over: false,
    }
    current = run
    for (let i = 0; i < size; i += 1) {
      let worker: Worker
      try {
        worker = spawn()
      } catch (error) {
        fail(run, messageOf(error))
        return true
      }
      const w: PoolWorker = { worker, settled: 0, progress: 0, busy: false }
      run.workers.push(w)
      attach(run, w)
    }
    for (const w of run.workers) {
      if (run.over || !handOut(run, w)) break
    }
    return true
  }

  const cancel = (runId?: string): boolean => {
    const run = current
    if (run == null || run.over || run.ending != null) return false
    if (runId != null && runId !== run.id) return false
    beginEnding(run, 'cancelled')
    if (idle(run)) finish(run, 'cancelled')
    return true
  }

  return { start, cancel, dispose }
}
