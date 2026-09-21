import { create } from 'zustand'
import type { Override, OverrideSet } from '../model/libraryField'

export { activeOverrides, applyOverrides } from '../model/applyOverrides'

/**
 * User replacements of library field values, in their own store. An override is
 * never scenario content: it stays out of the Board store, out of history and out
 * of the scenario save, and persists under its own key (`io/persistOverrides.ts`).
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

  // The same array is kept when nothing is removed, so the autosave subscription
  // does not wake for a field that carries no override.
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
