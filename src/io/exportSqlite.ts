/**
 * Run history as one SQLite file. A caller reads records through `listRuns` then
 * `getRun` and hands the array here; every table carries `run_id` referencing
 * `runs.id`. Units stay in the column names (`_s`, `_m`) exactly as the record
 * fields state them, and every statistic keeps its own interval (`lo`, `hi`,
 * `conf`, `interval`) and its own denominator (`n`, `total`, `defined_*`): a NaN
 * statistic writes NULL, never a substituted number.
 *
 * `sql.js` and its wasm URL are loaded only inside `exportRunsSqlite`, so the
 * emscripten glue stays out of the entry chunk.
 */
import type { RunRecord } from '../model/runRecord'
import type { SensitivitySummary, Stat } from '../playback/mcRun'
import type { SobolResult } from '../playback/mcTypes'

/** What a bound column may hold; a non-finite number becomes NULL. */
type SqlValue = number | string | null

/** The slice of the sql.js surface this module uses; the package ships no types. */
interface SqlStatement {
  run(values: SqlValue[]): void
  free(): void
}

interface SqlDatabase {
  run(sql: string): void
  prepare(sql: string): SqlStatement
  export(): Uint8Array
  close(): void
}

interface SqlJsStatic {
  Database: new () => SqlDatabase
}

type InitSqlJs = (config?: { locateFile?: (file: string) => string }) => Promise<SqlJsStatic>

export interface SqliteExportOptions {
  /**
   * Where the sql.js wasm lives. The browser resolves it through Vite by
   * default; a node caller (the test) passes the path under `node_modules`.
   */
  locateFile?: (file: string) => string
}

/**
 * One `Stat` flattened into typed columns. `interval` is the method text; the
 * rest are numbers, with the sample counts as INTEGER.
 */
function statColumns(prefix: string): string[] {
  return [
    `${prefix}_mean REAL`,
    `${prefix}_sd REAL`,
    `${prefix}_se REAL`,
    `${prefix}_lo REAL`,
    `${prefix}_hi REAL`,
    `${prefix}_conf REAL`,
    `${prefix}_interval TEXT`,
    `${prefix}_p10 REAL`,
    `${prefix}_p90 REAL`,
    `${prefix}_p025 REAL`,
    `${prefix}_p975 REAL`,
    `${prefix}_n INTEGER`,
    `${prefix}_total INTEGER`,
    `${prefix}_defined_p REAL`,
    `${prefix}_defined_lo REAL`,
    `${prefix}_defined_hi REAL`,
  ]
}

