/**
 * teStore.ts is in the initial modulepreload graph (App.tsx, main.tsx and Toolbar.tsx
 * import useTeStore), so a value import here lands in the initial bundle and the
 * `npm run check:bundle` budget pays for it. The heavy calc and planning modules
 * belong to the lazy panels: the panel prepares, the store applies.
 */

// @ts-expect-error node types are not in the app tsconfig; vitest runs this file in node.
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { expect, it } from 'vitest'

const LAZY_ONLY = /\/(package|findingEvidence|matrixPlan)$/

it('keeps the delivery, finding-evidence and matrix-planning modules out of teStore', () => {
  const file = 'src/te/state/teStore.ts'
  const { outputText } = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext },
    fileName: file,
  })
  const imports = ts.preProcessFile(outputText).importedFiles.map((x) => x.fileName)
  expect(imports.length).toBeGreaterThan(0)
  for (const dep of imports) expect(dep, file).not.toMatch(LAZY_ONLY)
})
