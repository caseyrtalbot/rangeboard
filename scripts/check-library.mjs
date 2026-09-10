// Data health check for the JSON library package. Run: node scripts/check-library.mjs
//
// Every rule names the file and the field it failed on. The rules are the ones
// data/schema/library.schema.json states; they are enforced by hand here so the
// app ships no validator dependency. Exit 1 on the first report, 0 when clean.

import fs from 'node:fs'
import path from 'node:path'
import {
  ROOT, UNIT_BY_FIELD, RANGE_TYPE_BY_FIELD, GRADES, LAYERS, RANGE_TYPES,
  ESTIMATORS, BASES, ALLOWED_UNITS, KIND_DIRS, readLibraryFiles,
} from './build-library.mjs'

const problems = []
const fail = (where, message) => problems.push(`${where}: ${message}`)

/**
 * Keys declared twice inside one JSON object. JSON.parse keeps the last one
 * silently, so a model that names a field twice is invisible after parsing.
 */
function duplicateKeys(text) {
  const dupes = []
  const stack = []
  let lastString = null
  let pendingName = null
  let i = 0
  while (i < text.length) {
    const c = text[i]
    if (c === '"') {
      let j = i + 1
      while (j < text.length && text[j] !== '"') j += text[j] === '\\' ? 2 : 1
      lastString = text.slice(i + 1, j)
      i = j + 1
      continue
    }
    if (c === '{') { stack.push({ keys: new Set(), name: pendingName ?? '(root)' }); pendingName = null; lastString = null }
    else if (c === '[') { stack.push(null); pendingName = null; lastString = null }
    else if (c === '}' || c === ']') { stack.pop(); pendingName = null; lastString = null }
    else if (c === ':') {
      const top = stack[stack.length - 1]
      if (top && lastString !== null) {
        if (top.keys.has(lastString)) dupes.push(`${top.name}.${lastString}`)
        top.keys.add(lastString)
      }
      pendingName = lastString
      lastString = null
    } else if (c === ',') { pendingName = null; lastString = null }
    i++
  }
  return dupes
}

const { index, files } = readLibraryFiles()

// --- index and package version ----------------------------------------------
const contract = fs.readFileSync(path.join(ROOT, 'src/model/libraryField.ts'), 'utf8')
const declared = contract.match(/export const DATA_PACKAGE_VERSION\s*=\s*(\d+)/)
if (!declared) fail('src/model/libraryField.ts', 'no DATA_PACKAGE_VERSION to read')
else if (index.version !== Number(declared[1])) {
  fail('data/library/index.json', `version ${index.version} is not DATA_PACKAGE_VERSION ${declared[1]}`)
}

const listed = new Set(index.order)
if (listed.size !== index.order.length) fail('data/library/index.json', 'an id is listed twice in order')
for (const id of index.order) if (!files.has(id)) fail('data/library/index.json', `lists '${id}', which has no file`)
for (const [id, entry] of files) {
  if (!listed.has(id)) fail(path.relative(ROOT, entry.file), `'${id}' is not in data/library/index.json`)
}

// --- per file ----------------------------------------------------------------
const TOP_REQUIRED = ['id', 'kind', 'type', 'version', 'name', 'description', 'color', 'builtin', 'spec', 'fields', 'attributes']
const TYPE_KEY = { sensor: 'sensorType', effector: 'effectorType', uas: 'airframe' }

