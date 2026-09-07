import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Just above the entry chunk (index-*.js, 805 kB raw after the Wave 3 lazy boundaries),
    // the largest chunk the build emits. Raise it only with a measured reason.
    chunkSizeWarningLimit: 810,
  },
})
