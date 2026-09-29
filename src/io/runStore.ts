/**
 * Saved run history: finished `RunRecord`s in IndexedDB under `RUNS_DB_NAME`. A
 * record is written through JSON, so an undefined statistic is null on disk and
 * `getRun` restores NaN through `validateMcSummary`.
 */
import type { RunRecord } from '../model/runRecord'
import { validateMcSummary } from '../state/baseline'
import { RUNS_DB_NAME } from './storageKeys'

const DB_VERSION = 1
const STORE_NAME = 'runs'
const SAVED_AT = 'savedAt'

/** 64 MiB of record JSON. A save evicts the oldest records until the new one fits. */
const RUN_STORE_CAP_BYTES = 64 * 1024 * 1024

/** What the history list reads without loading a whole record. */
export interface RunSummary {
  id: string
  label: string
  /** ISO time of the save. */
  savedAt: string
  seed: number
  replicates: number
  scenarioName: string
  /** JSON length of the record, the quantity the cap measures. */
  bytes: number
}

/** A row on disk: the list fields at the top level, the record as JSON beside them. */
interface StoredRun extends RunSummary {
  record: unknown
}

/** The IndexedDB surface this module uses; `globalThis.indexedDB` satisfies it. */
export type IndexedDbFactory = Pick<IDBFactory, 'open'>

export interface RunStoreOptions {
  /** The IndexedDB factory; the browser's by default. */
  factory?: IndexedDbFactory
  /** The JSON-byte cap; `RUN_STORE_CAP_BYTES` by default. */
  capBytes?: number
}

const NO_INDEXED_DB = 'Run history is unavailable: this browser provides no IndexedDB.'

function factoryOf(options: RunStoreOptions): IndexedDbFactory | undefined {
  return options.factory ?? globalThis.indexedDB
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Run store request failed.'))
  })
}

function openDb(factory: IndexedDbFactory | undefined): Promise<IDBDatabase> {
  if (!factory) return Promise.reject(new Error(NO_INDEXED_DB))
  return new Promise((resolve, reject) => {
    const req = factory.open(RUNS_DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (db.objectStoreNames.contains(STORE_NAME)) return
      db.createObjectStore(STORE_NAME, { keyPath: 'id' }).createIndex(SAVED_AT, SAVED_AT)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error(NO_INDEXED_DB))
  })
}

/** One transaction per call. A write resolves only after `oncomplete`. */
async function withStore<T>(
  options: RunStoreOptions,
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
  const db = await openDb(factoryOf(options))
  try {
    const tx = db.transaction(STORE_NAME, mode)
    const done =
      mode === 'readonly'
        ? Promise.resolve()
        : new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => resolve()
            tx.onerror = () => reject(tx.error ?? new Error('Run store write failed.'))
            tx.onabort = () => reject(tx.error ?? new Error('Run store write was aborted.'))
          })
    const result = await work(tx.objectStore(STORE_NAME))
    await done
    return result
  } finally {
    db.close()
  }
}

/**
 * Write one record, evicting oldest first until it fits the cap. Re-saving an id
 * replaces that record. Returns the evicted ids.
 */
export async function saveRun(
  record: RunRecord,
  options: RunStoreOptions = {},
): Promise<{ evicted: string[] }> {
  const cap = options.capBytes ?? RUN_STORE_CAP_BYTES
  const json = JSON.stringify(record)
  const bytes = json.length
  if (bytes > cap) throw new Error(`This run is ${bytes} bytes; the run store holds ${cap}.`)
  const stored: StoredRun = {
    id: record.id,
    label: record.label,
    savedAt: record.savedAt,
    seed: record.manifest.seed,
    replicates: record.manifest.replicates,
    scenarioName: record.scenario.name,
    bytes,
    // JSON round trip: NaN statistics become null on disk.
    record: JSON.parse(json),
  }
  return withStore(options, 'readwrite', async (store) => {
    // The savedAt index reads oldest first, which is the eviction order.
    const existing = await request<StoredRun[]>(store.index(SAVED_AT).getAll())
    let used = existing.reduce((sum, run) => (run.id === stored.id ? sum : sum + run.bytes), 0)
    const evicted: string[] = []
    for (const run of existing) {
      if (used + bytes <= cap) break
      if (run.id === stored.id) continue
      store.delete(run.id)
      evicted.push(run.id)
      used -= run.bytes
    }
    store.put(stored)
    return { evicted }
  })
}

/** Every saved run, newest first. */
export async function listRuns(options: RunStoreOptions = {}): Promise<RunSummary[]> {
  const rows = await withStore(options, 'readonly', (store) =>
    request<StoredRun[]>(store.index(SAVED_AT).getAll()),
  )
  return rows
    .map((row) => ({
      id: row.id,
      label: row.label,
      savedAt: row.savedAt,
      seed: row.seed,
      replicates: row.replicates,
      scenarioName: row.scenarioName,
      bytes: row.bytes,
    }))
    .reverse()
}

/** One record, with its NaN statistics restored; null when the id is unknown. */
export async function getRun(id: string, options: RunStoreOptions = {}): Promise<RunRecord | null> {
  const row = await withStore(options, 'readonly', (store) =>
    request<StoredRun | undefined>(store.get(id)),
  )
  if (!row) return null
  const record = row.record as RunRecord
  return { ...record, mc: validateMcSummary(record.mc, 'run.mc') }
}

export async function deleteRun(id: string, options: RunStoreOptions = {}): Promise<void> {
  await withStore(options, 'readwrite', async (store) => {
    store.delete(id)
  })
}

export async function clearRuns(options: RunStoreOptions = {}): Promise<void> {
  await withStore(options, 'readwrite', async (store) => {
    store.clear()
  })
}
