import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { graphFailures, walkEntry } from './check-entry-graph.mjs'

const config = {
  entry: 'src/main.tsx',
  guarded: ['src/engine/', 'src/model/data.generated.ts'],
  packages: ['react'],
  modules: ['src/engine/helper.ts', 'src/engine/run.ts'],
}

function fixture(t, files = {}) {
  const root = mkdtempSync(join(tmpdir(), 'rangeboard-entry-graph-test-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const tree = {
    'src/main.tsx':
      "import React from 'react'\nimport { App } from './App'\nimport './index.css'\n",
    'src/App.tsx':
      "import type { Spec } from './engine/types'\nimport { type Result, run } from './engine/run'\nexport const App = () => run()\n",
    'src/engine/run.ts':
      "import { helper } from './helper.js'\nconst lazy = () => import('./sobol')\nexport const run = () => helper()\n",
    'src/engine/helper.ts': 'export const helper = () => 1\n',
    'src/engine/types.ts': 'export type Spec = number\n',
    'src/engine/sobol.ts': 'export const sobol = 1\n',
    'src/model/data.generated.ts': 'export const DATA = []\n',
    ...files,
  }
  for (const [file, text] of Object.entries(tree)) {
    mkdirSync(join(root, file, '..'), { recursive: true })
    writeFileSync(join(root, file), text)
  }
  return root
}

test('follows static value imports only; skips type-only, dynamic and css imports', (t) => {
  const result = walkEntry(fixture(t), 'src/main.tsx')
  assert.deepEqual(result.modules, [
    'src/App.tsx',
    'src/engine/helper.ts',
    'src/engine/run.ts',
    'src/main.tsx',
  ])
  assert.deepEqual(result.packages, ['react'])
  assert.deepEqual(graphFailures(result, config), [])
})

test('a guarded module or a package that newly reaches the entry fails', (t) => {
  const root = fixture(t, {
    'src/App.tsx':
      "import { DATA } from './model/data.generated'\nimport { create } from 'zustand'\nexport const App = () => create(DATA)\n",
  })
  const failures = graphFailures(walkEntry(root, 'src/main.tsx'), config)
  assert.deepEqual(failures, [
    'Package reaches the entry and is not frozen: zustand',
    'Guarded module reaches the entry and is not frozen: src/model/data.generated.ts',
    'Guarded module is frozen but no longer reaches the entry: src/engine/helper.ts',
    'Guarded module is frozen but no longer reaches the entry: src/engine/run.ts',
  ])
})

test('an unguarded shell module may enter the entry without a freeze', (t) => {
  const root = fixture(t, {
    'src/App.tsx':
      "import { run } from './engine/run'\nimport { Panel } from './panels/Panel'\nexport const App = () => Panel(run())\n",
    'src/panels/Panel.tsx': 'export const Panel = (x) => x\n',
  })
  assert.deepEqual(graphFailures(walkEntry(root, 'src/main.tsx'), config), [])
})
