import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyScenario } from '../../../model/seed'
import type {
  BandSeries,
  McSummary,
  SensitivityResponseStat,
  SensitivitySummary,
  Stat,
  SweepSummary,
} from '../../../playback/mcRun'
import { SENSITIVITY_RESPONSES } from '../../../playback/mcRun'
import { MORRIS_FIXTURE, SOBOL_FIXTURE } from '../../../charts/__fixtures__/sobolFixture'
import { IDLE_MC, IDLE_SENSITIVITY, IDLE_SWEEP } from '../../../state/runState'
import { useStore } from '../../../state/store'
import { FragilityScreen } from './FragilityScreen'

const interaction = vi.hoisted(() => ({
  cursor: 0,
  states: [] as unknown[],
  buttons: new Map<string, { disabled?: boolean; onClick: () => void }>(),
  fields: new Map<string, (event: { target: { value: string } }) => void>(),
}))
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return {
    ...actual,
    useState: (initial: unknown) => {
      const index = interaction.cursor++
      if (!(index in interaction.states))
        interaction.states[index] = typeof initial === 'function' ? initial() : initial
      return [
        interaction.states[index],
        (value: unknown) => {
          interaction.states[index] = value
        },
      ]
    },
  }
})
vi.mock('react/jsx-dev-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react/jsx-dev-runtime')>()
  const jsxDEV: typeof actual.jsxDEV = (type, props, ...rest) => {
    const p = props as {
      children?: unknown
      disabled?: boolean
      onClick?: () => void
      label?: string
    }
    if (type === 'button' && typeof p.children === 'string' && p.onClick)
      interaction.buttons.set(p.children, { disabled: p.disabled, onClick: p.onClick })
    if (typeof type === 'function' && type.name === 'Field') {
      const child = p.children as {
        props?: { onChange?: (event: { target: { value: string } }) => void }
      }
      if (p.label && child?.props?.onChange) interaction.fields.set(p.label, child.props.onChange)
    }
    return actual.jsxDEV(type, props, ...rest)
  }
  return { ...actual, jsxDEV }
})

