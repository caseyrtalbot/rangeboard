import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))

export const CONFIG_FILE = 'scripts/silent/sgconfig.yml'

export const SCAN_FILE = /\.(ts|tsx|mts|cts)$/

/** A finding on a line that carries this marker with a reason is accepted. */
export const OK_MARKER = /silent-ok:\s*\S/

/** Domain terms that contain a weasel word but describe the C-UAS problem, not a hidden failure. */
export const DOMAIN_TERMS = [/\bRF[- ]silent\b/i, /\bjam-degraded\b/i]

/** A comment that forbids the pattern is not an instance of it. */
export const NEGATED =
  /\b(never|not|no|without|instead of)\s+(be(ing)?\s+|is\s+|a\s+)?(silent|silently|swallow)/i

/** The weasel-word rule regex, kept in step with scripts/silent/rules/weasel-word.yml and weasel-word-tsx.yml. */
export const WEASEL_WORD =
  /\b(silent|silently|swallow(s|ed|ing)?|fail[- ]?soft|fail[- ]?open|best[- ]effort|fallback|graceful(ly)?[- ]degrad\w*|degrade[sd]?\s+gracefully)\b/i

const ZERO_SHA = /^0{40}$/

export function parseArgs(argv) {
  const args = { base: null, staged: false, all: false, json: false, help: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--base') args.base = argv[++i] ?? null
    else if (arg.startsWith('--base=')) args.base = arg.slice('--base='.length)
    else if (arg === '--staged') args.staged = true
    else if (arg === '--all') args.all = true
    else if (arg === '--json') args.json = true
    else if (arg === '--help' || arg === '-h') args.help = true
    else throw new Error(`Unknown argument: ${arg}`)
  }
  return args
}

export function git(root, ...cmd) {
  const result = spawnSync('git', cmd, { cwd: root, encoding: 'utf8' })
  return {
    ok: result.status === 0,
    out: (result.stdout ?? '').trim(),
    err: (result.stderr ?? '').trim(),
  }
}

/** Parse `git diff -U0` output into added line numbers per file. */
export function addedLines(diffText) {
  const added = new Map()
  let file = null
  for (const line of diffText.split('\n')) {
    if (line.startsWith('+++ ')) {
      // git appends a tab to the header when the path holds a space.
      const path = line.slice(4).replace(/\t$/, '')
      // A quoted path holds characters core.quotePath=false still escapes; it cannot be read back.
      if (path.startsWith('"')) throw new Error(`Cannot check a quoted path in git diff: ${path}`)
      file = path === '/dev/null' ? null : path.replace(/^b\//, '')
      if (file && !added.has(file)) added.set(file, new Set())
      continue
    }
    if (!file || !line.startsWith('@@')) continue
    const match = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line)
    if (!match) continue
    const start = Number(match[1])
    const count = match[2] === undefined ? 1 : Number(match[2])
    const lines = added.get(file)
    for (let n = start; n < start + count; n++) lines.add(n)
  }
  return added
}

/** Pick the commit to diff against. Records which choice was made and why. */
export function resolveBase(root, explicit) {
  const candidates = []
  if (explicit && !ZERO_SHA.test(explicit)) candidates.push({ ref: explicit, reason: 'given' })
  if (git(root, 'rev-parse', '--verify', '-q', 'main').ok)
    candidates.push({ ref: 'main', reason: 'main' })
  if (git(root, 'rev-parse', '--verify', '-q', 'origin/main').ok)
    candidates.push({ ref: 'origin/main', reason: 'origin/main' })
  for (const candidate of candidates) {
    const merge = git(root, 'merge-base', candidate.ref, 'HEAD')
    if (merge.ok) return { sha: merge.out, reason: candidate.reason }
    // A given base that cannot be reached must not turn into a diff against HEAD.
    if (candidate.reason === 'given')
      throw new Error(
        `Base ${candidate.ref} has no merge-base with HEAD: ${merge.err || 'git merge-base failed'}`,
      )
  }
  throw new Error(
    'No base to diff against: neither main nor origin/main resolves. Pass --base <ref>.',
  )
}

// Pin every option that user git config can change in the diff text the parser reads.
const DIFF_ARGS = [
  '-c',
  'core.quotePath=false',
  'diff',
  '-U0',
  '--inter-hunk-context=0',
  '--no-color',
  '--no-ext-diff',
  '--no-renames',
  '--no-relative',
  '--src-prefix=a/',
  '--dst-prefix=b/',
  '--diff-filter=AM',
]

