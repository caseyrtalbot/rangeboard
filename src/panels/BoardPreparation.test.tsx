import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyScenario } from '../model/seed'
import { effectiveDoctrine } from '../model/types'
import { IDLE_MC } from '../state/runState'
import type { McState } from '../state/runState'
import { useStore } from '../state/store'
import { BoardPreparation } from './BoardPreparation'

// Register rows have no local state; their click handlers are captured from the markup.
const rows = vi.hoisted(() => new Map<string, () => void>())
vi.mock('react/jsx-dev-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react/jsx-dev-runtime')>()
  const jsxDEV: typeof actual.jsxDEV = (type, props, ...rest) => {
    const p = props as { 'aria-label'?: string; onClick?: () => void }
    if (type === 'button' && p['aria-label']?.startsWith('Inspect ') && p.onClick)
      rows.set(p['aria-label'], p.onClick)
    return actual.jsxDEV(type, props, ...rest)
  }
  return { ...actual, jsxDEV }
})

// Zustand 5 gives react-dom/server the initial state, so keep it aligned with
// the live store before each static render of a store-reading panel.
function render(): string {
  rows.clear()
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<BoardPreparation />)
}

/** One radar and two pathed threats; the second starts inside the radar ring. */
function pathedThreats(): void {
  const store = useStore.getState()
  store.addEntityFromModel('lib-giraffe1x', { x: 0, y: 0 })
  store.addEntityFromModel('lib-mavic3', { x: 0, y: -3500 })
  const threats = useStore.getState().scenario.entities.filter((entity) => entity.kind === 'uas')
  for (const threat of threats) {
    store.beginPath(threat.id)
    store.addDraftPoint({ x: 0, y: -100 })
    store.finishPath()
  }
  store.clearSelection()
}

