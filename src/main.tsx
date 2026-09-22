import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { restoreAutosave, startAutosave } from './io/persist'
import { restoreOverrides, startOverridesAutosave } from './io/persistOverrides'
import { useStore } from './state/store'
import { OverrideSubscriberBoundary } from './ui/OverrideSubscriber'
import './index.css'

restoreAutosave()
restoreOverrides()

startAutosave()
startOverridesAutosave()

// Dev-only hook for scripted verification.
if (import.meta.env.DEV) {
  ;(window as unknown as { __store: typeof useStore }).__store = useStore
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OverrideSubscriberBoundary />
    <App />
  </StrictMode>,
)
