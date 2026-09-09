import { afterEach, expect, it, vi } from 'vitest'
import { ANALYSIS_KEY, UNITS_KEY, VIEW_KEY } from './storageKeys'
import { savedUnits, savedView, writeUnits } from './viewState'

afterEach(() => vi.unstubAllGlobals())

it('savedUnits reads metric only for the exact saved value and defaults to aviation', () => {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  })
  expect(savedUnits()).toBe('aviation')
  writeUnits('metric')
  expect(store.get(UNITS_KEY)).toBe('metric')
  expect(savedUnits()).toBe('metric')
  store.set(UNITS_KEY, 'imperial')
  expect(savedUnits()).toBe('aviation')
})

it('savedView keeps a known theme and drops anything else', () => {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  })
  store.set(VIEW_KEY, JSON.stringify({ theme: 'light' }))
  expect(savedView()).toEqual({ theme: 'light' })
  store.set(VIEW_KEY, JSON.stringify({ theme: 'daylight', basemap: 'sat' }))
  expect(savedView()).toEqual({ basemap: 'sat' })
})

it('savedView reads and drops the retired analysis lens field', () => {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  })
  // The shape earlier builds wrote: a lens layout plus user presets.
  const analysis = {
    layout: {
      presetId: 'sensors',
      widgets: [{ id: 'se-kpi', type: 'kpi-tiles', params: { tiles: ['detect'] }, collapsed: false }],
    },
    userPresets: [{ id: 'user-1', label: 'Wide look', builtin: false, widgets: [] }],
  }
  store.set(VIEW_KEY, JSON.stringify({ rightTab: 'analysis', analysis }))
  store.set(ANALYSIS_KEY, JSON.stringify(analysis))
  expect(savedView()).toEqual({ rightTab: 'analysis' })
  store.set(VIEW_KEY, JSON.stringify({ theme: 'dark', analysis: 'not a layout' }))
  expect(savedView()).toEqual({ theme: 'dark' })
})
