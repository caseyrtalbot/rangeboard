// Development-only generator: data/library/**.json -> data/priors/<class>.json
// and src/analysis/classPriors.generated.ts.
// Run: node scripts/derive-priors.mjs          writes the priors and the module
//      node scripts/derive-priors.mjs --check  exits 1 when either is stale
//
// A class prior is the per-field statistic of the L1 (public, sourced) values
// over every library model in one class. L2 planning figures never feed a
// prior, so a prior cannot cite itself. A field needs three L1 members before
// it gets a prior; below that the runtime keeps the PF_SPREAD fallback.
//
// classOf(file) here and classOfModel(model) in src/analysis/classPriors.ts
// must give the same key for the same model; classPriors.test.ts proves it on
// every seed model. Change both together.

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { ROOT, UNIT_BY_FIELD, readLibraryFiles } from './build-library.mjs'

const PRIORS_DIR = 'data/priors'
const OUT = 'src/analysis/classPriors.generated.ts'
const MIN_MEMBERS = 3

/**
 * Units whose fields vary multiplicatively (ranges, areas, powers, speeds,
 * altitudes, masses): the lognormal family, summarized by the median of ln(v)
 * and the sample sd of 20*log10(v). Every other unit (seconds, minutes,
 * degrees, counts, fractions, dB, indices) is additive: mean and sample sd.
 */
export const MULTIPLICATIVE_UNITS = ['m', 'm2', 'W', 'mps', 'ft', 'kg']

export function isMultiplicative(field) {
  return MULTIPLICATIVE_UNITS.includes(UNIT_BY_FIELD[field])
}

/** The class key of one library file: kind/type/band/targetClass. */
export function classOf(file) {
  const a = file.attributes ?? {}
  if (file.spec === 'sensor') {
    const t = a.sensorType
    let band = 'any'
    if (t === 'eo-ir') band = a.eoBand ?? 'dual'
    else if (t === 'rf') band = Array.isArray(a.rfBands) && a.rfBands.length ? [...a.rfBands].sort().join('+') : 'any'
    // SensorSpec carries no target-group key (refRcsM2 and refSpanM are numbers), so 'any'.
    return `sensor/${t}/${band}/any`
  }
  if (file.spec === 'effector') {
    const bands = a.jamBands
    const band = Array.isArray(bands) && bands.length ? [...bands].sort().join('+') : 'any'
    return `effector/${a.effectorType}/${band}/any`
  }
  if (file.spec === 'uas') {
    return `uas/${a.airframe}/${file.fields?.group?.value ?? 'any'}/any`
  }
  return null
}

