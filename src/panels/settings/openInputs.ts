import { createContext } from 'react'

/** App's route to Prepare > Inputs, the one editor for Fire doctrine and Environment (D2). */
export const OpenInputsContext = createContext<(() => void) | null>(null)
