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
    if (type === 'button' && typeof p.children === 'string' && p.onClick)
      interaction.buttons.set(p.children, { disabled: p.disabled, onClick: p.onClick })
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

  it('offers the objective, the movable systems and the contract budget, with Run disabled until one is checked', () => {
    const html = render()
    expect(html).toContain('No current placement result.')
    expect(html).toContain('Minimize Leakers (members).')
    // Only active sensors, effectors and C2 are movable: the asset is not offered.
    expect(html).toContain('aria-label="Move Coyote 1"')
    expect(html).toContain('aria-label="Move Giraffe 1"')
    expect(html).not.toContain('aria-label="Move Asset"')
    // The contract defaults, and the seed of the scenario's run settings.
    expect(html).toContain('value="60"')
    expect(html).toContain('value="40"')
    expect(html).toContain('<span class="mono">4821</span>')
    expect(html).toContain('Main range · 4 points')
    expect(interaction.buttons.get('Run placement')!.disabled).toBe(true)
    expect(html).not.toContain('data-placement-row')
  })

  it('sends the checked systems, the range bounds and the edited budget to the run', () => {
    const start = vi.fn()
    useStore.setState({ runOptimize: start })
    render()
    check('Move Coyote 1', true)
    change('Evaluations', '6')
    const html = change('Replicates per evaluation', '10')
    expect(interaction.buttons.get('Run placement')!.disabled).toBe(false)
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

  it('takes the direction from the response and blocks a run without bounds or a whole budget', () => {
    render()
    check('Move Coyote 1', true)
    // A kill count is maximized where a leaker count is minimized.
    const kills = change('Placement response', 'kills')
    expect(kills).toContain('Maximize Kills (members).')
    change('Evaluations', '1')
    expect(interaction.buttons.get('Run placement')!.disabled).toBe(true)
    change('Evaluations', '60')
    expect(interaction.buttons.get('Run placement')!.disabled).toBe(false)
    useStore.getState().patchScenario({ boundaries: [] })
    const noRange = render()
    expect(noRange).toContain('No range boundary. Draw one on the board before a placement run.')
    expect(interaction.buttons.get('Run placement')!.disabled).toBe(true)
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
    expect(interaction.buttons.has('Run placement')).toBe(true)
    expect(interaction.buttons.get('Run placement')!.disabled).toBe(true)
  })

  it('ranks the candidates best first, marks the start row and says the run was cut', () => {
    installResult(cutResult())
    const html = render()
    expect(html).toContain('Run cut at 4 of 6 evaluations.')
    expect(html).toContain('4 evaluations · 160 engine replicates')
    const order = ['data-placement-row="1"', 'data-placement-row="2"', 'data-placement-row="3"']
    expect(order.map((mark) => html.indexOf(mark))).toEqual(
      [...order.map((mark) => html.indexOf(mark))].sort((a, b) => a - b),
    )
    // Candidate 1 is trace index 2: 1500.24, -1200.46 rounds to one decimal.
    expect(html).toContain('1500.2, -1200.5')
    expect(html).toContain('1.4 · 1.0 to 1.8 (95% mean CI) · n=40')
    // The starting laydown is candidate 3 here, so it carries the start mark and no extra row.
    expect(html.match(/data-placement-row=/g)).toHaveLength(3)
    expect(html).toContain('>start<')
    expect(html).toContain('Coyote 1 (m)')
  })

  it('appends the starting laydown when the ranking dropped it', () => {
    const result = cutResult()
    installResult({ ...result, candidates: result.candidates.slice(0, 2) })
    const html = render()
    expect(html.match(/data-placement-row=/g)).toHaveLength(3)
    expect(html).toContain('data-placement-row="start"')
    // The appended start row carries no Apply button: only a candidate is applied.
    expect(interaction.buttons.has('Apply placement 1')).toBe(true)
    expect(html.match(/>Apply placement /g)).toHaveLength(2)
  })

  it('applies a candidate as a new scenario and never edits the current one', () => {
    installResult(cutResult())
    const before = useStore.getState().scenario
    render()
    interaction.buttons.get('Apply placement 1')!.onClick()
    const after = useStore.getState().scenario
    expect(after.name).toBe(`${before.name} (placement 1)`)
    expect(after.entities.find((e) => e.id === EFFECTOR)!.pos).toEqual({ x: 1500.24, y: -1200.46 })
    // Every other entity keeps its place, and the previous object is untouched.
    expect(after.entities.find((e) => e.id === SENSOR)!.pos).toEqual({ x: 0, y: 0 })
    expect(before.entities.find((e) => e.id === EFFECTOR)!.pos).toEqual({ x: 1700, y: -1700 })
    expect(before.name).not.toContain('placement')
    // A replacement starts a clean run, so the result no longer reads as current.
    expect(useStore.getState().mc.optimize.status).toBe('idle')
    expect(render()).toContain('No current placement result.')
  })

  it('withholds a result from another run or another board', () => {
    installResult(cutResult())
    expect(render()).toContain('data-placement-row=')
    const mc = useStore.getState().mc
    useStore.setState({
      mc: { ...mc, optimize: { ...mc.optimize, basisSignature: 'other-board' } },
    })
    expect(render()).toContain('No current placement result.')
    useStore.setState({ mc: { ...mc, optimize: { ...mc.optimize, runId: 'other-run' } } })
    expect(render()).toContain('No current placement result.')
  })

  it('keeps a deterministic scenario out of a placement run', () => {
    useStore.getState().patchScenario({ runMode: 'deterministic' })
    const html = render()
    expect(html).toContain('Choose Monte Carlo mode in the Inputs tab to run a placement study.')
    check('Move Coyote 1', true)
    expect(interaction.buttons.get('Run placement')!.disabled).toBe(true)
  })

  it('gives every former muted sentence a home: (i), error line or empty-state row', () => {
    useStore.getState().patchScenario({ runMode: 'deterministic', boundaries: [] })
    const idle = render()
    expect(idle).not.toContain('muted')
    // Method notes sit behind a 24 px (i) whose title holds the unchanged note.
    expect(idle).toContain(
      'aria-label="About movable systems" title="Every other entity, every threat and every asset stays put."',
    )
    expect(idle).toContain(
      'aria-label="About bounds" title="A proposal stays inside the range polygon, in the meters world frame."',
    )
    expect(idle).toContain(
      'aria-label="About budget" title="Engine replicates: evaluations × replicates per evaluation."',
    )
    expect(idle).toContain(
      'aria-label="About Placement response" title="Minimize Leakers (members)."',
    )
    // A rule is an error line; a missing input is an empty-state row.
    expect(idle).toContain(
      '<p class="line-error">Choose Monte Carlo mode in the Inputs tab to run a placement study.</p>',
    )
    expect(idle).toMatch(
      /<p class="empty-row"><span class="state warning">.*No range boundary\. Draw one on the board before a placement run\.<\/span><\/p>/,
    )
    expect(idle).toMatch(/class="empty-row">.*No current placement result\./)
    expect(idle).not.toContain('field-help')

    change('Evaluations', '1')
    expect(render()).toContain(
      '<p class="line-error">Enter whole numbers: at least 2 evaluations and 1 replicate.</p>',
    )

    // Field help on renders each note as a normal-weight line.
    useStore.setState(({ ui }) => ({ ui: { ...ui, showFieldHelp: true } }))
    expect(render()).toContain(
      '<p class="field-help">Every other entity, every threat and every asset stays put.</p>',
    )
    useStore.setState(({ ui }) => ({ ui: { ...ui, showFieldHelp: false } }))
  })

  it('puts the result basis and the Apply note behind the candidates (i) once a result exists', () => {
    installResult(cutResult())
    const html = render()
    expect(html).not.toContain('muted')
    expect(html).not.toContain('No current placement result.')
    expect(html).toContain(
      'aria-label="About candidate laydowns" title="Best first by the objective · 4 evaluations · 160 engine replicates. Apply installs a copy of this scenario with the candidate positions and clears the run; the current scenario is never edited in place."',
    )
  })
})