/** Added lines for the working tree against a base commit, plus every line of untracked files. */
export function changedLines(root, { base, staged }) {
  const diff = git(root, ...DIFF_ARGS, staged ? '--cached' : base, '--')
  if (!diff.ok) throw new Error(`git diff failed: ${diff.err}`)
  const added = new Map([...addedLines(diff.out)].filter(([file]) => SCAN_FILE.test(file)))
  if (!staged) {
    const untracked = git(root, 'ls-files', '-z', '--others', '--exclude-standard')
    for (const file of untracked.out.split('\0').filter((f) => f && SCAN_FILE.test(f))) {
      const count = readFileSync(resolve(root, file), 'utf8').split('\n').length
      added.set(file, new Set(Array.from({ length: count }, (_, i) => i + 1)))
    }
  }
  return added
}

export function trackedFiles(root) {
  const list = git(root, 'ls-files', '-z')
  return list.out.split('\0').filter((f) => f && SCAN_FILE.test(f))
}

export function astGrepBin(repoRoot) {
  return resolve(repoRoot, 'node_modules', '.bin', 'ast-grep')
}

/** Run ast-grep over the given files and return its findings as plain objects. */
export function scan(root, files, { bin, config } = {}) {
  if (files.length === 0) return []
  // ast-grep exits 0 with no findings for a missing path, so check first.
  const missing = files.filter((file) => !existsSync(resolve(root, file)))
  if (missing.length > 0) throw new Error(`Cannot scan missing file(s): ${missing.join(', ')}`)
  const repoRoot = resolve(SCRIPT_DIR, '..')
  const result = spawnSync(
    bin ?? astGrepBin(repoRoot),
    ['scan', '-c', config ?? resolve(repoRoot, CONFIG_FILE), '--json=compact', ...files],
    { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  )
  if (result.error) {
    const stderr = (result.stderr ?? '').trim()
    throw new Error(
      `ast-grep scan could not start: ${result.error.message}${stderr ? `\n${stderr}` : ''}`,
      { cause: result.error },
    )
  }
  if (result.status !== 0 && result.status !== 1) {
    const outcome = result.signal
      ? `signal ${result.signal}`
      : `exit code ${result.status ?? 'unknown'}`
    const stderr = (result.stderr ?? '').trim()
    throw new Error(
      `ast-grep scan failed with ${outcome} while scanning ${files.join(', ')}.\n${
        stderr || 'ast-grep produced no stderr output.'
      }`,
    )
  }
  let parsed
  try {
    parsed = JSON.parse(result.stdout || '[]')
  } catch {
    throw new Error(`ast-grep did not return JSON.\n${result.stdout}\n${result.stderr}`)
  }
  if (!Array.isArray(parsed)) throw new Error('ast-grep JSON output was not an array.')
  return parsed.map((m) => ({
    rule: m.ruleId,
    file: m.file,
    line: m.range.start.line + 1,
    endLine: m.range.end.line + 1,
    text: m.lines.trim(),
    message: m.message,
  }))
}

function lineText(sources, file, line) {
  const lines = sources.get(file)
  return lines?.[line - 1] ?? ''
}

function findingTouchesLines(finding, lines) {
  if (!lines) return false
  const endLine = finding.endLine ?? finding.line
  for (let line = finding.line; line <= endLine; line++) {
    if (lines.has(line)) return true
  }
  return false
}

/** Drop findings outside the added lines, marked silent-ok within their span, or matching a domain or negated phrase. */
export function filterFindings(findings, added, sources) {
  const seen = new Set()
  const kept = []
  for (const finding of findings) {
    const lines = added?.get(finding.file)
    if (added && !findingTouchesLines(finding, lines)) continue
    const key = `${finding.rule}:${finding.file}:${finding.line}`
    if (seen.has(key)) continue
    seen.add(key)
    const span = []
    for (let n = finding.line - 1; n <= (finding.endLine ?? finding.line); n++)
      span.push(lineText(sources, finding.file, n))
    if (span.some((line) => OK_MARKER.test(line))) continue
    if (finding.rule === 'weasel-word' || finding.rule === 'weasel-word-tsx') {
      // Each matching line of the span, without the line above, must carry its own exemption.
      const matching = span.slice(1).filter((line) => WEASEL_WORD.test(line))
      const exempt = (line) => DOMAIN_TERMS.some((term) => term.test(line)) || NEGATED.test(line)
      if (matching.length > 0 && matching.every(exempt)) continue
    }
    kept.push(finding)
  }
  return kept.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)
}

