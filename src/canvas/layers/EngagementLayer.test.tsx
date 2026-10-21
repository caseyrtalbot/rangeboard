import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, it, vi } from 'vitest'
import { emptyScenario } from '../../model/seed'
import type { ShotInFlight } from '../../playback/trackState'
import { useStore } from '../../state/store'
import { BOARD_INK_DARK } from '../../ui/ink'
import { EngagementLayer } from './EngagementLayer'

vi.mock('react-konva', () => ({
  Group: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Circle: () => <span>seeker</span>,
  // The layer names each line; the lock line reads 'guidance' here as it always has.
  Line: ({
    name,
    dash,
    stroke,
    fill,
    opacity,
  }: {
    name: 'beam' | 'lock' | 'round'
    dash?: number[]
    stroke?: string
    fill?: string
    opacity?: number
  }) => (
    <span data-stroke={stroke} data-fill={fill} data-dash={dash?.join(' ')} data-opacity={opacity}>
      {name === 'lock' ? 'guidance' : name}
    </span>
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

it('draws the lock line white, the round in the friend hue and a dotted line once the round seeks', () => {
  const guided = render({ ...shot, mode: 'semi-active', progress: 0.5 }, 16)
  expect(guided).toContain(`data-stroke="${BOARD_INK_DARK.selection}" data-opacity="0.7">guidance`)
  expect(guided).toContain(`data-fill="${BOARD_INK_DARK.friend}"`)
  expect(guided).not.toContain('seeker')
  const seeking = render({ ...shot, mode: 'active', progress: 0.5 }, 16)
  expect(seeking).toContain(
    `data-stroke="${BOARD_INK_DARK.selection}" data-dash="1 4" data-opacity="0.35">guidance`,
  )
  expect(seeking).toContain('seeker')
})

it('draws a jam as a dashed EW beam and a DE beam as a solid white line, at one constant opacity', () => {
  for (const tS of [16, 16.25]) {
    const jam = render({ ...shot, mode: 'beam', channel: 'jam', progress: 1 }, tS)
    expect(jam).toContain(`data-stroke="${BOARD_INK_DARK.ew}" data-dash="2 4"`)
    expect(jam).not.toContain('data-opacity')
    const de = render({ ...shot, mode: 'beam', progress: 1 }, tS)
    expect(de).toContain(`data-stroke="${BOARD_INK_DARK.selection}">beam`)
  }
})
