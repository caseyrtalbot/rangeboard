import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, it, vi } from 'vitest'
import { emptyScenario } from '../../model/seed'
import type { Scenario } from '../../model/types'
import { useStore } from '../../state/store'
import { capPathPoints } from '../../model/cap'
import { PathLayer } from './PathLayer'

vi.mock('react-konva', () => ({
  Group: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Arrow: () => <span>arrow</span>,
  Circle: () => <span>vertex</span>,
  Line: () => <span>line</span>,
  Text: ({ text }: { text: string }) => <span>{text}</span>,
}))

function laydown(points: Scenario['paths'][number]['points']): Scenario {
  const s = emptyScenario()
  const uas = s.library.find((m) => m.kind === 'uas')!
  s.entities = [
    {
      id: 'u',
      name: 'U',
      kind: 'uas',
      specId: uas.id,
      pos: { x: 0, y: 0 },
      headingDeg: 0,
      color: null,
      notes: '',
    },
  ]
  s.paths = [{ id: 'p', entityId: 'u', points, speedMps: 10, startDelayS: 0 }]
  return s
}

// Static markup reads the server snapshot, which zustand takes from the initial state.
function install(scenario: Scenario) {
  useStore.getState().replaceScenario(scenario)
  useStore.getState().setBoardPhase('execute')
  Object.assign(useStore.getInitialState(), useStore.getState())
}

beforeEach(() => install(emptyScenario()))

it('draws a two-point path with its caption', () => {
  install(
    laydown([
      { x: 0, y: -1000 },
      { x: 0, y: 0 },
    ]),
  )
  const html = renderToStaticMarkup(<PathLayer mouseWorld={null} />)
  expect(html).toContain('arrow')
  expect(html).toMatch(/ · \d+ s/)
})

it.each([[[]], [[{ x: 0, y: 0 }]]])('renders nothing for a path with points %j', (points) => {
  install(laydown(points))
  expect(renderToStaticMarkup(<PathLayer mouseWorld={null} />)).toBe('')
})

it('draws the egress leg of a CAP that exits over a phase line', () => {
  const s = laydown([])
  const cap = {
    center: { x: 0, y: -3000 },
    radiusM: 1000,
    laps: 1,
    exit: { kind: 'egress' as const, boundaryId: 'pl' },
  }
  s.boundaries = [
    {
      id: 'pl',
      name: 'BLUE',
      type: 'phase-line',
      points: [
        { x: 4000, y: -9000 },
        { x: 4000, y: 3000 },
      ],
      closed: false,
      altBandFt: null,
      designation: 'PL',
    },
  ]
  s.paths[0] = {
    ...s.paths[0],
    cap,
    points: capPathPoints({ x: 0, y: 0 }, cap, s.boundaries[0].points),
  }
  install(s)
  const html = renderToStaticMarkup(<PathLayer mouseWorld={null} />)
  expect(html).toContain('arrow')
  expect(html).toContain('egress PL BLUE')
})