/** NaN and the infinities have no SQLite REAL; they write NULL, the absence the Stat means. */
function num(value: number | null | undefined): SqlValue {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** Column values in the order `statColumns` declares them. */
function statValues(stat: Stat): SqlValue[] {
  return [
    num(stat.mean),
    num(stat.sd),
    num(stat.se),
    num(stat.lo),
    num(stat.hi),
    num(stat.conf),
    stat.interval,
    num(stat.p10),
    num(stat.p90),
    num(stat.p025),
    num(stat.p975),
    num(stat.n),
    num(stat.total),
    num(stat.defined.p),
    num(stat.defined.lo),
    num(stat.defined.hi),
  ]
}

const TARGET_STATS = ['killed', 'leaked', 'first_detect_s']
const EFFECTOR_STATS = ['salvos', 'kills']

/** One table: its column declarations and the constraints that follow them. */
interface TableSchema {
  name: string
  columns: string[]
  constraints: string[]
}

const RUNS: TableSchema = {
  name: 'runs',
  columns: [
    'id TEXT PRIMARY KEY',
    'saved_at TEXT NOT NULL',
    'label TEXT NOT NULL',
    'scenario_name TEXT NOT NULL',
    'scenario_hash TEXT NOT NULL',
    'seed INTEGER NOT NULL',
    'replicates INTEGER NOT NULL',
    'uncertainty TEXT NOT NULL',
    'run_mode TEXT NOT NULL',
    'engine_revision TEXT NOT NULL',
    'draw_policy_version TEXT NOT NULL',
    'build_revision TEXT',
    'sweep_step_s REAL NOT NULL',
    'data_package_version INTEGER NOT NULL',
    'fidelity_floor TEXT NOT NULL',
    'producer TEXT NOT NULL',
    'overrides_json TEXT NOT NULL',
    'physics_switches_json TEXT NOT NULL',
  ],
  constraints: [],
}

const PER_TARGET: TableSchema = {
  name: 'per_target',
  columns: [
    'run_id TEXT NOT NULL REFERENCES runs(id)',
    'threat_id TEXT NOT NULL',
    // Geometry, identical in every replicate; NULL when the threat never arrives.
    'arrival_s REAL',
    'ship_count INTEGER NOT NULL',
    ...TARGET_STATS.flatMap(statColumns),
  ],
  constraints: ['PRIMARY KEY (run_id, threat_id)'],
}

const PER_EFFECTOR: TableSchema = {
  name: 'per_effector',
  columns: [
    'run_id TEXT NOT NULL REFERENCES runs(id)',
    'effector_id TEXT NOT NULL',
    ...EFFECTOR_STATS.flatMap(statColumns),
  ],
  constraints: ['PRIMARY KEY (run_id, effector_id)'],
}

// Long form: one row per tornado row per response, so the five responses share
// one set of columns and each keeps its own definedness on both sides.
const SENSITIVITY: TableSchema = {
  name: 'sensitivity',
  columns: [
    'run_id TEXT NOT NULL REFERENCES runs(id)',
    'model_id TEXT NOT NULL',
    'field TEXT NOT NULL',
    'label TEXT NOT NULL',
    'response TEXT NOT NULL',
    'lo REAL',
    'hi REAL',
    'swing REAL',
    'se REAL',
    'defined_lo_p REAL',
    'defined_lo_lo REAL',
    'defined_lo_hi REAL',
    'defined_hi_p REAL',
    'defined_hi_lo REAL',
    'defined_hi_hi REAL',
    // The sensitivity run's own basis, which is not the replicate run's.
    'nominal_leakers REAL',
    'sensitivity_replicates INTEGER NOT NULL',
    'sensitivity_seed INTEGER NOT NULL',
  ],
  constraints: ['PRIMARY KEY (run_id, model_id, field, response)'],
}

const SOBOL: TableSchema = {
  name: 'sobol',
  columns: [
    'run_id TEXT NOT NULL REFERENCES runs(id)',
    'model_id TEXT NOT NULL',
    'field TEXT NOT NULL',
    'response TEXT NOT NULL',
    'total_rank INTEGER NOT NULL',
    'first_order REAL',
    'first_order_lo REAL',
    'first_order_hi REAL',
    'total REAL',
    'total_lo REAL',
    'total_hi REAL',
    'bootstrap INTEGER NOT NULL',
    'confidence REAL NOT NULL',
    'base INTEGER NOT NULL',
    'evaluations INTEGER NOT NULL',
    'sobol_seed INTEGER NOT NULL',
  ],
  constraints: ['PRIMARY KEY (run_id, model_id, field)'],
}

function createTable(table: TableSchema): string {
  const lines = [...table.columns, ...table.constraints]
  return `CREATE TABLE ${table.name} (\n  ${lines.join(',\n  ')}\n);`
}

/** `INSERT INTO <table> VALUES (?, ?, ...)`, one placeholder per declared column. */
function insertSql(table: TableSchema): string {
  return `INSERT INTO ${table.name} VALUES (${new Array(table.columns.length).fill('?').join(', ')})`
}

const SCHEMA_SQL = [RUNS, PER_TARGET, PER_EFFECTOR, SENSITIVITY, SOBOL].map(createTable).join('\n')

/** A record may carry a Sobol result; no saved record does yet, so the `sobol` table is empty. */
type RunRecordWithSobol = RunRecord & { sobol?: SobolResult | null }

function insertRun(db: SqlDatabase, records: RunRecord[]): void {
  const stmt = db.prepare(insertSql(RUNS))
  try {
    for (const record of records) {
      const m = record.manifest
      stmt.run([
        record.id,
        record.savedAt,
        record.label,
        record.scenario.name,
        record.scenarioHash,
        num(m.seed),
        num(m.replicates),
        m.uncertainty,
        m.runMode,
        m.engineRevision,
        m.drawPolicyVersion,
        m.buildRevision,
        num(m.sweepStepS),
        num(m.dataPackageVersion),
        m.fidelityFloor,
        m.producer,
        JSON.stringify(m.overrides),
        JSON.stringify(m.physicsSwitches),
      ])
    }
  } finally {
    stmt.free()
  }
}

function insertPerTarget(db: SqlDatabase, records: RunRecord[]): void {
  const stmt = db.prepare(insertSql(PER_TARGET))
  try {
    for (const record of records) {
      for (const [threatId, row] of Object.entries(record.mc.perThreat)) {
        stmt.run([
          record.id,
          threatId,
          num(row.arrivalS),
          num(row.shipCount),
          ...statValues(row.killed),
          ...statValues(row.leaked),
          ...statValues(row.firstDetectS),
        ])
      }
    }
  } finally {
    stmt.free()
  }
}

function insertPerEffector(db: SqlDatabase, records: RunRecord[]): void {
  const stmt = db.prepare(insertSql(PER_EFFECTOR))
  try {
    for (const record of records) {
      for (const [effectorId, row] of Object.entries(record.mc.perEffector)) {
        stmt.run([record.id, effectorId, ...statValues(row.salvos), ...statValues(row.kills)])
      }
    }
  } finally {
    stmt.free()
  }
}

/**
 * One row per response. A row written before the loop recorded `responses` carries
 * the leakers headline only, and writes that one row with no definedness.
 */
function sensitivityRows(record: RunRecord, summary: SensitivitySummary): SqlValue[][] {
  const out: SqlValue[][] = []
  for (const row of summary.rows) {
    const basis = [num(summary.nominal), num(summary.replicates), num(summary.seed)]
    if (!row.responses) {
      out.push([
        record.id,
        row.modelId,
        row.field,
        row.label,
        'leakers',
        num(row.low),
        num(row.high),
        num(row.swing),
        num(row.se),
        null,
        null,
        null,
        null,
        null,
        null,
        ...basis,
      ])
      continue
    }
    for (const [response, stat] of Object.entries(row.responses)) {
      out.push([
        record.id,
        row.modelId,
        row.field,
        row.label,
        response,
        num(stat.lo),
        num(stat.hi),
        num(stat.swing),
        num(stat.se),
        num(stat.defined.lo.p),
        num(stat.defined.lo.lo),
        num(stat.defined.lo.hi),
        num(stat.defined.hi.p),
        num(stat.defined.hi.lo),
        num(stat.defined.hi.hi),
        ...basis,
      ])
    }
  }
  return out
}

function insertSensitivity(db: SqlDatabase, records: RunRecord[]): void {
  const stmt = db.prepare(insertSql(SENSITIVITY))
  try {
    for (const record of records) {
      if (!record.sensitivity) continue
      for (const values of sensitivityRows(record, record.sensitivity)) stmt.run(values)
    }
  } finally {
    stmt.free()
  }
}

function insertSobol(db: SqlDatabase, records: RunRecord[]): void {
  const stmt = db.prepare(insertSql(SOBOL))
  try {
    for (const record of records as RunRecordWithSobol[]) {
      const sobol = record.sobol
      if (!sobol) continue
      // `ranking` holds field indices by total index descending; the rank is the position.
      const rankOf = new Map(sobol.ranking.map((index, position) => [index, position]))
      sobol.fields.forEach((field, index) => {
        stmt.run([
          record.id,
          field.field.modelId,
          field.field.field,
          sobol.response,
          num(rankOf.get(index) ?? index),
          num(field.firstOrder.value),
          num(field.firstOrder.lo),
          num(field.firstOrder.hi),
          num(field.total.value),
          num(field.total.lo),
          num(field.total.hi),
          num(field.firstOrder.bootstrap),
          num(field.firstOrder.confidence),
          num(sobol.base),
          num(sobol.evaluations),
          num(sobol.seed),
        ])
      })
    }
  } finally {
    stmt.free()
  }
}

/** The wasm URL Vite emits, imported inside the lazy path so nothing static references sql.js. */
async function bundledWasm(): Promise<(file: string) => string> {
  const { default: url } = await import('sql.js/dist/sql-wasm.wasm?url')
  return () => url
}

/** Every record as one SQLite database file. */
export async function exportRunsSqlite(
  records: RunRecord[],
  options: SqliteExportOptions = {},
): Promise<Uint8Array> {
  const locateFile = options.locateFile ?? (await bundledWasm())
  // @ts-expect-error sql.js ships no declarations; `SqlJsStatic` above is the surface this uses.
  const module = await import('sql.js')
  const initSqlJs = (module.default ?? module) as InitSqlJs
  const SQL = await initSqlJs({ locateFile })
  const db = new SQL.Database()
  try {
    db.run('PRAGMA foreign_keys = ON;')
    db.run(SCHEMA_SQL)
    insertRun(db, records)
    insertPerTarget(db, records)
    insertPerEffector(db, records)
    insertSensitivity(db, records)
    insertSobol(db, records)
    return db.export()
  } finally {
    db.close()
  }
}

/** The filename rule `persist.ts` applies to an exported scenario. */
function safeName(name: string): string {
  return name.replace(/[^a-z0-9-_]+/gi, '_').toLowerCase() || 'scenario'
}

/** Save the export as `<scenario>.runs.sqlite`, in the style of `downloadJson`. */
export async function downloadRunsSqlite(
  records: RunRecord[],
  scenarioName: string,
): Promise<void> {
  const bytes = await exportRunsSqlite(records)
  const blob = new Blob([bytes as BlobPart], { type: 'application/vnd.sqlite3' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${safeName(scenarioName)}.runs.sqlite`
  a.click()
  URL.revokeObjectURL(url)
}
