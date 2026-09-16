import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { LARGE_CAPTURE_BYTES, compareCapture, readCapture, writeCapture } from './evidence/capture.mjs'

function fixture(t) {
  const dir = join(mkdtempSync(join(tmpdir(), 'rangeboard-capture-test-')), 'evidence')
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const manifest = () => JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))
  return { dir, manifest }
}

const bulky = replicate => ({ replicate, samples: Array.from({ length: 4000 }, (_, i) => i % 97) })

test('a new capture writes its JSON file and one manifest entry', t => {
  const { dir, manifest } = fixture(t)
  const value = { assessments: [1, 2, 3], seed: 7 }
  const entry = writeCapture(dir, 'before', value)
  assert.deepEqual(entry, { tag: 'before', file: 'before.json', sha256: entry.sha256, bytes: 32 })
  assert.equal(readFileSync(join(dir, 'before.json'), 'utf8'), JSON.stringify(value))
  assert.deepEqual(manifest().captures, [entry])
  assert.equal(LARGE_CAPTURE_BYTES, 524288)
})

test('an identical repeat records sameAs instead of a second file', t => {
  const { dir, manifest } = fixture(t)
  const value = { assessments: [1, 2, 3], seed: 7 }
  writeCapture(dir, 'before', value)
  const after = writeCapture(dir, 'after', structuredClone(value))
  assert.deepEqual(after, { tag: 'after', sha256: after.sha256, bytes: 32, sameAs: 'before' })
  assert.ok(!existsSync(join(dir, 'after.json')))
  assert.equal(manifest().captures.length, 2)
  assert.deepEqual(readCapture(dir, 'after'), value)
})

test('a capture over the limit is gzipped and round-trips', t => {
  const { dir } = fixture(t)
  const value = bulky(1)
  const entry = writeCapture(dir, 'total-mc', value, { limitBytes: 1024 })
  assert.equal(entry.file, 'total-mc.json.gz')
  assert.ok(entry.bytes > 1024)
  assert.ok(entry.gzipBytes < entry.bytes, `${entry.gzipBytes} < ${entry.bytes}`)
  assert.deepEqual(readCapture(dir, 'total-mc'), value)
})

test('comparison hashes the new serialization, including through sameAs', t => {
  const { dir } = fixture(t)
  const value = bulky(2)
  writeCapture(dir, 'before', value, { limitBytes: 1024 })
  writeCapture(dir, 'after', structuredClone(value), { limitBytes: 1024 })
  const same = compareCapture(dir, 'before', structuredClone(value))
  assert.equal(same.match, true)
  assert.equal(same.expected, same.actual)
  const pointer = compareCapture(dir, 'after', structuredClone(value))
  assert.equal(pointer.match, true)
  const changed = compareCapture(dir, 'after', { ...value, replicate: 3 })
  assert.equal(changed.match, false)
  assert.notEqual(changed.expected, changed.actual)
  assert.throws(() => compareCapture(dir, 'missing', value), /No capture recorded for tag "missing"/)
})

test('re-capturing a tag replaces the entry and leaves no stale sibling', t => {
  const { dir, manifest } = fixture(t)
  writeCapture(dir, 'series', { points: [1] }, { limitBytes: 1024 })
  assert.ok(existsSync(join(dir, 'series.json')))
  const entry = writeCapture(dir, 'series', bulky(4), { limitBytes: 1024 })
  assert.equal(entry.file, 'series.json.gz')
  assert.ok(!existsSync(join(dir, 'series.json')))
  assert.deepEqual(manifest().captures, [entry])
  const back = writeCapture(dir, 'series', { points: [2] }, { limitBytes: 1024 })
  assert.equal(back.file, 'series.json')
  assert.ok(!existsSync(join(dir, 'series.json.gz')))
  assert.deepEqual(readCapture(dir, 'series'), { points: [2] })
})

test('unrelated manifest keys survive a capture', t => {
  const { dir, manifest } = fixture(t)
  writeCapture(dir, 'seed', { a: 1 })
  writeFileSync(join(dir, 'manifest.json'), `${JSON.stringify({
    captured: '2026-09-16',
    gates: { tests: { exitCode: 0 } },
    captures: manifest().captures,
  }, null, 2)}\n`)
  writeCapture(dir, 'next', { b: 2 })
  const after = manifest()
  assert.equal(after.captured, '2026-09-16')
  assert.deepEqual(after.gates, { tests: { exitCode: 0 } })
  assert.deepEqual(after.captures.map(item => item.tag), ['seed', 'next'])
  assert.equal(readFileSync(join(dir, 'manifest.json'), 'utf8').endsWith('}\n'), true)
})
