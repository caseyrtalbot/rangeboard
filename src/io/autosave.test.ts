import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Scenario } from '../model/types'
import { emptyScenario } from '../model/seed'
import { useOverrides } from '../state/overrides'
import { useStore } from '../state/store'
import type { BaselineSave } from './persist'
import { baselineAutosaveAdapter, scenarioAutosaveAdapter } from './persist'
import { overridesAutosaveAdapter } from './persistOverrides'
import type { Autosave, AutosaveAdapter } from './autosave'
import { createAutosave } from './autosave'
import {
  BASELINE_RECOVERY_PREFIX,
  BOARD_BASELINE,
  OVERRIDES_KEY,
  SCENARIO_KEY,
  SCENARIO_RECOVERY_PREFIX,
} from './storageKeys'
import { runReplicates } from '../playback/mcRun'
import { buildBaseline } from '../state/baseline'
import { IDLE_MC } from '../state/runState'
import {
  allowAutosave,
  assertAutosaveAllowed,
  dismissRecoveryNotice,
  getRecoveryNotices,
} from './recovery'

function storage(initial: Record<string, string> = {}, fail?: (key: string) => boolean) {
  const data = new Map(Object.entries(initial))
  const setItem = vi.fn((key: string, value: string) => {
    if (fail?.(key)) throw new DOMException('Storage unavailable', 'QuotaExceededError')
    data.set(key, value)
  })
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem })
  return { data, setItem }
}

/** Browser stand-ins whose timer queue actually runs, so the debounce is testable. */
function browser() {
  const events = new Map<string, () => void>()
  const timers = new Map<number, () => void>()
  let nextTimer = 0
  const addEventListener = (key: string, callback: () => void) => events.set(key, callback)
  const removeEventListener = (key: string) => events.delete(key)
  vi.stubGlobal('window', {
    alert: vi.fn(),
    addEventListener,
    removeEventListener,
    setTimeout: (callback: () => void) => {
      timers.set(++nextTimer, callback)
      return nextTimer
    },
    clearTimeout: (id?: number) => {
      if (id !== undefined) timers.delete(id)
    },
  })
  vi.stubGlobal('document', { visibilityState: 'hidden', addEventListener, removeEventListener })
  return {
    events,
    scheduled: () => timers.size,
    runTimers: () => {
      const due = [...timers.values()]
      timers.clear()
      due.forEach((callback) => callback())
    },
  }
}

/** One store's fixtures: what it saves, how it is edited and where its status lands. */
interface Lane<R> {
  adapter: AutosaveAdapter<R>
  key: string
  prefix: string
  /** A valid saved record carrying `label`. */
  raw: (label: string) => string
  /** Valid JSON the parser rejects. */
  corrupt: string
  /** One store edit the subscription must see. */
  edit: (label: string) => void
  /** The label the store holds now. */
  held: () => string | undefined
  /** The label a written record carries. */
  written: (raw: string) => string
  status: () => string | null
}

const board: Lane<Scenario> = {
  adapter: scenarioAutosaveAdapter,
  key: SCENARIO_KEY,
  prefix: SCENARIO_RECOVERY_PREFIX,
  raw: (label) => JSON.stringify({ ...emptyScenario(), name: label }),
  corrupt: JSON.stringify({ ...emptyScenario(), entities: null }),
  edit: (label) => useStore.getState().setScenarioName(label),
  held: () => useStore.getState().scenario.name,
  written: (raw) => (JSON.parse(raw) as Scenario).name,
  status: () => useStore.getState().save.error,
}

