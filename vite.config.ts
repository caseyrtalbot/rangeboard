import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Just above the entry chunk (index-*.js, 818 kB raw after the T&E Ops removal folded
    // the chunks it had shared with the entry back into the entry; initial gzip fell from
    // 386 kB to 352 kB), the largest chunk the build emits. Raise it only with a measured reason.
    chunkSizeWarningLimit: 820,
  },
})
