// Development-only generator: data/library/**.json -> src/model/seedLibrary.generated.ts.
// Run: node scripts/build-library.mjs          writes the generated module
//      node scripts/build-library.mjs --check  exits 1 when the module on disk is stale
//
// The JSON files are the source of truth for the library. Each file is a
// LibraryFile (src/model/libraryField.ts): `fields` holds every numeric spec key
// with its lineage, `attributes` holds every other spec key bare.
//
// hasRow mechanism: `provenanceOrder` lists, in order, the spec keys that carried
// a provenance row in the hand-written library. The build emits exactly those rows
// in that order and no others, so a model's `provenance` array is reproduced
// element for element. A listed key resolves to `fields[key]` when it is numeric
// and to `attributeProvenance[key]` when it is not; either entry carries the
// original row `basis`, which the grade cannot always give back because an
// inventory row may raise the grade above the basis mapping.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const ROOT = fileURLToPath(new URL('..', import.meta.url))
const OUT = 'src/model/seedLibrary.generated.ts'

/**
 * Unit of every numeric spec key, by name. One table for the whole package:
 * the build refuses a file whose field carries a different unit, so a unit is
 * never invented per file. SI where SI applies; 'fraction' for a probability,
 * 'count' for a count, 'uas-group' for the JP 3-30 group index.
 */
export const UNIT_BY_FIELD = {
  // sensor
  detectRangeM: 'm',
  classifyRangeM: 'm',
  instrumentedRangeM: 'm',
  urbanRangeM: 'm',
  resolutionM: 'm',
  refSpanM: 'm',
  mountHeightM: 'm',
  sectorDeg: 'deg',
  elevationDeg: 'deg',
  maxAltitudeFt: 'ft',
  refRcsM2: 'm2',
  refAcousticDb: 'dB',
  placardPd: 'fraction',
  pfa: 'fraction',
  updateRateS: 's',
  trackInitS: 's',
  trackInitM: 'count',
  trackInitN: 'count',
  trackDropMisses: 'count',
  // uas
  group: 'uas-group',
  rcsM2: 'm2',
  spanM: 'm',
  acousticDb: 'dB',
  swerling: 'swerling-case',
  cruiseSpeedMps: 'mps',
  maxSpeedMps: 'mps',
  enduranceMin: 'min',
  altBandFt: 'ft',
  controlLinkRangeM: 'm',
  operatingRadiusM: 'm',
  combatRadiusM: 'm',
  standoffRangeM: 'm',
  effectRadiusM: 'm',
  warheadKg: 'kg',
  jamResistDb: 'dB',
  // effector
  minRangeM: 'm',
  maxRangeM: 'm',
  engageTimeS: 's',
  pk: 'fraction',
  magazineSize: 'count',
  salvoCooldownS: 's',
  flyoutSpeedMps: 'mps',
  eirpW: 'W',
  ratedEirpW: 'W',
  bdaS: 's',
  commitPk: 'fraction',
  targetS: 's',
}

/**
 * Which range a distance is, by spec and field name. A detection, instrumented,
 * classification, track and effective engagement range are different quantities,
 * so every field listed here must state its type and the condition it holds under.
 * `urbanRangeM` is a detection range measured in an urban background.
 */
export const RANGE_TYPE_BY_FIELD = {
  sensor: {
    detectRangeM: 'detection',
    urbanRangeM: 'detection',
    instrumentedRangeM: 'instrumented',
    classifyRangeM: 'classification',
  },
  effector: {
    maxRangeM: 'effective-engagement',
    minRangeM: 'effective-engagement',
  },
  uas: {},
}

export const GRADES = ['VERIFIED', 'CORROBORATED', 'REPORTED', 'MANUFACTURER_CLAIM', 'INFERRED', 'UNKNOWN']
export const LAYERS = ['L1', 'L2', 'L3']
export const RANGE_TYPES = ['detection', 'instrumented', 'track', 'classification', 'effective-engagement']
export const ESTIMATORS = ['class-median', 'planning-factor', 'analyst']
export const BASES = ['datasheet', 'reference', 'pf']
export const KIND_DIRS = ['sensor', 'effector', 'c2', 'uas', 'asset', 'marker']
export const ALLOWED_UNITS = [...new Set(Object.values(UNIT_BY_FIELD))]

/** Every library file on disk, by id, with the path it came from. */
export function readLibraryFiles(root = ROOT) {
  const base = path.join(root, 'data/library')
  const files = new Map()
  for (const dir of KIND_DIRS) {
    const full = path.join(base, dir)
    if (!fs.existsSync(full)) continue
    for (const name of fs.readdirSync(full).sort()) {
      if (!name.endsWith('.json')) continue
      const file = path.join(full, name)
      const text = fs.readFileSync(file, 'utf8')
      const data = JSON.parse(text)
      files.set(data.id, { file, dir, name, text, data })
    }
  }
  const index = JSON.parse(fs.readFileSync(path.join(base, 'index.json'), 'utf8'))
  return { index, files }
}

