import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve, relative, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

// Raised from 260 kB on 2026-09-10 at the calibration Phase 0 gate: the entry measured
// 335 kB gzip (336 kB before Phase 0). Raised to 364 kB on 2026-09-15 at the Phase 4 gate:
// the entry measured 360.3 kB after the saved-run package moved out of persist.ts; the
// optimize request wiring in the store and analysisRequests is the remaining addition.
// Raised to 365 kB on 2026-09-22: the column-buffer track ledger in retainTrial.ts added
// 682 bytes and the entry measured 364.4 kB. Held here until the engine additions load lazily.
// Raised to 366 kB on 2026-09-23 at the Row B design gate by the user: the board ink, icons
// and floating surfaces put the merged entry at 365.7 kB.
// Raised to 367 kB on 2026-09-23 at the polish follow-up gate by the user: the board ink
// fields, the hover release and the degenerate-range refusal put the entry at 366.2 kB.
// Raised to 368 kB on 2026-09-24 at the Row B chrome gate by the user: the status bar, the
// top-bar run control, the popovers and the always-mounted playback loop put the entry at
// 367,008 after the Row B removals paid for the rest.
export const BUNDLE_BUDGET = { entry: 368_000, initial: 400_000 }

// Match the Wave 3 evidence method: entry + modulepreloaded JS + initial CSS.
// Report other preloads separately so the total transfer is also visible.
export function measureBundle(directory) {
  const root = resolve(directory)
  const html = readFileSync(resolve(root, 'index.html'), 'utf8')
  const entries = new Set()
  const initial = new Set()
  const preloads = new Set()
  for (const tag of html.matchAll(/<(script|link)\b[^>]*>/gi)) {
    const attrs = Object.fromEntries(
      [...tag[0].matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map((match) => [
        match[1].toLowerCase(),
        match[2] ?? match[3],
      ]),
    )
    const rels = (attrs.rel ?? '').toLowerCase().split(/\s+/)
    if (tag[1].toLowerCase() === 'script' && attrs.src) {
      entries.add(attrs.src)
      initial.add(attrs.src)
    }
    if (tag[1].toLowerCase() !== 'link' || !attrs.href) continue
    if (rels.includes('stylesheet') || rels.includes('modulepreload')) initial.add(attrs.href)
    if (rels.includes('preload')) {
      if (['script', 'style'].includes(attrs.as)) initial.add(attrs.href)
      else preloads.add(attrs.href)
    }
  }
  if (entries.size !== 1) throw new Error(`Expected one built entry script; found ${entries.size}`)
  const files = new Map()
  const measure = (url) => {
    if (/^(?:[a-z][\w+.-]*:|\/\/)/i.test(url))
      throw new Error(`Cannot measure external initial asset: ${url}`)
    const file = resolve(root, decodeURIComponent(url.split(/[?#]/, 1)[0]).replace(/^\//, ''))
    const name = relative(root, file)
    if (name === '..' || name.startsWith(`..${sep}`)) throw new Error(`Asset outside dist: ${url}`)
    if (!files.has(name)) {
      const bytes = execFileSync('gzip', ['-9', '-c'], { input: readFileSync(file) }).length
      files.set(name, bytes)
    }
    return name
  }
  const initialFiles = new Set([...initial].map(measure))
  const preloadFiles = new Set([...preloads].map(measure).filter((file) => !initialFiles.has(file)))
  const total = (names) => [...names].reduce((sum, name) => sum + files.get(name), 0)
  const entryFile = measure([...entries][0])
  const initialBytes = total(initialFiles)
  const preloadBytes = total(preloadFiles)
  return {
    entryFile,
    entryBytes: files.get(entryFile),
    initialBytes,
    preloadBytes,
    allBytes: initialBytes + preloadBytes,
    files: [...files].map(([file, gzipBytes]) => ({ file, gzipBytes })),
  }
}

export function budgetFailures(result, budget = BUNDLE_BUDGET) {
  return [
    result.entryBytes > budget.entry &&
      `Entry exceeds ${budget.entry} bytes gzip-9: ${result.entryBytes}`,
    result.initialBytes > budget.initial &&
      `Initial JavaScript + CSS exceeds ${budget.initial} bytes gzip-9: ${result.initialBytes}`,
  ].filter(Boolean)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = measureBundle(process.argv[2] ?? 'dist')
    console.log(JSON.stringify(result, null, 2))
    const failures = budgetFailures(result)
    if (failures.length) throw new Error(failures.join('\n'))
    console.log(
      `Bundle budget passed: entry <= ${BUNDLE_BUDGET.entry / 1000} kB; initial JavaScript + CSS <= ${BUNDLE_BUDGET.initial / 1000} kB (gzip -9).`,
    )
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
