import { create } from 'zustand'
import type { Override, OverrideSet } from '../model/libraryField'
import type { Scenario } from '../model/types'
import { specFields } from '../model/types'

/**
 * User replacements of library field values, in their own store. An override is
 * never scenario content: it stays out of the Board store, out of history and
 * out of the scenario save, so a shared scenario carries the sourced library and
 * this board's replacements travel under their own key
 * (`io/persistOverrides.ts`). A run records them through the trial manifest.
 */
export interface OverridesStore {
  overrides: Override[]
  /**
   * Record one override. A later override of the same model and field replaces
   * the earlier one in place, so a field never carries two. A blank reason
   * throws: the reason is the record of why a sourced value was replaced.
   */
  setOverride: (modelId: string, field: string, value: unknown, reason: string) => void
  resetField: (modelId: string, field: string) => void
  resetModel: (modelId: string) => void
  resetAll: () => void
  /** Adopt a restored save. The restore path only; it replaces every override. */
  restoreOverrides: (saved: OverrideSet) => void
}

export const useOverrides = create<OverridesStore>()((set) => ({
  overrides: [],

  setOverride: (modelId, field, value, reason) => {
    const text = reason.trim()
    if (!text) throw new Error('An override needs a reason')
    const entry: Override = { modelId, field, value, reason: text, date: new Date().toISOString() }
    set((state) => {
      const at = state.overrides.findIndex((o) => o.modelId === modelId && o.field === field)
      if (at < 0) return { overrides: [...state.overrides, entry] }
      const next = state.overrides.slice()
      next[at] = entry
      return { overrides: next }
    })
  },

  // Each reset keeps the same array when it removes nothing, so a reset of a
  // field that carries no override never wakes the autosave subscription.
  resetField: (modelId, field) =>
    set((state) => {
      const next = state.overrides.filter((o) => o.modelId !== modelId || o.field !== field)
      return next.length === state.overrides.length ? state : { overrides: next }
    }),

  resetModel: (modelId) =>
    set((state) => {
      const next = state.overrides.filter((o) => o.modelId !== modelId)
      return next.length === state.overrides.length ? state : { overrides: next }
    }),

  resetAll: () => set((state) => (state.overrides.length === 0 ? state : { overrides: [] })),

  restoreOverrides: (saved) => set({ overrides: saved.overrides }),
}))

/** Position of one field in a model's spec key order; an unknown field sorts last. */
function rank(order: string[], field: string): number {
  const at = order.indexOf(field)
  return at < 0 ? order.length : at
}

/**
 * The overrides a run must record: those on a model this scenario's library
 * carries, in library order, then in the model's spec field order (an unknown
 * field last, by name). `createTrialManifest` writes the result into the
 * manifest, so the order is the manifest's order and has to be stable.
 */
export function activeOverrides(overrides: Override[], scenario: Scenario): Override[] {
  const out: Override[] = []
  for (const model of scenario.library) {
    const mine = overrides.filter((o) => o.modelId === model.id)
    if (mine.length === 0) continue
    const order = Object.keys(specFields(model))
    mine.sort((a, b) => rank(order, a.field) - rank(order, b.field) || a.field.localeCompare(b.field))
    out.push(...mine)
  }
  return out
}
