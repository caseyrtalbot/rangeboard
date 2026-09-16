import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'

/** Captures above this size are stored gzipped; engine snapshots compress 8-20x. */
export const LARGE_CAPTURE_BYTES = 524288

/** Compact and deterministic. Keys keep insertion order, which callers already rely on. */
export function serializeCapture(value) {
  return JSON.stringify(value)
}

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function loadManifest(path) {
  const manifest = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {}
  if (!Array.isArray(manifest.captures)) manifest.captures = []
  return manifest
}

/** Follow `sameAs` pointers to the entry that owns the stored file. */
function ownerEntry(captures, entry) {
  const seen = new Set()
  let current = entry
  while (current?.sameAs) {
    if (seen.has(current.tag)) return undefined
    seen.add(current.tag)
    current = captures.find(item => item.tag === current.sameAs)
  }
  return current
}

function storedPath(dir, captures, entry) {
  const owner = ownerEntry(captures, entry)
  return owner?.file ? join(dir, owner.file) : ''
}

function findEntry(dir, tag, manifestName) {
  const captures = loadManifest(join(dir, manifestName)).captures
  const entry = captures.find(item => item.tag === tag)
  if (!entry) throw new Error(`No capture recorded for tag "${tag}" in ${dir}`)
  return { captures, entry }
}

/** Serialize once, then store the bytes at most once per distinct hash. */
export function writeCapture(dir, tag, value, options = {}) {
  const { limitBytes = LARGE_CAPTURE_BYTES, manifest: manifestName = 'manifest.json' } = options
  mkdirSync(dir, { recursive: true })
  const text = serializeCapture(value)
  const bytes = Buffer.byteLength(text)
  const digest = sha256(text)
  const manifestPath = join(dir, manifestName)
  const manifest = loadManifest(manifestPath)
  const captures = manifest.captures
  const index = captures.findIndex(item => item.tag === tag)
  const staleFile = index === -1 ? undefined : captures[index].file

  // A byte-identical capture records a pointer instead of a second copy.
  const duplicate = captures.find(item => item.tag !== tag && item.sha256 === digest
    && existsSync(storedPath(dir, captures, item)))
  let entry
  if (duplicate) {
    entry = { tag, sha256: digest, bytes, sameAs: duplicate.tag }
  } else {
    const compress = bytes > limitBytes
    const file = compress ? `${tag}.json.gz` : `${tag}.json`
    const payload = compress ? gzipSync(Buffer.from(text), { level: 9 }) : Buffer.from(text)
    writeFileSync(join(dir, file), payload)
    entry = compress
      ? { tag, file, sha256: digest, bytes, gzipBytes: payload.length }
      : { tag, file, sha256: digest, bytes }
  }
  if (index === -1) captures.push(entry)
  else captures[index] = entry

  // Drop a file this tag no longer owns, such as after a .json to .json.gz switch.
  if (staleFile && staleFile !== entry.file && !captures.some(item => item.file === staleFile)) {
    rmSync(join(dir, staleFile), { force: true })
  }
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  return entry
}

/** Compare by hash only; the stored file is never read or inflated. */
export function compareCapture(dir, tag, value, options = {}) {
  const { manifest: manifestName = 'manifest.json' } = options
  const { captures, entry } = findEntry(dir, tag, manifestName)
  const expected = ownerEntry(captures, entry)?.sha256 ?? entry.sha256
  const actual = sha256(serializeCapture(value))
  return { match: actual === expected, expected, actual }
}

export function readCapture(dir, tag, options = {}) {
  const { manifest: manifestName = 'manifest.json' } = options
  const { captures, entry } = findEntry(dir, tag, manifestName)
  const owner = ownerEntry(captures, entry)
  if (!owner?.file) throw new Error(`Capture "${tag}" has no stored file in ${dir}`)
  const raw = readFileSync(join(dir, owner.file))
  return JSON.parse(owner.file.endsWith('.gz') ? gunzipSync(raw) : raw)
}
