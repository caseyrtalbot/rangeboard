/**
 * The browser worker pool for a replicate run. One pool holds at most one live
 * run: `start` replaces whatever runs, `cancel` asks every live worker to stop
 * and gives it CANCEL_GRACE_MS, `dispose` terminates now.
 *
 * Work is handed out by replicate index. A cursor over 0..target gives each
 * worker a contiguous chunk and refills it when the chunk lands. Replicate i is
 * a pure function of i, so the merged partial is the sequential loop's rows
 * whatever order the chunks land in.
 *
 * Chunk size, with `size` workers: `max(1, min(25, ceil(stopFloor / size)))`
 * under a half-width target, so every worker starts busy and the rule is
 * checked several times before the floor; otherwise
 * `min(ceil(replicates / size), 50)`.
 *
 * Stop rules. With `targetHalfWidth` null the pool runs exactly `replicates`
 * indices and reports 'replicates'. With a target it runs until
 * `halfWidthOnEnds` holds on the contiguous prefix of the landed indices,
 * checked after every landed chunk, or until `stopCap` indices are done. The
 * budget applies to the landed rows and the run's wall clock. Any stop cancels
 * the chunks in flight and waits for their partials. The summary is finished
 * on one worker: the page transfers each chunk's packed grids and does not
 * clone them. The worker merges, keeps the contiguous prefix, and calls
 * `finishSummary`, so a run is always the replicates 0..m-1 with no holes. A
 * worker still silent after CANCEL_GRACE_MS is terminated.
 */
import { sampleCount } from '../analysis/projection'
import type { McSettings, Scenario } from '../model/types'
import { runSettings } from '../model/types'
import type { ExecutionBudget, McPartial, McSummary, McWorkerMessage, StopRule } from './mcRun'
import { assertSummaryFits, DEFAULT_BUDGET, halfWidthOnEnds } from './mcRun'
import type { PoolProgress } from './mcTypes'
import { prefixLeakerEnds, prefixLength } from './mergeSummaries'
import { CANCEL_GRACE_MS } from './workerSlot'

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
 * reached, so the coordinator can merge what it completed.
 */
export type PoolMessage =
  | { type: 'range-progress'; runId: string; done: number; total: number }
  | { type: 'range-done'; runId: string; partial: McPartial }
  | { type: 'range-error'; runId: string; message: string }

/** One request to finish the landed chunks. The grids are transferred, not copied. */
export interface FinishSummaryRequest {
  type: 'finish-summary'
  runId: string
  scenario: Scenario
  parts: McPartial[]
  rule: StopRule
  elapsedMs: number
}

/** The finish worker's reply. `summary-error` is a throw or an empty prefix. */
export type FinishSummaryMessage =
  | { type: 'summary-done'; runId: string; summary: McSummary }
  | { type: 'summary-error'; runId: string; message: string }

const GRID_KEYS = ['kills', 'leakers', 'detected', 'tracked', 'engaged'] as const

/** ArrayBuffers of the packed grids. Each buffer is listed once. Empty grids are omitted. */
function gridBuffers(parts: McPartial[]): ArrayBuffer[] {
  const buffers: ArrayBuffer[] = []
  const seen = new Set<ArrayBuffer>()
  const add = (view: Float64Array): void => {
    const buffer = view.buffer
    if (!(buffer instanceof ArrayBuffer)) {
      throw new Error('A grid buffer could not be transferred')
    }
    if (view.byteLength === 0 || seen.has(buffer)) return
    seen.add(buffer)
    buffers.push(buffer)
  }
  for (const part of parts) {
    for (const key of GRID_KEYS) add(part[key])
    for (const grid of part.threatResidual) add(grid)
  }
  return buffers
}

