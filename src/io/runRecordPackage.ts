/**
 * The saved-run package: one `RunRecord` in its own versioned envelope, its
 * parser and the file import that writes it to the run store. Kept out of
 * `persist.ts` so the run store and the record parser load with the analysis
 * panel, not with the entry chunk.
 */
import type { RunMode, UncertaintyMode } from '../model/types'
import type { FidelityTier, Override, PhysicsSwitch } from '../model/libraryField'
import type { RunManifest, RunRecord } from '../model/runRecord'
import type { SensitivityResponseStat, SensitivitySummary, Stat } from '../playback/mcRun'
import { SENSITIVITY_RESPONSES } from '../playback/mcRun'
import { validateMcSummary } from '../state/baseline'
import { downloadJson, fillScenario, pickJsonFile, safeName } from './persist'
import { saveRun } from './runStore'
import { invalid, objectAt } from './runtimeValidation'

/**
 * A saved-run package: one `RunRecord` in its own versioned envelope. It is a
 * different document from the debrief `RunExport` above, which carries a
 * deterministic picture and no run manifest.
 */
export interface RunRecordExport {
  rangeboardRunRecord: 1
  record: RunRecord
}

/** Pure builder for tests and alternate storage targets. */
export function runRecordExportObject(record: RunRecord): RunRecordExport {
  return { rangeboardRunRecord: 1, record }
}

export function exportRunRecordPackage(record: RunRecord): void {
  downloadJson(
    runRecordExportObject(record),
    `${safeName(record.scenario.name)}.${safeName(record.label)}.run.json`,
  )
}

const RUN_MODES: readonly RunMode[] = ['deterministic', 'monte-carlo']
const UNCERTAINTY_MODES: readonly UncertaintyMode[] = ['aleatory', 'total']
const FIDELITY_TIERS: readonly FidelityTier[] = ['analytic', 'datasheet', 'calibrated', 'fallback']
const PRODUCERS: readonly RunManifest['producer'][] = ['browser', 'cli']
const PHYSICS_SWITCHES: readonly PhysicsSwitch[] = [
  'truthTracks', 'noFalseTracks', 'noOperatorQueue', 'singlePulseRadar',
  'noFlightLimits', 'rfBandGate', 'eoirSpanRatio', 'legacyKineticPk', 'legacyBeamPk',
]

function text(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value) invalid(path, 'expected a nonempty string')
  return value
}

function number(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) invalid(path, 'expected a finite number')
  return value
}

/** JSON has no NaN: a statistic written as null is NaN again, as `validateMcSummary` restores it. */
function statistic(value: unknown, path: string): number {
  if (value === null) return NaN
  if (typeof value !== 'number' || !Number.isFinite(value)) invalid(path, 'expected a finite number or null')
  return value
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], path: string): T {
  if (!allowed.includes(value as T)) invalid(path, `expected one of ${allowed.join(', ')}`)
  return value as T
}

function arrayAt(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) invalid(path, 'expected an array')
  return value
}

/** An override keeps its reason and its date; its value is library-shaped and passes through. */
function parseOverride(value: unknown, path: string): Override {
  const o = objectAt(value, path)
  return {
    modelId: text(o.modelId, `${path}.modelId`),
    field: text(o.field, `${path}.field`),
    value: o.value,
    reason: text(o.reason, `${path}.reason`),
    date: text(o.date, `${path}.date`),
  }
}

function parseRunManifest(value: unknown, path: string): RunManifest {
  const m = objectAt(value, path)
  return {
    runId: text(m.runId, `${path}.runId`),
    basisSignature: text(m.basisSignature, `${path}.basisSignature`),
    seed: number(m.seed, `${path}.seed`),
    replicates: number(m.replicates, `${path}.replicates`),
    uncertainty: oneOf(m.uncertainty, UNCERTAINTY_MODES, `${path}.uncertainty`),
    runMode: oneOf(m.runMode, RUN_MODES, `${path}.runMode`),
    drawPolicyVersion: text(m.drawPolicyVersion, `${path}.drawPolicyVersion`),
    engineRevision: text(m.engineRevision, `${path}.engineRevision`),
    buildRevision: m.buildRevision == null ? null : text(m.buildRevision, `${path}.buildRevision`),
    sweepStepS: number(m.sweepStepS, `${path}.sweepStepS`),
    dataPackageVersion: number(m.dataPackageVersion, `${path}.dataPackageVersion`),
    overrides: arrayAt(m.overrides, `${path}.overrides`)
      .map((entry, i) => parseOverride(entry, `${path}.overrides[${i}]`)),
    physicsSwitches: arrayAt(m.physicsSwitches, `${path}.physicsSwitches`)
      .map((entry, i) => oneOf(entry, PHYSICS_SWITCHES, `${path}.physicsSwitches[${i}]`)),
    fidelityFloor: oneOf(m.fidelityFloor, FIDELITY_TIERS, `${path}.fidelityFloor`),
    producer: oneOf(m.producer, PRODUCERS, `${path}.producer`),
  }
}

