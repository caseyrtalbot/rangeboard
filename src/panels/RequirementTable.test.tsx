import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RequirementGate, RequirementGateReport } from '../analysis/requirements'
import { emptyScenario } from '../model/seed'
import { useStore } from '../state/store'
import { RequirementTable } from './RequirementTable'

// The boxes have no local state; their change handlers are captured by id from the markup.
const changes = vi.hoisted(() => new Map<string, (event: { target: { value: string } }) => void>())
// The open gate is local state; a test seeds it through the first useState call.
const openGate = vi.hoisted(() => ({ current: undefined as string | undefined }))
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  const useState = ((init: unknown) =>
    actual.useState(openGate.current ?? init)) as typeof actual.useState
  return { ...actual, useState }
})
vi.mock('react/jsx-dev-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react/jsx-dev-runtime')>()
  const jsxDEV: typeof actual.jsxDEV = (type, props, ...rest) => {
    const p = props as { id?: string; onChange?: (event: { target: { value: string } }) => void }
    if (type === 'input' && p.id && p.onChange) changes.set(p.id, p.onChange)
    return actual.jsxDEV(type, props, ...rest)
  }
  return { ...actual, jsxDEV }
})

function gate(
  patch: Partial<RequirementGate> & Pick<RequirementGate, 'id' | 'label'>,
): RequirementGate {
  return {
    status: 'pass',
    met: 2,
    required: 2,
    metric: '2/2',
    detail: 'detail',
    caveats: [],
    notEvaluatedReason: null,
    failures: [],
    ...patch,
  }
}

const REPORT: RequirementGateReport = {
  basis: 'planning-envelope',
  overall: 'fail',
  met: 3,
  required: 6,
  gates: [
    gate({ id: 'detect', label: 'Detect', metric: 'first 3:01' }),
    gate({
      id: 'track',
      label: 'Track',
      status: 'fail',
      met: 1,
      failures: [{ uasId: 'u2', name: 'OWA-02', reason: 'not held at 4:10' }],
    }),
    gate({ id: 'identify', label: 'Identify' }),
    gate({
      id: 'target',
      label: 'Target',
      status: 'not-evaluated',
      met: 0,
      notEvaluatedReason: 'ROE hold: the run assigns no engagements',
    }),
    gate({ id: 'engage', label: 'Engage' }),
    gate({ id: 'effect', label: 'Effect', status: 'fail', met: 0, metric: '15.2% defeat' }),
  ],
}

function render(): string {
  changes.clear()
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<RequirementTable report={REPORT} />)
}

describe('RequirementTable', () => {
  beforeEach(() => {
    useStore.getState().replaceScenario(emptyScenario())
  })

  it('lays gate, pass line (label and box) and met as three table columns', () => {
    const html = render()
    expect(html).toContain(
      '<div class="gt-h" role="row"><span role="columnheader">Gate</span><span class="gt-thr" role="columnheader">Pass line</span><span class="gt-met" role="columnheader">Met</span></div>',
    )
    expect(html.match(/role="row"/g)).toHaveLength(7)
    expect(html).toMatch(
      /<span class="gt-tl"><label class="gt-q" for="gate-detect-pdDetect" title="[^"]+">Pd ≥<\/label><input id="gate-detect-pdDetect"/,
    )
    expect(html).toContain('>DETECT<small>first 3:01</small></span>')
    expect(html).toContain('>EFFECT<small>15.2% defeat</small></span>')
    expect(html).not.toContain('<small>2/2</small>')
  })

  it('shows met in the tone of the status and a hollow N/E with its reason', () => {
    const html = render()
    expect(html).toContain('<span class="state nominal" title="Detect: 2/2 met · first 3:01">')
    expect(html).toContain(
      '<span class="state inactive" title="ROE hold: the run assigns no engagements"><i class="state-square hollow" aria-hidden="true"></i>N/E</span>',
    )
    // A failed gate with blocking tracks opens them; one without failures is a plain state.
    expect(html).toMatch(
      /<button type="button" class="gt-toggle" aria-expanded="false" aria-controls="gate-track-blocking" title="Show blocking tracks"><span class="state critical"[^>]*><i class="state-square" aria-hidden="true"><\/i>1\/2<\/span><\/button>/,
    )
    expect(html).not.toContain('gate-effect-blocking')
    expect(html).not.toContain('class="gt-fail"')
  })

  it('spans the one blocking cell over the three columns', () => {
    openGate.current = 'track'
    const html = render()
    openGate.current = undefined
    expect(html).toContain(
      '<div class="gt-fail" id="gate-track-blocking" role="row"><span class="gt-fail-cell" role="cell" aria-colspan="3">',
    )
  })

  it('keeps the clamp and blank rules of the requirement inputs', () => {
    render()
    changes.get('gate-detect-pdDetect')?.({ target: { value: '2' } })
    expect(useStore.getState().scenario.requirements?.pdDetect).toBe(0.99)
    changes.get('gate-detect-pdDetect')?.({ target: { value: '' } })
    expect(useStore.getState().scenario.requirements?.pdDetect).toBe(0.99)
    changes.get('gate-detect-minWarningS')?.({ target: { value: '30' } })
    expect(useStore.getState().scenario.requirements?.minWarningS).toBe(30)
    changes.get('gate-detect-minWarningS')?.({ target: { value: '' } })
    expect(useStore.getState().scenario.requirements?.minWarningS).toBeNull()
    changes.get('gate-effect-maxResidualPerTrack')?.({ target: { value: '-1' } })
    expect(useStore.getState().scenario.requirements?.maxResidualPerTrack).toBe(0)
  })
})
