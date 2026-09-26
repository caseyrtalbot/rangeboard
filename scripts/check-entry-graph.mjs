import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { format } from 'prettier'
import ts from 'typescript'

// The entry chunk is every module `src/main.tsx` reaches through static value imports.
// This check freezes the heavy part of that set: the npm packages and the modules under
// the guarded prefixes in `entry-graph.json` (engine, analysis, charts, analysis panels,
// generated data). A shell file may import another shell file freely. A guarded module
// or a package that reaches the entry for the first time fails the check; so does a
// frozen entry that no longer reaches it. Run with `--write` to record a deliberate
// change, and name the reason in the commit.
//
// The check reads source, not `dist/`, so it needs no build and runs inside
// `npm run check`. Dynamic `import()` and `new Worker(new URL(...))` are not followed:
// they are the chunk boundaries this check protects.

const SOURCE_EXTENSIONS = ['.ts', '.tsx']

function scriptKind(file) {
  return file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
}

function valueSpecifiers(sourceFile) {
  const specifiers = []
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause
      if (clause?.isTypeOnly) continue
      if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings) && !clause.name) {
        const elements = clause.namedBindings.elements
        if (elements.length && elements.every((element) => element.isTypeOnly)) continue
      }
      specifiers.push(statement.moduleSpecifier.text)
    } else if (ts.isExportDeclaration(statement) && statement.moduleSpecifier) {
      if (statement.isTypeOnly) continue
      const clause = statement.exportClause
      if (clause && ts.isNamedExports(clause) && clause.elements.every((e) => e.isTypeOnly))
        continue
      specifiers.push(statement.moduleSpecifier.text)
    } else if (
      ts.isImportEqualsDeclaration(statement) &&
      ts.isExternalModuleReference(statement.moduleReference)
    ) {
      specifiers.push(statement.moduleReference.expression.text)
    }
  }
  return specifiers
}

function resolveRelative(fromFile, specifier) {
  const base = resolve(dirname(fromFile), specifier)
  const candidates = [base]
  for (const extension of SOURCE_EXTENSIONS) {
    candidates.push(base + extension, resolve(base, 'index' + extension))
    if (base.endsWith('.js')) candidates.push(base.slice(0, -3) + extension)
  }
  return candidates.find((candidate) => {
    try {
      return statSync(candidate).isFile()
    } catch {
      return false
    }
  })
}

function packageName(specifier) {
  const parts = specifier.split('/')
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}

export function walkEntry(root, entry) {
  const rootDir = resolve(root)
  const modules = new Set()
  const packages = new Set()
  const queue = [resolve(rootDir, entry)]
  while (queue.length) {
    const file = queue.pop()
    const name = relative(rootDir, file).split(sep).join('/')
    if (modules.has(name)) continue
    modules.add(name)
    if (!SOURCE_EXTENSIONS.some((extension) => file.endsWith(extension))) continue
    const sourceFile = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      false,
      scriptKind(file),
    )
    for (const specifier of valueSpecifiers(sourceFile)) {
      if (specifier.includes('?')) continue
      if (specifier.startsWith('.') || specifier.startsWith('/')) {
        if (specifier.endsWith('.css')) continue
        const target = resolveRelative(file, specifier)
        if (!target) throw new Error(`Cannot resolve ${specifier} from ${name}`)
        queue.push(target)
      } else {
        packages.add(packageName(specifier))
      }
    }
  }
  return {
    modules: [...modules].sort(),
    packages: [...packages].sort(),
  }
}

export function guardedModules(result, config) {
  return result.modules.filter((module) =>
    config.guarded.some((prefix) =>
      prefix.endsWith('/') ? module.startsWith(prefix) : module === prefix,
    ),
  )
}

export function graphFailures(result, config) {
  const guarded = guardedModules(result, config)
  const failures = []
  const diff = (label, actual, frozen) => {
    for (const item of actual)
      if (!frozen.includes(item))
        failures.push(`${label} reaches the entry and is not frozen: ${item}`)
    for (const item of frozen)
      if (!actual.includes(item))
        failures.push(`${label} is frozen but no longer reaches the entry: ${item}`)
  }
  diff('Package', result.packages, config.packages)
  diff('Guarded module', guarded, config.modules)
  return failures
}

export function readConfig(file) {
  return JSON.parse(readFileSync(file, 'utf8'))
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const configFile = resolve('scripts/entry-graph.json')
  const config = readConfig(configFile)
  const result = walkEntry('.', config.entry)
  const guarded = guardedModules(result, config)
  if (process.argv.includes('--write')) {
    const next = { ...config, packages: result.packages, modules: guarded }
    writeFileSync(configFile, await format(JSON.stringify(next), { parser: 'json' }))
    console.log(
      `Entry graph frozen: ${result.packages.length} packages, ${guarded.length} guarded modules of ${result.modules.length} reachable.`,
    )
  } else {
    const failures = graphFailures(result, config)
    if (failures.length) {
      console.error(failures.join('\n'))
      console.error(
        `\nA new import moves code into the entry chunk. Remove the edge, load the module through import(), or run \`node scripts/check-entry-graph.mjs --write\` and name the reason in the commit.`,
      )
      process.exitCode = 1
    } else {
      console.log(
        `Entry graph passed: ${result.packages.length} packages, ${guarded.length} guarded modules of ${result.modules.length} reachable.`,
      )
    }
  }
}
