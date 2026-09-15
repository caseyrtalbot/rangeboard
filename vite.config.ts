import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Just above the entry chunk (index-*.js, 1,237 kB raw and 360 kB gzip at the Phase 4
    // gate, 2026-09-15; 1,156 kB raw at the calibration Phase 0 gate), the largest chunk
    // the build emits. Raise it only with a measured reason.
    chunkSizeWarningLimit: 1250,
  },
})
