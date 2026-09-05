// @ts-expect-error node types are not in the app tsconfig; vitest runs this file in node.
import { readFileSync } from 'node:fs'
// @ts-expect-error node types are not in the app tsconfig; vitest runs this file in node.
import { dirname, relative, resolve } from 'node:path'
import ts from 'typescript'
import { expect, it } from 'vitest'

/** Follow emitted value imports; type-only edges never execute in a worker. */
function valueGraph(entry: string): Map<string, string> {
  const modules = new Map<string, string>()
  function visit(file: string): void {
    if (modules.has(file)) return
    const source = readFileSync(file, 'utf8')
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext, removeComments: true },
      fileName: file,
    })
    modules.set(file, outputText)
    for (const dep of ts.preProcessFile(outputText).importedFiles) {
      // Any external runtime dependency must be reviewed before joining the engine graph.
      expect(dep.fileName.startsWith('.'), `${relative('.', file)} -> ${dep.fileName}`).toBe(true)
      const target = resolve(dirname(file), dep.fileName)
      visit(target.endsWith('.ts') ? target : `${target}.ts`)
    }
  }
  visit(resolve(entry))
  return modules
}

it('keeps the worker engine independent of stores, React, panels and browser persistence', () => {
  const modules = valueGraph('src/playback/mc.worker.ts')
  expect(modules.size).toBeGreaterThan(1)
  for (const [file, source] of modules) {
    expect(relative('.', file)).not.toMatch(/^src\/(state|io|panels|canvas)\//)
    expect(source, relative('.', file)).not.toMatch(/\b(localStorage|sessionStorage)\b/)
  }
})

it('keeps view-state persistence free of runtime store imports', () => {
  const modules = valueGraph('src/io/viewState.ts')
  expect([...modules.keys()].map(file => relative('.', file))).not.toContain('src/state/store.ts')
})
