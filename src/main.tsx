import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { loadAutosave, startAutosave } from './io/persist'
import { startTeAutosave } from './te/io/persistTe'
import { useStore } from './state/store'
import { useTeStore } from './te/state/teStore'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-sans/700.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/600.css'
import './index.css'

const saved = loadAutosave()
if (saved) useStore.setState({ scenario: saved })
startAutosave()
startTeAutosave()

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
