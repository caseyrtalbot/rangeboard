/**
 * The smallest in-memory IndexedDB `src/io/runStore.ts` needs. Requests settle on a
 * microtask and a transaction completes on the next macrotask, so a request chained
 * from another request's success joins the same transaction, as the browser does.
 * A test helper only; the app always uses the real factory.
 */

type Row = Record<string, unknown>
type Handler = (() => void) | null

interface StoreData {
  keyPath: string
  rows: Map<IDBValidKey, Row>
  indexes: Set<string>
}

interface FakeRequest<T> {
  result: T
  error: DOMException | null
  onsuccess: Handler
  onerror: Handler
}

/** A transaction's request queue: it decides when the transaction may complete. */
interface Queue {
  run: <T>(work: () => T) => IDBRequest<T>
}

function keyOf(row: Row, keyPath: string): IDBValidKey {
  const key = row[keyPath]
  if (typeof key !== 'string' && typeof key !== 'number')
    throw new Error(`fake IndexedDB: ${keyPath} must be a string or a number`)
  return key
}

/** String and number index keys only; the run store indexes an ISO time. */
function compare(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0
}

function makeQueue(tx: {
  error: DOMException | null
  oncomplete: Handler
  onerror: Handler
  onabort: Handler
}): Queue {
  let pending = 0
  let settled = false
  let failed = false

  function check() {
    setTimeout(() => {
      if (settled || pending > 0) return
      settled = true
      if (failed) tx.onerror?.()
      else tx.oncomplete?.()
    }, 0)
  }

  check()
  return {
    run<T>(work: () => T): IDBRequest<T> {
      pending += 1
      const req: FakeRequest<T> = {
        result: undefined as T,
        error: null,
        onsuccess: null,
        onerror: null,
      }
      queueMicrotask(() => {
        try {
          req.result = work()
          pending -= 1
          req.onsuccess?.()
        } catch (error) {
          failed = true
          pending -= 1
          req.error = new DOMException(
            error instanceof Error ? error.message : 'fake IndexedDB failure',
          )
          tx.error = req.error
          req.onerror?.()
        }
        check()
      })
      return req as unknown as IDBRequest<T>
    },
  }
}

function makeStore(data: StoreData, queue: Queue): IDBObjectStore {
  const store = {
    keyPath: data.keyPath,
    createIndex(name: string) {
      data.indexes.add(name)
      return { getAll: () => queue.run(() => sorted(data, name)) }
    },
    index(name: string) {
      if (!data.indexes.has(name)) throw new Error(`fake IndexedDB: no index ${name}`)
      return { getAll: () => queue.run(() => sorted(data, name)) }
    },
    get: (key: IDBValidKey) => queue.run(() => data.rows.get(key)),
    getAll: () => queue.run(() => [...data.rows.values()]),
    put: (value: Row) =>
      queue.run(() => {
        const key = keyOf(value, data.keyPath)
        data.rows.set(key, value)
        return key
      }),
    delete: (key: IDBValidKey) =>
      queue.run(() => {
        data.rows.delete(key)
      }),
    clear: () =>
      queue.run(() => {
        data.rows.clear()
      }),
  }
  return store as unknown as IDBObjectStore
}

/** Index order: rows sorted by the indexed field, insertion order breaking ties. */
function sorted(data: StoreData, name: string): Row[] {
  return [...data.rows.values()].sort((a, b) => compare(a[name], b[name]))
}

function makeDb(stores: Map<string, StoreData>): IDBDatabase {
  const db = {
    objectStoreNames: { contains: (name: string) => stores.has(name) },
    createObjectStore(name: string, options: { keyPath: string }) {
      const data: StoreData = { keyPath: options.keyPath, rows: new Map(), indexes: new Set() }
      stores.set(name, data)
      // The upgrade transaction issues no request; its queue never has to complete.
      return makeStore(data, {
        run: () => {
          throw new Error('fake IndexedDB: no request during an upgrade')
        },
      })
    },
    transaction(name: string) {
      const data = stores.get(name)
      if (!data) throw new Error(`fake IndexedDB: no object store ${name}`)
      const tx = {
        error: null as DOMException | null,
        oncomplete: null as Handler,
        onerror: null as Handler,
        onabort: null as Handler,
        objectStore: (_name: string) => makeStore(data, queue),
      }
      const queue = makeQueue(tx)
      return tx
    },
    close: () => {},
  }
  return db as unknown as IDBDatabase
}

/**
 * A factory over its own databases. Two calls give two independent stores, so
 * one test's records never reach another.
 */
export function createFakeIndexedDb(): IDBFactory {
  const databases = new Map<string, Map<string, StoreData>>()
  return {
    open(name: string) {
      const fresh = !databases.has(name)
      const stores = databases.get(name) ?? new Map<string, StoreData>()
      if (fresh) databases.set(name, stores)
      const req = {
        result: makeDb(stores),
        error: null,
        onsuccess: null as Handler,
        onerror: null as Handler,
        onupgradeneeded: null as Handler,
      }
      queueMicrotask(() => {
        if (fresh) req.onupgradeneeded?.()
        req.onsuccess?.()
      })
      return req
    },
  } as unknown as IDBFactory
}
