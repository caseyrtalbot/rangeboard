// Headless runner check: the pooled CLI summary equals the in-process
// `runReplicates` summary from the same bundle on the same filled scenario.
// Run: npm run test:engine
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { before, test } from 'node:test'

const ROOT = resolve(import.meta.dirname, '..')
const FIXTURE = resolve(ROOT, 'src/playback/__fixtures__/detection-outside-rings.json')
const REPLICATES = 40
const SEED = 4821

let engine
before(() => {
  execFileSync('npm', ['run', 'engine:build'], { cwd: ROOT, stdio: 'pipe' })
  return import(pathToFileURL(resolve(ROOT, 'dist-engine/engine.js')).href).then((m) => {
    engine = m
  })
})

/** A calibrated Pk of 0.02 on the Coyote the fixture fires, in the persisted OverrideSet shape. */
const OVERRIDES = {
  overrides: [
    {
      modelId: 'lib-coyote',
      field: 'pk',
      value: 0.02,
      reason: 'calibrated',
      date: '2026-09-15T00:00:00.000Z',
    },
  ],
}

function runCli(t, workers, overrides) {
  const dir = mkdtempSync(join(tmpdir(), 'rangeboard-engine-cli-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const out = join(dir, 'run.json')
  const flags = []
  if (overrides) {
    const file = join(dir, 'overrides.json')
    writeFileSync(file, JSON.stringify(overrides))
    flags.push('--overrides', file)
  }
  const result = spawnSync(
    process.execPath,
    [
      'scripts/run-engine.mjs',
      FIXTURE,
      '--replicates',
      String(REPLICATES),
      '--seed',
      String(SEED),
      '--workers',
      String(workers),
      '--out',
      out,
      ...flags,
    ],
    { cwd: ROOT, encoding: 'utf8' },
  )
  assert.equal(result.status, 0, result.stderr)
  assert.match(
    result.stdout,
    new RegExp(`replicates ${REPLICATES}  seed ${SEED}  workers ${workers}`),
  )
  return JSON.parse(readFileSync(out, 'utf8'))
}

/**
 * The in-process summary as the file carries it: NaN written as null, elapsedMs
 * dropped. With overrides, the run is on the applied scenario, as every browser
 * path runs it; the record's scenario stays the loaded one.
 */
function expected(overrides = []) {
  const scenario = {
    ...engine.parseScenarioJson(readFileSync(FIXTURE, 'utf8')),
    seed: SEED,
    replicates: REPLICATES,
    targetHalfWidth: null,
    runMode: 'monte-carlo',
  }
  const { elapsedMs: _e, ...mc } = engine.runReplicates(engine.applyOverrides(scenario, overrides))
  return { scenario, mc: JSON.parse(JSON.stringify(mc)) }
}

test('the pooled CLI record matches runReplicates in-process and carries a cli manifest', (t) => {
  const record = runCli(t, 3)
  const want = expected()
  const { elapsedMs, ...mc } = record.mc
  assert.ok(elapsedMs > 0)
  assert.deepEqual(mc, want.mc)
  assert.deepEqual(record.scenario, want.scenario)
  assert.equal(record.manifest.producer, 'cli')
  assert.equal(record.manifest.seed, SEED)
  assert.equal(record.manifest.replicates, REPLICATES)
  assert.equal(record.manifest.runId, record.id)
  assert.equal(record.scenarioHash, engine.analysisBasisSignature(want.scenario))
  assert.equal(record.manifest.basisSignature, record.scenarioHash)
  assert.equal(record.sensitivity, null)
  assert.deepEqual(record.mc.stopped, { rule: 'replicates', at: REPLICATES })
})

test('an override set is applied from the manifest and lowers the kills of the library run', (t) => {
  const record = runCli(t, 3, OVERRIDES)
  const want = expected(OVERRIDES.overrides)
  const { elapsedMs: _e, ...mc } = record.mc
  assert.deepEqual(mc, want.mc)
  assert.deepEqual(record.manifest.overrides, OVERRIDES.overrides)
  assert.deepEqual(record.scenario, want.scenario)
  assert.equal(record.scenario.library.find((m) => m.id === 'lib-coyote').effector.pk, 0.85)
  const last = (xs) => xs[xs.length - 1]
  const library = expected().mc
  assert.ok(last(library.kills.mean) > 0)
  assert.ok(
    last(mc.kills.mean) < last(library.kills.mean),
    `${last(mc.kills.mean)} < ${last(library.kills.mean)}`,
  )
})

test('one worker gives the same summary as three', (t) => {
  const { elapsedMs: _one, ...one } = runCli(t, 1).mc
  const { elapsedMs: _three, ...three } = runCli(t, 3).mc
  assert.deepEqual(one, three)
})