/** The runtime SpecModel one library file compiles into. */
function toModel(entry) {
  const f = entry.data
  const model = { id: f.id, name: f.name, kind: f.kind, description: f.description, color: f.color, builtin: f.builtin }
  if (f.spec) {
    const spec = {}
    // Attributes first (type, role, mode) so the block reads like a placard.
    for (const [key, value] of Object.entries(f.attributes)) spec[key] = value
    for (const [key, field] of Object.entries(f.fields)) {
      const unit = UNIT_BY_FIELD[key]
      if (!unit) throw new Error(`${entry.file}: no unit table entry for '${key}'`)
      if (field.unit !== unit) throw new Error(`${entry.file}: '${key}' unit '${field.unit}' is not the table unit '${unit}'`)
      spec[key] = field.value
    }
    model[f.spec] = spec
  }
  const order = f.provenanceOrder ?? []
  if (order.length) {
    model.provenance = order.map((key) => {
      const field = f.fields?.[key]
      const attr = f.attributeProvenance?.[key]
      const src = field ?? attr
      if (!src) throw new Error(`${entry.file}: provenanceOrder names '${key}', which has no field or attribute lineage`)
      if (!src.basis) throw new Error(`${entry.file}: '${key}' is in provenanceOrder with no basis`)
      const row = {
        field: key,
        value: field ? field.condition : attr.value,
        source: src.source,
        url: src.url ?? null,
        date: src.date,
        basis: src.basis,
      }
      if ('spread' in src) row.spread = src.spread
      row.grade = src.grade
      row.layer = src.layer
      if (field) row.unit = field.unit
      if (src.rangeType) row.rangeType = src.rangeType
      // `condition` repeats `value` on a field row, so it is emitted only when it adds something.
      if (attr && attr.condition && attr.condition !== attr.value) row.condition = attr.condition
      if (src.estimator) row.estimator = src.estimator
      if (src.comparisonSet) row.comparisonSet = src.comparisonSet
      if (src.note) row.note = src.note
      return row
    })
  }
  if (f.threatProfile) model.threatProfile = f.threatProfile
  return model
}

/** Every model in `index.json` order. */
export function buildModels(root = ROOT) {
  const { index, files } = readLibraryFiles(root)
  return index.order.map((id) => {
    const entry = files.get(id)
    if (!entry) throw new Error(`data/library/index.json lists '${id}', which has no file`)
    return toModel(entry)
  })
}

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/

function quote(text) {
  return `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`
}

/** A TypeScript literal in house style: two spaces, single quotes, trailing commas. */
function literal(value, pad = '') {
  if (value === null) return 'null'
  if (typeof value === 'string') return quote(value)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  const inner = pad + '  '
  if (Array.isArray(value)) {
    if (!value.length) return '[]'
    if (value.every((v) => typeof v === 'number')) return `[${value.join(', ')}]`
    return `[\n${value.map((v) => inner + literal(v, inner)).join(',\n')},\n${pad}]`
  }
  const keys = Object.keys(value)
  if (!keys.length) return '{}'
  const body = keys
    .map((k) => `${inner}${IDENT.test(k) ? k : quote(k)}: ${literal(value[k], inner)}`)
    .join(',\n')
  return `{\n${body},\n${pad}}`
}

const HEADER = `// Generated by scripts/build-library.mjs from data/library/**.json.
// Do not hand-edit: edit the JSON files and run \`npm run library:build\`.
//
// Seed spec library, researched from open sources (government documents,
// manufacturer releases, DoD public statements, defense trade press).
//
// Values are planning figures, not authoritative performance data. Where the
// public record gives no figure the field is null or the description says the
// ring is a planning figure; a number is never invented to fill a blank.
// Per-field lineage lives in the JSON files and in docs/inventory/, which also
// records what is unknown and why.
//
// The detect / track / identify / defeat chain is from the DoD Counter-Small
// Unmanned Aircraft Systems Strategy (Jan 2021, p. 17), which reads detect,
// track, identify, and, if necessary, deter, deny or defeat. UAS Groups 1-5
// are from JP 3-30 (25 Jul 2019) Figure III-14.
import type { SpecModel } from './types'

export const SEED_LIBRARY: SpecModel[] = `

export function render(models) {
  return HEADER + literal(models) + '\n'
}

const countModels = (text) => (text.match(/^ {4}id: /gm) ?? []).length

function main() {
  const out = render(buildModels())
  const target = path.join(ROOT, OUT)
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : ''
    if (current !== out) {
      console.error(`${OUT} is stale; run \`npm run library:build\` and review the diff.`)
      process.exit(1)
    }
    console.log(`${OUT} is current (${countModels(out)} models).`)
  } else {
    fs.writeFileSync(target, out)
    console.log(`Wrote ${OUT} (${countModels(out)} models).`)
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) main()
