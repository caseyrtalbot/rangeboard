import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve, relative, extname, dirname, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const EVIDENCE_DIR = 'docs/field-te/evidence'

// Captured JSON stays readable below 512 kB; larger records belong in a gzip sidecar.
export const JSON_LIMIT_BYTES = 524_288

// Fixtures that tests and scripts import stay exempt from the gate.
export const ALLOWLIST_FILE = 'scripts/evidence/allowlist.json'

/** Treat a gzip sidecar as one extension so `.json` never counts compressed bytes. */
export function extensionOf(path) {
  return path.toLowerCase().endsWith('.json.gz') ? '.json.gz' : extname(path).toLowerCase()
}

/** Hash and measure every regular file under the evidence directory. */
export function scanEvidence(root, directory = EVIDENCE_DIR) {
  const base = resolve(root, directory)
  let entries = []
  try {
    entries = readdirSync(base, { recursive: true, withFileTypes: true })
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  const files = entries.filter(entry => entry.isFile()).map(entry => {
    const file = resolve(entry.parentPath ?? entry.path, entry.name)
    const bytes = readFileSync(file)
    return {
      path: relative(resolve(root), file).split(sep).join('/'),
      bytes: bytes.length,
      ext: extensionOf(entry.name),
      sha256: createHash('sha256').update(bytes).digest('hex'),
    }
  }).sort((a, b) => a.path.localeCompare(b.path))
  return { root: resolve(root), directory, files }
}

/** Identical JSON captures waste the whole group except one copy. */
export function duplicateGroups(files) {
  const groups = new Map()
  for (const file of files.filter(file => file.ext === '.json')) {
    const group = groups.get(file.sha256) ?? { sha256: file.sha256, bytes: file.bytes, paths: [] }
    group.paths.push(file.path)
    groups.set(file.sha256, group)
  }
  return [...groups.values()]
    .filter(group => group.paths.length > 1)
    .map(group => ({ ...group, paths: [...group.paths].sort() }))
    .sort((a, b) => b.bytes - a.bytes || a.sha256.localeCompare(b.sha256))
}

/** Wasted bytes are every copy after the first. */
export function duplicateBytes(group) {
  return group.bytes * (group.paths.length - 1)
}

/** Uncompressed JSON above the limit; a gzip sidecar is never oversized. */
export function oversizedJson(files, limitBytes = JSON_LIMIT_BYTES) {
  return files
    .filter(file => file.ext === '.json' && file.bytes > limitBytes)
    .sort((a, b) => b.bytes - a.bytes || a.path.localeCompare(b.path))
}

/** Totals by extension plus the JSON, gzip and image lines the report leads with. */
export function summarize(scan) {
  const byExt = {}
  let totalBytes = 0
  for (const file of scan.files) {
    const bucket = byExt[file.ext] ?? (byExt[file.ext] = { count: 0, bytes: 0 })
    bucket.count += 1
    bucket.bytes += file.bytes
    totalBytes += file.bytes
  }
  const extBytes = ext => byExt[ext]?.bytes ?? 0
  const jsonBytes = extBytes('.json')
  const jsonDuplicateBytes = duplicateGroups(scan.files).reduce((sum, group) => sum + duplicateBytes(group), 0)
  return {
    totalBytes,
    byExt,
    jsonBytes,
    jsonUniqueBytes: jsonBytes - jsonDuplicateBytes,
    jsonDuplicateBytes,
    gzJsonBytes: extBytes('.json.gz'),
    pngBytes: extBytes('.png'),
  }
}

/** One decimal in MB, or in kB below a megabyte, so small files stay readable. */
export function formatBytes(bytes) {
  return bytes < 1_000_000
    ? `${(bytes / 1000).toFixed(1)} kB`
    : `${(bytes / 1_000_000).toFixed(1)} MB`
}

/** Printable size table, duplicate groups and oversized JSON. */
export function report(scan, limitBytes = JSON_LIMIT_BYTES) {
  const summary = summarize(scan)
  const groups = duplicateGroups(scan.files)
  const oversized = oversizedJson(scan.files, limitBytes)
  const lines = [
    `Evidence report: ${scan.directory}`,
    `${scan.files.length} files, ${formatBytes(summary.totalBytes)} total`,
    '',
    'Size by extension',
  ]
  for (const [ext, bucket] of Object.entries(summary.byExt).sort((a, b) => b[1].bytes - a[1].bytes)) {
    lines.push(`  ${(ext || '(none)').padEnd(10)} ${String(bucket.count).padStart(5)} files  ${formatBytes(bucket.bytes).padStart(10)}`)
  }
  lines.push(
    '',
    `JSON: ${formatBytes(summary.jsonBytes)} total, ${formatBytes(summary.jsonUniqueBytes)} unique, ${formatBytes(summary.jsonDuplicateBytes)} duplicate`,
    `Gzipped JSON: ${formatBytes(summary.gzJsonBytes)}; PNG: ${formatBytes(summary.pngBytes)}`,
    '',
    `Duplicate JSON groups: ${groups.length}`,
  )
  for (const group of groups) {
    lines.push(`  ${formatBytes(group.bytes)} x ${group.paths.length} copies (${formatBytes(duplicateBytes(group))} duplicate)`)
    for (const path of group.paths) lines.push(`    ${path}`)
  }
  lines.push('', `Oversized JSON (over ${formatBytes(limitBytes)}): ${oversized.length}`)
  for (const file of oversized) lines.push(`  ${formatBytes(file.bytes).padStart(10)}  ${file.path}`)
  return lines.join('\n')
}

/** Fixtures imported by tests and scripts are exempt; missing list means nothing is exempt. */
export function loadAllowlist(root, file = ALLOWLIST_FILE) {
  try {
    return JSON.parse(readFileSync(resolve(root, file), 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}

/** Gate messages: one per duplicate JSON group, one per oversized JSON file. */
export function enforcementFailures(scan, { limitBytes = JSON_LIMIT_BYTES, allow = [] } = {}) {
  const exempt = new Set(allow)
  const failures = []
  for (const group of duplicateGroups(scan.files)) {
    const paths = group.paths.filter(path => !exempt.has(path))
    if (paths.length < 2) continue
    failures.push(`Duplicate JSON (${formatBytes(group.bytes)} x ${paths.length}): ${paths.join(', ')}`)
  }
  for (const file of oversizedJson(scan.files, limitBytes)) {
    if (exempt.has(file.path)) continue
    failures.push(`Oversized JSON (${formatBytes(file.bytes)} over ${formatBytes(limitBytes)}): ${file.path}`)
  }
  return failures
}

/** Read the flags this slice supports. */
export function parseArgs(args) {
  const options = { limitBytes: JSON_LIMIT_BYTES, enforce: false }
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--enforce') { options.enforce = true; continue }
    if (args[index] !== '--limit') continue
    const value = Number(args[index + 1])
    if (!Number.isFinite(value) || value < 0) throw new Error('Usage: check-evidence.mjs [--limit <bytes>] [--enforce]')
    options.limitBytes = value
    index += 1
  }
  return options
}

function main(args) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const options = parseArgs(args)
  const scan = scanEvidence(root)
  console.log(report(scan, options.limitBytes))
  if (!options.enforce) return
  const allow = loadAllowlist(root)
  const failures = enforcementFailures(scan, { limitBytes: options.limitBytes, allow })
  if (failures.length === 0) {
    console.log(`Evidence gate passed (${scan.files.length} files, 0 duplicate JSON groups, 0 oversized JSON, ${allow.length} allowlisted)`)
    return
  }
  console.error(`\nEvidence gate failed: ${failures.length} findings`)
  for (const failure of failures) console.error(`  ${failure}`)
  process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(process.argv.slice(2)) } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