function parseDefined(value: unknown, path: string): Stat['defined'] {
  const d = objectAt(value, path)
  return { p: statistic(d.p, `${path}.p`), lo: statistic(d.lo, `${path}.lo`), hi: statistic(d.hi, `${path}.hi`) }
}

function parseResponseStat(value: unknown, path: string): SensitivityResponseStat {
  const r = objectAt(value, path)
  const defined = objectAt(r.defined, `${path}.defined`)
  return {
    lo: statistic(r.lo, `${path}.lo`), hi: statistic(r.hi, `${path}.hi`),
    swing: statistic(r.swing, `${path}.swing`), se: statistic(r.se, `${path}.se`),
    defined: { lo: parseDefined(defined.lo, `${path}.defined.lo`), hi: parseDefined(defined.hi, `${path}.defined.hi`) },
  }
}

/**
 * The sensitivity companion, rebuilt field by field so a null written for NaN
 * comes back as NaN, exactly as `validateMcSummary` restores the ensemble.
 */
function parseSensitivity(value: unknown, path: string): SensitivitySummary | null {
  if (value == null) return null
  const s = objectAt(value, path)
  if (s.stat !== 'leakers') invalid(`${path}.stat`, "expected 'leakers'")
  const rows = arrayAt(s.rows, `${path}.rows`).map((entry, i) => {
    const p = `${path}.rows[${i}]`
    const r = objectAt(entry, p)
    const row: SensitivitySummary['rows'][number] = {
      modelId: text(r.modelId, `${p}.modelId`), field: text(r.field, `${p}.field`), label: text(r.label, `${p}.label`),
      low: statistic(r.low, `${p}.low`), high: statistic(r.high, `${p}.high`),
      swing: statistic(r.swing, `${p}.swing`), se: statistic(r.se, `${p}.se`),
    }
    if (r.responses !== undefined) {
      const responses = objectAt(r.responses, `${p}.responses`)
      row.responses = Object.fromEntries(SENSITIVITY_RESPONSES.map((response) =>
        [response, parseResponseStat(responses[response], `${p}.responses.${response}`)],
      )) as NonNullable<SensitivitySummary['rows'][number]['responses']>
    }
    return row
  })
  const summary: SensitivitySummary = {
    stat: 'leakers', rows,
    nominal: statistic(s.nominal, `${path}.nominal`),
    replicates: number(s.replicates, `${path}.replicates`),
    seed: number(s.seed, `${path}.seed`),
    elapsedMs: number(s.elapsedMs, `${path}.elapsedMs`),
  }
  if (s.stopped !== undefined) {
    const stopped = objectAt(s.stopped, `${path}.stopped`)
    summary.stopped = {
      rule: oneOf(stopped.rule, ['budget', 'cancelled'] as const, `${path}.stopped.rule`),
      at: number(stopped.at, `${path}.stopped.at`),
    }
  }
  return summary
}

/**
 * Parse a saved-run package or a raw `RunRecord`. The scenario passes the one
 * Board load boundary and the summary passes `validateMcSummary`, so an
 * imported record is exactly what a locally saved one is. A debrief export is
 * refused by name: it carries no run manifest, and a manifest is not something
 * an import may invent.
 */
export function parseRunRecordPackage(value: unknown): RunRecord {
  const outer = objectAt(value, 'runRecord')
  if (outer.rangeboardRun === 1) {
    invalid('runRecord', 'this is a debrief export, which carries no run manifest; export a run from the run history instead')
  }
  const raw = outer.rangeboardRunRecord === 1 ? objectAt(outer.record, 'runRecord.record') : outer
  return {
    id: text(raw.id, 'runRecord.id'),
    savedAt: text(raw.savedAt, 'runRecord.savedAt'),
    label: text(raw.label, 'runRecord.label'),
    manifest: parseRunManifest(raw.manifest, 'runRecord.manifest'),
    scenario: fillScenario(raw.scenario),
    scenarioHash: text(raw.scenarioHash, 'runRecord.scenarioHash'),
    mc: validateMcSummary(raw.mc, 'runRecord.mc'),
    sensitivity: parseSensitivity(raw.sensitivity ?? null, 'runRecord.sensitivity'),
  }
}

/** Open a file picker, parse a saved-run package and write it to the run store. */
export function importRunRecordFile(onSaved: (record: RunRecord, evicted: string[]) => void): void {
  pickJsonFile(async (data) => {
    const record = parseRunRecordPackage(data)
    const { evicted } = await saveRun(record)
    onSaved(record, evicted)
  })
}