/** The class key as a file name: lowercase, '/' to '__'. */
export function classFileName(key) {
  return key.toLowerCase().replace(/\//g, '__')
}

function median(sorted) {
  const n = sorted.length
  return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2
}

function sampleSd(values) {
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  const ss = values.reduce((s, v) => s + (v - mean) * (v - mean), 0)
  return { mean, sd: Math.sqrt(ss / (values.length - 1)) }
}

/** The prior for one field from its L1 members, or null under MIN_MEMBERS. */
function fieldPrior(field, members) {
  const multiplicative = isMultiplicative(field)
  const usable = members.filter(({ value }) => typeof value === 'number' && Number.isFinite(value) && (!multiplicative || value > 0))
  if (usable.length < MIN_MEMBERS) return null
  const ids = usable.map((m) => m.id)
  const values = usable.map((m) => m.value)
  if (multiplicative) {
    const logMedian = median(values.map((v) => Math.log(v)).sort((x, y) => x - y))
    const { sd } = sampleSd(values.map((v) => 20 * Math.log10(v)))
    return { logMedian, sigmaDb: sd, n: ids.length, members: ids }
  }
  const { mean, sd } = sampleSd(values)
  return { mean, sd, n: ids.length, members: ids }
}

/** Every class with at least one field prior, keyed by class, in key order. */
export function derivePriors(root = ROOT) {
  const { index, files } = readLibraryFiles(root)
  const byClass = new Map()
  for (const id of index.order) {
    const file = files.get(id).data
    const key = classOf(file)
    if (!key) continue
    if (!byClass.has(key)) byClass.set(key, [])
    byClass.get(key).push(file)
  }
  const priors = {}
  for (const key of [...byClass.keys()].sort()) {
    const members = byClass.get(key)
    const fieldNames = [...new Set(members.flatMap((f) => Object.keys(f.fields ?? {})))]
    const fields = {}
    const union = new Set()
    for (const name of fieldNames) {
      const l1 = members
        .filter((f) => f.fields[name]?.layer === 'L1')
        .map((f) => ({ id: f.id, value: f.fields[name].value }))
      const prior = fieldPrior(name, l1)
      if (!prior) continue
      fields[name] = prior
      for (const id of prior.members) union.add(id)
    }
    if (!Object.keys(fields).length) continue
    const [kind, type, band, targetClass] = key.split('/')
    priors[key] = {
      class: key,
      kind,
      type,
      band,
      targetClass,
      dataPackageVersion: index.version,
      members: [...union],
      fields,
    }
  }
  return priors
}

const HEADER = `// Generated by scripts/derive-priors.mjs from data/library/**.json.
// Do not hand-edit: edit the JSON files and run \`npm run priors:build\`.
//
// Class priors from L1 entries only: per class and field, the median of
// ln(value) and the sample sd of 20*log10(value) for the multiplicative family,
// or the mean and sample sd for the additive family. A field with fewer than
// three L1 members has no prior and keeps the PF_SPREAD fallback.
import type { ClassPriorTable } from './classPriors'

export const CLASS_PRIORS: ClassPriorTable = `

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/
const quote = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

function literal(value, pad = '') {
  if (value === null) return 'null'
  if (typeof value === 'string') return quote(value)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  const inner = pad + '  '
  if (Array.isArray(value)) {
    if (!value.length) return '[]'
    return `[\n${value.map((v) => inner + literal(v, inner)).join(',\n')},\n${pad}]`
  }
  const keys = Object.keys(value)
  if (!keys.length) return '{}'
  const body = keys.map((k) => `${inner}${IDENT.test(k) ? k : quote(k)}: ${literal(value[k], inner)}`).join(',\n')
  return `{\n${body},\n${pad}}`
}

export function render(priors) {
  return HEADER + literal(priors) + '\n'
}

/** The files this run wants on disk: relative path -> text. */
function wantedFiles(priors) {
  const out = new Map()
  for (const prior of Object.values(priors)) {
    out.set(path.join(PRIORS_DIR, `${classFileName(prior.class)}.json`), JSON.stringify(prior, null, 2) + '\n')
  }
  out.set(OUT, render(priors))
  return out
}

function currentPriorFiles() {
  const dir = path.join(ROOT, PRIORS_DIR)
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).filter((n) => n.endsWith('.json')).map((n) => path.join(PRIORS_DIR, n))
}

function main() {
  const priors = derivePriors()
  const wanted = wantedFiles(priors)
  const classes = Object.keys(priors).length
  if (process.argv.includes('--check')) {
    const stale = []
    for (const [rel, text] of wanted) {
      const full = path.join(ROOT, rel)
      if (!fs.existsSync(full) || fs.readFileSync(full, 'utf8') !== text) stale.push(rel)
    }
    for (const rel of currentPriorFiles()) if (!wanted.has(rel)) stale.push(`${rel} (stale file)`)
    if (stale.length) {
      console.error(`Class priors are stale; run \`npm run priors:build\` and review the diff:\n  ${stale.join('\n  ')}`)
      process.exit(1)
    }
    console.log(`${PRIORS_DIR} and ${OUT} are current (${classes} classes).`)
    return
  }
  fs.mkdirSync(path.join(ROOT, PRIORS_DIR), { recursive: true })
  for (const rel of currentPriorFiles()) if (!wanted.has(rel)) fs.unlinkSync(path.join(ROOT, rel))
  for (const [rel, text] of wanted) fs.writeFileSync(path.join(ROOT, rel), text)
  console.log(`Wrote ${PRIORS_DIR} and ${OUT} (${classes} classes).`)
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) main()
