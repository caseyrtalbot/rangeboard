import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyScenario } from '../../model/seed'
import {
  DEFAULT_CONFIDENCE,
  DEFAULT_SOBOL_BASE,
  DEFAULT_STOP_CAP,
  DEFAULT_STOP_FLOOR,
  DEFAULT_TARGET_HALF_WIDTH,
  runSettings,
} from '../../model/types'
import { useStore } from '../../state/store'
import { RunTab } from './RunTab'

// The tab has no local state, so a static render plus the handlers each control
// was given is the whole surface. Buttons are keyed by their accessible name,
// commit and change handlers by the label of the Field that holds the control.
const interaction = vi.hoisted(() => ({
  buttons: new Map<string, { disabled?: boolean; onClick: () => void }>(),
  commits: new Map<string, (v: number | null) => void>(),
  changes: new Map<string, (v: string) => void>(),
}))
vi.mock('react/jsx-dev-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react/jsx-dev-runtime')>()
  const jsxDEV: typeof actual.jsxDEV = (type, props, ...rest) => {
    const p = props as {
      children?: unknown
      label?: string
      disabled?: boolean
      onClick?: () => void
      'aria-label'?: string
    }
    if (type === 'button' && p.onClick) {
      const name = p['aria-label'] ?? (typeof p.children === 'string' ? p.children : '')
      if (name) interaction.buttons.set(name, { disabled: p.disabled, onClick: p.onClick })
    }
    if (typeof type === 'function' && type.name === 'Field' && p.label) {
      const child = p.children as {
        props?: { onCommit?: (v: number | null) => void; onChange?: (v: string) => void }
      }
      if (child?.props?.onCommit) interaction.commits.set(p.label, child.props.onCommit)
      if (child?.props?.onChange) interaction.changes.set(p.label, child.props.onChange)
    }
    return actual.jsxDEV(type, props, ...rest)
  }
  return { ...actual, jsxDEV }
})

function render(): string {
  interaction.buttons.clear()
  interaction.commits.clear()
  interaction.changes.clear()
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<RunTab />)
}

function run() {
  return runSettings(useStore.getState().scenario)
}

describe('RunTab', () => {
  beforeEach(() => {
    useStore.getState().replaceScenario(emptyScenario())
  })

  it('names every run setting in plain language with its technical name', () => {
    const html = render()

    expect(html).toContain('Run kind · Monte Carlo')
    expect(html).toContain('What varies · total')
    expect(html).toContain('Repeat key · seed')
    expect(html).toContain('How many runs · replicates')
    expect(html).toContain('Stop rule · half-width')
    expect(html).toContain('Fewest runs before it may stop · stop floor')
    expect(html).toContain('Most runs it may make · stop cap')
    expect(html).toContain('Interval width · confidence')
    expect(html).toContain('Parameter draws · Latin hypercube')
    expect(html).toContain('What drives the result · Morris then Sobol')
    expect(html).toContain('Sobol sample size · base N')
    // The other option of each choice is offered by its technical name.
    expect(html).toContain('>Independent<')
    expect(html).toContain('>Quick: one-at-a-time<')
    expect(html).toContain('>Deterministic<')
    expect(html).toContain('>Aleatory<')
  })

  it('shows the default of every setting beside it', () => {
    const html = render()

    expect(html).toContain('Default Monte Carlo')
    expect(html).toContain('Default total')
    expect(html).toContain('Default 4821')
    expect(html).toContain('Default 100')
    expect(html).toContain(`Default ${DEFAULT_TARGET_HALF_WIDTH}`)
    expect(html).toContain(`Default ${DEFAULT_STOP_FLOOR}`)
    expect(html).toContain(`Default ${DEFAULT_STOP_CAP}`)
    expect(html).toContain(`Default ${DEFAULT_CONFIDENCE}`)
    expect(html).toContain('Default Latin hypercube')
    expect(html).toContain('Default Morris then Sobol')
    expect(html).toContain(`Default ${DEFAULT_SOBOL_BASE}`)
  })

  it('offers a reset per setting, disabled while the fresh scenario is untouched', () => {
    const html = render()
    const resets = [...interaction.buttons.keys()].filter((name) => name.startsWith('Reset '))

    expect(resets).toHaveLength(11)
    expect(resets.every((name) => interaction.buttons.get(name)!.disabled)).toBe(true)
    expect(html.match(/>Reset</g)).toHaveLength(11)
  })

  it('enables the reset of a changed setting and writes the default back', () => {
    useStore.getState().patchScenario({ seed: 7, sobolBase: 64 })
    render()

    expect(interaction.buttons.get('Reset Repeat key to the default')!.disabled).toBe(false)
    interaction.buttons.get('Reset Repeat key to the default')!.onClick()
    interaction.buttons.get('Reset Sobol sample size to the default')!.onClick()

    expect(run().seed).toBe(4821)
    expect(run().sobolBase).toBe(DEFAULT_SOBOL_BASE)
    render()
    expect(interaction.buttons.get('Reset Repeat key to the default')!.disabled).toBe(true)
  })

  it('writes a chosen option through patchScenario', () => {
    render()
    interaction.changes.get('Parameter draws · Latin hypercube')!('independent')
    expect(run().sampling).toBe('independent')

    const html = render()
    expect(html).toContain('Parameter draws · independent')
    interaction.changes.get('What drives the result · Morris then Sobol')!('quick')
    expect(run().sensitivityDepth).toBe('quick')
    expect(render()).toContain('What drives the result · one-at-a-time')
  })

  it('clears the stop rule on an empty half-width and says the run takes every replicate', () => {
    render()
    interaction.commits.get('Stop rule · half-width')!(null)

    expect(run().targetHalfWidth).toBeNull()
    const html = render()
    expect(html).toContain('Stop rule · every replicate')
    expect(interaction.buttons.get('Reset Stop rule to the default')!.disabled).toBe(false)
  })

  it('commits a confidence and bounds its input to the open interval', () => {
    const html = render()
    // The input carries the bounds; the commit rule inside it is covered by inputs.tsx.
    expect(html).toContain('placeholder="None"')
    expect(html).toContain('min="0" max="1"')

    interaction.commits.get('Interval width · confidence')!(0.9)
    expect(run().confidence).toBe(0.9)
    expect(render()).toContain('Default 0.95')
  })
})