const band = (value: number): BandSeries => ({
  mean: [0, value],
  lo: [0, value - 0.2],
  hi: [0, value + 0.2],
  p10: [],
  p90: [],
  p025: [],
  p975: [],
})
const stat = (value: number): Stat => ({
  mean: value,
  sd: 1,
  se: 0.1,
  lo: value - 1,
  hi: value + 1,
  conf: 0.95,
  interval: 't',
  p10: 0,
  p90: 0,
  p025: 0,
  p975: 0,
  n: 40,
  total: 40,
  defined: { p: 1, lo: 0.9, hi: 1 },
})
function mcSummary(): McSummary {
  return {
    seed: 123,
    replicates: 40,
    durationS: 60,
    elapsedMs: 2000,
    stopped: { rule: 'replicates', at: 40 },
    kills: band(3),
    leakers: band(1),
    detected: band(4),
    tracked: band(4),
    engaged: band(4),
    firstDetectS: stat(10),
    firmTrackS: stat(12),
    minWarningS: stat(20),
    perEffector: {},
    perThreat: {
      threat: {
        killed: stat(3),
        leaked: stat(1),
        firstDetectS: stat(10),
        arrivalS: 45,
        shipCount: 4,
        residual: band(1),
      },
    },
  }
}
function sensitivitySummary(): SensitivitySummary {
  const responses = (swing: number, kills: number) =>
    Object.fromEntries(
      SENSITIVITY_RESPONSES.map((r) => [
        r,
        {
          lo: 1,
          hi: 1 + (r === 'kills' ? kills : swing),
          swing: r === 'kills' ? kills : swing,
          se: 0.12,
          defined: { lo: { p: 0.75, lo: 0.6, hi: 0.85 }, hi: { p: 0.9, lo: 0.8, hi: 0.97 } },
        } satisfies SensitivityResponseStat,
      ]),
    ) as NonNullable<SensitivitySummary['rows'][number]['responses']>
  return {
    stat: 'leakers',
    nominal: 1,
    replicates: 40,
    seed: 123,
    elapsedMs: 1000,
    rows: [
      {
        modelId: 'lib-coyote',
        field: 'pk',
        label: 'Coyote',
        low: 0,
        high: 99,
        swing: 99,
        se: 99,
        responses: responses(1, 4),
      },
      {
        modelId: 'lib-mavic3',
        field: 'rcsM2',
        label: 'Mavic',
        low: 0,
        high: 88,
        swing: 88,
        se: 88,
        responses: responses(3, 2),
      },
    ],
  }
}
function sweepSummary(): SweepSummary {
  const s = mcSummary()
  return {
    factors: [{ id: 'threatAltitudeFt', values: [100, 200] }],
    responses: [...SENSITIVITY_RESPONSES],
    replicatesPerCell: 40,
    seed: 123,
    elapsedMs: 8000,
    cells: [0, 1].map((i) => ({
      index: [i],
      values: [100 + 100 * i],
      summary: {
        kills: s.kills,
        leakers: s.leakers,
        firstDetectS: s.firstDetectS,
        minWarningS: s.minWarningS,
        perEffector: {},
        replicates: 40,
      },
    })),
  }
}
function installResults() {
  const runId = useStore.getState().playback.runId
  useStore.setState({
    mc: {
      ...IDLE_MC,
      status: 'done',
      runId,
      summary: mcSummary(),
      sensitivity: { ...IDLE_SENSITIVITY, status: 'done', runId, summary: sensitivitySummary() },
      sweep: { ...IDLE_SWEEP, status: 'done', runId, summary: sweepSummary() },
    },
  })
}
function render() {
  interaction.cursor = 0
  interaction.buttons.clear()
  interaction.fields.clear()
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<FragilityScreen />)
}
function change(label: string, value: string) {
  expect(interaction.fields.has(label)).toBe(true)
  interaction.fields.get(label)!({ target: { value } })
  return render()
}
function grid() {
  render()
  change('Column values · 2–6, comma-separated', '100,200,300,400,500')
  return change('Row values · 2–6, comma-separated', '10,20,30,40')
}

