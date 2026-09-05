import { afterEach, expect, it, vi } from 'vitest'
import { UNITS_KEY } from './storageKeys'
import { savedUnits, writeUnits } from './viewState'

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
