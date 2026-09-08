import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Scenario } from '../model/types'
import { emptyScenario } from '../model/seed'
import { useStore } from '../state/store'
import type { TeState } from '../te/model/types'
import { emptyCampaign } from '../te/model/empty'
import { useTeStore } from '../te/state/teStore'
import { teAutosaveAdapter } from '../te/io/persistTe'
import type { BaselineSave } from './persist'
import { baselineAutosaveAdapter, scenarioAutosaveAdapter } from './persist'
import type { Autosave, AutosaveAdapter } from './autosave'
import { createAutosave } from './autosave'
import { BASELINE_RECOVERY_PREFIX, BOARD_BASELINE, SCENARIO_KEY, SCENARIO_RECOVERY_PREFIX, TE_KEY, TE_RECOVERY_PREFIX } from './storageKeys'
import { runReplicates } from '../playback/mcRun'
import { buildBaseline } from '../state/baseline'
import { IDLE_MC } from '../state/runState'
import { allowAutosave, assertAutosaveAllowed, dismissRecoveryNotice, getRecoveryNotices } from './recovery'

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
    alert: vi.fn(), addEventListener, removeEventListener,
    setTimeout: (callback: () => void) => { timers.set(++nextTimer, callback); return nextTimer },
    clearTimeout: (id?: number) => { if (id !== undefined) timers.delete(id) },
  })
  vi.stubGlobal('document', { visibilityState: 'hidden', addEventListener, removeEventListener })
  return {
    events,
    scheduled: () => timers.size,
    runTimers: () => { const due = [...timers.values()]; timers.clear(); due.forEach(callback => callback()) },
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

const te: Lane<TeState> = {
  adapter: teAutosaveAdapter,
  key: TE_KEY,
  prefix: TE_RECOVERY_PREFIX,
  raw: (label) => JSON.stringify({ schemaVersion: 1, campaigns: [emptyCampaign(label, 'CAMP')], activeCampaignId: null }),
  corrupt: JSON.stringify({ schemaVersion: 1, campaigns: [{ cards: null }] }),
  edit: (label) => { useTeStore.getState().createCampaign(label, 'CAMP') },
  held: () => useTeStore.getState().campaigns.at(-1)?.name,
  written: (raw) => (JSON.parse(raw) as TeState).campaigns.at(-1)!.name,
  status: () => useTeStore.getState().saveError,
}

/** A finished ensemble on the empty scenario: its undefined statistics round-trip as null. */
const summary = runReplicates({ ...emptyScenario(), replicates: 1 })
const baseline: Lane<BaselineSave> = {
  adapter: baselineAutosaveAdapter,
  key: BOARD_BASELINE,
  prefix: BASELINE_RECOVERY_PREFIX,
  raw: (label) => JSON.stringify({ schemaVersion: 1, baseline: buildBaseline(emptyScenario(), summary, 'hash', label) }),
  corrupt: JSON.stringify({ schemaVersion: 1, baseline: { ...buildBaseline(emptyScenario(), summary, 'hash', 'bad'), mc: { ...summary, kills: null } } }),
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
  it(`T&E ${what}`, () => run(te))
  it(`Baseline ${what}`, () => run(baseline))
}

/** Every instance is restored first: the T&E lane admits no write before that. */
function started<R>(lane: Lane<R>): Autosave<R> {
  const autosave = createAutosave(lane.adapter)
  running.push(autosave)
  autosave.restore()
  autosave.observe()
  return autosave
}

afterEach(() => {
  running.splice(0).forEach(autosave => autosave.stop())
  getRecoveryNotices().forEach(notice => dismissRecoveryNotice(notice.id))
  allowAutosave(SCENARIO_KEY); allowAutosave(TE_KEY); allowAutosave(BOARD_BASELINE)
  useStore.setState({ baseline: null, mc: IDLE_MC, save: { lastAutosaveAt: null, error: null } })
  vi.restoreAllMocks(); vi.unstubAllGlobals()
})

describe('autosave lifecycle', () => {
  eachLane('restores the saved record once, and a new instance restores again', (lane) => {
    storage({ [lane.key]: lane.raw('restored') }); browser()
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
    lane.edit('first'); lane.edit('second'); lane.edit('last')
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
    const { data } = storage({ [lane.key]: original }, key => key === lane.key)
    const timers = browser()
    started(lane)
    lane.edit('cannot save')
    timers.runTimers()
    expect(data.get(lane.key)).toBe(original)
    expect(lane.status()).toContain('Storage unavailable')
  })

  it('admits no T&E write before the restore, so an untouched store cannot overwrite a saved record', () => {
    const saved = te.raw('saved')
    const { data, setItem } = storage({ [TE_KEY]: saved })
    const timers = browser()
    const autosave = createAutosave(teAutosaveAdapter)
    running.push(autosave)
    autosave.observe()
    te.edit('before restore')
    expect(timers.scheduled()).toBe(0)
    expect(setItem).not.toHaveBeenCalled()
    autosave.restore()
    // The adoption itself is not an edit: it must not schedule a write either.
    expect(timers.scheduled()).toBe(0)
    te.edit('after restore')
    timers.runTimers()
    expect(te.written(data.get(TE_KEY)!)).toBe('after restore')
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
    expect(createAutosave(baselineAutosaveAdapter).read()).toEqual({ schemaVersion: 1, baseline: null })
  })

  it('restores a baseline whose undefined statistics were saved as null, as NaN', () => {
    storage({ [BOARD_BASELINE]: baseline.raw('nan') }); browser()
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
    const { data } = storage({ [BOARD_BASELINE]: baseline.raw('saved') }, key => failing && key === BOARD_BASELINE)
    const timers = browser()
    useStore.getState().setSaveState(1234, null)
    started(baseline)
    baseline.edit('cannot save')
    timers.runTimers()
    expect(useStore.getState().save).toEqual({ lastAutosaveAt: 1234, error: expect.stringContaining('Baseline not saved') })
    failing = false
    baseline.edit('saved now')
    timers.runTimers()
    expect(baseline.written(data.get(BOARD_BASELINE)!)).toBe('saved now')
    expect(useStore.getState().save).toEqual({ lastAutosaveAt: 1234, error: null })
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
      const { data } = storage({ [lane.key]: raw }, key => key.startsWith(lane.prefix))
      browser()
      expect(createAutosave(lane.adapter).read()).toBeNull()
      expect(data.get(lane.key)).toBe(raw)
      expect(() => assertAutosaveAllowed(lane.key)).toThrow('preserve')
      expect(getRecoveryNotices().at(-1)?.message).toContain('autosave is paused')
      expect(window.alert).not.toHaveBeenCalled()
    }
  })

  eachLane('suppresses later writes after a failed recovery', (lane) => {
    const raw = lane.corrupt
    const { data } = storage({ [lane.key]: raw }, key => key.startsWith(lane.prefix))
    const timers = browser()
    started(lane)
    lane.edit('after recovery failure')
    timers.runTimers()
    expect(data.get(lane.key)).toBe(raw)
    expect(lane.status()).toContain('preserve')
  })

  eachLane('fails closed after a denied read', (lane) => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new DOMException('Denied', 'SecurityError') } })
    browser()
    expect(createAutosave(lane.adapter).read()).toBeNull()
    expect(() => assertAutosaveAllowed(lane.key)).toThrow('could not be read')
    expect(lane.status()).toContain('could not be read')
  })
})