describe('FragilityScreen', () => {
  beforeEach(() => {
    interaction.states = []
    const scenario = emptyScenario()
    scenario.runMode = 'monte-carlo'
    scenario.entities.push({
      id: 'asset',
      name: 'Asset',
      kind: 'asset',
      specId: null,
      pos: { x: 0, y: 0 },
      headingDeg: 0,
      color: null,
      notes: '',
    })
    useStore.getState().replaceScenario(scenario)
    useStore.setState({ mc: IDLE_MC })
  })

  it('offers one no-ensemble line, run actions and a disabled pin without an ensemble', () => {
    const start = vi.fn()
    useStore.setState({ runMonteCarlo: start })
    const html = render()
    expect(html).toContain('Monte Carlo · No current ensemble result.')
    expect(html.match(/>Run Monte Carlo</g)).toHaveLength(1)
    expect(html).not.toContain('class="tile"')
    expect(html).toContain('no rate yet')
    expect(html).toContain(
      'disabled="" title="Pin this laydown and ensemble for Compare">Pin as baseline',
    )
    interaction.buttons.get('Run Monte Carlo')!.onClick()
    expect(start).toHaveBeenCalledOnce()
    expect(html).toContain('Run sensitivity · Morris then Sobol')
    expect(html).toContain('Morris screening, then Sobol indices on the fields it keeps')
  })

  it('mounts the Sobol chart on the Morris and Sobol results of the current sensitivity run', () => {
    const runId = useStore.getState().playback.runId
    const done = { ...IDLE_SENSITIVITY, status: 'done' as const, runId }
    useStore.setState({
      mc: { ...IDLE_MC, sensitivity: done, morris: MORRIS_FIXTURE, sobol: SOBOL_FIXTURE },
    })
    const html = render()
    expect(html).toContain('data-sensitivity-widget="sobol"')
    expect(html).toContain('4 fields ranked by the total index')
    expect(html).toContain('kept 4 for Sobol')
    // No one-at-a-time summary: no rows and no paired-replicate sentence.
    expect(html).not.toContain('data-sensitivity-row=')
    expect(html).not.toContain('paired replicates')
    // A stale sensitivity run withholds both results.
    useStore.setState({
      mc: { ...useStore.getState().mc, sensitivity: { ...done, status: 'stale' } },
    })
    expect(render()).not.toContain('data-sensitivity-widget=')
  })

  it('names the stage on the running line under the full depth', () => {
    const runId = useStore.getState().playback.runId
    const running = {
      ...IDLE_SENSITIVITY,
      status: 'running' as const,
      runId,
      progress: 7,
      total: 70,
    }
    useStore.setState({ mc: { ...IDLE_MC, sensitivity: running } })
    expect(render()).toContain('7 of 70 evaluations · Morris screening')
    useStore.setState({
      mc: {
        ...IDLE_MC,
        sensitivity: { ...running, progress: 3, total: 1536 },
        morris: MORRIS_FIXTURE,
      },
    })
    const html = render()
    expect(html).toContain('3 of 1536 evaluations · Sobol on 4 fields')
    expect(html).toContain('data-sensitivity-widget="morris"')
    useStore.getState().patchScenario({ sensitivityDepth: 'quick' })
    useStore.setState({ mc: { ...IDLE_MC, sensitivity: { ...running, progress: 1, total: 2 } } })
    expect(render()).toContain('1 of 2 fields')
  })

  it('passes the selected response to the sensitivity launch', () => {
    const start = vi.fn()
    useStore.setState({ runSensitivity: start })
    render()
    change('Sensitivity response', 'kills')
    interaction.buttons.get('Run sensitivity · Morris then Sobol')!.onClick()
    expect(start).toHaveBeenCalledWith('kills')
  })

  it('names the quick depth in the sensitivity button and the sentence above it', () => {
    useStore.getState().patchScenario({ sensitivityDepth: 'quick' })
    const html = render()
    expect(html).toContain('Run sensitivity · one-at-a-time')
    expect(html).toContain('One-at-a-time at p10 and p90')
    expect(html).not.toContain('Morris screening')
  })

  it('renders the current tiles, own intervals, map, ranked responses and validity rows', () => {
    installResults()
    const html = render()
    expect(html.match(/class="tile"/g)).toHaveLength(3)
    expect(html).toContain('3<small>/4 members')
    expect(html).toContain('1<small>/4 members')
    expect(html).toContain('2.8 to 3.2 (95% mean CI)')
    expect(html).toContain('20<small> s')
    expect(html).toContain('warning time in 40 of 40')
    expect(html.match(/by T\+1:00/g)).toHaveLength(3)
    expect(html.match(/data-sweep-cell=/g)).toHaveLength(2)
    expect(html.indexOf('data-sensitivity-row="rcsM2"')).toBeLessThan(
      html.indexOf('data-sensitivity-row="pk"'),
    )
    expect(html).toContain('width:100%')
    expect(html).not.toContain('99 members')
    expect(html).toContain('class="validity-finding"')
    const rows = html
      .slice(html.indexOf('<section aria-label="Validity">'))
      .split('class="validity-finding"')
      .slice(1)
    expect(rows.length).toBeGreaterThan(0)
    rows.forEach((row) => expect((row.match(/<summary>|<button /g) ?? []).length).toBe(1))
  })

  it('changes response ranking and preserves conditional definedness for times', () => {
    installResults()
    render()
    const kills = change('Sensitivity response', 'kills')
    expect(kills.indexOf('data-sensitivity-row="pk"')).toBeLessThan(
      kills.indexOf('data-sensitivity-row="rcsM2"'),
    )
    const times = change('Sensitivity response', 'firstDetectS')
    expect(times).toContain('conditional on defined times')
    expect(times).toContain('75.0% [60.0%, 85.0%]')
    expect(times).toContain('SE 0.12')
  })

  it.each(['stale', 'running', 'error'] as const)(
    'withholds %s results and never substitutes legacy sensitivity aliases',
    (status) => {
      installResults()
      const mc = useStore.getState().mc
      useStore.setState({
        mc: {
          ...mc,
          status,
          sweep: { ...mc.sweep, status },
          sensitivity: { ...mc.sensitivity, status },
        },
      })
      const html = render()
      expect(html).not.toContain('class="tile"')
      expect(html).not.toContain('data-sensitivity-row=')
      expect(html).not.toContain('data-sweep-cell=')
    },
  )

  it('submits a 5 × 4 sweep and paints completion counts while results are pending', () => {
    const start = vi.fn()
    const cancel = vi.fn()
    useStore.setState({ runSweep: start, cancelSweep: cancel })
    expect(grid()).toContain('20 cells')
    expect(interaction.buttons.get('Run sweep')!.disabled).toBe(false)
    interaction.buttons.get('Run sweep')!.onClick()
    expect(start).toHaveBeenCalledWith({
      factors: [
        { id: 'threatAltitudeFt', values: [100, 200, 300, 400, 500] },
        { id: 'threatSpeedMps', values: [10, 20, 30, 40] },
      ],
      replicatesPerCell: 40,
      responses: [...SENSITIVITY_RESPONSES],
    })
    const state = useStore.getState()
    useStore.setState({
      mc: {
        ...state.mc,
        sweep: {
          ...IDLE_SWEEP,
          runId: state.playback.runId,
          status: 'running',
          progress: 7,
          total: 20,
        },
      },
    })
    const html = render()
    expect(html.match(/data-tone="complete"/g)).toHaveLength(7)
    expect(html).toContain('7 of 20 cells complete')
    expect(interaction.buttons.get('Run sweep')!.disabled).toBe(true)
    interaction.buttons.get('Cancel sweep')!.onClick()
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('blocks invalid picker values, duplicate factors and more than six values', () => {
    grid()
    for (const value of ['100', '100,100', '100,NaN', '1,2,3,4,5,6,7', '-1,2']) {
      change('Column values · 2–6, comma-separated', value)
      expect(interaction.buttons.get('Run sweep')!.disabled).toBe(true)
    }
    change('Column values · 2–6, comma-separated', '100,200')
    change('Row factor', 'threatAltitudeFt')
    change('Row values · 2–6, comma-separated', '100,200')
    expect(interaction.buttons.get('Run sweep')!.disabled).toBe(true)
  })

  it.each(['mc', 'sweep'] as const)(
    'estimates a grid from the retained %s measurement',
    (source) => {
      installResults()
      if (source === 'mc')
        useStore.setState({ mc: { ...useStore.getState().mc, sweep: IDLE_SWEEP } })
      expect(grid()).toContain(
        `Estimated time: ${source === 'mc' ? 40 : 80} s at ${source === 'mc' ? 20 : 10} replicates/s`,
      )
    },
  )

  it('keeps undefined warning and missing response data unavailable', () => {
    installResults()
    const mc = useStore.getState().mc
    useStore.setState({
      mc: {
        ...mc,
        summary: { ...mc.summary!, minWarningS: { ...stat(0), mean: NaN, n: 0 } },
        sensitivity: {
          ...mc.sensitivity,
          summary: {
            ...mc.sensitivity.summary!,
            rows: mc.sensitivity.summary!.rows.map((row) => ({ ...row, responses: undefined })),
          },
        },
      },
    })
    const html = render()
    expect(html).toContain('warning time in 0 of 40')
    expect(html).toContain('Response unavailable; run sensitivity again.')
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('99 members')
  })
})
