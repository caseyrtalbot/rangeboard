import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { duplicateGroups, oversizedJson, report, scanEvidence, summarize } from './check-evidence.mjs'

const EVIDENCE = 'docs/field-te/evidence'

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'rangeboard-evidence-test-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(join(root, EVIDENCE, 'run-a'), { recursive: true })
  mkdirSync(join(root, EVIDENCE, 'run-b'), { recursive: true })
  const put = (file, text) => writeFileSync(join(root, EVIDENCE, file), text)
  return { root, put, scan: () => scanEvidence(root, EVIDENCE) }
}

test('identical JSON groups, different JSON and identical text do not', t => {
  const { put, scan } = fixture(t)
  put('run-a/summary.json', '{"a":1}')
  put('run-b/summary.json', '{"a":1}')
  put('run-b/other.json', '{"a":2}')
  put('run-a/notes.txt', 'same')
  put('run-b/notes.txt', 'same')
  const files = scan().files
  assert.equal(files.length, 5)
  assert.ok(files.every(file => file.sha256.length === 64))
  const groups = duplicateGroups(files)
  assert.equal(groups.length, 1)
  assert.deepEqual(groups[0].paths, [
    `${EVIDENCE}/run-a/summary.json`,
    `${EVIDENCE}/run-b/summary.json`,
  ])
  assert.equal(groups[0].bytes, 7)
  assert.match(report(scan()), /run-b\/summary\.json/)
})

test('groups sort by bytes descending', t => {
  const { put, scan } = fixture(t)
  put('run-a/small.json', '{"a":1}')
  put('run-b/small.json', '{"a":1}')
  put('run-a/large.json', `{"a":"${'x'.repeat(200)}"}`)
  put('run-b/large.json', `{"a":"${'x'.repeat(200)}"}`)
  const groups = duplicateGroups(scan().files)
  assert.deepEqual(groups.map(group => group.bytes), [208, 7])
})

test('oversized JSON starts one byte above the limit', t => {
  const { put, scan } = fixture(t)
  put('run-a/at-limit.json', 'x'.repeat(1024))
  put('run-a/over-limit.json', 'x'.repeat(1025))
  put('run-a/huge.txt', 'x'.repeat(4096))
  const oversized = oversizedJson(scan().files, 1024)
  assert.deepEqual(oversized.map(file => file.path), [`${EVIDENCE}/run-a/over-limit.json`])
})

test('summary accounts for every byte and splits unique from duplicate JSON', t => {
  const { put, scan } = fixture(t)
  put('run-a/summary.json', '{"a":1}')
  put('run-b/summary.json', '{"a":1}')
  put('run-b/other.json', '{"a":22}')
  put('run-a/shot.png', 'png-bytes')
  put('run-a/bundle.json.gz', 'gz')
  const summary = summarize(scan())
  assert.equal(summary.totalBytes, 7 + 7 + 8 + 9 + 2)
  assert.equal(summary.byExt['.json'].count, 3)
  assert.equal(summary.jsonBytes, 22)
  assert.equal(summary.jsonDuplicateBytes, 7)
  assert.equal(summary.jsonUniqueBytes, summary.jsonBytes - summary.jsonDuplicateBytes)
  assert.equal(summary.gzJsonBytes, 2)
  assert.equal(summary.pngBytes, 9)
  assert.equal(oversizedJson(scan().files, 1).some(file => file.ext === '.json.gz'), false)
})
