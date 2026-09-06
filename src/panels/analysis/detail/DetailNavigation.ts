import { createContext } from 'react'

/** Canonical workspace navigation leaves the Board selection intact. */
export const DetailOverviewContext = createContext<(() => void) | null>(null)
