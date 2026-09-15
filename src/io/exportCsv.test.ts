import { describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import type { Entity, Scenario } from '../model/types'
import { createRunManifest } from '../model/runRecord'
import type { RunRecord } from '../model/runRecord'
import type { BandSeries, McSummary, SensitivitySummary, Stat } from '../playback/mcRun'
import {
  csvField, csvFileName, csvText, perEffectorCsv, perThreatCsv, runCsvTable, runCsvTables, sensitivityCsv,
} from './exportCsv'

function stat(mean: number, lo: number, hi: number, n = 40, interval: Stat['interval'] = 't'): Stat {
  return { mean, lo, hi, n, total: 40, sd: 1, se: 0.1, conf: 0.95, interval,
    p10: NaN, p90: NaN, p025: NaN, p975: NaN, defined: { p: n / 40, lo: 0.8, hi: 1 } }
}
const undefinedStat = () => stat(NaN, NaN, NaN, 0, 'none')
const band = (): BandSeries =>
  ({ mean: [0, 1], lo: [0, 1], hi: [0, 1], p10: [0, 1], p90: [0, 1], p025: [0, 1], p975: [0, 1] })

function entity(id: string, name: string, kind: Entity['kind']): Entity {
  return { id, name, kind, specId: null, pos: { x: 0, y: 0 }, headingDeg: 0, color: null, notes: '' }
}

const scenario: Scenario = {
  ...emptyScenario(),
  name: 'Camp Able',
  entities: [entity('uas-1', 'Raid A', 'uas'), entity('uas-2', 'Raid B', 'uas'), entity('gun-1', 'Gun 1', 'effector')],
}

const mc: McSummary = {
  seed: 7, replicates: 40, durationS: 60,
  kills: band(), leakers: band(), detected: band(), tracked: band(), engaged: band(),
  firstDetectS: stat(12, 10, 14), firmTrackS: stat(14, 12, 16), minWarningS: stat(30, 28, 32),
  perThreat: {
    'uas-1': { killed: stat(2.5, 2, 3), leaked: stat(1, 0.5, 1.5), firstDetectS: stat(12, 10, 14, 38),
      arrivalS: 42, shipCount: 9, residual: band() },
    // Never detected in any replicate: the three time columns stay empty, not zero.
    'uas-2': { killed: stat(0, 0, 0), leaked: stat(3, 2, 4), firstDetectS: undefinedStat(),
      arrivalS: null, shipCount: 3, residual: band() },
  },
  perEffector: { 'gun-1': { salvos: stat(4, 3, 5), kills: stat(2, 1, 3) } },
  elapsedMs: 1, stopped: { rule: 'replicates', at: 40 },
}

// A label with a comma and a quote: it repeats on every row, so it exercises the quoting everywhere.
const label = 'Run "A", saved'
const savedAt = '2026-09-15T12:00:00.000Z'
const record: RunRecord = {
  id: 'run-1', savedAt, label, manifest: createRunManifest(scenario, 'sim-1', 'basis'),
  scenario, scenarioHash: 'basis', mc, sensitivity: null,
}

const lines = (text: string) => text.split('\r\n')

describe('csvField', () => {
  it('quotes only a field that needs it, and doubles an embedded quote', () => {
    expect(csvField('Raid A')).toBe('Raid A')
    expect(csvField('ships (count)')).toBe('ships (count)')
    expect(csvField('a,b')).toBe('"a,b"')
    expect(csvField('say "hi"')).toBe('"say ""hi"""')
    expect(csvField('two\nlines')).toBe('"two\nlines"')
    expect(csvField('carriage\rreturn')).toBe('"carriage\rreturn"')
  })

  it('ends every record with CRLF, the header included', () => {
    expect(csvText(['a', 'b'], [['1', '2']])).toBe('a,b\r\n1,2\r\n')
  })
})

describe('perThreatCsv', () => {
  it('names every column with its unit', () => {
    expect(lines(perThreatCsv(record))[0]).toBe(
      'run_label,saved_at (ISO 8601),seed,replicates,horizon (s),' +
      'threat_id,threat_name,ships (count),arrival (s from T0),' +
      'killed_mean (ships),killed_lo (ships),killed_hi (ships),killed_conf,killed_interval,' +
      'killed_defined_n (replicates),killed_total (replicates),' +
      'leaked_mean (ships),leaked_lo (ships),leaked_hi (ships),leaked_conf,leaked_interval,' +
      'leaked_defined_n (replicates),leaked_total (replicates),' +
      'first_detect_mean (s from T0),first_detect_lo (s from T0),first_detect_hi (s from T0),' +
      'first_detect_conf,first_detect_interval,' +
      'first_detect_defined_n (replicates),first_detect_total (replicates)',
    )
  })

  it('writes one row per threat, the record identity quoted on each', () => {
    const rows = lines(perThreatCsv(record))
    expect(rows).toHaveLength(4)
    expect(rows[3]).toBe('')
    // Raid A: 9 ships, arrival at 42 s, killed 2.5 [2, 3], leaked 1 [0.5, 1.5],
    // first detect 12 s [10, 14] defined in 38 of 40 replicates.
    expect(rows[1]).toBe(
      '"Run ""A"", saved",2026-09-15T12:00:00.000Z,7,40,60,uas-1,Raid A,9,42,' +
      '2.5,2,3,0.95,t,40,40,1,0.5,1.5,0.95,t,40,40,12,10,14,0.95,t,38,40',
    )
  })

  it('leaves an unavailable arrival and an undefined time mean empty, never zero', () => {
    // Raid B never arrives and is never detected: 4 empty fields, and 0 of 40 defined.
    expect(lines(perThreatCsv(record))[2]).toBe(
      '"Run ""A"", saved",2026-09-15T12:00:00.000Z,7,40,60,uas-2,Raid B,3,,' +
      '0,0,0,0.95,t,40,40,3,2,4,0.95,t,40,40,,,,0.95,none,0,40',
    )
  })
})

describe('perEffectorCsv', () => {
  it('writes the salvo and kill statistics with their units and intervals', () => {
    const rows = lines(perEffectorCsv(record))
    expect(rows[0]).toBe(
      'run_label,saved_at (ISO 8601),seed,replicates,horizon (s),effector_id,effector_name,' +
      'salvos_mean (salvos),salvos_lo (salvos),salvos_hi (salvos),salvos_conf,salvos_interval,' +
      'salvos_defined_n (replicates),salvos_total (replicates),' +
      'kills_mean (ships),kills_lo (ships),kills_hi (ships),kills_conf,kills_interval,' +
      'kills_defined_n (replicates),kills_total (replicates)',
    )
    // Gun 1: 4 salvos [3, 5], 2 kills [1, 3].
    expect(rows[1]).toBe(
      '"Run ""A"", saved",2026-09-15T12:00:00.000Z,7,40,60,gun-1,Gun 1,' +
      '4,3,5,0.95,t,40,40,2,1,3,0.95,t,40,40',
    )
  })
})

describe('sensitivityCsv', () => {
  const responseStat = (lo: number, hi: number) =>
    ({ lo, hi, swing: Math.abs(hi - lo), se: 0.2, defined: { lo: { p: 1, lo: 0.9, hi: 1 }, hi: { p: 0.5, lo: 0.3, hi: 0.7 } } })
  const summary: SensitivitySummary = {
    stat: 'leakers', nominal: 2, replicates: 40, seed: 7, elapsedMs: 3,
    rows: [
      { modelId: 'radar-1', field: 'pd', label: 'Radar', low: 1, high: 4, swing: 3, se: 0.2,
        responses: { leakers: responseStat(1, 4), kills: responseStat(5, 2), firstDetectS: responseStat(9, 11),
          minWarningS: responseStat(30, 24), salvos: responseStat(6, 8) } },
      // A row written before the per-response block: its leakers aliases alone.
      { modelId: 'gun-1', field: 'pk', label: 'Gun', low: 2, high: 3, swing: 1, se: 0.1 },
    ],
  }

  it('writes one row per field and response, each with its own unit', () => {
    const rows = lines(sensitivityCsv(summary, label, savedAt))
    expect(rows[0]).toBe(
      'run_label,saved_at (ISO 8601),seed,replicates,model_id,field,label,response,unit,' +
      'low,high,swing,swing_se,low_defined_p,high_defined_p,nominal_leakers (ships)',
    )
    // Five responses for the radar row, one alias row for the gun row.
    expect(rows).toHaveLength(8)
    expect(rows[1]).toBe(
      '"Run ""A"", saved",2026-09-15T12:00:00.000Z,7,40,radar-1,pd,Radar,leakers,ships,1,4,3,0.2,1,0.5,2',
    )
    expect(rows[3]).toBe(
      '"Run ""A"", saved",2026-09-15T12:00:00.000Z,7,40,radar-1,pd,Radar,firstDetectS,s from T0,9,11,2,0.2,1,0.5,2',
    )
    expect(rows[5]).toContain(',salvos,salvos,6,8,2,0.2,')
    // The alias row claims one response and no definedness it does not hold.
    expect(rows[6]).toBe(
      '"Run ""A"", saved",2026-09-15T12:00:00.000Z,7,40,gun-1,pk,Gun,leakers,ships,2,3,1,0.1,,,2',
    )
  })

  it('offers the sensitivity table only when the record ran one', () => {
    expect(runCsvTable(record, 'sensitivity')).toBeNull()
    expect(runCsvTables(record).map(table => table.name)).toEqual(['per-threat', 'per-effector'])
    const withRows = { ...record, sensitivity: summary }
    expect(runCsvTables(withRows).map(table => table.name)).toEqual(['per-threat', 'per-effector', 'sensitivity'])
    expect(csvFileName(withRows, 'sensitivity')).toBe('camp_able.run_a_saved.sensitivity.csv')
  })
})
