import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const registryPath = resolve(root, 'docs/maintenance.json')

/** Include added files and omit deleted files, without inspecting ignored local data. */
export function repositoryFiles(directory) {
  return [
    ...new Set(
      execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
        cwd: directory,
        encoding: 'utf8',
      })
        .split('\0')
        .filter(Boolean),
    ),
  ]
    .filter((file) => existsSync(resolve(directory, file)))
    .sort()
}

/** Hash names and bytes so edits, additions, deletions and moves all invalidate review. */
export function fingerprint(directory, files, entry) {
  const selected = files.filter(
    (file) =>
      file === entry.document ||
      entry.inputs.some((input) => (input.endsWith('/') ? file.startsWith(input) : file === input)),
  )
  for (const input of [entry.document, ...entry.inputs]) {
    if (!selected.some((file) => (input.endsWith('/') ? file.startsWith(input) : file === input))) {
      throw new Error(`Missing review input: ${input}`)
    }
  }
  const hash = createHash('sha256')
  for (const file of selected) {
    const bytes = readFileSync(resolve(directory, file))
    hash.update(`${file}\0${bytes.length}\0`).update(bytes)
  }
  return hash.digest('hex')
}

/** Every Markdown file has one role and a direct link in the canonical index. */
export function placementErrors(directory, files, registry) {
  const index = readFileSync(resolve(directory, 'docs/README.md'), 'utf8')
  const errors = []
  const current = new Set(registry.references.map((entry) => entry.document))
  for (const file of files.filter((file) => /\.md$/i.test(file))) {
    if (
      !current.has(file) &&
      !registry.historical.some((path) =>
        path.endsWith('/') ? file.startsWith(path) : file === path,
      )
    ) {
      errors.push(`Unclassified Markdown: ${file}. Place it or register a current reference.`)
    }
    const target = relative('docs', file).split('\\').join('/')
    if (file !== 'docs/README.md' && !index.includes(`](${target})`)) {
      errors.push(`Missing direct index link: ${file}`)
    }
  }
  if (readFileSync(resolve(directory, 'AGENTS.md'), 'utf8').trimEnd().split('\n').length > 80) {
    errors.push('AGENTS.md exceeds 80 lines; move detail to an existing reference.')
  }
  return errors
}

function main(args) {
  const registry = JSON.parse(readFileSync(registryPath, 'utf8'))
  const files = repositoryFiles(root)
  if (args.length) {
    const [mode, document, flag, note, ...extra] = args
    if (mode !== '--review' || flag !== '--note' || !note?.trim() || extra.length) {
      throw new Error('Usage: npm run docs:review -- <document> --note "What was reviewed"')
    }
    const entry = registry.references.find((item) => item.document === document)
    if (!entry) throw new Error(`Not a current reference: ${document}`)
    entry.sha256 = fingerprint(root, files, entry)
    entry.reviewedAt = new Date().toISOString().slice(0, 10)
    entry.note = note.trim()
    writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`)
    console.log(`Recorded source review: ${document}`)
    return
  }
  const errors = placementErrors(root, files, registry)
  for (const entry of registry.references) {
    if (
      !entry.reviewedAt ||
      !entry.note?.trim() ||
      entry.sha256 !== fingerprint(root, files, entry)
    ) {
      errors.push(
        `Review required: ${entry.document}. Read its changed inputs, update it, then use docs:review with a note.`,
      )
    }
  }
  if (errors.length) throw new Error(errors.join('\n'))
  console.log(
    `Documentation placement and source review passed (${registry.references.length} current references).`,
  )
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2))
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
