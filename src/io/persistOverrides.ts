import type { Override, OverrideSet } from '../model/libraryField'
import { useOverrides } from '../state/overrides'
import { useStore } from '../state/store'
import type { AutosaveAdapter } from './autosave'
import { createAutosave, pauseStatus } from './autosave'
import { invalid, objectAt } from './runtimeValidation'
import { OVERRIDES_KEY, OVERRIDES_RECOVERY_PREFIX } from './storageKeys'

function text(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim()) invalid(path, 'expected a nonempty string')
  return value as string
}

function override(value: unknown, path: string): Override {
  const o = objectAt(value, path)
  const date = text(o.date, `${path}.date`)
  if (!Number.isFinite(Date.parse(date))) invalid(`${path}.date`, 'expected an ISO date')
  // The value is whatever the library field holds. Only its presence is checked.
  if (!Object.hasOwn(o, 'value')) invalid(`${path}.value`, 'expected a value')
  return {
    modelId: text(o.modelId, `${path}.modelId`),
    field: text(o.field, `${path}.field`),
    value: o.value,
    reason: text(o.reason, `${path}.reason`),
    date,
  }
}

/** Parse a raw overrides save. Throws a path and reason on invalid JSON or shape. */
export function parseOverrideSet(raw: string): OverrideSet {
  const save = objectAt(JSON.parse(raw), 'overrideSet')
  if (!Array.isArray(save.overrides)) invalid('overrideSet.overrides', 'expected an array')
  return {
    overrides: save.overrides.map((entry, i) => override(entry, `overrideSet.overrides[${i}]`)),
  }
}

const OVERRIDES_ERROR = 'Overrides not saved'

/** A failed write is retried on the next Board change until storage accepts it. */
let overridesWriteFailed = false

/**
 * The overrides half of the autosave lifecycle in `io/autosave.ts`. It shares the
 * Board save status and clears only its own error.
 */
export const overridesAutosaveAdapter: AutosaveAdapter<OverrideSet> = {
  key: OVERRIDES_KEY,
  recoveryPrefix: OVERRIDES_RECOVERY_PREFIX,
  label: 'overrides',
  parse: parseOverrideSet,
  adopt: (saved) => useOverrides.getState().restoreOverrides(saved),
  deferred: true,
  subscribe: (changed) => {
    const onOverrides = useOverrides.subscribe((state, prev) => {
      if (state.overrides === prev.overrides) return
      changed({ overrides: state.overrides })
    })
    const onBoard = useStore.subscribe((state, prev) => {
      // Save-status updates are excluded: reporting the failure would otherwise
      // schedule the retry that reports it again.
      if (!overridesWriteFailed || state.save !== prev.save) return
      changed({ overrides: useOverrides.getState().overrides })
    })
    return () => {
      onOverrides()
      onBoard()
    }
  },
  reportSaved: () => {
    overridesWriteFailed = false
    const store = useStore.getState()
    if (store.save.error?.startsWith(OVERRIDES_ERROR))
      store.setSaveState(store.save.lastAutosaveAt, null)
  },
  reportPaused: (message) => {
    const store = useStore.getState()
    const next = pauseStatus(store.save.error, message)
    if (next === store.save.error) return
    store.setSaveState(store.save.lastAutosaveAt, next)
  },
  reportWriteFailure: (error) => {
    overridesWriteFailed = true
    const store = useStore.getState()
    const reason = error instanceof Error ? error.message || error.name : 'storage error'
    store.setSaveState(
      store.save.lastAutosaveAt,
      `${OVERRIDES_ERROR}: ${reason}. The overrides retry on the next save.`,
    )
  },
}

const overridesAutosave = createAutosave(overridesAutosaveAdapter)

/** Read the saved overrides back into their store at startup. Runs at most once. */
export function restoreOverrides(): void {
  overridesAutosave.restore()
}

/** Subscribe the overrides store to localStorage autosave. Call once at startup. */
export function startOverridesAutosave(): void {
  overridesAutosave.observe()
}
