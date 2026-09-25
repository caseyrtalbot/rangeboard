import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { budgetFailures, measureBundle } from './check-bundle.mjs'

function fixture(t, entry = 'export const ready = true') {
  const root = mkdtempSync(join(tmpdir(), 'rangeboard-bundle-test-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(join(root, 'assets'))
  const put = (file, text) => writeFileSync(join(root, file), text)
  put(
    'index.html',
    `<script type="module" src="/assets/index.js"></script>
    <link rel="modulepreload" href="/assets/shared.js">
    <link rel="modulepreload" href="/assets/shared.js?duplicate">
    <link rel="stylesheet" href="/assets/index.css">
    <link rel="preload" as="font" href="/assets/font.woff2">`,
  )
  put('assets/index.js', entry)
  put('assets/shared.js', 'export const shared = true')
  put('assets/index.css', 'body { color: white }')
  put('assets/font.woff2', randomBytes(200))
  put('assets/lazy.js', randomBytes(500_000))
  return { root, put }
}

test('counts entry, modulepreloads and CSS once; reports font and all-in totals, excludes lazy assets', (t) => {
  const { root } = fixture(t)
  const result = measureBundle(root)
  assert.equal(result.files.length, 4)
  const bytes = Object.fromEntries(result.files.map(({ file, gzipBytes }) => [file, gzipBytes]))
  assert.equal(
    result.entryBytes,
    execFileSync('gzip', ['-9', '-c'], { input: 'export const ready = true' }).length,
  )
  assert.equal(
    result.initialBytes,
    bytes['assets/index.js'] + bytes['assets/shared.js'] + bytes['assets/index.css'],
  )
  assert.equal(result.preloadBytes, bytes['assets/font.woff2'])
  assert.equal(result.allBytes, result.initialBytes + result.preloadBytes)
  assert.deepEqual(budgetFailures(result), [])
})

test('budget boundaries use exact decimal bytes and allow equality', () => {
  assert.deepEqual(budgetFailures({ entryBytes: 369_000, initialBytes: 400_000 }), [])
  assert.equal(budgetFailures({ entryBytes: 369_001, initialBytes: 400_000 }).length, 1)
  assert.match(
    budgetFailures({ entryBytes: 369_000, initialBytes: 400_001 })[0],
    /Initial JavaScript \+ CSS/,
  )
})

test('CLI passes a small bundle and fails an entry whose gzip size exceeds its budget', (t) => {
  const { root, put } = fixture(t)
  const run = () =>
    spawnSync(process.execPath, ['scripts/check-bundle.mjs', root], { encoding: 'utf8' })
  assert.equal(run().status, 0)
  put('assets/index.js', randomBytes(380_000))
  const result = run()
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Entry exceeds 369000/)
})

test('CLI fails when shared JS and CSS push the initial set over budget', (t) => {
  const { root, put } = fixture(t, randomBytes(240_000))
  put('assets/shared.js', randomBytes(100_000))
  put('assets/index.css', randomBytes(70_000))
  const result = spawnSync(process.execPath, ['scripts/check-bundle.mjs', root], {
    encoding: 'utf8',
  })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Initial JavaScript \+ CSS exceeds 400000/)
  assert.doesNotMatch(result.stderr, /Entry exceeds/)
})

test('missing entry, missing assets and external initial assets fail closed', (t) => {
  const { root, put } = fixture(t)
  put('index.html', '<link rel="stylesheet" href="/assets/index.css">')
  assert.throws(() => measureBundle(root), /Expected one built entry/)
  put('index.html', '<script src="/assets/missing.js"></script>')
  assert.throws(() => measureBundle(root), /ENOENT/)
  put('index.html', '<script src="https://example.com/index.js"></script>')
  assert.throws(() => measureBundle(root), /Cannot measure external/)
})
