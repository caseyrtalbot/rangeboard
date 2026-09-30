import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RunValidityAssessment, RunValidityFinding } from '../../analysis/runValidity'
import type { Entity } from '../../model/types'
import { useStore } from '../../state/store'
import { ValidityLine } from './ValidityLine'
import type { ValidityLineProps } from './ValidityLine'

// Buttons by their text, so a test can press one after a static render.
const buttons = vi.hoisted(() => new Map<string, () => void>())
vi.mock('react/jsx-dev-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react/jsx-dev-runtime')>()
  const jsxDEV: typeof actual.jsxDEV = (type, props, ...rest) => {
    const p = props as { children?: unknown; id?: string; onClick?: () => void }
    const text = [p.children].flat().filter((c) => typeof c === 'string')
    if (type === 'button' && p.onClick && text.length) buttons.set(text.join(''), p.onClick)
    if (type === 'button' && p.onClick && p.id) buttons.set(`#${p.id}`, p.onClick)
    return actual.jsxDEV(type, props, ...rest)
  }
  return { ...actual, jsxDEV }
})

const noAsset: RunValidityFinding = {
  id: 'no-defended-asset',
  severity: 'limiting',
  uasIds: [],
  gates: ['detect', 'track'],
  message: 'No defended asset is placed.',
}
const spawn: RunValidityFinding = {
  id: 'spawn-in-ring',
  severity: 'invalidating',
  uasIds: ['uas-1'],
  gates: ['detect'],
  message: 'A threat spawns inside a sensor ring.',
}
const entities = [{ id: 'uas-1', name: 'OWA-01 1' }] as Entity[]

function render(props: Partial<ValidityLineProps>): string {
  buttons.clear()
  // A static render reads the initial state: copy the live state into it.
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(
    <ValidityLine
      phase="prepare"
      assessment={null}
      source="forecast"
      entities={entities}
      {...props}
    />,
  )
}

function assessment(
  validity: RunValidityAssessment['validity'],
  findings: RunValidityFinding[],
): RunValidityAssessment {
  return { validity, findings }
}

describe('ValidityLine', () => {
  afterEach(() => {
    useStore.getState().setValidityOpen(false)
    useStore.getState().clearSelection()
  })

  it.each([
    ['valid', 'nominal', 'VALID', '0 findings'],
    ['valid-limited', 'warning', 'VALID, LIMITED', '1 finding'],
    ['invalid', 'critical', 'INVALID', '1 finding'],
    ['pending', 'inactive', 'PENDING', '1 finding'],
  ] as const)('reads the %s state word, tone and count', (validity, tone, word, count) => {
    const findings = validity === 'valid' ? [] : [noAsset]
    const html = render({ assessment: assessment(validity, findings) })
    expect(html).toContain(
      `<span class="state ${tone}"><i class="state-square" aria-hidden="true"></i>${word}</span>`,
    )
    expect(html).toContain(`<span class="vline-count">${count}</span>`)
    expect(html).toContain('<span class="vline-label">Forecast validity</span>')
    expect(html).toContain('aria-expanded="false"')
    // Closed: the findings do not render.
    expect(html).not.toContain('vline-finding')
  })

  it('reads PENDING without a chevron before a completed trial', () => {
    const html = render({ phase: 'analyze', source: 'trial' })
    expect(html).toContain('<span class="vline-label">Trial validity</span>')
    expect(html).toContain('PENDING')
    expect(html).toContain('No completed trial')
    expect(html).not.toContain('<button')
  })

  it('opens in place with the invalidating findings first', () => {
    useStore.getState().setValidityOpen(true)
    const html = render({ assessment: assessment('invalid', [noAsset, spawn]) })
    expect(html).toContain('aria-expanded="true"')
    expect(html.indexOf(spawn.message)).toBeLessThan(html.indexOf(noAsset.message))
    expect(html).toContain('Gates: DETECT · TRACK')
  })

  it('carries Place asset and the Select buttons', () => {
    useStore.getState().setValidityOpen(true)
    render({ assessment: assessment('invalid', [noAsset, spawn]) })
    const seq = useStore.getState().ui.libraryRequest.seq
    buttons.get('Place asset')!()
    expect(useStore.getState().ui.libraryRequest).toMatchObject({ seq: seq + 1, kind: 'asset' })
    useStore.getState().setRightTab('analysis')
    buttons.get('Select OWA-01 1')!()
    // D7: a panel selection keeps the current tab.
    expect(useStore.getState().selection.entityIds).toEqual(['uas-1'])
    expect(useStore.getState().ui.selectionOrigin).toBe('panel')
    expect(useStore.getState().ui.rightTab).toBe('analysis')
  })

  it('hides in Execute unless the status bar opened it', () => {
    const line = assessment('valid-limited', [noAsset])
    expect(render({ phase: 'execute', assessment: line })).toBe('')
    useStore.getState().setValidityOpen(true)
    expect(render({ phase: 'execute', assessment: line })).toContain('id="validity-line"')
  })

  it('toggles its open state from the line', () => {
    render({ assessment: assessment('valid-limited', [noAsset]) })
    buttons.get('#validity-line')!()
    expect(useStore.getState().ui.validityOpen).toBe(true)
  })
})
