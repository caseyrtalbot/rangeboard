import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import { runReplicates } from '../playback/mcRun'
import { analysisBasisSignature } from './analysisBasis'
import { buildBaseline, defaultBaselineLabel, validateMcSummary } from './baseline'
import { IDLE_MC } from './runState'
import { useStore } from './store'

/** A real summary with undefined statistics: no threat, so every time Stat has n = 0 and NaN. */
const summary = runReplicates({ ...emptyScenario(), replicates: 2, seed: 3, targetHalfWidth: null })
const persisted = () => JSON.parse(JSON.stringify(summary)) as Record<string, unknown>

describe('validateMcSummary', () => {
  it('restores NaN from null and keeps every other field', () => {
    expect(Number.isNaN(summary.firstDetectS.mean)).toBe(true)
    const raw = persisted()
    expect((raw.firstDetectS as { mean: unknown }).mean).toBeNull()
    const restored = validateMcSummary(raw)
    expect(restored).toEqual(summary)
    expect(Number.isNaN(restored.firstDetectS.mean)).toBe(true)
    expect(restored.kills.mean).toHaveLength(summary.kills.mean.length)
  })

  it.each([
    ['a string mean', (r: Record<string, unknown>) => { (r.minWarningS as { mean: unknown }).mean = '4' }, 'mc.minWarningS.mean: expected a finite number or null'],
    ['a missing series', (r: Record<string, unknown>) => { delete (r.leakers as Record<string, unknown>).p90 }, 'mc.leakers.p90: expected an array'],
    ['a series of another length', (r: Record<string, unknown>) => { (r.tracked as { hi: number[] }).hi = [0] }, 'mc.tracked.hi: expected'],
    ['an unknown interval method', (r: Record<string, unknown>) => { (r.firmTrackS as { interval: unknown }).interval = 'bootstrap' }, 'mc.firmTrackS.interval: expected one of'],
    ['an unknown stop rule', (r: Record<string, unknown>) => { (r.stopped as { rule: unknown }).rule = 'crash' }, 'mc.stopped.rule: expected one of'],
    ['a reserved threat id', (r: Record<string, unknown>) => { (r.perThreat as Record<string, unknown>)['constructor' as string] = {} }, 'mc.perThreat.constructor: reserved or empty ID'],
    ['n above total', (r: Record<string, unknown>) => { (r.firstDetectS as { n: number }).n = 5 }, 'mc.firstDetectS.n: expected 0 <= n <= total'],
    ['a null replicate count', (r: Record<string, unknown>) => { r.replicates = null }, 'mc.replicates: expected a finite number'],
  ])('rejects %s with its path', (_what, corrupt, message) => {
    const raw = persisted()
    corrupt(raw)
    expect(() => validateMcSummary(raw)).toThrow(message)
  })

  it('keeps a null arrival as null, not NaN', () => {
    const raw = persisted()
    ;(raw.perThreat as Record<string, unknown>).t1 = { ...JSON.parse(JSON.stringify({
      killed: summary.firstDetectS, leaked: summary.firstDetectS, firstDetectS: summary.firstDetectS, arrivalS: null, shipCount: 2, residual: summary.kills,
    })) }
    expect(validateMcSummary(raw).perThreat.t1.arrivalS).toBeNull()
  })
})

describe('buildBaseline', () => {
  it('labels with the scenario name and the pin time unless a label is given', () => {
    const scenario = { ...emptyScenario(), name: 'Camp Able' }
    const pinnedAt = '2026-09-08T14:05:00.000Z'
    const baseline = buildBaseline(scenario, summary, 'hash', undefined, pinnedAt)
    expect(baseline.label).toBe(defaultBaselineLabel('Camp Able', pinnedAt))
    expect(baseline.label.startsWith('Camp Able · ')).toBe(true)
    expect(buildBaseline(scenario, summary, 'hash', ' Reference ', pinnedAt).label).toBe('Reference')
    expect(defaultBaselineLabel('  ', pinnedAt).startsWith('Untitled · ')).toBe(true)
  })
})

describe('store baseline actions', () => {
  beforeEach(() => { Object.assign(useStore.getInitialState(), useStore.getState()) })
  afterEach(() => { useStore.setState({ baseline: null, mc: IDLE_MC }) })

  function done(overrides: Partial<typeof IDLE_MC> = {}) {
    const st = useStore.getState()
    useStore.setState({ mc: { ...IDLE_MC, status: 'done', runId: st.playback.runId, summary, basisSignature: analysisBasisSignature(st.scenario), ...overrides } })
  }

  it('pins the current scenario and summary with the basis signature', () => {
    done()
    useStore.getState().pinBaseline()
    const { baseline, scenario } = useStore.getState()
    expect(baseline?.scenario).toBe(scenario)
    expect(baseline?.mc).toBe(summary)
    expect(baseline?.scenarioHash).toBe(analysisBasisSignature(scenario))
    expect(Number.isFinite(Date.parse(baseline!.pinnedAt))).toBe(true)
    useStore.getState().clearBaseline()
    expect(useStore.getState().baseline).toBeNull()
  })

  it.each([
    ['no run', () => useStore.setState({ mc: IDLE_MC })],
    ['a running ensemble', () => done({ status: 'running' })],
    ['a stale ensemble', () => done({ status: 'stale' })],
    ['another run id', () => done({ runId: 'other-run' })],
    ['another basis', () => done({ basisSignature: 'other-basis' })],
  ])('is a no-op with %s', (_what, arrange) => {
    arrange()
    useStore.getState().pinBaseline('ignored')
    expect(useStore.getState().baseline).toBeNull()
  })

  it('never writes the baseline into the scenario or history', () => {
    done()
    const { scenario, past } = useStore.getState()
    useStore.getState().pinBaseline()
    expect(useStore.getState().scenario).toBe(scenario)
    expect(useStore.getState().past).toBe(past)
    expect('baseline' in useStore.getState().scenario).toBe(false)
  })
})
