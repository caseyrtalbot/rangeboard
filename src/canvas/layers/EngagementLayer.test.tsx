import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, it, vi } from 'vitest'
import { emptyScenario } from '../../model/seed'
import type { ShotInFlight } from '../../playback/trackState'
import { useStore } from '../../state/store'
import { EngagementLayer } from './EngagementLayer'

vi.mock('react-konva', () => ({
  Group: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Circle: () => <span>seeker</span>,
  Line: ({ closed, dash }: { closed?: boolean; dash?: number[] }) => (
    <span>{closed ? 'round' : dash ? 'beam' : 'guidance'}</span>
  ),
}))

const shot: ShotInFlight = {
  effectorId: 'launcher',
  uasId: 'threat',
  shipIdx: 0,
  tS: 10,
  tReleaseS: 15,
  tEffectS: 20,
  progress: 0,
  channel: 'kill',
  softShot: false,
  pk: 0.5,
  from: { x: 0, y: 0 },
  to: { x: 1000, y: 0 },
  mode: 'active',
}

beforeEach(() => {
  useStore.getState().replaceScenario(emptyScenario())
  useStore.getState().setBoardPhase('execute')
  Object.assign(useStore.getInitialState(), useStore.getState())
})

function render(event: ShotInFlight, tS: number) {
  return renderToStaticMarkup(<EngagementLayer shots={[event]} displayTimeS={tS} />)
}

it('renders no round or guidance during preparation', () => {
  expect(render(shot, 14.9)).not.toContain('round')
  expect(render(shot, 14.9)).not.toContain('guidance')
  expect(render(shot, 15)).toContain('round')
})

it('renders beams without a traveling round or seeker', () => {
  const html = render({ ...shot, mode: 'beam', progress: 1 }, 16)
  expect(html).toContain('beam')
  expect(html).not.toContain('round')
  expect(html).not.toContain('seeker')
})

it('does not fabricate a kinetic round for a zero-flight interval', () => {
  expect(render({ ...shot, tEffectS: 15, progress: 1 }, 15)).not.toContain('round')
  expect(render({ ...shot, tEffectS: 15, progress: 1, mode: 'beam' }, 15)).toContain('beam')
})
