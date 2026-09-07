import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { loadAutosave, startAutosave } from './io/persist'
import { restoreTeAutosave, startTeAutosave } from './te/io/persistTe'
import { useStore } from './state/store'
import { useTeStore } from './te/state/teStore'
import './index.css'

const saved = loadAutosave()
if (saved) useStore.getState().loadScenario(saved)

startAutosave()
startTeAutosave()

// The T&E restore parses and validates a second saved record; keep it off the first-paint
// path. The Ops boundary in App.tsx runs it too, so whichever comes first wins.
if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(() => restoreTeAutosave())
else window.setTimeout(restoreTeAutosave, 0)

// Dev-only hook for scripted verification.
if (import.meta.env.DEV) {
  ;(window as unknown as { __store: typeof useStore }).__store = useStore
  ;(window as unknown as { __teStore: typeof useTeStore }).__teStore = useTeStore
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