/** A finished ensemble on the empty scenario: its undefined statistics round-trip as null. */
const summary = runReplicates({ ...emptyScenario(), replicates: 1 })
const baseline: Lane<BaselineSave> = {
  adapter: baselineAutosaveAdapter,
  key: BOARD_BASELINE,
  prefix: BASELINE_RECOVERY_PREFIX,
  raw: (label) =>
    JSON.stringify({
      schemaVersion: 1,
      baseline: buildBaseline(emptyScenario(), summary, 'hash', label),
    }),
  corrupt: JSON.stringify({
    schemaVersion: 1,
    baseline: {
      ...buildBaseline(emptyScenario(), summary, 'hash', 'bad'),
      mc: { ...summary, kills: null },
    },
  }),
  edit: (label) => {
    const st = useStore.getState()
    useStore.setState({ mc: { ...IDLE_MC, status: 'done', runId: st.playback.runId, summary } })
    st.pinBaseline(label)
  },
  held: () => useStore.getState().baseline?.label,
  written: (raw) => (JSON.parse(raw) as BaselineSave).baseline!.label,
  status: () => useStore.getState().save.error,
}

const running: Autosave<unknown>[] = []

/** Run one lifecycle case against every adapter. Each lane keeps its own record type. */
function eachLane(what: string, run: <R>(lane: Lane<R>) => void): void {
  it(`Board ${what}`, () => run(board))
  it(`Baseline ${what}`, () => run(baseline))
}

/** Every instance is restored first, then observed. */
function started<R>(lane: Lane<R>): Autosave<R> {
  const autosave = createAutosave(lane.adapter)
  running.push(autosave)
  autosave.restore()
  autosave.observe()
  return autosave
}