for (const entry of files.values()) {
  const where = path.relative(ROOT, entry.file)
  const f = entry.data

  for (const dupe of duplicateKeys(entry.text)) fail(where, `names '${dupe}' twice`)
  for (const key of TOP_REQUIRED) if (!(key in f)) fail(where, `has no '${key}'`)
  if (!KIND_DIRS.includes(f.kind)) fail(where, `kind '${f.kind}' is not an entity kind`)
  else if (entry.dir !== f.kind) fail(where, `sits under '${entry.dir}' but its kind is '${f.kind}'`)
  if (entry.name !== `${String(f.id).replace(/^lib-/, '')}.json`) fail(where, `file name does not match id '${f.id}'`)
  if (typeof f.version !== 'number' || f.version < 1) fail(where, `version '${f.version}' is not a revision number`)

  const specKey = TYPE_KEY[f.spec]
  const expectedType = specKey ? (f.attributes?.[specKey] ?? null) : null
  if ((f.type ?? null) !== expectedType) fail(where, `type '${f.type}' is not ${specKey ? `attributes.${specKey} ('${expectedType}')` : 'null, as this kind has no type'}`)

  const fields = f.fields ?? {}
  const attributes = f.attributes ?? {}
  for (const key of Object.keys(fields)) {
    if (key in attributes) fail(where, `names '${key}' twice: once in fields, once in attributes`)
  }
  if (!f.spec && (Object.keys(fields).length || Object.keys(attributes).length)) {
    fail(where, 'has no spec block but carries fields or attributes')
  }

  for (const [key, field] of Object.entries(fields)) {
    const at = `${where} ${key}`
    if (!field || typeof field !== 'object') { fail(at, 'is not a field object'); continue }
    if (!('value' in field)) fail(at, 'has no value')
    if (!field.unit) fail(at, 'has no unit')
    else if (!ALLOWED_UNITS.includes(field.unit)) fail(at, `unit '${field.unit}' is not a known unit`)
    else if (UNIT_BY_FIELD[key] && field.unit !== UNIT_BY_FIELD[key]) fail(at, `unit '${field.unit}' is not the table unit '${UNIT_BY_FIELD[key]}'`)
    if (!field.grade) fail(at, 'has no grade')
    else if (!GRADES.includes(field.grade)) fail(at, `grade '${field.grade}' is not a known grade`)
    if (!field.layer) fail(at, 'has no layer')
    else if (!LAYERS.includes(field.layer)) fail(at, `layer '${field.layer}' is not L1, L2 or L3`)

    const rangeType = RANGE_TYPE_BY_FIELD[f.spec]?.[key]
    if (rangeType) {
      if (!field.rangeType) fail(at, 'is a range field with no rangeType')
      if (!field.condition) fail(at, 'is a range field with no condition')
    }
    if (field.rangeType && !RANGE_TYPES.includes(field.rangeType)) fail(at, `rangeType '${field.rangeType}' is not a known range type`)

    if (field.layer === 'L1') {
      if (!field.source) fail(at, 'is L1 with no source')
      if (!field.date) fail(at, 'is L1 with no date')
    }
    if (field.layer === 'L2' && !field.estimator) fail(at, 'is L2 with no estimator')
    if (field.estimator && !ESTIMATORS.includes(field.estimator)) fail(at, `estimator '${field.estimator}' is not a known estimator`)
    if (field.estimator === 'class-median' && !(field.comparisonSet?.length)) {
      fail(at, "estimator 'class-median' needs a comparisonSet")
    }
    if (field.basis && !BASES.includes(field.basis)) fail(at, `basis '${field.basis}' is not a known basis`)
  }

  const order = f.provenanceOrder ?? []
  if (new Set(order).size !== order.length) fail(where, 'names a field twice in provenanceOrder')
  for (const key of order) {
    const src = fields[key] ?? f.attributeProvenance?.[key]
    if (!src) fail(where, `provenanceOrder names '${key}', which has no field or attribute lineage`)
    else if (!src.basis) fail(`${where} ${key}`, 'is in provenanceOrder with no basis')
  }
  for (const [key, lineage] of Object.entries(f.attributeProvenance ?? {})) {
    const at = `${where} ${key}`
    if (!(key in attributes)) fail(at, 'has attribute lineage but is not an attribute')
    if (!GRADES.includes(lineage.grade)) fail(at, `grade '${lineage.grade}' is not a known grade`)
    if (!LAYERS.includes(lineage.layer)) fail(at, `layer '${lineage.layer}' is not L1, L2 or L3`)
    if (!BASES.includes(lineage.basis)) fail(at, `basis '${lineage.basis}' is not a known basis`)
  }
}

// --- class priors, once lane 0.2 writes them ---------------------------------
// A value more than three spreads outside its class prior is either wrong or
// exceptional; an exceptional one says so in its note. The directory is absent
// until the priors exist, and the check is silent until then.
const priorsDir = path.join(ROOT, 'data/priors')
if (fs.existsSync(priorsDir)) {
  const spreads = (value, prior) => {
    const median = prior.median ?? (prior.logMedian != null ? Math.exp(prior.logMedian) : null)
    if (median != null && prior.sigmaDb) return Math.abs(20 * Math.log10(value / median)) / prior.sigmaDb
    if (prior.mean != null && prior.sd) return Math.abs(value - prior.mean) / prior.sd
    return null
  }
  for (const name of fs.readdirSync(priorsDir).sort()) {
    if (!name.endsWith('.json')) continue
    const priorPath = path.join(priorsDir, name)
    const prior = JSON.parse(fs.readFileSync(priorPath, 'utf8'))
    if (!Array.isArray(prior.members) || !prior.fields) {
      console.log(`${path.relative(ROOT, priorPath)}: no members and fields to check against; skipped.`)
      continue
    }
    for (const id of prior.members) {
      const entry = files.get(id)
      if (!entry) { fail(path.relative(ROOT, priorPath), `names member '${id}', which has no file`); continue }
      for (const [key, spec] of Object.entries(prior.fields)) {
        const field = entry.data.fields?.[key]
        if (!field || typeof field.value !== 'number' || field.value <= 0) continue
        const away = spreads(field.value, spec)
        if (away != null && away > 3 && !field.note) {
          fail(`${path.relative(ROOT, entry.file)} ${key}`, `is ${away.toFixed(1)} spreads from the ${name.replace(/\.json$/, '')} prior with no note`)
        }
      }
    }
  }
}

if (problems.length) {
  console.error(`Library health check failed (${problems.length}):`)
  for (const p of problems) console.error(`  ${p}`)
  process.exit(1)
}
console.log(`Library health check passed: ${files.size} models, ${[...files.values()].reduce((n, e) => n + Object.keys(e.data.fields ?? {}).length, 0)} fields.`)
