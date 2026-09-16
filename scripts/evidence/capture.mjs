import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
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

/** `sameAs` is `<tag>` in this manifest or `<relative-dir>/<tag>` in a sibling folder's. */
function pointerTarget(dir, sameAs) {
  const slash = sameAs.lastIndexOf('/')
  return slash === -1
    ? { dir, tag: sameAs }
    : { dir: resolve(dir, sameAs.slice(0, slash)), tag: sameAs.slice(slash + 1) }
}

/** Follow `sameAs` pointers, loading other folders' manifests, to the entry that owns the stored file. */
function ownerEntry(dir, captures, entry, manifestName = 'manifest.json') {
  const seen = new Set()
  let current = { dir: resolve(dir), captures, entry }
  while (current.entry?.sameAs) {
    const key = `${current.dir}\0${current.entry.tag}`
    if (seen.has(key)) return undefined
    seen.add(key)
    const target = pointerTarget(current.dir, current.entry.sameAs)
    const next =
      target.dir === current.dir
        ? current.captures
        : loadManifest(join(target.dir, manifestName)).captures
    current = {
      dir: target.dir,
      captures: next,
      entry: next.find((item) => item.tag === target.tag),
    }
  }
  return current.entry ? { dir: current.dir, entry: current.entry } : undefined
}

function storedPath(dir, captures, entry, manifestName) {
  const owner = ownerEntry(dir, captures, entry, manifestName)
  return owner?.entry.file ? join(owner.dir, owner.entry.file) : ''
}

/** Sibling folders (one level under the parent, sorted) that already hold these bytes. */
function siblingPointer(dir, digest, manifestName) {
  const parent = dirname(resolve(dir))
  const self = basename(resolve(dir))
  const folders = readdirSync(parent, { withFileTypes: true })
    .filter((item) => item.isDirectory() && item.name !== self)
    .map((item) => item.name)
    .sort()
  for (const folder of folders) {
    const siblingDir = join(parent, folder)
    if (!existsSync(join(siblingDir, manifestName))) continue
    const captures = loadManifest(join(siblingDir, manifestName)).captures
    const match = captures.find(
      (item) =>
        item.sha256 === digest && existsSync(storedPath(siblingDir, captures, item, manifestName)),
    )
    if (match) return `../${folder}/${match.tag}`
  }
  return undefined
}

function findEntry(dir, tag, manifestName) {
  const captures = loadManifest(join(dir, manifestName)).captures
  const entry = captures.find((item) => item.tag === tag)
  if (!entry) throw new Error(`No capture recorded for tag "${tag}" in ${dir}`)
  return { captures, entry }
}

/** Serialize once, then store the bytes at most once per distinct hash. */
export function writeCapture(dir, tag, value, options = {}) {
  const {
    limitBytes = LARGE_CAPTURE_BYTES,
    manifest: manifestName = 'manifest.json',
    siblings = true,
  } = options
  mkdirSync(dir, { recursive: true })
  const text = serializeCapture(value)
  const bytes = Buffer.byteLength(text)
  const digest = sha256(text)
  const manifestPath = join(dir, manifestName)
  const manifest = loadManifest(manifestPath)
  const captures = manifest.captures
  const index = captures.findIndex((item) => item.tag === tag)
  const staleFile = index === -1 ? undefined : captures[index].file

  // A byte-identical capture records a pointer instead of a second copy; this folder wins over a sibling.
  const duplicate = captures.find(
    (item) =>
      item.tag !== tag &&
      item.sha256 === digest &&
      existsSync(storedPath(dir, captures, item, manifestName)),
  )
  const sameAs =
    duplicate?.tag ?? (siblings ? siblingPointer(dir, digest, manifestName) : undefined)
  let entry
  if (sameAs) {
    entry = { tag, sha256: digest, bytes, sameAs }
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
  if (staleFile && staleFile !== entry.file && !captures.some((item) => item.file === staleFile)) {
    rmSync(join(dir, staleFile), { force: true })
  }
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  return entry
}

/** Compare by hash only; the stored file is never read or inflated. */
export function compareCapture(dir, tag, value, options = {}) {
  const { manifest: manifestName = 'manifest.json' } = options
  const { captures, entry } = findEntry(dir, tag, manifestName)
  const expected = ownerEntry(dir, captures, entry, manifestName)?.entry.sha256 ?? entry.sha256
  const actual = sha256(serializeCapture(value))
  return { match: actual === expected, expected, actual }
}

export function readCapture(dir, tag, options = {}) {
  const { manifest: manifestName = 'manifest.json' } = options
  const { captures, entry } = findEntry(dir, tag, manifestName)
  const owner = ownerEntry(dir, captures, entry, manifestName)
  if (!owner?.entry.file) throw new Error(`Capture "${tag}" has no stored file in ${dir}`)
  const raw = readFileSync(join(owner.dir, owner.entry.file))
  return JSON.parse(owner.entry.file.endsWith('.gz') ? gunzipSync(raw) : raw)
}
