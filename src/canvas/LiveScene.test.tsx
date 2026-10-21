import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { mixedTrial } from '../playback/__fixtures__/trialFixture'
import { trialSweepAt } from '../playback/trialSweepAt'
import { useStore } from '../state/store'
import { LiveScene, renderedTrialGeometry } from './LiveScene'
import { StaticScene, trialActiveIds } from './StaticScene'

vi.mock('./frameClock', () => ({ useFrameClock: () => ({ simTimeS: 50, displayTimeS: 50 }) }))
vi.mock('react-konva', () => ({
  Group: ({
    children,
    name,
    x,
    y,
  }: {
    children?: ReactNode
    name?: string
    x?: number
    y?: number
  }) => (
    <div data-name={name} data-x={x} data-y={y}>
      {children}
    </div>
  ),
  Text: ({ text }: { text: string }) => <span>{text}</span>,
  Circle: ({ stroke }: { stroke?: string }) => (stroke ? <span>ring:{stroke}</span> : null),
  // The round is the one closed Line with a fill and no stroke; a diamond frame is stroked.
  Line: ({ closed, stroke }: { closed?: boolean; stroke?: string }) =>
    closed && !stroke ? <span>round</span> : null,
  RegularPolygon: () => null,
  Path: () => null,
  Rect: () => null,
}))
vi.mock('./layers/PathLayer', () => ({ PathLayer: () => <span>known-path</span> }))
vi.mock('./layers/SystemHandleLayer', () => ({ SystemHandleLayer: () => null }))
vi.mock('./layers/CalloutLayer', () => ({ CalloutLayer: () => null }))
vi.mock('./layers/BoundaryLayer', () => ({ BoundaryLayer: () => null }))
vi.mock('./layers/RangeLayer', () => ({ RangeLayer: () => null }))
vi.mock('./layers/ConnectionLayer', () => ({ ConnectionLayer: () => null }))
vi.mock('./layers/FootprintLayer', () => ({
  FootprintLayer: ({ runActiveIds }: { runActiveIds: Set<string> }) => (
    <span>active-systems:{[...runActiveIds].join(',')}</span>
  ),
}))

describe('sampled canvas scene', () => {
  it('freezes the actual hard-killed member while survivors and soft kills move, and restores motion on rewind', () => {
    const { scenario, view } = mixedTrial()
    const at3 = renderedTrialGeometry(scenario, view, 3, 3).members.get('swarm')!
    const at20 = renderedTrialGeometry(scenario, view, 20, 20).members.get('swarm')!
    expect(at20[3].position).toEqual(at3[3].position)
    expect(at20[3].heading).toBe(at3[3].heading)
    expect(at20[0].position).not.toEqual(at3[0].position)
    expect(at20[1].outcome).toBe('mission-kill')
    expect(at20[1].position).not.toEqual(at3[1].position)
    const rewind = renderedTrialGeometry(scenario, view, 1, 1).members.get('swarm')!
    expect(rewind[3].outcome).toBe('active')
    expect(rewind[3].position).not.toEqual(at3[3].position)
    const preview = renderedTrialGeometry(scenario, view, 3, 20).members.get('swarm')!
    expect(preview[4].outcome).toBe('active')
    expect(preview[3].position).toEqual(at3[3].position)
    expect(preview[0].position).toEqual(at20[0].position)
  })

  it.each(['idle', 'preparing', 'error', 'cancelled'])(
    '%s selection renders configuration and known paths without outcome elements',
    () => {
      const { scenario } = mixedTrial()
      useStore.getState().replaceScenario(scenario)
      useStore.getState().setBoardPhase('execute')
      Object.assign(useStore.getInitialState(), useStore.getState())
      const html = renderToStaticMarkup(
        <>
          <LiveScene
            scenario={scenario}
            trial={null}
            horizonS={null}
            camera={{ x: 0, y: 0, scale: 1 }}
            size={{ w: 1200, h: 800 }}
            mouseWorld={null}
            durationS={60}
          />
          <StaticScene trial={null} horizonS={null} />
        </>,
      )
      expect(html).toContain('known-path')
      expect(html).toContain('member:swarm:3')
      for (const outcome of [
        'HK',
        'MK',
        'ASN',
        'MIF',
        'EMPTY',
        'round',
        'I&amp;W',
        'active-systems:radar',
      ])
        expect(html).not.toContain(outcome)
    },
  )

  it('keeps shot release and future effects bounded while geometry previews ahead', () => {
    const { scenario, view } = mixedTrial()
    useStore.getState().replaceScenario(scenario)
    useStore.getState().setBoardPhase('execute')
    Object.assign(useStore.getInitialState(), useStore.getState())
    const render = (horizonS: number) =>
      renderToStaticMarkup(
        <LiveScene
          scenario={scenario}
          trial={view}
          horizonS={horizonS}
          camera={{ x: 0, y: 0, scale: 1 }}
          size={{ w: 1200, h: 800 }}
          mouseWorld={null}
          durationS={60}
        />,
      )
    // The swarm round releases at 1.8, while moving's round is already in flight.
    expect(render(1.3).match(/>round</g)).toHaveLength(1)
    expect(render(1.8).match(/>round</g)).toHaveLength(2)
    expect(render(1.8)).not.toContain('HK')
    expect(render(1.8)).not.toContain('MK')
  })

  it('keeps measured and held sensors active, with coast and pre-scan states distinct', () => {
    const { view } = mixedTrial()
    const ids = (t: number) => [...trialActiveIds(trialSweepAt(view, t))]
    // The gun engages throughout; the radar lights only while measured or held.
    expect(ids(1)).toEqual(['gun'])
    expect(ids(1.1)).toEqual(['radar', 'gun'])
    expect(ids(3.1)).toEqual(['gun'])
    expect(trialActiveIds(trialSweepAt(view, 3))).toBe(trialActiveIds(trialSweepAt(view, 1.5)))
  })

  it('keeps an engaging effector active from preparation through the beam, and rests it after', () => {
    const { view } = mixedTrial()
    const ids = (t: number) => [...trialActiveIds(trialSweepAt(view, t))]
    expect(ids(0.5)).toContain('gun')
    expect(ids(1.2)).toContain('jammer')
    expect(ids(1.4)).toContain('jammer')
    expect(ids(2)).toEqual(['radar', 'jammer'])
    expect(ids(4)).toEqual([])
    const sweep = trialSweepAt(view, 4)
    const states = new Map([
      ['idle-gun', 'idle'],
      ['spent-gun', 'depleted'],
      ['beam-jammer', 'beam'],
    ] as const)
    expect([...trialActiveIds({ ...sweep, effectorStates: states })]).toEqual(['beam-jammer'])
  })
})
