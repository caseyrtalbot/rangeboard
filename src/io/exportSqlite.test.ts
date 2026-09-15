// @ts-expect-error node types are not in the app tsconfig; vitest runs this file in node.
import { execFileSync } from 'node:child_process'
// @ts-expect-error node types are not in the app tsconfig; vitest runs this file in node.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
// @ts-expect-error node types are not in the app tsconfig; vitest runs this file in node.
import { tmpdir } from 'node:os'
// @ts-expect-error node types are not in the app tsconfig; vitest runs this file in node.
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import probe from '../../docs/field-te/evidence/onboarding-2026-09-04/firing-scenario.json'
import { parseAutosave } from './persist'
import { createRunManifest } from '../model/runRecord'
import type { RunRecord } from '../model/runRecord'
import { runReplicates, runSensitivity } from '../playback/mcRun'
import { exportRunsSqlite } from './exportSqlite'

/** The wasm ships beside the sql.js dist entry; node has no Vite to resolve the `?url` import. */
const locateFile = () => resolve('node_modules/sql.js/dist/sql-wasm.wasm')

/** The firing probe, the fixture `runExport.test.ts` uses: it has threats and effectors. */
function scenarioAt(seed: number, replicates: number) {
  const scenario = parseAutosave(JSON.stringify(probe))!
  scenario.runMode = 'monte-carlo'
  scenario.replicates = replicates
  scenario.seed = seed
  return scenario
}

function record(id: string, seed: number, savedAt: string, withSensitivity: boolean): RunRecord {
  const scenario = scenarioAt(seed, 3)
  return {
    id, savedAt, label: `RUN-${id}`,
    manifest: createRunManifest(scenario, `sim-${id}`, `basis-${id}`),
    scenario, scenarioHash: `basis-${id}`,
    mc: runReplicates(scenario),
    sensitivity: withSensitivity ? runSensitivity(scenario) : null,
  }
}

const records = [
  record('run-a', 3, '2026-09-15T10:00:00.000Z', true),
  record('run-b', 7, '2026-09-15T11:00:00.000Z', false),
]

const dir = mkdtempSync(join(tmpdir(), 'rangeboard-sqlite-'))
const file = join(dir, 'history.sqlite')
afterAll(() => rmSync(dir, { recursive: true, force: true }))

/** Run one query through the sqlite3 CLI against the exported file. */
function sqlite(...args: string[]): string {
  return execFileSync('/usr/bin/sqlite3', [file, ...args], { encoding: 'utf8' }).trim()
}

describe('exportRunsSqlite', () => {
  it('writes a file the sqlite3 CLI opens, with every table keyed on run_id', async () => {
    const bytes = await exportRunsSqlite(records, { locateFile })
    expect(bytes).toBeInstanceOf(Uint8Array)
    // Every SQLite file starts with the 16-byte header string 'SQLite format 3\0'.
    expect(new TextDecoder().decode(bytes.subarray(0, 15))).toBe('SQLite format 3')
    writeFileSync(file, bytes)

    const schema = sqlite('.schema')
    for (const table of ['runs', 'per_target', 'per_effector', 'sensitivity', 'sobol']) {
      expect(schema).toContain(`CREATE TABLE ${table} (`)
    }
    // Units stay in the column names, and each statistic keeps its own interval and denominator.
    expect(schema).toContain('arrival_s REAL')
    expect(schema).toContain('sweep_step_s REAL NOT NULL')
    expect(schema).toContain('first_detect_s_lo REAL')
    expect(schema).toContain('first_detect_s_hi REAL')
    expect(schema).toContain('first_detect_s_interval TEXT')
    expect(schema).toContain('killed_defined_p REAL')
    // run_id is a declared foreign key on each of the four child tables.
    expect(schema.match(/run_id TEXT NOT NULL REFERENCES runs\(id\)/g)).toHaveLength(4)
  })

  it('returns per-target rows for both runs through one join', async () => {
    const joined = sqlite('-noheader',
      `SELECT r.id, t.threat_id, t.ship_count
       FROM per_target t JOIN runs r ON r.id = t.run_id
       WHERE r.id IN ('run-a', 'run-b')
       ORDER BY r.id, t.threat_id`)
    const rows = joined.split('\n').filter(Boolean)
    const threats = Object.keys(records[0].mc.perThreat)
    expect(threats.length).toBeGreaterThan(0)
    // Both runs ran the same scenario threats, so the join returns two rows per threat.
    expect(rows).toHaveLength(threats.length * 2)
    expect(rows.filter(row => row.startsWith('run-a|'))).toHaveLength(threats.length)
    expect(rows.filter(row => row.startsWith('run-b|'))).toHaveLength(threats.length)

    const seeds = sqlite('-noheader', 'SELECT id, seed, replicates FROM runs ORDER BY id')
    expect(seeds).toBe('run-a|3|3\nrun-b|7|3')
  })

  it('carries the effector and sensitivity rows, and leaves sobol empty', () => {
    const effectors = Object.keys(records[0].mc.perEffector)
    expect(effectors.length).toBeGreaterThan(0)
    expect(sqlite('-noheader', 'SELECT COUNT(*) FROM per_effector'))
      .toBe(String(effectors.length * 2))

    // Only run-a carries a sensitivity summary; each of its rows writes one row per response.
    const rows = records[0].sensitivity!.rows
    const expected = rows.reduce((sum, row) => sum + (row.responses ? Object.keys(row.responses).length : 1), 0)
    expect(expected).toBeGreaterThan(0)
    expect(sqlite('-noheader',
      `SELECT COUNT(*) FROM sensitivity s JOIN runs r ON r.id = s.run_id WHERE r.id = 'run-a'`))
      .toBe(String(expected))
    expect(sqlite('-noheader', `SELECT COUNT(*) FROM sensitivity WHERE run_id = 'run-b'`)).toBe('0')

    // No saved record carries Sobol indices today: the table exists and is empty by construction.
    expect(sqlite('-noheader', 'SELECT COUNT(*) FROM sobol')).toBe('0')
  })

  it('writes NULL for a quantile with too few replicates rather than a substituted number', () => {
    // Three replicates is under BAND95_MIN_N (40), so every p025 and p975 is NaN.
    // SQLite has no NaN: both columns write NULL on every per-target row of the two runs.
    const rows = Number(sqlite('-noheader', 'SELECT COUNT(*) FROM per_target'))
    expect(rows).toBe(2)
    expect(sqlite('-noheader',
      'SELECT COUNT(*) FROM per_target WHERE killed_p025 IS NULL AND killed_p975 IS NULL'))
      .toBe(String(rows))
    // The interval method is text beside the bounds, so a reader never guesses it.
    expect(sqlite('-noheader', 'SELECT DISTINCT killed_interval FROM per_target').split('\n'))
      .not.toContain('')
  })
})
