import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Boundary } from '../model/types'
import { CAP_POINTS_PER_LAP } from '../model/cap'
import { useStore } from '../state/store'
import { emptyScenario } from '../model/seed'
import { CapExitField } from './CapExitField'

// Node has no DOM renderer; record each button by its text, so a test can fire the
// real handler.
const buttons = vi.hoisted(() => new Map<string, () => void>())
vi.mock('react/jsx-dev-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react/jsx-dev-runtime')>()
  type Props = { children?: unknown; onClick?: () => void }
  const jsxDEV: typeof actual.jsxDEV = (type, props, ...rest) => {
    const p = props as Props
    if (type === 'button' && typeof p.children === 'string' && p.onClick)
      buttons.set(p.children, p.onClick)
    return actual.jsxDEV(type, props, ...rest)
  }
  return { ...actual, jsxDEV }
})

function path() {
  return useStore.getState().scenario.paths[0]
}

function render(): string {
  buttons.clear()
  Object.assign(useStore.getInitialState(), useStore.getState())
  const p = path()
  return renderToStaticMarkup(<CapExitField path={p} cap={p.cap!} />)
}

function addPhaseLine(name: string) {
  const s = useStore.getState().scenario
  const line: Boundary = {
    id: 'pl',
    name,
    type: 'phase-line',
    points: [
      { x: 5000, y: -9000 },
      { x: 5000, y: 3000 },
    ],
    closed: false,
    altBandFt: null,
    designation: 'PL',
  }
  useStore.getState().replaceScenario({ ...s, boundaries: [...s.boundaries, line] })
}

describe('CapExitField', () => {
  beforeEach(() => {
    const st = useStore.getState()
    st.replaceScenario(emptyScenario())
    st.addEntityFromModel('lib-mugin5', { x: 0, y: 0 })
    useStore.getState().beginCap(useStore.getState().scenario.entities[0].id)
    useStore.getState().addDraftPoint({ x: 0, y: -4000 })
    useStore.getState().finishCap({ x: 1000, y: -4000 })
  })

  it('stops on the orbit by default', () => {
    expect(render()).toMatch(/aria-pressed="true" class="active"[^>]*>Stop</)
  })

  it('disables Egress with no phase line on the board', () => {
    const html = render()
    expect(html).toMatch(/disabled="">Egress</)
    expect(html).toContain('Draw a phase line first (Boundary tool).')
  })

  it('writes the exit to the first phase line and the path gains the egress points', () => {
    addPhaseLine('BLUE')
    const before = path().points.length
    expect(before).toBe(2 + 3 * CAP_POINTS_PER_LAP)
    render()
    buttons.get('Egress')!()
    expect(path().cap?.exit).toEqual({ kind: 'egress', boundaryId: 'pl' })
    expect(path().points).toHaveLength(before + 2)
    const html = render()
    expect(html).toMatch(/aria-pressed="true" class="active"[^>]*>Egress</)
    expect(html).toContain('PL BLUE')
  })

  it('Stop clears the exit and the egress points', () => {
    addPhaseLine('BLUE')
    render()
    buttons.get('Egress')!()
    const withExit = path().points.length
    render()
    buttons.get('Stop')!()
    expect(path().cap?.exit).toBeNull()
    expect(path().points).toHaveLength(withExit - 2)
  })

  it('keeps a missing line on Egress until the user acts', () => {
    addPhaseLine('BLUE')
    render()
    buttons.get('Egress')!()
    const s = useStore.getState().scenario
    useStore.getState().replaceScenario({ ...s, boundaries: [] })
    const html = render()
    expect(html).toMatch(/aria-pressed="true" class="active"[^>]*>Egress</)
    expect(html).toContain('>missing</option>')
  })
})
