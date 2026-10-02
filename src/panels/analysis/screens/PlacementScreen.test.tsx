import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyScenario } from '../../../model/seed'
import type { Boundary, Entity, Scenario } from '../../../model/types'
import type { Stat } from '../../../playback/mcRun'
import type { OptimizeEvaluation, OptimizeResult } from '../../../playback/optimizeTypes'
import { analysisBasisSignature } from '../../../state/analysisBasis'
import { IDLE_MC, IDLE_OPTIMIZE } from '../../../state/runState'
import { useStore } from '../../../state/store'
import { PlacementScreen } from './PlacementScreen'

const interaction = vi.hoisted(() => ({
  cursor: 0,
  states: [] as unknown[],
  buttons: new Map<string, { disabled?: boolean; onClick: () => void }>(),
  fields: new Map<string, (event: { target: { value: string } }) => void>(),
  boxes: new Map<string, (event: { target: { checked: boolean } }) => void>(),
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
      type?: string
      'aria-label'?: string
      onChange?: (event: never) => void
    }
    if (type === 'button' && p.onClick) {
      const entry = { disabled: p.disabled, onClick: p.onClick }
      if (typeof p.children === 'string') interaction.buttons.set(p.children, entry)
      if (p['aria-label']) interaction.buttons.set(p['aria-label'], entry)
    }
    if (type === 'input' && p.type === 'checkbox' && p['aria-label'] && p.onChange) {
      interaction.boxes.set(
        p['aria-label'],
        p.onChange as (event: { target: { checked: boolean } }) => void,
      )
    }
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

const RANGE: Boundary = {
  id: 'bnd-range',
  name: 'Main range',
  type: 'range',
  closed: true,
  altBandFt: null,
  points: [
    { x: -3000, y: -3000 },
    { x: 3000, y: -3000 },
    { x: 3000, y: 3000 },
    { x: -3000, y: 3000 },
  ],
}
const EFFECTOR = 'ent-effector'
const SENSOR = 'ent-sensor'
const entity = (id: string, kind: Entity['kind'], name: string, x: number, y: number): Entity => ({
  id,
  name,
  kind,
  specId: null,
  pos: { x, y },
  headingDeg: 0,
  color: null,
  notes: '',
})

function board(): Scenario {
  const s = emptyScenario()
  s.runMode = 'monte-carlo'
  s.boundaries = [RANGE]
  s.entities.push(entity(EFFECTOR, 'effector', 'Coyote 1', 1700, -1700))
  s.entities.push(entity(SENSOR, 'sensor', 'Giraffe 1', 0, 0))
  s.entities.push(entity('ent-asset', 'asset', 'Asset', 0, 0))
  return s
}

const stat = (mean: number): Stat => ({
  mean,
  sd: 1,
  se: 0.2,
  lo: mean - 0.4,
  hi: mean + 0.4,
  conf: 0.95,
  interval: 't',
  p10: mean,
  p90: mean,
  p025: mean,
  p975: mean,
  n: 40,
  total: 40,
  defined: { p: 1, lo: 0.9, hi: 1 },
})
const evaluation = (index: number, mean: number, x: number, y: number): OptimizeEvaluation => ({
  index,
  positions: { [EFFECTOR]: { x, y } },
  objective: stat(mean),
  incumbent: index === 0 || index === 2,
})

/** Four evaluations of a six-evaluation budget: a cut run, best at index 2. */
function cutResult(): OptimizeResult {
  const trace = [
    evaluation(0, 2.5, 1700, -1700),
    evaluation(1, 3.1, -450.08, 900),
    evaluation(2, 1.4, 1500.24, -1200.46),
    evaluation(3, 1.9, 200, 200),
  ]
  const candidate = (e: OptimizeEvaluation) => ({
    positions: e.positions,
    objective: e.objective,
    evaluationIndex: e.index,
  })
  return {
    method: 'gp-ei',
    objective: { response: 'leakers', direction: 'minimize' },
    movableIds: [EFFECTOR],
    budget: { evaluations: 6, replicates: 40, seed: 4821 },
    candidates: [candidate(trace[2]), candidate(trace[3]), candidate(trace[0])],
    trace,
    replicatesRun: 160,
    elapsedMs: 9000,
  }
}

function render() {
  interaction.cursor = 0
  interaction.buttons.clear()
  interaction.fields.clear()
  interaction.boxes.clear()
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<PlacementScreen />)
}
function click(label: string) {
  expect(interaction.buttons.has(label)).toBe(true)
  interaction.buttons.get(label)!.onClick()
  return render()
}
const needsOf = (html: string) =>
  [
    ...(html.split('data-placement-needs="">')[1] ?? '')
      .split('</div>')[0]
      .matchAll(/<\/i>([^<]+)<\/span>/g),
  ].map((m) => m[1])
function check(label: string, value: boolean) {
  expect(interaction.boxes.has(label)).toBe(true)
  interaction.boxes.get(label)!({ target: { checked: value } })
  return render()
}
function change(label: string, value: string) {
  expect(interaction.fields.has(label)).toBe(true)
  interaction.fields.get(label)!({ target: { value } })
  return render()
}
function installResult(result: OptimizeResult) {
  const { playback, scenario } = useStore.getState()
  useStore.setState({
    mc: {
      ...IDLE_MC,
      optimize: {
        ...IDLE_OPTIMIZE,
        status: 'done',
        runId: playback.runId,
        summary: result,
        progress: result.trace.length,
        total: result.budget.evaluations,
        basisSignature: analysisBasisSignature(scenario),
      },
    },
  })
}

describe('PlacementScreen', () => {
  beforeEach(() => {
    interaction.states = []
    useStore.getState().replaceScenario(board())
    useStore.setState({ mc: IDLE_MC })
  })

  it('offers one Goal select, compact movable rows and the budget on the grid', () => {
    const html = render()
    expect(html).not.toContain('<h3>Placement</h3>')
    expect(html).not.toContain('Objective')
    expect(html).toContain(
      '<option value="leakers" selected="">Minimize leakers (members)</option>',
    )
    expect(html).toContain('<option value="kills">Maximize kills (members)</option>')
    expect(html).toContain('<option value="firstDetectS">Minimize first detect (s)</option>')
    // Only active sensors, effectors and C2 are movable: the asset is not offered.
    expect(html).toContain('aria-label="Move Coyote 1"')
    expect(html).toContain('aria-label="Move Giraffe 1"')
    expect(html).not.toContain('aria-label="Move Asset"')
    expect(html).toMatch(
      /<div class="r2b-move-group">Sensors<\/div><label class="r2b-mv" title="Giraffe 1">.*<span class="r2b-kind">S<\/span>/,
    )
    expect(html).toContain('<span class="r2b-kind">E</span><span class="r2b-mv-nm">Coyote 1</span>')
    expect(html).toContain('<span class="psec-readout">0 of 2</span>')
    expect(html).toContain('value="60"')
    expect(html).toContain('value="40"')
    expect(html).toContain('2,400 runs')
    expect(html).toContain('Main range · 4 points')
    expect(interaction.buttons.get('Run placement')!.disabled).toBe(true)
    expect(needsOf(html)).toEqual(['a system to move'])
    expect(html).toContain('No placement result yet.')
    expect(html).not.toContain('data-placement-row')
  })

  it('checks All and None from the head', () => {
    render()
    expect(click('All')).toContain('<span class="psec-readout">2 of 2</span>')
    expect(click('None')).toContain('<span class="psec-readout">0 of 2</span>')
  })

  it('sends the checked systems, the range bounds and the edited budget to the run', () => {
    const start = vi.fn()
    useStore.setState({ runOptimize: start })
    render()
    check('Move Coyote 1', true)
    change('Evaluations', '6')
    const html = change('Runs each', '10')
    expect(html).toContain('60 runs')
    expect(interaction.buttons.get('Run placement')!.disabled).toBe(false)
    expect(html).not.toContain('data-placement-needs')
    expect(html).toContain('a 10-replicate run under common random numbers at seed 4821')
    interaction.buttons.get('Run placement')!.onClick()
    expect(start).toHaveBeenCalledWith({
      objective: { response: 'leakers', direction: 'minimize' },
      movableIds: [EFFECTOR],
      bounds: { boundaryId: RANGE.id, points: RANGE.points },
      evaluations: 6,
      replicates: 10,
    })
  })

  it('lists what Run placement needs and takes the direction from the goal', () => {
    const start = vi.fn()
    useStore.setState({ runOptimize: start })
    useStore.getState().patchScenario({ runMode: 'deterministic', boundaries: [] })
    render()
    const html = change('Evaluations', '1')
    expect(needsOf(html)).toEqual([
      'Monte Carlo mode',
      'a system to move',
      'a range boundary',
      'a whole-number budget',
    ])
    expect(html).toContain(
      '<p class="empty-row"><span class="state warning"><i class="state-square hollow" aria-hidden="true"></i>No range boundary on the board.</span></p><button type="button" class="mini">Draw boundary</button>',
    )
    click('Draw boundary')
    expect(useStore.getState().ui.tool).toBe('boundary')
    useStore.getState().patchScenario({ runMode: 'monte-carlo', boundaries: [RANGE] })
    check('Move Coyote 1', true)
    change('Evaluations', '60')
    const kills = change('Goal', 'kills')
    expect(kills).not.toContain('data-placement-needs')
    interaction.buttons.get('Run placement')!.onClick()
    expect(start.mock.calls[0][0].objective).toEqual({ response: 'kills', direction: 'maximize' })
  })

  it('disables the goals that need an asset and falls back to Maximize kills without one', () => {
    useStore.getState().patchScenario({
      entities: useStore.getState().scenario.entities.filter((e) => e.kind !== 'asset'),
    })
    const html = render()
    expect(html).toContain(
      '<option value="leakers" disabled="">Minimize leakers (members) · needs asset</option>',
    )
    expect(html).toContain('<option value="kills" selected="">Maximize kills (members)</option>')
  })

  it('marks a range the run would refuse, shows the reason and blocks the run from it', () => {
    const flat: Boundary = {
      ...RANGE,
      id: 'bnd-flat',
      name: 'Flat range',
      points: [
        { x: -3000, y: 0 },
        { x: 0, y: 0 },
        { x: 3000, y: 0 },
      ],
    }
    useStore.getState().patchScenario({ boundaries: [flat, RANGE] })
    render()
    check('Move Coyote 1', true)
    // The default skips the refused range for the first usable one.
    const usable = render()
    expect(usable).toContain('Flat range · 3 points · unavailable')
    expect(usable).toContain('Main range · 4 points</option>')
    expect(usable).not.toContain('enclose no area')
    expect(interaction.buttons.get('Run placement')!.disabled).toBe(false)
    const refused = change('Range boundary', flat.id)
    expect(refused).toContain(
      'The range boundary points lie on one line and enclose no area. A placement run needs a polygon.',
    )
    expect(needsOf(refused)).toEqual(['a usable range boundary'])
    expect(interaction.buttons.get('Run placement')!.disabled).toBe(true)
  })

  it('counts the evaluations and names the incumbent while running, and cancels on demand', () => {
    const cancel = vi.fn()
    useStore.setState({ cancelOptimize: cancel })
    const { playback } = useStore.getState()
    useStore.setState({
      mc: {
        ...IDLE_MC,
        optimize: {
          ...IDLE_OPTIMIZE,
          status: 'running',
          runId: playback.runId,
          progress: 3,
          total: 6,
        },
        optimizeBest: evaluation(2, 1.4, 1500.24, -1200.46),
      },
    })
    const html = render()
    expect(html).toContain('3 of 6 evaluations')
    // The incumbent keeps its own interval: mean 1.4, hand-built lo 1.4-0.4 and hi 1.4+0.4.
    expect(html).toContain('incumbent 1.4 · 1.0 to 1.8 (95% mean CI) · n=40')
    interaction.buttons.get('Cancel placement')!.onClick()
    expect(cancel).toHaveBeenCalledOnce()
    expect(interaction.buttons.get('Run placement')!.disabled).toBe(true)
  })

  it('prints a change that rounds to zero unsigned', () => {
    const result = cutResult()
    // Candidate 2 sits 0.03 under the start mean of 2.5.
    result.candidates[1] = {
      ...result.candidates[1],
      objective: evaluation(3, 2.47, 200, 200).objective,
    }
    installResult(result)
    const html = render()
    // A lower mean is better for Leakers, but a change that prints 0 takes no tone.
    expect(html).toContain('<span class="r2b-cand-d">0</span>')
    expect(html).not.toMatch(/<span class="r2b-cand-d[^"]*">[+−]0<\/span>/)
  })

  it('ranks the candidates best first on one interval scale with the change against the start', () => {
    installResult(cutResult())
    const html = render()
    expect(html).toContain('Run cut at 4 of 6 evaluations.')
    expect(html).toContain('Leakers (members) · 4 evaluations</span>')
    const order = ['data-placement-row="1"', 'data-placement-row="2"', 'data-placement-row="3"']
    expect(order.map((mark) => html.indexOf(mark))).toEqual(
      [...order.map((mark) => html.indexOf(mark))].sort((a, b) => a - b),
    )
    // One scale for the result: 1.0 (candidate 1 low end) to 2.9 (the start's high end).
    expect(html).toContain('data-band="0.0-42.1"')
    expect(html).toContain('data-band="26.3-68.4"')
    expect(html).toContain('data-band="57.9-100.0"')
    expect(html.match(/class="r2b-iv-ref" style="left:78.94/g)).toHaveLength(3)
    // The start laydown is candidate 3: it reads its mean; the others read the change.
    expect(html).toContain('<span class="r2b-cand-d good">−1.1</span>')
    expect(html).toContain('<span class="r2b-cand-d good">−0.6</span>')
    expect(html).toContain('<span class="r2b-cand-d">2.5</span>')
    expect(html).toContain('class="r2b-cand start" data-placement-row="3"')
    expect(html.match(/data-placement-row=/g)).toHaveLength(3)
    expect(html).toContain('title="1.4 · 1.0 to 1.8 (95% mean CI) · n=40"')
    expect(html).not.toContain('1500.2, -1200.5')
    // A row opens to its coordinates.
    // The open row is the screen's last state.
    interaction.states[interaction.states.lastIndexOf(null)] = 0
    const open = render()
    expect(open).toContain('<span title="Coyote 1">Coyote 1</span><span>1500.2, -1200.5 m</span>')
  })

  it('appends the starting laydown when the ranking dropped it', () => {
    const result = cutResult()
    installResult({ ...result, candidates: result.candidates.slice(0, 2) })
    const html = render()
    expect(html.match(/data-placement-row=/g)).toHaveLength(3)
    expect(html).toContain('data-placement-row="start"')
    // The appended start row carries no Apply button: only a candidate is applied.
    expect(interaction.buttons.has('Apply placement 1')).toBe(true)
    expect(html.match(/aria-label="Apply placement /g)).toHaveLength(2)
  })

  it('names the goal a result ran on when the Goal changes', () => {
    installResult(cutResult())
    render()
    expect(change('Goal', 'kills')).toContain(
      'This result is for Minimize leakers (members). Run placement again for the new goal.',
    )
  })

  it('applies a candidate as a new scenario and never edits the current one', () => {
    installResult(cutResult())
    const before = useStore.getState().scenario
    render()
    interaction.buttons.get('Apply placement 1')!.onClick()
    const after = useStore.getState().scenario
    expect(after.name).toBe(`${before.name} (placement 1)`)
    expect(after.entities.find((e) => e.id === EFFECTOR)!.pos).toEqual({ x: 1500.24, y: -1200.46 })
    expect(after.entities.find((e) => e.id === SENSOR)!.pos).toEqual({ x: 0, y: 0 })
    expect(before.entities.find((e) => e.id === EFFECTOR)!.pos).toEqual({ x: 1700, y: -1700 })
    expect(before.name).not.toContain('placement')
    // A replacement starts a clean run, so the result no longer reads as current.
    expect(useStore.getState().mc.optimize.status).toBe('idle')
    expect(render()).toContain('No placement result yet.')
  })

  it('withholds a result from another run or another board', () => {
    installResult(cutResult())
    expect(render()).toContain('data-placement-row=')
    const mc = useStore.getState().mc
    useStore.setState({
      mc: { ...mc, optimize: { ...mc.optimize, basisSignature: 'other-board' } },
    })
    expect(render()).toContain('No placement result yet.')
    useStore.setState({ mc: { ...mc, optimize: { ...mc.optimize, runId: 'other-run' } } })
    expect(render()).toContain('No placement result yet.')
  })

  it('keeps the method notes behind (i) and shows them as lines with field help on', () => {
    const idle = render()
    expect(idle).not.toContain('muted')
    expect(idle).toContain(
      'aria-label="About systems to move" title="Every other entity, every threat and every asset stays put."',
    )
    expect(idle).toContain(
      'aria-label="About bounds" title="A proposal stays inside the range polygon, in the meters world frame."',
    )
    expect(idle).toContain(
      'aria-label="About budget" title="Gaussian process with expected improvement over the movable positions. Each evaluation is a 40-replicate run under common random numbers at seed 4821. Engine replicates: evaluations × runs each. Modeled, not observed."',
    )
    expect(idle).not.toContain('field-help')
    installResult(cutResult())
    expect(render()).toContain(
      'aria-label="About candidates" title="Best first by the objective mean.',
    )
    useStore.setState(({ ui }) => ({ ui: { ...ui, showFieldHelp: true } }))
    expect(render()).toContain(
      '<p class="field-help">Every other entity, every threat and every asset stays put.</p>',
    )
    useStore.setState(({ ui }) => ({ ui: { ...ui, showFieldHelp: false } }))
  })
})
