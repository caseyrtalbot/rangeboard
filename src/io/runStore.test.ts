import { beforeEach, describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import { createRunManifest } from '../model/runRecord'
import type { RunRecord } from '../model/runRecord'
import { runReplicates } from '../playback/mcRun'
import { createFakeIndexedDb } from './fakeIndexedDb'
import { clearRuns, deleteRun, getRun, listRuns, saveRun } from './runStore'

const scenario = { ...emptyScenario(), name: 'Camp Able', replicates: 2, seed: 3 }
/** No threat, so every time Stat has n = 0 and NaN: the record carries undefined statistics. */
const summary = runReplicates(scenario)

/** Equal-length ids and labels keep the saved records the same size for the cap test. */
function record(id: string, savedAt: string): RunRecord {
  return {
    id,
    savedAt,
    label: `Run ${id}`,
    manifest: createRunManifest(scenario, `sim-${id}`, 'basis'),
    scenario,
    scenarioHash: 'basis',
    mc: summary,
    sensitivity: null,
  }
}

let factory = createFakeIndexedDb()
const options = () => ({ factory })

describe('runStore', () => {
  beforeEach(() => {
    factory = createFakeIndexedDb()
  })

  it('round-trips a record through save, list and get, restoring NaN statistics', async () => {
    expect(Number.isNaN(summary.firstDetectS.mean)).toBe(true)
    expect(await saveRun(record('run-a', '2026-09-10T10:00:00.000Z'), options())).toEqual({
      evicted: [],
    })
    const listed = await listRuns(options())
    expect(listed).toHaveLength(1)
    expect(listed[0].label).toBe('Run run-a')
    expect(listed[0].seed).toBe(3)
    expect(listed[0].replicates).toBe(2)
    expect(listed[0].scenarioName).toBe('Camp Able')
    expect(listed[0].bytes).toBeGreaterThan(0)
    const loaded = await getRun('run-a', options())
    expect(loaded).not.toBeNull()
    expect(Number.isNaN(loaded!.mc.firstDetectS.mean)).toBe(true)
    expect(loaded!.mc).toEqual(summary)
    expect(loaded!.manifest).toEqual(record('run-a', '2026-09-10T10:00:00.000Z').manifest)
    expect(await getRun('run-missing', options())).toBeNull()
  })

  it('lists newest first', async () => {
    await saveRun(record('run-a', '2026-09-10T10:00:00.000Z'), options())
    await saveRun(record('run-b', '2026-09-10T11:00:00.000Z'), options())
    expect((await listRuns(options())).map((run) => run.id)).toEqual(['run-b', 'run-a'])
  })

  it('evicts oldest first until the new record fits the cap', async () => {
    await saveRun(record('run-a', '2026-09-10T10:00:00.000Z'), options())
    const bytes = (await listRuns(options()))[0].bytes
    // Room for two records only: the third save evicts the oldest.
    const capBytes = bytes * 2
    await saveRun(record('run-b', '2026-09-10T11:00:00.000Z'), { factory, capBytes })
    expect((await listRuns(options())).map((run) => run.id)).toEqual(['run-b', 'run-a'])
    const third = await saveRun(record('run-c', '2026-09-10T12:00:00.000Z'), { factory, capBytes })
    expect(third).toEqual({ evicted: ['run-a'] })
    expect((await listRuns(options())).map((run) => run.id)).toEqual(['run-c', 'run-b'])
    expect(await getRun('run-a', options())).toBeNull()
  })

  it('refuses a record larger than the cap', async () => {
    await expect(
      saveRun(record('run-a', '2026-09-10T10:00:00.000Z'), { factory, capBytes: 10 }),
    ).rejects.toThrow('the run store holds 10')
  })

  it('deletes one record and clears every record', async () => {
    await saveRun(record('run-a', '2026-09-10T10:00:00.000Z'), options())
    await saveRun(record('run-b', '2026-09-10T11:00:00.000Z'), options())
    await deleteRun('run-a', options())
    expect((await listRuns(options())).map((run) => run.id)).toEqual(['run-b'])
    await clearRuns(options())
    expect(await listRuns(options())).toEqual([])
  })

  it('reports a clear error without IndexedDB', async () => {
    expect(globalThis.indexedDB).toBeUndefined()
    await expect(listRuns()).rejects.toThrow(
      'Run history is unavailable: this browser provides no IndexedDB.',
    )
    await expect(saveRun(record('run-a', '2026-09-10T10:00:00.000Z'))).rejects.toThrow(
      'provides no IndexedDB',
    )
  })
})
