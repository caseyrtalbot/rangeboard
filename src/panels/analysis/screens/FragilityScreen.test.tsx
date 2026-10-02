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
import { FieldHelpProvider } from '../../../ui/kit'
import { FragilityScreen } from './FragilityScreen'

type Handler = (event: {
  key?: string
  target: { value: string }
  preventDefault: () => void
}) => void
const interaction = vi.hoisted(() => ({
  cursor: 0,
  states: [] as unknown[],
  buttons: new Map<string, { disabled?: boolean; onClick: () => void }>(),
  fields: new Map<string, Handler>(),
  keys: new Map<string, Handler>(),
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
      onChange?: Handler
      onKeyDown?: Handler
      label?: string
      name?: string
      'aria-label'?: string
    }
    if (type === 'button' && p.onClick) {
      const entry = { disabled: p.disabled, onClick: p.onClick }
      if (typeof p.children === 'string') interaction.buttons.set(p.children, entry)
      if (p['aria-label']) interaction.buttons.set(p['aria-label'], entry)
    }
    if ((type === 'select' || type === 'input') && p.name) {
      if (p.onChange) interaction.fields.set(p.name, p.onChange)
      if (p.onKeyDown) interaction.keys.set(p.name, p.onKeyDown)
    }
    if (typeof type === 'function' && type.name === 'Field') {
      const child = p.children as { props?: { onChange?: Handler } }
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
function render(help = false) {
  interaction.cursor = 0
  interaction.buttons.clear()
  interaction.fields.clear()
  interaction.keys.clear()
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(
    <FieldHelpProvider value={help}>
      <FragilityScreen />
    </FieldHelpProvider>,
  )
}
const event = (value: string, key?: string) => ({ key, target: { value }, preventDefault() {} })
function change(label: string, value: string) {
  expect(interaction.fields.has(label)).toBe(true)
  interaction.fields.get(label)!(event(value))
  return render()
}
function click(label: string) {
  expect(interaction.buttons.has(label)).toBe(true)
  interaction.buttons.get(label)!.onClick()
  return render()
}
/** Type a value in a factor's add box and press Enter. */
function addValue(axis: 'A' | 'B', value: string) {
  change(`add-${axis}`, value)
  interaction.keys.get(`add-${axis}`)!(event(value, 'Enter'))
  return render()
}
const section = (html: string, title: string) => {
  const from = html.indexOf(`<h3 class="psec-title">${title}</h3>`)
  const to = html.indexOf('<section class="psec', from)
  return html.slice(from, to < 0 ? undefined : to)
}
function manyRows(n: number): SensitivitySummary {
  const base = sensitivitySummary()
  const template = base.rows[0]
  return {
    ...base,
    rows: Array.from({ length: n }, (_, i) => ({
      ...template,
      field: `field${i}`,
      responses: Object.fromEntries(
        SENSITIVITY_RESPONSES.map((r) => [r, { ...template.responses!.leakers, swing: i + 1 }]),
      ) as typeof template.responses,
    })),
  }
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
    useStore.setState({ mc: IDLE_MC, ui: { ...useStore.getState().ui, showFieldHelp: false } })
  })

  it('names the top-bar Run for an empty ensemble, pins from the head and draws the empty grid', () => {
    const html = render()
    expect(html).toContain('No ensemble for this setup. Press Run (⌘↵) in the top bar to run it.')
    // The top-bar Run runs the ensemble; the screen has no run, cancel or progress line for it.
    expect(html).not.toContain('Run Monte Carlo<')
    expect(html).not.toContain('Cancel Monte Carlo')
    expect(html).not.toContain('replicates</span>')
    expect(html).toContain('disabled="" title="Run Monte Carlo first to pin a baseline.">Pin<')
    expect(html).toContain('12 cells · 40 runs each</span>')
    expect(html.match(/class="sweep-cell blank"/g)).toHaveLength(12)
    expect(html).toContain('Run sweep to fill')
    expect(html).toContain('>Run sensitivity</button>')
    expect(html).toContain(
      'aria-label="About sensitivity" title="Method: Morris then Sobol. Morris screening, then Sobol indices on the fields it keeps."',
    )
    // The Validity line carries findings and the missing asset; the screen repeats neither.
    expect(html).not.toContain('Validity')
    expect(html).not.toContain('Place asset')
    expect(html).not.toContain('class="primary"')
    // Screen titles no longer repeat the tab name.
    expect(html).not.toContain('<h3>Fragility</h3>')
  })

  it('offers one Measure select and falls back to Kills without a defended asset', () => {
    useStore.getState().replaceScenario({ ...emptyScenario(), runMode: 'monte-carlo' })
    installResults()
    const html = render()
    expect(html.match(/<select/g)?.length).toBe(3) // Measure, Factor A, Factor B
    expect(html).toContain(
      '<option value="leakers" disabled="">Leakers (members) · needs asset</option>',
    )
    expect(html).toContain(
      '<option value="minWarningS" disabled="">Min warning (s) · needs asset</option>',
    )
    expect(html).toContain('<option value="kills" selected="">Kills (members)</option>')
    expect(html).toContain('<tr class="on" data-ensemble-row="kills"')
    expect(html).toMatch(
      /data-ensemble-row="leakers" title="Unavailable without a defended asset"><td>Leakers<\/td><td>— <\/td><td class="r2b-dim">needs asset/,
    )
    // With an asset the default Leakers returns.
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
    installResults()
    expect(render()).toContain('<tr class="on" data-ensemble-row="leakers"')
  })

  it('lets the Measure drive the ranking, the map and the sensitivity launch', () => {
    const start = vi.fn()
    installResults()
    useStore.setState({ runSensitivity: start })
    const leakers = render()
    expect(leakers.indexOf('data-sensitivity-row="rcsM2"')).toBeLessThan(
      leakers.indexOf('data-sensitivity-row="pk"'),
    )
    expect(leakers).toContain('aria-label="Sweep map · Leakers (members)"')
    const kills = change('Measure', 'kills')
    expect(kills.indexOf('data-sensitivity-row="pk"')).toBeLessThan(
      kills.indexOf('data-sensitivity-row="rcsM2"'),
    )
    expect(kills).toContain('aria-label="Sweep map · Kills (members)"')
    expect(kills).toContain('<tr class="on" data-ensemble-row="kills"')
    click('Run again')
    expect(start).toHaveBeenCalledWith('kills')
  })

  it('names the response a full-depth result ran on when the Measure differs', () => {
    const runId = useStore.getState().playback.runId
    const done = { ...IDLE_SENSITIVITY, status: 'done' as const, runId }
    useStore.setState({ mc: { ...IDLE_MC, sensitivity: done, morris: MORRIS_FIXTURE } })
    expect(section(render(), 'Sensitivity')).not.toContain('ran on')
    const kills = section(change('Measure', 'kills'), 'Sensitivity')
    expect(kills).toContain('ran on leakers</span>')
  })

  it('shows the moved sentences as help lines with field help on', () => {
    useStore.setState({ ui: { ...useStore.getState().ui, showFieldHelp: true } })
    const html = render(true)
    expect(html).toContain('<p class="field-help">Run Monte Carlo first to pin a baseline.</p>')
    expect(html).toContain(
      '<span class="field-help">One measure drives the ensemble focus, the sweep map and the sensitivity ranking.</span>',
    )
    expect(html).toContain(
      '<p class="field-help">Planning-factor values. Each cell is a 40-replicate run of the full scenario.',
    )
    expect(html).toContain(
      '<p class="field-help">Method: Morris then Sobol. Morris screening, then Sobol indices on the fields it keeps.</p>',
    )
  })

  it('mounts the Sobol chart above the rows on the results of the current sensitivity run', () => {
    const runId = useStore.getState().playback.runId
    const done = { ...IDLE_SENSITIVITY, status: 'done' as const, runId }
    useStore.setState({
      mc: { ...IDLE_MC, sensitivity: done, morris: MORRIS_FIXTURE, sobol: SOBOL_FIXTURE },
    })
    const html = render()
    expect(html).toContain('data-sensitivity-widget="sobol"')
    expect(html).toContain('4 fields ranked by the total index')
    expect(html).toContain('kept 4 for Sobol')
    expect(html).not.toContain('data-sensitivity-row=')
    expect(html).not.toContain('paired runs · seed')
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
    expect(html).not.toContain('worker budget')
    expect(html).toContain('data-sensitivity-widget="morris"')
    useStore.getState().patchScenario({ sensitivityDepth: 'quick' })
    useStore.setState({ mc: { ...IDLE_MC, sensitivity: { ...running, progress: 1, total: 2 } } })
    expect(render()).toContain('1 of 2 fields')
  })

  it('names the Sobol row count before the first progress and warns when that count can use most of the worker budget', () => {
    const runId = useStore.getState().playback.runId
    const running = {
      ...IDLE_SENSITIVITY,
      status: 'running' as const,
      runId,
      progress: 0,
      total: 1536,
    }
    useStore.setState({ mc: { ...IDLE_MC, sensitivity: running, morris: MORRIS_FIXTURE } })
    const quiet = render()
    expect(quiet).toContain('0 of 1536 evaluations · Sobol on 4 fields')
    expect(quiet).not.toContain('worker budget')
    const one = useStore.getState().scenario.entities[0]
    useStore.setState({
      scenario: {
        ...useStore.getState().scenario,
        entities: Array.from({ length: 29 }, (_, i) => ({ ...one, id: `budget-ent-${i}` })),
      },
      mc: {
        ...IDLE_MC,
        sensitivity: { ...running, total: 2048 },
        morris: { ...MORRIS_FIXTURE, kept: [0, 1, 2, 3, 4, 5] },
      },
    })
    expect(render()).toContain(
      '0 of 2048 evaluations · Sobol on 6 fields · this count can use most of the 10 min worker budget',
    )
  })

  it('names the quick depth in the sensitivity (i) title', () => {
    useStore.getState().patchScenario({ sensitivityDepth: 'quick' })
    const html = render()
    expect(html).toContain('title="Method: one-at-a-time. One-at-a-time at p10 and p90."')
    expect(html).not.toContain('Morris screening')
  })

  it('tables the five quantities with the mean and its own interval, the horizon once in the head', () => {
    installResults()
    const html = render()
    const ensemble = section(html, 'Ensemble')
    expect(ensemble).toContain('40 runs · seed 123 · T+1:00</span>')
    expect(ensemble.match(/T\+1:00/g)).toHaveLength(2) // the readout and its title
    expect(ensemble.match(/data-ensemble-row=/g)).toHaveLength(5)
    expect(ensemble).toContain(
      '<td>Leakers</td><td>1 <span class="r2b-dim">/4</span></td><td class="r2b-dim">0.8–1.2</td>',
    )
    expect(ensemble).toContain(
      '<td>Kills</td><td>3 <span class="r2b-dim">/4</span></td><td class="r2b-dim">2.8–3.2</td>',
    )
    expect(ensemble).toContain(
      '<td>First detect</td><td>10 <span class="r2b-dim">s</span></td><td class="r2b-dim">9–11</td>',
    )
    expect(ensemble).toContain(
      '<td>Min warning</td><td>20 <span class="r2b-dim">s</span></td><td class="r2b-dim">19–21</td>',
    )
    // The total salvos carry no interval: the per-effector intervals do not sum.
    expect(ensemble).toMatch(
      /per-effector intervals only[^"]*"><td>Salvos<\/td><td>0 <span class="r2b-dim">salvos<\/span><\/td><td class="r2b-dim">—/,
    )
    expect(ensemble).toContain('title="MC mean · 2.8 to 3.2 (95% mean CI) · n=40"')
    expect(ensemble).toContain('warning time in 40 of 40')
    expect(ensemble).toMatch(
      /title="(Replaces the pinned baseline[^"]*|Pin this laydown and ensemble for Compare)">Pin</,
    )
    expect(html.match(/data-sweep-cell=/g)).toHaveLength(2)
    expect(html).toContain('width:100%')
    expect(html).not.toContain('99 members')
  })

  it('shows the top five sensitivity rows and toggles Show all', () => {
    installResults()
    const mc = useStore.getState().mc
    useStore.setState({
      mc: { ...mc, sensitivity: { ...mc.sensitivity, summary: manyRows(7) } },
    })
    const top = render()
    expect(top.match(/data-sensitivity-row=/g)).toHaveLength(5)
    expect(top).toContain('data-sensitivity-row="field6"')
    expect(top).not.toContain('data-sensitivity-row="field1"')
    const all = click('Show all 7')
    expect(all.match(/data-sensitivity-row=/g)).toHaveLength(7)
    expect(click('Show top 5').match(/data-sensitivity-row=/g)).toHaveLength(5)
  })

  it('opens a sensitivity row to p10, p90, SE and the definedness of a time response', () => {
    installResults()
    render()
    const times = change('Measure', 'firstDetectS')
    expect(times).not.toContain('SE 0.12')
    expect(times).toContain('aria-expanded="false"')
    // The row button carries no string label; open it through its state setter.
    const openIndex = interaction.states.findIndex((v) => v === null)
    interaction.states[openIndex] = 'lib-coyote:pk'
    const open = render()
    expect(open).toContain('aria-expanded="true"')
    expect(open).toContain('p10 1 → p90 2 · SE 0.12 · paired runs')
    expect(open).toContain('conditional on defined times')
    expect(open).toContain('75.0% [60.0%, 85.0%]')
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
      expect(html).not.toContain('data-ensemble-row=')
      expect(html).not.toContain('data-sensitivity-row=')
      expect(html).not.toMatch(/data-tone="(nominal|warning|critical)"/)
    },
  )

  it('submits the chip grid and paints completion counts while results are pending', () => {
    const start = vi.fn()
    const cancel = vi.fn()
    useStore.setState({ runSweep: start, cancelSweep: cancel })
    render()
    expect(interaction.buttons.get('Run sweep')!.disabled).toBe(false)
    interaction.buttons.get('Run sweep')!.onClick()
    expect(start).toHaveBeenCalledWith({
      factors: [
        { id: 'threatAltitudeFt', values: [100, 200, 400, 800] },
        { id: 'threatSpeedMps', values: [20, 35, 50] },
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
          total: 12,
        },
      },
    })
    const html = render()
    expect(html.match(/data-tone="complete"/g)).toHaveLength(7)
    expect(html).toContain('7 of 12 cells complete')
    expect(html).toContain('Running…')
    expect(interaction.buttons.get('Run sweep')!.disabled).toBe(true)
    interaction.buttons.get('Cancel')!.onClick()
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('adds chips by Enter under the current parse rules and refuses the rest', () => {
    render()
    for (const bad of ['100', 'abc', '-5', '1e']) {
      const html = addValue('A', bad)
      expect(html).toContain('<p class="line-error">Enter 2–6 distinct values per factor')
      expect(html).toContain('aria-invalid="true"')
      expect(html.match(/class="r2b-chip-t"/g)).toHaveLength(7)
    }
    const added = addValue('A', '1600')
    expect(added).toContain('<span class="r2b-chip-t">1600</span>')
    expect(added).not.toContain('class="line-error"')
    expect(added).toContain('15 cells')
    // A suggested value adds through the same rule; six values close the add box.
    const six = click('Add 50')
    expect(six).not.toContain('name="add-A"')
    expect(six).not.toContain('aria-label="Add 1200"')
    expect(addValue('B', '0')).toContain('<p class="line-error">')
    // Raid size takes positive integers only.
    change('factor-B', 'raidSize')
    expect(addValue('B', '2.5')).toContain('<p class="line-error">')
  })

  it('prints a chip as its parsed number, the way the map axis prints it', () => {
    render()
    const html = addValue('A', '1e3')
    expect(html).toContain(
      '<span class="r2b-chip" title="1000"><span class="r2b-chip-t">1000</span>',
    )
    expect(html).not.toContain('>1e3<')
    expect(interaction.buttons.has('Remove 1000')).toBe(true)
    expect(click('Remove 1000')).not.toContain('r2b-chip-t">1000<')
  })

  it('hides a suggestion that a chip already holds by value', () => {
    expect(render()).toContain('aria-label="Add 1200"')
    const html = addValue('A', '1.2e3')
    expect(html).toContain('<span class="r2b-chip-t">1200</span>')
    expect(html).not.toContain('aria-label="Add 1200"')
  })

  it('clears a refused add when a chip is removed', () => {
    render()
    expect(addValue('A', 'abc')).toContain('aria-invalid="true"')
    const html = click('Remove 200')
    expect(html).not.toContain('<p class="line-error">Enter 2–6 distinct values per factor')
    expect(html).not.toContain('aria-invalid="true"')
  })

  it('removes chips, factors and names the grid rule that blocks Run sweep', () => {
    render()
    click('Remove 20')
    const one = click('Remove 35')
    expect(one).toContain('<p class="line-error">Give each factor 2 to 6 values.</p>')
    expect(interaction.buttons.get('Run sweep')!.disabled).toBe(true)
    expect(interaction.buttons.get('Run sweep')!.disabled).toBe(true)
    const same = change('factor-B', 'threatAltitudeFt')
    expect(same).toContain('<p class="line-error">Choose two different factors.</p>')
    const single = click('Remove')
    expect(single).toContain('>Add second factor</button>')
    expect(single).toContain('4 cells · 40 runs each')
    expect(interaction.buttons.get('Run sweep')!.disabled).toBe(false)
    expect(click('Add second factor')).toContain('Factor B')
  })

  it('offers the environment presets as chips and suggestions without an add box', () => {
    render()
    const env = change('factor-A', 'environmentPreset')
    expect(env).toContain('<span class="r2b-chip-t">Clear day</span>')
    expect(env).toContain('<span class="r2b-chip-t">Fog, day</span>')
    expect(env).not.toContain('name="add-A"')
    expect(click('Add Rain, day')).toContain('<span class="r2b-chip-t">Rain, day</span>')
  })

  it.each(['mc', 'sweep'] as const)(
    'estimates a grid from the retained %s measurement',
    (source) => {
      installResults()
      if (source === 'mc')
        useStore.setState({ mc: { ...useStore.getState().mc, sweep: IDLE_SWEEP } })
      const html = render()
      // 12 cells × 40 replicates at 20 (mc) or 10 (sweep) replicates per second.
      expect(html).toContain(`12 cells · 40 runs each · ~${source === 'mc' ? 24 : 48} s`)
      expect(html).toContain(
        `Estimated time: ${source === 'mc' ? 24 : 48} s at ${source === 'mc' ? 20 : 10} replicates/s`,
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
    render()
    const openIndex = interaction.states.findIndex((v) => v === null)
    interaction.states[openIndex] = 'lib-coyote:pk'
    const html = render()
    expect(html).toContain('warning time in 0 of 40')
    expect(html).toContain(
      '<td>Min warning</td><td>— <span class="r2b-dim">s</span></td><td class="r2b-dim">—</td>',
    )
    expect(html).toContain('Response unavailable; run sensitivity again.')
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('99 members')
  })
})