/** Construction and sizing hooks; a test passes its own worker and pool size. */
export interface PoolOptions {
  /** Construct one worker. A synchronous throw becomes one terminal error. */
  spawn?: () => Worker
  /** Workers to build, before the replicate count caps it. Default `poolSize()`. */
  size?: number
  /** The budget on the merged rows and the wall clock. Default `DEFAULT_BUDGET`. */
  budget?: ExecutionBudget
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
   * the pool CANCEL_GRACE_MS to answer; a worker still silent then is
   * terminated. The run then finishes on the contiguous prefix with
   * `stopped.rule` 'cancelled'. Returns false with no live run, a cancel
   * already in flight, or a `runId` that is not the live one.
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
  const budget = options.budget ?? DEFAULT_BUDGET
  let current: Run | null = null
  /** The worker computing a summary. `dispose` and the next `start` terminate it. */
  let finishing: Worker | null = null

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
   * the run finishes on the chunks that landed.
   */
  const beginEnding = (run: Run, rule: StopRule): void => {
    run.ending = rule
    for (const w of run.workers) {
      if (w.busy) w.worker.postMessage({ type: 'cancel', runId: run.id })
    }
    run.grace = setTimeout(() => {
      if (current !== run || run.over) return
      finish(run, rule)
    }, CANCEL_GRACE_MS)
  }

  /**
   * Finish on the contiguous prefix of what landed, or fail when nothing did.
   * The range workers are released first. A separate worker receives the packed
   * grids by transfer and posts the summary; the page does not clone the rows
   * and does not run `finishSummary`.
   */
  const finish = (run: Run, rule: StopRule): void => {
    if (run.over) return
    if (prefixLength(run.parts) === 0) {
      fail(run, 'The run stopped before any replicate finished')
      return
    }
    const elapsedMs = Math.round(performance.now() - run.t0)
    const { id, scenario, parts, onMessage } = run
    // Release first: a terminal callback may synchronously start the next run.
    release(run)
    let worker: Worker
    try {
      worker = spawn()
    } catch (error) {
      onMessage({ type: 'error', runId: id, message: messageOf(error) })
      return
    }
    finishing = worker
    const deliver = (message: FinishSummaryMessage): void => {
      if (finishing !== worker) return
      finishing = null
      worker.onmessage = null
      worker.onerror = null
      worker.onmessageerror = null
      worker.terminate()
      if (message.type === 'summary-done')
        onMessage({ type: 'done', runId: id, summary: message.summary })
      else onMessage({ type: 'error', runId: id, message: message.message })
    }
    worker.onmessage = (e: MessageEvent<FinishSummaryMessage>) => {
      const message = e.data
      if (
        message != null &&
        (message.type === 'summary-done' || message.type === 'summary-error') &&
        message.runId === id
      ) {
        deliver(message)
      }
    }
    worker.onerror = () => {
      deliver({ type: 'summary-error', runId: id, message: 'Worker failed' })
    }
    worker.onmessageerror = () => {
      deliver({ type: 'summary-error', runId: id, message: 'Worker response could not be decoded' })
    }
    const request: FinishSummaryRequest = {
      type: 'finish-summary',
      runId: id,
      scenario,
      parts,
      rule,
      elapsedMs,
    }
    try {
      worker.postMessage(request, gridBuffers(parts))
    } catch (error) {
      if (finishing === worker) {
        finishing = null
        worker.onmessage = null
        worker.onerror = null
        worker.onmessageerror = null
        worker.terminate()
      }
      onMessage({ type: 'error', runId: id, message: messageOf(error) })
    }
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

  /** One chunk landed: count it, report, then either hand out more or end the run. */
  const settle = (run: Run, w: PoolWorker, partial: McPartial): void => {
    w.busy = false
    w.settled += partial.indices.length
    w.progress = 0
    run.parts.push(partial)
    let landed = 0
    let retained = 0
    for (const part of run.parts) {
      landed += part.indices.length
      retained += part.retained
    }
    report(run, landed)
    // A callback may have cancelled or disposed the run.
    if (current !== run || run.over) return
    if (run.ending == null) {
      const ends = prefixLeakerEnds(run.parts, sampleCount(run.scenario))
      if (ends != null && halfWidthOnEnds(run.scenario, ends.ends, ends.ships)) {
        beginEnding(run, 'halfWidth')
      } else if (
        retained >= budget.retainedNumbers ||
        performance.now() - run.t0 >= budget.timeMs
      ) {
        beginEnding(run, 'budget')
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
    if (finishing != null) {
      const worker = finishing
      finishing = null
      worker.onmessage = null
      worker.onerror = null
      worker.onmessageerror = null
      worker.terminate()
    }
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
    try {
      assertSummaryFits(scenario, budget)
    } catch (error) {
      fail(run, messageOf(error))
      return true
    }
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
