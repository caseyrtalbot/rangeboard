import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyScenario } from '../../model/seed'
import type { Entity } from '../../model/types'
import type { Laydown, OptimizeResult } from '../../playback/optimizeTypes'
import { analysisBasisSignature } from '../../state/analysisBasis'
import { IDLE_MC, IDLE_OPTIMIZE } from '../../state/runState'
import { useStore } from '../../state/store'
import { PlacementPreviewLayer } from './PlacementPreviewLayer'

vi.mock('react-konva', () => ({
  Group: ({ children, x, y }: { children?: ReactNode; x?: number; y?: number }) => (
    <div data-x={x} data-y={y}>
      {children}
    </div>
  ),
  Text: ({ text }: { text: string }) => <span>{text}</span>,
  Line: ({ points }: { points: number[] }) => <i data-leader={points.join(' ')} />,
  Path: () => null,
  Circle: () => null,
  Rect: () => null,
}))

const entity = (id: string, name: string, x: number, y: number): Entity => ({
  id,
  name,
  kind: 'effector',
  specId: null,
  pos: { x, y },
  headingDeg: 0,
  color: null,
  notes: '',
})

/** Only the identity of a result matters to the layer. */
const result = () => ({ candidates: [] }) as unknown as OptimizeResult

function install(source: OptimizeResult) {
  const { playback, scenario } = useStore.getState()
  useStore.setState({
    mc: {
      ...IDLE_MC,
      optimize: {
        ...IDLE_OPTIMIZE,
        status: 'done',
        runId: playback.runId,
        summary: source,
        basisSignature: analysisBasisSignature(scenario),
      },
    },
  })
}

function render(positions: Laydown, source: OptimizeResult) {
  useStore.getState().setPlacementPreview({ rank: 1, positions, source })
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<PlacementPreviewLayer />)
}

describe('PlacementPreviewLayer', () => {
  beforeEach(() => {
    const s = emptyScenario()
    s.entities.push(entity('ent-a', 'Coyote 1', 100, 200), entity('ent-b', 'Coyote 2', 0, 0))
    useStore.getState().replaceScenario(s)
    useStore.setState({ mc: IDLE_MC })
  })

  it('draws nothing unless the preview belongs to the current result', () => {
    const positions = { 'ent-a': { x: 500, y: 600 } }
    expect(render(positions, result())).toBe('')
    install(result())
    // A rerun installs a new result object: the old preview no longer matches.
    expect(render(positions, result())).toBe('')
    const current = useStore.getState().mc.optimize.summary!
    expect(render(positions, current)).toContain('data-leader="100 200 500 600"')
  })

  it('draws a frame and the short name at the candidate, with a leader from 0.5 m out', () => {
    install(result())
    const current = useStore.getState().mc.optimize.summary!
    const html = render({ 'ent-a': { x: 100.3, y: 200.3 }, 'ent-b': { x: 0, y: 0.5 } }, current)
    expect(html).toContain('data-x="100.3" data-y="200.3"')
    expect(html).toContain('data-x="0" data-y="0.5"')
    // ent-a moves 0.42 m and draws no leader; ent-b moves 0.5 m and draws one.
    expect(html.match(/data-leader=/g)).toHaveLength(1)
    expect(html).toContain('data-leader="0 0 0 0.5"')
    expect(html).toContain('<span>COYOTE 1</span>')
  })

  it('draws only the ids that exist in the scenario', () => {
    install(result())
    const current = useStore.getState().mc.optimize.summary!
    const html = render({ 'ent-gone': { x: 9, y: 9 }, 'ent-b': { x: 50, y: 50 } }, current)
    expect(html).not.toContain('data-x="9"')
    expect(html.match(/data-leader=/g)).toHaveLength(1)
  })
})
