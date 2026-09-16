import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyScenario } from '../../model/seed'
import { physicsSwitches } from '../../model/types'
import type { PhysicsSwitch } from '../../model/libraryField'
import { createRunManifest } from '../../model/runRecord'
import { createTrialManifest } from '../../playback/trialTypes'
import { useStore } from '../../state/store'
import { PhysicsTab } from './PhysicsTab'
import { SettingsPanel } from '../SettingsPanel'

const interaction = vi.hoisted(() => ({
  changes: new Map<string, (event: { currentTarget: { checked: boolean } }) => void>(),
  reset: undefined as undefined | { disabled: boolean; onClick: () => void },
}))
vi.mock('react/jsx-dev-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react/jsx-dev-runtime')>()
  const jsxDEV: typeof actual.jsxDEV = (type, props, ...rest) => {
    const p = props as {
      type?: string
      'aria-describedby'?: string
      children?: unknown
      disabled: boolean
      onClick: () => void
      onChange: (event: { currentTarget: { checked: boolean } }) => void
    }
    if (type === 'input' && p.type === 'checkbox' && p['aria-describedby']) {
      interaction.changes.set(p['aria-describedby'], p.onChange)
    }
    if (type === 'button' && p.children === 'Reset physics') interaction.reset = p
    return actual.jsxDEV(type, props, ...rest)
  }
  return { ...actual, jsxDEV }
})
const order: PhysicsSwitch[] = [
  'truthTracks',
  'noFalseTracks',
  'noOperatorQueue',
  'singlePulseRadar',
  'noFlightLimits',
  'rfBandGate',
  'eoirSpanRatio',
  'legacyKineticPk',
  'legacyBeamPk',
]
function render() {
  interaction.changes.clear()
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<PhysicsTab />)
}
function toggle(id: PhysicsSwitch, checked: boolean) {
  interaction.changes.get(`physics-${id}-help`)!({ currentTarget: { checked } })
}

describe('PhysicsTab', () => {
  beforeEach(() => useStore.getState().replaceScenario(emptyScenario()))

  it('offers all switches in manifest order with descriptions and active model disclosure', () => {
    const html = render()
    expect([...interaction.changes.keys()]).toEqual(order.map((id) => `physics-${id}-help`))
    expect(html.match(/lowers the run record to fallback/g)).toHaveLength(9)
    expect(html).not.toContain('Model pending.')
    expect(html).toContain('Clearing a control uses the available physical model')
    expect(html).toContain('Tracker: lowers')
    expect(html).toContain('False tracks: lowers')
    expect(html).toContain('Radar dwell: lowers')
    expect(html).toContain('Interceptor miss + Gun burst: lowers')
    expect(html).toContain('Optical dwell + HPM field: lowers')
    expect(interaction.reset?.disabled).toBe(true)
  })

  it('toggles every entry through scenario history without losing earlier selections', () => {
    const seed = useStore.getState().scenario.seed
    render()
    // Reverse click order deliberately; handlers also tolerate changes before a rerender.
    for (const id of [...order].reverse()) toggle(id, true)
    expect(useStore.getState().scenario.physics).toEqual(order)
    toggle('truthTracks', true)
    expect(useStore.getState().scenario.physics).toEqual(order)
    for (const id of order) {
      render()
      toggle(id, false)
      expect(physicsSwitches(useStore.getState().scenario)).not.toContain(id)
    }
    expect(useStore.getState().scenario.physics).toEqual([])
    expect(useStore.getState().scenario.seed).toBe(seed)
    useStore.getState().undo()
    expect(useStore.getState().scenario.physics).toEqual(['legacyBeamPk'])
  })

  it('resets switches and passes the selection into existing run and trial manifest floors', () => {
    render()
    toggle('noFalseTracks', true)
    toggle('truthTracks', true)
    const scenario = useStore.getState().scenario
    for (const manifest of [
      createRunManifest(scenario, 'run', 'basis'),
      createTrialManifest(scenario, 'trial', 'basis'),
    ]) {
      expect(manifest.physicsSwitches).toEqual(['truthTracks', 'noFalseTracks'])
      expect(manifest.fidelityFloor).toBe('fallback')
    }
    render()
    expect(interaction.reset?.disabled).toBe(false)
    interaction.reset!.onClick()
    expect(useStore.getState().scenario.physics).toEqual([])
    expect(createRunManifest(useStore.getState().scenario, 'run', 'basis').fidelityFloor).toBe(
      'datasheet',
    )
    render()
    expect(interaction.reset?.disabled).toBe(true)
  })

  it('mounts Physics from the Settings section navigation', () => {
    Object.assign(useStore.getInitialState(), useStore.getState())
    const html = renderToStaticMarkup(
      <SettingsPanel initialSection="physics" onRequestClose={() => {}} />,
    )
    expect(html).toContain(
      'aria-pressed="true" aria-controls="settings-body" class="active">Physics',
    )
    expect(html).toContain('Reset physics')
  })
})
