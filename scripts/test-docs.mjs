import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fingerprint, placementErrors, repositoryFiles } from './check-docs.mjs'

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'rangeboard-docs-test-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  for (const directory of ['src', 'docs']) mkdirSync(join(root, directory))
  const put = (file, text) => writeFileSync(join(root, file), text)
  put('AGENTS.md', '# Agents\n')
  put('docs/README.md', '# Index\n\n[Agents](../AGENTS.md)\n[Guide](guide.md)\n')
  put('docs/guide.md', '# Guide\n')
  put('src/a.ts', 'export const a = 1\n')
  execFileSync('git', ['init', '--quiet'], { cwd: root })
  return { root, put }
}

test('review detects changed source, edited prose, additions, deletions and moves', (t) => {
  const { root, put } = fixture(t)
  const entry = { document: 'docs/guide.md', inputs: ['src/'] }
  const hash = () => fingerprint(root, repositoryFiles(root), entry)
  const baseline = hash()
  put('src/a.ts', 'export const a = 2\n')
  assert.notEqual(hash(), baseline)
  put('src/a.ts', 'export const a = 1\n')
  assert.equal(hash(), baseline)
  put('docs/guide.md', '# Changed\n')
  assert.notEqual(hash(), baseline)
  put('docs/guide.md', '# Guide\n')
  put('src/b.ts', 'export const b = 1\n')
  const added = hash()
  assert.notEqual(added, baseline)
  rmSync(join(root, 'src/a.ts'))
  assert.notEqual(hash(), added)
  assert.notEqual(hash(), baseline)
  rmSync(join(root, 'src/b.ts'))
  assert.throws(hash, /Missing review input/)
})

test('untracked inputs count, ignored scratch files do not, ordering is stable', (t) => {
  const { root, put } = fixture(t)
  put('.gitignore', 'src/scratch.ts\n')
  put('src/scratch.ts', 'private scratch\n')
  const files = repositoryFiles(root)
  assert.ok(files.includes('src/a.ts'))
  assert.ok(!files.includes('src/scratch.ts'))
  assert.deepEqual(files, [...files].sort())
  const entry = { document: 'docs/guide.md', inputs: ['src/'] }
  const baseline = fingerprint(root, files, entry)
  execFileSync('git', ['add', 'src/a.ts'], { cwd: root })
  assert.equal(fingerprint(root, repositoryFiles(root), entry), baseline)
  rmSync(join(root, 'src/a.ts'))
  assert.ok(!repositoryFiles(root).includes('src/a.ts'))
})

test('orphan documents, missing index links and oversized agent guidance fail', (t) => {
  const { root, put } = fixture(t)
  const registry = {
    references: ['AGENTS.md', 'docs/README.md', 'docs/guide.md'].map((document) => ({ document })),
    historical: ['docs/records/'],
  }
  assert.deepEqual(placementErrors(root, repositoryFiles(root), registry), [])
  put('notes.md', '# Lost notes\n')
  assert.equal(placementErrors(root, repositoryFiles(root), registry).length, 2)
  rmSync(join(root, 'notes.md'))
  put('docs/README.md', '# Index\n\n[Agents](../AGENTS.md)\n')
  assert.match(
    placementErrors(root, repositoryFiles(root), registry)[0],
    /Missing direct index link/,
  )
  put('AGENTS.md', '# Agents\n'.repeat(81))
  assert.ok(
    placementErrors(root, repositoryFiles(root), registry).some((error) =>
      error.includes('80 lines'),
    ),
  )
})

test('historical placement does not grant an exemption from indexing', (t) => {
  const { root, put } = fixture(t)
  mkdirSync(join(root, 'docs/records'))
  put('docs/records/capture.md', '# Capture\n')
  const registry = {
    references: ['AGENTS.md', 'docs/README.md', 'docs/guide.md'].map((document) => ({ document })),
    historical: ['docs/records/'],
  }
  assert.deepEqual(placementErrors(root, repositoryFiles(root), registry), [
    'Missing direct index link: docs/records/capture.md',
  ])
})
