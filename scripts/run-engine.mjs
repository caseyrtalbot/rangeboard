// Headless engine runner. Runs a fixed replicate count on a scenario JSON over
// a worker_threads pool and writes a RunRecord.
//   npm run engine -- <scenario.json> --replicates 10000 --seed 4821 --out run.json
//     [--workers N] [--uncertainty aleatory|total] [--label text]
// Builds dist-engine/ (npm run engine:build) when the bundle is missing.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { availableParallelism } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { Worker } from 'node:worker_threads'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ENGINE = resolve(ROOT, 'dist-engine/engine.js')
const WORKER = resolve(ROOT, 'scripts/engine-worker.mjs')

const HELP = `Usage: npm run engine -- <scenario.json> [options]

Runs the replicate count it is given and stops there: the half-width rule
is off (targetHalfWidth null) on every CLI run.

Options:
  --replicates N          replicate count (default: the scenario's own)
  --seed N                Monte Carlo seed (default: the scenario's own)
  --uncertainty MODE      aleatory | total (default: the scenario's own)
  --workers N             threads in the pool (default: every core)
  --label TEXT            record label (default: cli)
  --out FILE              RunRecord path (default: run.json)
  --help                  this text
`

/** Build the Node bundle when it is missing. */
export function ensureBundle() {
  if (existsSync(ENGINE)) return
  execFileSync('npm', ['run', 'engine:build'], { cwd: ROOT, stdio: 'inherit' })
}

function integer(value, name) {
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1) throw new Error(`--${name} must be a positive integer, got ${value}`)
  return n
}

/** Split 0..n into ranges the pool hands out; several per thread so a slow thread evens out. */
export function chunkRanges(replicates, workers) {
  const size = Math.max(1, Math.ceil(replicates / (workers * 4)))
  const ranges = []
  for (let start = 0; start < replicates; start += size) ranges.push([start, Math.min(start + size, replicates)])
  return ranges
}

/** Run every range on a pool of `workers` threads; resolves with the partials in any order. */
function runPool(scenario, ranges, workers) {
  return new Promise((resolvePool, reject) => {
    const queue = [...ranges]
    const partials = []
    const threads = []
    let failed = false
    const finish = () => {
      for (const t of threads) t.postMessage({ type: 'close' })
      resolvePool(partials)
    }
    const fail = (error) => {
      if (failed) return
      failed = true
      for (const t of threads) t.terminate()
      reject(error instanceof Error ? error : new Error(String(error)))
    }
    const feed = (thread) => {
      const next = queue.shift()
      if (next) thread.postMessage({ type: 'range', start: next[0], end: next[1] })
      else if (partials.length === ranges.length) finish()
    }
    for (let w = 0; w < Math.min(workers, ranges.length); w += 1) {
      const thread = new Worker(WORKER, { workerData: { scenario } })
      threads.push(thread)
      thread.on('message', (reply) => {
        if (reply.type === 'error') return fail(new Error(reply.message))
        partials.push(reply.partial)
        feed(thread)
      })
      thread.on('error', fail)
      thread.on('exit', (code) => { if (code !== 0 && !failed) fail(new Error(`worker exited with code ${code}`)) })
      feed(thread)
    }
  })
}

/** The scenario with the CLI's run settings applied. */
export function applyRunFlags(scenario, flags) {
  const out = { ...scenario, targetHalfWidth: null, runMode: 'monte-carlo' }
  if (flags.seed != null) out.seed = integer(flags.seed, 'seed')
  if (flags.replicates != null) out.replicates = integer(flags.replicates, 'replicates')
  if (flags.uncertainty != null) {
    if (flags.uncertainty !== 'aleatory' && flags.uncertainty !== 'total') {
      throw new Error(`--uncertainty must be aleatory or total, got ${flags.uncertainty}`)
    }
    out.uncertainty = flags.uncertainty
  }
  return out
}

export async function main(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      replicates: { type: 'string' },
      seed: { type: 'string' },
      uncertainty: { type: 'string' },
      workers: { type: 'string' },
      label: { type: 'string' },
      out: { type: 'string', default: 'run.json' },
      help: { type: 'boolean', default: false },
    },
  })
  if (values.help || positionals.length !== 1) {
    process.stdout.write(HELP)
    return values.help ? 0 : 2
  }
  ensureBundle()
  const engine = await import(pathToFileURL(ENGINE).href)
  const scenario = applyRunFlags(engine.parseScenarioJson(readFileSync(resolve(positionals[0]), 'utf8')), values)
  const { replicates, seed } = engine.runSettings(scenario)
  const workers = values.workers ? integer(values.workers, 'workers') : availableParallelism()

  // The retained numbers: the same budget the browser worker applies, so a
  // record the CLI writes is one the browser could have produced.
  engine.assertSummaryFits(scenario, engine.DEFAULT_BUDGET)
  const perReplicate = engine.summaryNumbers(scenario) / 7
  const budget = engine.DEFAULT_BUDGET.retainedNumbers
  if (perReplicate * replicates > budget) {
    throw new Error(
      `${replicates} replicates would retain ${(perReplicate * replicates).toLocaleString()} numbers, over the budget of ` +
        `${budget.toLocaleString()}. The largest count that fits is ${Math.floor(budget / perReplicate)}.`,
    )
  }

  const t0 = performance.now()
  const partials = await runPool(scenario, chunkRanges(replicates, workers), workers)
  const merged = engine.mergePartials(partials)
  const wallMs = performance.now() - t0
  const mc = engine.finishSummary(scenario, merged, { rule: 'replicates', at: replicates }, wallMs)

  const runId = crypto.randomUUID()
  const basisSignature = engine.analysisBasisSignature(scenario)
  const record = {
    id: runId,
    savedAt: new Date().toISOString(),
    label: values.label ?? 'cli',
    manifest: engine.createRunManifest(scenario, runId, basisSignature, { producer: 'cli' }),
    scenario,
    scenarioHash: basisSignature,
    mc,
    sensitivity: null,
  }
  const out = resolve(values.out)
  mkdirSync(dirname(out), { recursive: true })
  // JSON turns NaN into null, the same mapping the browser's saved summaries use.
  writeFileSync(out, JSON.stringify(record, null, 2))

  const last = mc.leakers.mean.length - 1
  const fmt = (x) => (Number.isFinite(x) ? x.toFixed(3) : 'undefined')
  process.stdout.write(
    `replicates ${replicates}  seed ${seed}  workers ${workers}  wall ${(wallMs / 1000).toFixed(1)} s  ` +
      `leakers ${fmt(mc.leakers.mean[last])} [${fmt(mc.leakers.lo[last])}, ${fmt(mc.leakers.hi[last])}]  ${out}\n`,
  )
  return 0
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(
    (code) => { process.exitCode = code },
    (error) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
      process.exitCode = 1
    },
  )
}
