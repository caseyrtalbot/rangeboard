// One thread of the headless runner's pool (scripts/run-engine.mjs). The main
// thread starts it with the scenario in workerData, then posts replicate
// ranges; each range runs replicateRangeLoop to its end and the McPartial goes
// back by structured clone, which keeps NaN. A throw goes back as a message so
// the pool can stop every thread.
import { parentPort, workerData } from 'node:worker_threads'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const { replicateRangeLoop } = await import(pathToFileURL(resolve(import.meta.dirname, '../dist-engine/engine.js')).href)

/** Run start..end-1 on this thread. */
export function runRange(scenario, start, end) {
  const loop = replicateRangeLoop(scenario, start, end)
  let next = loop.next()
  while (!next.done) next = loop.next()
  return next.value
}

const { scenario } = workerData
parentPort.on('message', (request) => {
  if (request.type === 'close') {
    parentPort.close()
    return
  }
  try {
    const partial = runRange(scenario, request.start, request.end)
    parentPort.postMessage({ type: 'partial', start: request.start, end: request.end, partial })
  } catch (error) {
    parentPort.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) })
  }
})