afterEach(() => {
  running.splice(0).forEach((autosave) => autosave.stop())
  getRecoveryNotices().forEach((notice) => dismissRecoveryNotice(notice.id))
  allowAutosave(SCENARIO_KEY)
  allowAutosave(BOARD_BASELINE)
  allowAutosave(OVERRIDES_KEY)
  overridesAutosaveAdapter.reportSaved()
  useOverrides.setState({ overrides: [] })
  useStore.setState({ baseline: null, mc: IDLE_MC, save: { lastAutosaveAt: null, error: null } })
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('autosave lifecycle', () => {
  eachLane('restores the saved record once, and a new instance restores again', (lane) => {
    storage({ [lane.key]: lane.raw('restored') })
    browser()
    const first = createAutosave(lane.adapter)
    expect(first.restore()).not.toBeNull()
    expect(lane.held()).toBe('restored')
    expect(first.restore()).toBeNull()
    expect(createAutosave(lane.adapter).restore()).not.toBeNull()
  })

  eachLane('debounces a burst of edits into one write', (lane) => {
    const { data, setItem } = storage({ [lane.key]: lane.raw('original') })
    const timers = browser()
    started(lane)
    lane.edit('first')
    lane.edit('second')
    lane.edit('last')
    expect(lane.written(data.get(lane.key)!)).toBe('original')
    expect(timers.scheduled()).toBe(1)
    timers.runTimers()
    expect(setItem).toHaveBeenCalledOnce()
    expect(lane.written(data.get(lane.key)!)).toBe('last')
    expect(lane.status()).toBeNull()
  })

  eachLane('flushes the pending edit on hide and on unload', (lane) => {
    for (const event of ['pagehide', 'visibilitychange']) {
      const { data } = storage({ [lane.key]: lane.raw('original') })
      const timers = browser()
      const autosave = started(lane)
      lane.edit(`before ${event}`)
      timers.events.get(event)!()
      expect(lane.written(data.get(lane.key)!)).toBe(`before ${event}`)
      expect(timers.scheduled()).toBe(0)
      autosave.stop()
    }
  })

  eachLane('keeps the previous record and reports a failed write', (lane) => {
    const original = lane.raw('original')
    const { data } = storage({ [lane.key]: original }, (key) => key === lane.key)
    const timers = browser()
    started(lane)
    lane.edit('cannot save')
    timers.runTimers()
    expect(data.get(lane.key)).toBe(original)
    expect(lane.status()).toContain('Storage unavailable')
  })

  it('writes a cleared baseline as null under the same key, so a pending pin cannot outlive a clear', () => {
    const { data } = storage({ [BOARD_BASELINE]: baseline.raw('saved') })
    const timers = browser()
    started(baseline)
    expect(baseline.held()).toBe('saved')
    baseline.edit('replaced')
    useStore.getState().clearBaseline()
    timers.runTimers()
    expect(JSON.parse(data.get(BOARD_BASELINE)!)).toEqual({ schemaVersion: 1, baseline: null })
    expect(createAutosave(baselineAutosaveAdapter).read()).toEqual({
      schemaVersion: 1,
      baseline: null,
    })
  })

  it('restores a baseline whose undefined statistics were saved as null, as NaN', () => {
    storage({ [BOARD_BASELINE]: baseline.raw('nan') })
    browser()
    expect(baseline.raw('nan')).toContain('"mean":null')
    createAutosave(baselineAutosaveAdapter).restore()
    const restored = useStore.getState().baseline!
    expect(Number.isNaN(restored.mc.firstDetectS.mean)).toBe(true)
    expect(restored.mc).toEqual(summary)
    expect(restored.scenario.schemaVersion).toBe(1)
    expect(restored.scenarioHash).toBe('hash')
  })

  it('keeps the scenario stamp and clears only a baseline write error after the next baseline write', () => {
    let failing = true
    const { data } = storage(
      { [BOARD_BASELINE]: baseline.raw('saved') },
      (key) => failing && key === BOARD_BASELINE,
    )
    const timers = browser()
    useStore.getState().setSaveState(1234, null)
    started(baseline)
    baseline.edit('cannot save')
    timers.runTimers()
    expect(useStore.getState().save).toEqual({
      lastAutosaveAt: 1234,
      error: expect.stringContaining('Baseline not saved'),
    })
    failing = false
    baseline.edit('saved now')
    timers.runTimers()
    expect(baseline.written(data.get(BOARD_BASELINE)!)).toBe('saved now')
    expect(useStore.getState().save).toEqual({ lastAutosaveAt: 1234, error: null })
  })

  it('keeps another lane save error when the scenario writes, and clears only its own', () => {
    storage(
      { [SCENARIO_KEY]: board.raw('original'), [BOARD_BASELINE]: baseline.raw('saved') },
      (key) => key === BOARD_BASELINE,
    )
    const timers = browser()
    started(baseline)
    started(board)
    baseline.edit('cannot save')
    timers.runTimers()
    expect(useStore.getState().save.error).toContain('Baseline not saved')
    board.edit('nudge')
    timers.runTimers()
    expect(useStore.getState().save.lastAutosaveAt).toEqual(expect.any(Number))
    expect(useStore.getState().save.error).toContain('Baseline not saved')
  })

  it('clears its own error when the scenario writes again', () => {
    storage({ [SCENARIO_KEY]: board.raw('original') })
    const timers = browser()
    started(board)
    useStore.getState().setSaveState(1234, 'Not saved: storage error. Export the scenario.')
    board.edit('saved now')
    timers.runTimers()
    expect(useStore.getState().save.error).toBeNull()
  })

  it('a pause fills an empty status and leaves another lane error', () => {
    const message = 'Autosave paused: browser storage could not be read.'
    for (const adapter of [
      scenarioAutosaveAdapter,
      baselineAutosaveAdapter,
      overridesAutosaveAdapter,
    ]) {
      useStore.getState().setSaveState(1234, 'Baseline not saved: quota')
      adapter.reportPaused(message)
      expect(useStore.getState().save).toEqual({
        lastAutosaveAt: 1234,
        error: 'Baseline not saved: quota',
      })
      useStore.getState().setSaveState(1234, null)
      adapter.reportPaused(message)
      expect(useStore.getState().save.error).toBe(message)
    }
  })

  it('retries a failed overrides write on the next scenario edit', () => {
    const saved = {
      modelId: 'lib-giraffe1x',
      field: 'detectRangeM',
      value: 1,
      reason: 'site survey',
      date: '2026-09-10T00:00:00.000Z',
    }
    let failing = true
    const { data } = storage(
      { [OVERRIDES_KEY]: JSON.stringify({ overrides: [saved] }) },
      (key) => failing && key === OVERRIDES_KEY,
    )
    const timers = browser()
    const autosave = createAutosave(overridesAutosaveAdapter)
    running.push(autosave)
    autosave.restore()
    autosave.observe()
    useOverrides.getState().setOverride('lib-giraffe1x', 'detectRangeM', 2, 'retry me')
    timers.runTimers()
    expect(JSON.parse(data.get(OVERRIDES_KEY)!).overrides[0].value).toBe(1)
    expect(timers.scheduled()).toBe(0)
    expect(useStore.getState().save.error).toContain('Overrides not saved')
    failing = false
    useStore.getState().setScenarioName('nudge')
    timers.runTimers()
    expect(JSON.parse(data.get(OVERRIDES_KEY)!).overrides[0].value).toBe(2)
    expect(useStore.getState().save.error).toBeNull()
  })

  it('retries a failed baseline write on the next scenario edit, without a new pin', () => {
    let failing = true
    const { data } = storage(
      { [SCENARIO_KEY]: board.raw('original'), [BOARD_BASELINE]: baseline.raw('saved') },
      (key) => failing && key === BOARD_BASELINE,
    )
    const timers = browser()
    started(baseline)
    baseline.edit('pinned under quota')
    timers.runTimers()
    expect(baseline.written(data.get(BOARD_BASELINE)!)).toBe('saved')
    // Reporting the failure must not schedule its own retry.
    expect(timers.scheduled()).toBe(0)
    failing = false
    board.edit('unrelated edit')
    timers.runTimers()
    expect(baseline.written(data.get(BOARD_BASELINE)!)).toBe('pinned under quota')
    expect(useStore.getState().save.error).toBeNull()
  })

  eachLane('writes nothing after a stop', (lane) => {
    const original = lane.raw('original')
    const { data } = storage({ [lane.key]: original })
    const timers = browser()
    const autosave = started(lane)
    lane.edit('dropped')
    autosave.stop()
    timers.runTimers()
    expect(timers.events.has('pagehide')).toBe(false)
    expect(data.get(lane.key)).toBe(original)
  })
})

describe('autosave read failures', () => {
  eachLane('retains an unreadable record and pauses autosave when recovery fails', (lane) => {
    for (const raw of ['', '{partial', lane.corrupt]) {
      const { data } = storage({ [lane.key]: raw }, (key) => key.startsWith(lane.prefix))
      browser()
      expect(createAutosave(lane.adapter).read()).toBeNull()
      expect(data.get(lane.key)).toBe(raw)
      expect(() => assertAutosaveAllowed(lane.key)).toThrow('preserve')
      expect(getRecoveryNotices().at(-1)?.message).toContain('autosave is paused')
      expect(window.alert).not.toHaveBeenCalled()
    }
  })

  eachLane('resumes after a failed rescue and keeps the later edit', (lane) => {
    let failing = true
    const raw = lane.corrupt
    const { data } = storage({ [lane.key]: raw }, (key) => failing && key.startsWith(lane.prefix))
    const timers = browser()
    started(lane)
    lane.edit('held back')
    timers.runTimers()
    expect(data.get(lane.key)).toBe(raw)
    failing = false
    lane.edit('written after')
    timers.runTimers()
    expect(lane.written(data.get(lane.key)!)).toBe('written after')
    const rescues = [...data.keys()].filter((key) => key.startsWith(lane.prefix))
    expect(rescues).toHaveLength(1)
    expect(data.get(rescues[0]!)).toBe(raw)
  })

  eachLane('suppresses later writes after a failed recovery', (lane) => {
    const raw = lane.corrupt
    const { data } = storage({ [lane.key]: raw }, (key) => key.startsWith(lane.prefix))
    const timers = browser()
    started(lane)
    lane.edit('after recovery failure')
    timers.runTimers()
    expect(data.get(lane.key)).toBe(raw)
    expect(lane.status()).toContain('preserve')
  })

  eachLane('fails closed after a denied read', (lane) => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new DOMException('Denied', 'SecurityError')
      },
    })
    browser()
    expect(createAutosave(lane.adapter).read()).toBeNull()
    expect(() => assertAutosaveAllowed(lane.key)).toThrow('could not be read')
    expect(lane.status()).toContain('could not be read')
  })
})
