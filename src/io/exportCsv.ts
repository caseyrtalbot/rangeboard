/**
 * CSV export of the tables inside one saved `RunRecord`: per threat, per effector and
 * the sensitivity rows, one file each. RFC 4180 quoting, and one header row whose
 * every column names its unit. Each row repeats the record identity, so one file
 * stands alone. A statistic keeps its own interval, confidence, interval method and
 * defined count; an unavailable number is an empty field, never a zero.
 */
import type { RunRecord } from '../model/runRecord'
import type { SensitivityResponse, SensitivitySummary, Stat } from '../playback/mcRun'
import { SENSITIVITY_RESPONSES } from '../playback/mcRun'
import { safeName } from './persist'

/** RFC 4180: a field holding a comma, a quote, CR or LF is quoted, and its quotes doubled. */
export function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/** The header row then the data rows, CRLF terminated per RFC 4180. */
export function csvText(header: readonly string[], rows: ReadonlyArray<readonly string[]>): string {
  return [header, ...rows].map((row) => row.map(csvField).join(',')).join('\r\n') + '\r\n'
}

/** An unavailable statistic is an empty field: a CSV has no NaN and 0 is a different claim. */
function num(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? '' : String(value)
}

/** The seven columns one `Stat` occupies: the mean, its interval, and its definedness. */
function statHeader(name: string, unit: string): string[] {
  return [
    `${name}_mean (${unit})`,
    `${name}_lo (${unit})`,
    `${name}_hi (${unit})`,
    `${name}_conf`,
    `${name}_interval`,
    `${name}_defined_n (replicates)`,
    `${name}_total (replicates)`,
  ]
}

function statCells(stat: Stat): string[] {
  return [
    num(stat.mean),
    num(stat.lo),
    num(stat.hi),
    num(stat.conf),
    stat.interval,
    String(stat.n),
    String(stat.total),
  ]
}

/** Record identity, repeated on every row so the file carries its own basis. */
const RECORD_HEADER = ['run_label', 'saved_at (ISO 8601)', 'seed', 'replicates', 'horizon (s)']

function recordCells(record: RunRecord): string[] {
  return [
    record.label,
    record.savedAt,
    String(record.mc.seed),
    String(record.mc.replicates),
    num(record.mc.durationS),
  ]
}

const entityName = (record: RunRecord, id: string) =>
  record.scenario.entities.find((entity) => entity.id === id)?.name ?? id

/** One row per threat: its ships, its arrival geometry and its three statistics. */
export function perThreatCsv(record: RunRecord): string {
  const header = [
    ...RECORD_HEADER,
    'threat_id',
    'threat_name',
    'ships (count)',
    'arrival (s from T0)',
    ...statHeader('killed', 'ships'),
    ...statHeader('leaked', 'ships'),
    ...statHeader('first_detect', 's from T0'),
  ]
  const rows = Object.entries(record.mc.perThreat).map(([id, threat]) => [
    ...recordCells(record),
    id,
    entityName(record, id),
    String(threat.shipCount),
    num(threat.arrivalS),
    ...statCells(threat.killed),
    ...statCells(threat.leaked),
    ...statCells(threat.firstDetectS),
  ])
  return csvText(header, rows)
}

/** One row per effector: the salvos it fired and the kills credited to it. */
export function perEffectorCsv(record: RunRecord): string {
  const header = [
    ...RECORD_HEADER,
    'effector_id',
    'effector_name',
    ...statHeader('salvos', 'salvos'),
    ...statHeader('kills', 'ships'),
  ]
  const rows = Object.entries(record.mc.perEffector).map(([id, effector]) => [
    ...recordCells(record),
    id,
    entityName(record, id),
    ...statCells(effector.salvos),
    ...statCells(effector.kills),
  ])
  return csvText(header, rows)
}

/** The unit of each sensitivity response; the response column says which row is which. */
const RESPONSE_UNIT: Record<SensitivityResponse, string> = {
  leakers: 'ships',
  kills: 'ships',
  firstDetectS: 's from T0',
  minWarningS: 's',
  salvos: 'salvos',
}

/**
 * One row per uncertain field and response. A row recorded before the per-response
 * block carries its leakers aliases alone, and leaves the definedness columns empty.
 */
export function sensitivityCsv(
  summary: SensitivitySummary,
  label: string,
  savedAt: string,
): string {
  const header = [
    'run_label',
    'saved_at (ISO 8601)',
    'seed',
    'replicates',
    'model_id',
    'field',
    'label',
    'response',
    'unit',
    'low',
    'high',
    'swing',
    'swing_se',
    'low_defined_p',
    'high_defined_p',
    'nominal_leakers (ships)',
  ]
  const identity = [label, savedAt, String(summary.seed), String(summary.replicates)]
  const rows: string[][] = []
  for (const row of summary.rows) {
    const responses = row.responses
    if (!responses) {
      rows.push([
        ...identity,
        row.modelId,
        row.field,
        row.label,
        'leakers',
        RESPONSE_UNIT.leakers,
        num(row.low),
        num(row.high),
        num(row.swing),
        num(row.se),
        '',
        '',
        num(summary.nominal),
      ])
      continue
    }
    for (const response of SENSITIVITY_RESPONSES) {
      const stat = responses[response]
      rows.push([
        ...identity,
        row.modelId,
        row.field,
        row.label,
        response,
        RESPONSE_UNIT[response],
        num(stat.lo),
        num(stat.hi),
        num(stat.swing),
        num(stat.se),
        num(stat.defined.lo.p),
        num(stat.defined.hi.p),
        num(summary.nominal),
      ])
    }
  }
  return csvText(header, rows)
}

export type CsvTableName = 'per-threat' | 'per-effector' | 'sensitivity'

export interface CsvTable {
  name: CsvTableName
  text: string
}

/** One table of one record; null for a sensitivity table the record never ran. */
export function runCsvTable(record: RunRecord, name: CsvTableName): string | null {
  if (name === 'per-threat') return perThreatCsv(record)
  if (name === 'per-effector') return perEffectorCsv(record)
  return record.sensitivity
    ? sensitivityCsv(record.sensitivity, record.label, record.savedAt)
    : null
}

/** Every table the record can fill, in file order. */
export function runCsvTables(record: RunRecord): CsvTable[] {
  const names: CsvTableName[] = ['per-threat', 'per-effector', 'sensitivity']
  return names.flatMap((name) => {
    const text = runCsvTable(record, name)
    return text ? [{ name, text }] : []
  })
}

export function csvFileName(record: RunRecord, name: CsvTableName): string {
  return `${safeName(record.scenario.name)}.${safeName(record.label)}.${name}.csv`
}

function downloadCsv(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Download one table. False when the record holds no such table. */
export function exportRunCsv(record: RunRecord, name: CsvTableName): boolean {
  const text = runCsvTable(record, name)
  if (!text) return false
  downloadCsv(text, csvFileName(record, name))
  return true
}

/** Download every table the record can fill, one file each. */
export function exportRunCsvTables(record: RunRecord): number {
  const tables = runCsvTables(record)
  for (const table of tables) downloadCsv(table.text, csvFileName(record, table.name))
  return tables.length
}
