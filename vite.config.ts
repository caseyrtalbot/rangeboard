import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Just above the entry chunk (index-*.js, 1,156 kB raw and 340 kB gzip at the
    // calibration Phase 0 gate, 2026-09-10), the largest chunk the build emits. Raise it
    // only with a measured reason.
    chunkSizeWarningLimit: 1200,
  },
})