describe('BoardPreparation', () => {
  beforeEach(() => {
    const store = useStore.getState()
    store.replaceScenario({ ...emptyScenario(), runMode: 'monte-carlo' })
    store.addEntityFromModel('lib-mavic3', { x: 0, y: -3000 })
    store.clearSelection()
    store.setRightTab('analysis')
    useStore.setState((state) => ({ mc: IDLE_MC, ui: { ...state.ui, openSections: {} } }))
  })

  it('renders the five sections in order and no header, forecast line or findings', () => {
    const html = render()
    expect(html.startsWith('<div class="inspector-body board-preparation">')).toBe(true)
    const ids = [
      'prepare-run',
      'prepare-environment',
      'prepare-doctrine',
      'prepare-requirements',
      'prepare-entities',
    ]
    const positions = ids.map((id) => html.indexOf(`id="${id}"`))
    expect(positions.every((at) => at > 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
    expect(html).toContain('<h3 class="psec-title">Run</h3>')
    for (const title of ['Environment', 'Fire control', 'Requirements', 'Entities'])
      expect(html).toContain(`<span class="psec-name">${title}</span>`)
    // Cut: the ObjectHeader, the forecast line, the Deterministic checkbox, the
    // Scenario inputs wrapper and the Run validity section (D1).
    expect(html).not.toContain('RUN-0001')
    expect(html).not.toContain('forecast-line')
    expect(html).not.toContain('Deterministic (no sampling)')
    expect(html).not.toContain('Scenario inputs')
    expect(html).not.toContain('Run validity')
    expect(html).not.toContain('No defended asset is placed.')
    expect(html).not.toContain('These threats have no flight path')
    expect(html).not.toContain('<details')
  })

  it('holds the stale chip and the Settings link in the Run head', () => {
    expect(render()).not.toContain('ENSEMBLE STALE')
    useStore.setState({ mc: { ...IDLE_MC, status: 'stale' } as McState })
    const html = render()
    expect(html).toMatch(
      /<span class="psec-end"><span class="state warning"[^>]*><i class="state-square" aria-hidden="true"><\/i>ENSEMBLE STALE<\/span><button type="button" class="mini prep-settings-link"[^>]*>Settings<\/button>/,
    )
  })

  it('switches environment effects in the head and reads the closed summary', () => {
    const html = render()
    expect(html).toMatch(
      /<button type="button" class="prep-switch" role="switch" aria-checked="true" title="Apply environment effects to sensors and threats">/,
    )
    expect(html).toContain('title="Rural: quiet RF background">Rural</button>')
    expect(html).toContain('title="Urban: dense RF background">Urban</button>')
    useStore.getState().setSectionOpen('prepare-environment', false)
    expect(render()).toMatch(
      /class="psec-sum" title="Clear · Day · Rural · wind [^"]+ · [-\d]+ °C · [\d,]+ ft"/,
    )
    useStore.getState().updateEnvironment({ apply: false })
    expect(render()).toContain('<span class="psec-sum" title="Effects off">Effects off</span>')
    useStore.getState().setSectionOpen('prepare-environment', true)
    expect(render()).toContain('Effects are off. Sensors and threats ignore these values.')
  })

  it('shows the doctrine fields only with doctrine on, and Release range only for Fraction', () => {
    const store = useStore.getState()
    const doctrine = effectiveDoctrine(store.scenario)
    store.patchScenario({ doctrine: { ...doctrine, enabled: false } })
    let html = render()
    expect(html).toContain('data-role="roe"')
    expect(html).toMatch(/role="switch" aria-checked="false"[^>]*>.*Off<\/button>/)
    expect(html).toContain('ROE gating only. Every ready effector fires when the window opens.')
    expect(html).not.toContain('Launch point')
    store.patchScenario({ doctrine: { ...doctrine, enabled: true, launchPolicy: 'pk-commit' } })
    html = render()
    expect(html).not.toContain('ROE gating only.')
    expect(html).toContain('class="seg pg-seg4"')
    for (const label of ['Max range', 'Fraction', 'Pk commit', 'Latest'])
      expect(html).toMatch(new RegExp(`title="[^"]+">${label}</button>`))
    expect(html).toContain('Declaration dwell')
    expect(html).not.toContain('Release range')
    store.patchScenario({
      doctrine: { ...doctrine, enabled: true, launchPolicy: 'range-fraction' },
    })
    expect(render()).toContain('Release range')
    useStore.getState().setSectionOpen('prepare-doctrine', false)
    expect(render()).toMatch(
      /class="psec-sum" title="ROE \w+ · Fraction · \d+ cycles · \d+ s dwell"/,
    )
  })

  it('renders six gate rows in kill-chain order with four pass-line boxes', () => {
    pathedThreats()
    const html = render()
    const gates = ['DETECT', 'TRACK', 'IDENTIFY', 'TARGET', 'ENGAGE', 'EFFECT']
    const table = html.slice(html.indexOf('class="gtable"'), html.indexOf('id="prepare-entities"'))
    expect(table.match(/class="gt-r[^"]*" role="row"/g)).toHaveLength(6)
    const at = gates.map((gate) => table.indexOf(`>${gate}`))
    expect(at.every((position) => position > 0)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(table.match(/<input[^>]*type="number"/g)).toHaveLength(4)
    expect(table).toContain('>Pd ≥</label>')
    expect(table).toContain('>warn ≥</label>')
    expect(table).toMatch(/placeholder="None"[^>]*\/><span class="nu-unit">s<\/span>/)
    expect(table).toContain('>cum. Pd ≥</label>')
    expect(table).toContain('>residual ≤</label>')
    expect(table.match(/title="No pass line for this gate"/g)).toHaveLength(3)
    // DETECT and EFFECT carry their metric as a sub-line.
    expect(table).toMatch(/>DETECT<small>[^<]+<\/small>/)
    expect(table).toMatch(/>EFFECT<small>[\d.]+% defeat<\/small>/)
    expect(table).toMatch(/>TRACK<\/span>/)
  })

  it('marks not-evaluated gates hollow with the reason, and a failed gate opens its blocking tracks', () => {
    pathedThreats()
    useStore.getState().patchScenario({ roe: 'hold' })
    const html = render()
    const hold = 'ROE hold: the run assigns no engagements'
    expect(
      html.match(
        new RegExp(
          `<span class="state inactive" title="${hold}"><i class="state-square hollow" aria-hidden="true"></i>N/E</span>`,
          'g',
        ),
      ),
    ).toHaveLength(3)
    expect(html).toMatch(
      /<button type="button" class="gt-toggle" aria-expanded="false" aria-controls="gate-\w+-blocking" title="Show blocking tracks"><span class="state critical"/,
    )
    useStore.getState().setSectionOpen('prepare-requirements', false)
    expect(render()).toMatch(
      /class="psec-sum" title="\d of 6 gates met · \d not evaluated · forecast"/,
    )
  })

  it('closes Entities by default with the counts and selects a row from the panel', () => {
    pathedThreats()
    const html = render()
    expect(html).toContain(
      '<section class="psec closed prepare-entity-register" id="prepare-entities">',
    )
    expect(html).toContain('title="3 placed · 2 threats">3 placed · 2 threats</span>')
    useStore.getState().setSectionOpen('prepare-entities', true)
    const open = render()
    expect(open).toContain(
      '<div class="prepare-entity-head">Threats <span class="mono">2</span></div>',
    )
    expect(open).toContain(
      '<div class="prepare-entity-head">Sensors <span class="mono">1</span></div>',
    )
    expect(open.indexOf('>Threats <')).toBeLessThan(open.indexOf('>Sensors <'))
    const threat = useStore.getState().scenario.entities.find((entity) => entity.kind === 'uas')!
    expect(open).toContain(`aria-label="Inspect ${threat.name}"`)
    expect(open).toContain(`<span class="prepare-entity-name">${threat.name}</span>`)
    expect(open).not.toContain(threat.id)
    rows.get(`Inspect ${threat.name}`)?.()
    const state = useStore.getState()
    expect(state.selection.entityIds).toEqual([threat.id])
    expect(state.ui.selectionOrigin).toBe('panel')
    // D7: a panel row keeps the current tab.
    expect(state.ui.rightTab).toBe('analysis')
  })
})
