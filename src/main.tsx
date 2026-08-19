import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { loadAutosave, startAutosave } from './io/persist'
import { useStore } from './state/store'
import './index.css'

const saved = loadAutosave()
if (saved) useStore.setState({ scenario: saved })
startAutosave()

// Dev-only hook for scripted verification.
if (import.meta.env.DEV) {
  ;(window as unknown as { __store: typeof useStore }).__store = useStore
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
