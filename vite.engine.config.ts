import { defineConfig } from 'vite'

/**
 * The headless engine bundle: `src/engine/index.ts` as one ES module for
 * Node 22. No React plugin, no DOM. JSON fixtures inline as in the app
 * build. `npm run engine:build` writes `dist-engine/engine.js`, which
 * `scripts/run-engine.mjs` imports on the main thread and
 * `scripts/engine-worker.mjs` in every pool thread.
 */
export default defineConfig({
  build: {
    outDir: 'dist-engine',
    emptyOutDir: true,
    copyPublicDir: false,
    target: 'node22',
    ssr: true,
    minify: false,
    sourcemap: false,
    lib: {
      entry: { engine: 'src/engine/index.ts' },
      formats: ['es'],
    },
    rollupOptions: {
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
      },
    },
  },
  ssr: {
    // Bundle everything: the runner must not depend on node_modules at run time.
    noExternal: true,
  },
})
