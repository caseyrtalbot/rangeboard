import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { addedLines, filterFindings, parseArgs, resolveBase, runGate } from './check-silent.mjs'

function repo(t) {
  const root = mkdtempSync(join(tmpdir(), 'rangeboard-silent-test-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const git = (...cmd) => {
    const result = spawnSync('git', cmd, { cwd: root, encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
    return result.stdout.trim()
  }
  git('init', '-q', '-b', 'main')
  git('config', 'user.email', 'test@example.com')
  git('config', 'user.name', 'test')
  const put = (file, text) => writeFileSync(join(root, file), text)
  const commit = (message) => {
    git('add', '-A')
    git('commit', '-q', '-m', message)
  }
  return { root, git, put, commit }
}

const CLEAN =
  'export function a() {\n  try {\n    x()\n  } catch (error) {\n    report(error)\n  }\n}\n'

test('parseArgs reads base, staged, all, json', () => {
  assert.deepEqual(parseArgs(['--base', 'abc', '--json']), {
    base: 'abc',
    staged: false,
    all: false,
    json: true,
    help: false,
  })
  assert.equal(parseArgs(['--base=origin/main']).base, 'origin/main')
  assert.equal(parseArgs(['--staged']).staged, true)
  assert.equal(parseArgs(['--all']).all, true)
  assert.throws(() => parseArgs(['--nope']), /Unknown argument/)
})

test('addedLines reads hunk headers into line sets per file', () => {
  const diff = [
    'diff --git a/src/a.ts b/src/a.ts',
    '--- a/src/a.ts',
    '+++ b/src/a.ts',
    '@@ -3,0 +4,2 @@',
    '+one',
    '+two',
    '@@ -10 +12 @@',
    '+three',
    'diff --git a/src/gone.ts b/src/gone.ts',
    '--- a/src/gone.ts',
    '+++ /dev/null',
    '@@ -1,3 +0,0 @@',
  ].join('\n')
  const added = addedLines(diff)
  assert.deepEqual(
    [...added.get('src/a.ts')].sort((a, b) => a - b),
    [4, 5, 12],
  )
  assert.equal(added.has('src/gone.ts'), false)
})

test('filterFindings keeps only added lines and drops marked, domain, and negated lines', () => {
  const findings = [
    { rule: 'empty-catch', file: 'a.ts', line: 2, text: 'catch {}', message: 'm' },
    { rule: 'empty-catch', file: 'a.ts', line: 5, text: 'catch {}', message: 'm' },
    { rule: 'empty-catch', file: 'a.ts', line: 7, text: 'catch {}', message: 'm' },
    { rule: 'weasel-word', file: 'a.ts', line: 9, text: '// RF silent', message: 'm' },
    { rule: 'weasel-word', file: 'a.ts', line: 10, text: '// never silent', message: 'm' },
    { rule: 'weasel-word', file: 'a.ts', line: 11, text: '// swallowed', message: 'm' },
    { rule: 'weasel-word', file: 'a.ts', line: 11, text: '// swallowed', message: 'm' },
  ]
  const source = [
    '',
    'catch {}',
    '',
    '// silent-ok: probe only',
    'catch {}',
    '',
    'catch {} // silent-ok: probe only',
    '',
    '// RF silent threats',
    '// never silent: escapes are logged',
    '// swallowed',
  ]
  const added = new Map([['a.ts', new Set([2, 4, 5, 7, 9, 10, 11])]])
  const kept = filterFindings(findings, added, new Map([['a.ts', source]]))
  assert.deepEqual(
    kept.map((f) => f.line),
    [2, 11],
  )
})

test('filterFindings with no added map reports every finding once', () => {
  const findings = [
    { rule: 'empty-catch', file: 'b.ts', line: 1, text: 'catch {}', message: 'm' },
    { rule: 'empty-catch', file: 'a.ts', line: 1, text: 'catch {}', message: 'm' },
  ]
  const kept = filterFindings(findings, null, new Map())
  assert.deepEqual(
    kept.map((f) => f.file),
    ['a.ts', 'b.ts'],
  )
})

test('resolveBase prefers the given ref, then main, and ignores a zero sha', (t) => {
  const { root, git, put, commit } = repo(t)
  put('a.ts', CLEAN)
  commit('base')
  const base = git('rev-parse', 'HEAD')
  git('checkout', '-q', '-b', 'topic')
  put('a.ts', CLEAN + '\n')
  commit('topic')
  assert.deepEqual(resolveBase(root, null), { sha: base, reason: 'main' })
  assert.deepEqual(resolveBase(root, '0'.repeat(40)), { sha: base, reason: 'main' })
  assert.equal(resolveBase(root, 'HEAD').reason, 'given')
})

test('gate flags a hidden failure only on added lines and accepts a silent-ok marker', (t) => {
  const { root, put, commit } = repo(t)
  put('old.ts', 'export function old() {\n  try {\n    x()\n  } catch {}\n}\n')
  put('new.ts', CLEAN)
  commit('base')
  put(
    'new.ts',
    CLEAN + 'export function b() {\n  try {\n    y()\n  } catch {\n    return null\n  }\n}\n',
  )
  put('fresh.ts', '// the loader silently skips a bad record\nexport const n = 1\n')
  let result = runGate(root, parseArgs(['--base', 'HEAD']))
  assert.deepEqual(
    result.findings.map((f) => [f.file, f.line, f.rule]),
    [
      ['fresh.ts', 1, 'weasel-word'],
      ['new.ts', 11, 'silent-catch'],
    ],
  )
  assert.match(result.text, /2 finding\(s\)/)
  put(
    'new.ts',
    CLEAN +
      'export function b() {\n  try {\n    y()\n  } catch {\n    // silent-ok: probe result is optional\n    return null\n  }\n}\n',
  )
  put(
    'fresh.ts',
    '// silent-ok: test fixture\n// the loader silently skips a bad record\nexport const n = 1\n',
  )
  result = runGate(root, parseArgs(['--base', 'HEAD']))
  assert.deepEqual(result.findings, [])
  assert.match(result.text, /No hidden-failure patterns/)
})

test('gate fails on ast-grep operational errors and includes stderr', (t) => {
  const { root, put, commit } = repo(t)
  put('a.ts', CLEAN)
  commit('base')
  put('a.ts', `${CLEAN}export const changed = true\n`)
  assert.throws(
    () =>
      runGate(root, parseArgs(['--base', 'HEAD']), {
        config: join(root, 'missing-sgconfig.yml'),
      }),
    (error) => {
      assert.match(error.message, /ast-grep scan failed with exit code \d+/)
      assert.match(error.message, /Cannot read configuration/)
      return true
    },
  )
})

test('staged mode checks the index and ignores unstaged edits', (t) => {
  const { root, git, put, commit } = repo(t)
  put('a.ts', CLEAN)
  commit('base')
  put('a.ts', CLEAN + 'p.catch(() => {})\n')
  git('add', 'a.ts')
  put('a.ts', CLEAN + 'p.catch(() => {})\nq.catch(() => null)\n')
  const result = runGate(root, parseArgs(['--staged']))
  assert.deepEqual(
    result.findings.map((f) => [f.line, f.rule]),
    [[8, 'noop-promise-catch']],
  )
})

test('staged mode scans staged blobs instead of working-tree bytes', (t) => {
  const { root, git, put, commit } = repo(t)
  put('a.ts', CLEAN)
  commit('base')
  put('a.ts', `${CLEAN}p.catch(() => {})\n`)
  git('add', 'a.ts')
  put('a.ts', `${CLEAN}export const workingTreeOnly = true\n`)
  const result = runGate(root, parseArgs(['--staged']))
  assert.deepEqual(
    result.findings.map((f) => [f.line, f.rule]),
    [[8, 'noop-promise-catch']],
  )
})

test('gate catches a finding that starts before its added offending line', (t) => {
  const { root, put, commit } = repo(t)
  put(
    'a.ts',
    'export function a() {\n  try {\n    return x()\n  } catch {\n    const substitute = null\n  }\n}\n',
  )
  commit('base')
  put(
    'a.ts',
    'export function a() {\n  try {\n    return x()\n  } catch {\n    const substitute = null\n    return substitute\n  }\n}\n',
  )
  const result = runGate(root, parseArgs(['--base', 'HEAD']))
  assert.deepEqual(
    result.findings.map((f) => [f.line, f.endLine, f.rule]),
    [[4, 7, 'silent-catch']],
  )
})

test('all mode reports pre-existing findings across tracked files', (t) => {
  const { root, put, commit } = repo(t)
  put('old.ts', 'export function old() {\n  try {\n    x()\n  } catch {}\n}\n')
  commit('base')
  const result = runGate(root, parseArgs(['--all']))
  assert.deepEqual(
    result.findings.map((f) => [f.file, f.line, f.rule]),
    [['old.ts', 4, 'empty-catch']],
  )
})