export function loadSources(root, files) {
  const sources = new Map()
  for (const file of files) {
    const path = resolve(root, file)
    if (existsSync(path)) sources.set(file, readFileSync(path, 'utf8').split('\n'))
  }
  return sources
}

function indexBlob(root, file) {
  const result = spawnSync('git', ['show', `:${file}`], {
    cwd: root,
    encoding: null,
    maxBuffer: 64 * 1024 * 1024,
  })
  if (result.error)
    throw new Error(`Could not read staged file ${file}: ${result.error.message}`, {
      cause: result.error,
    })
  if (result.status !== 0) {
    const stderr = result.stderr?.toString('utf8').trim()
    throw new Error(
      `Could not read staged file ${file}: ${stderr || `git exited ${result.status}`}`,
    )
  }
  return result.stdout
}

function withStagedSnapshot(root, files, inspectSnapshot) {
  const snapshotRoot = mkdtempSync(join(tmpdir(), 'rangeboard-silent-staged-'))
  try {
    for (const file of files) {
      const destination = resolve(snapshotRoot, file)
      const localPath = relative(snapshotRoot, destination)
      if (localPath === '..' || localPath.startsWith(`..${sep}`) || isAbsolute(localPath))
        throw new Error(`Refusing to materialize staged path outside the snapshot: ${file}`)
      mkdirSync(dirname(destination), { recursive: true })
      writeFileSync(destination, indexBlob(root, file))
    }
    return inspectSnapshot(snapshotRoot)
  } finally {
    rmSync(snapshotRoot, { recursive: true, force: true })
  }
}

export function report(findings, { base, mode }) {
  const lines = [
    `silent gate: ${mode}${base ? ` against ${base.sha.slice(0, 10)} (${base.reason})` : ''}`,
  ]
  if (findings.length === 0) {
    lines.push('No hidden-failure patterns in the checked lines.')
    return lines.join('\n')
  }
  for (const f of findings) {
    lines.push(`${f.file}:${f.line} [${f.rule}] ${f.text}`)
    lines.push(`  ${f.message}`)
  }
  lines.push('')
  lines.push(`${findings.length} finding(s).`)
  lines.push(
    'Report or record the failure. If the code is right as written, add `// silent-ok: <reason>` on the line, the line above, or inside the matched block.',
  )
  return lines.join('\n')
}

/** Run the gate. Returns findings and the text report; the caller decides the exit code. */
export function runGate(root, args, scanOptions = {}) {
  if (args.all) {
    // A tracked file deleted from the working tree has nothing to scan.
    const files = trackedFiles(root).filter((file) => existsSync(resolve(root, file)))
    const findings = filterFindings(scan(root, files, scanOptions), null, loadSources(root, files))
    return {
      findings,
      base: null,
      mode: 'all tracked files',
      text: report(findings, { mode: 'all tracked files' }),
    }
  }
  const base = args.staged ? null : resolveBase(root, args.base)
  const added = changedLines(root, { base: base?.sha, staged: args.staged })
  const files = [...added.keys()]
  const mode = args.staged ? 'staged changes' : 'changed lines'
  const scanFiles = (sourceRoot) =>
    filterFindings(scan(sourceRoot, files, scanOptions), added, loadSources(sourceRoot, files))
  const findings = args.staged ? withStagedSnapshot(root, files, scanFiles) : scanFiles(root)
  return { findings, base, mode, text: report(findings, { base, mode }) }
}

function usage() {
  return [
    'Usage: node scripts/check-silent.mjs [--base <ref>] [--staged] [--all] [--json]',
    '',
    'Checks added lines for catch blocks and promise catches that hide a failure,',
    'and for comments or strings that describe one. Default base is the merge-base',
    'with main, then origin/main. --staged checks the index. --all reports every',
    'tracked file and never fails.',
  ].join('\n')
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log(usage())
    return 0
  }
  const root = resolve(SCRIPT_DIR, '..')
  const result = runGate(root, args)
  if (args.json) console.log(JSON.stringify(result.findings, null, 2))
  else console.log(result.text)
  if (args.all) return 0
  return result.findings.length === 0 ? 0 : 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main())
