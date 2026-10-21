import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mixedTrial } from '../../playback/__fixtures__/trialFixture'
import { trialMemberStatesAt } from '../../playback/trialTrackState'
import { useStore } from '../../state/store'
import { OutcomeMarkLayer } from './OutcomeMarkLayer'

vi.mock('react-konva', () => ({
  Group: ({ children, x, y }: { children?: ReactNode; x?: number; y?: number }) => (
    <div data-x={x} data-y={y}>
      {children}
    </div>
  ),
  Line: () => <span>cross</span>,
  Circle: () => <span>circle</span>,
  Text: ({ text }: { text: string }) => <i>{text}</i>,
}))

const { scenario, view } = mixedTrial()

beforeEach(() => {
  useStore.getState().replaceScenario(scenario)
  Object.assign(useStore.getInitialState(), useStore.getState())
})

function render(horizonS: number | null) {
  return renderToStaticMarkup(<OutcomeMarkLayer trial={view} horizonS={horizonS} />)
}

describe('OutcomeMarkLayer', () => {
  it('draws nothing without a trial or a horizon', () => {
    expect(renderToStaticMarkup(<OutcomeMarkLayer trial={null} horizonS={5} />)).toBe('')
    expect(render(null)).toBe('')
  })

  it('shows a mark only once its effect has landed', () => {
    // The first gun kills land at 2 s on moving ship 2 and swarm ship 3.
    expect(render(1.9)).toBe('')
    const html = render(2)
    expect(html.match(/<i>K 0:02<\/i>/g)).toHaveLength(2)
    expect(html).not.toContain('circle')
  })

  it('marks a miss with the open circle and keeps earlier kills', () => {
    // The gun misses swarm ship 3 at 4 s; the soft kill at 3 s draws nothing.
    const html = render(4)
    expect(html).toContain('<span>circle</span><i>M 0:04</i>')
    expect(html.match(/<i>K 0:02<\/i>/g)).toHaveLength(2)
    expect(html).not.toContain('0:03')
  })

  it('places a kill at the position the member held when the effect landed', () => {
    const member = trialMemberStatesAt(view, 'moving', 2)[2]
    expect(render(2)).toContain(`data-x="${member.position.x}" data-y="${member.position.y}"`)
  })

  it('draws a late kill and no jam dwell at the end of the run', () => {
    // Swarm ship 4 is killed late at 8 s; the jammer soft kill at 9 s is not a mark.
    const html = render(10)
    expect(html).toContain('K 0:08')
    expect(html).not.toContain('0:09')
  })
})
