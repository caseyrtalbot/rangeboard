import { create } from 'zustand'
import type { Override, OverrideSet } from '../model/libraryField'

// The record and the rule live store-free in the model, where the engine CLI reads them.
export { activeOverrides, applyOverrides } from '../model/applyOverrides'

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
