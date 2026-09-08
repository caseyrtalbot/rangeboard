import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { mixedTrial } from '../../playback/__fixtures__/trialFixture'
import { trialSweepAt } from '../../playback/trialSweepAt'
import { trialTelemetryAt } from '../../panels/analysis/threatReadout'
import { useStore } from '../../state/store'
import { renderedTrialGeometry } from '../LiveScene'
import { EntityLayer } from './EntityLayer'

vi.mock('react-konva', () => ({
  Group: ({ children, name, x, y }: { children?: ReactNode; name?: string; x?: number; y?: number }) => <div data-name={name} data-x={x} data-y={y}>{children}</div>,
  Text: ({ text }: { text: string }) => <span>{text}</span>,
  Circle: () => null, Line: () => null, RegularPolygon: () => null, Path: () => null, Rect: () => null,
}))

describe('EntityLayer member rendering', () => {
  it('marks the retained jammed member without assigning its jam to the lead', () => {
    const { scenario, view } = mixedTrial()
    useStore.getState().replaceScenario(scenario)
    Object.assign(useStore.getInitialState(), useStore.getState())
    const sweep = trialSweepAt(view, 1.5)
    const states = new Map(view.assessments.map(a => [a.uasId, trialTelemetryAt(view, a.uasId, 1.5, sweep)]))
    const geometry = renderedTrialGeometry(scenario, view, 1.5, 1.5)
    const html = renderToStaticMarkup(<EntityLayer {...geometry} states={states} sweep={sweep} spokeIds={new Set()} blink={false} />)
    const member = geometry.members.get('swarm')![2]
    expect(html).toContain(`data-name="member:swarm:2" data-x="${member.position.x}" data-y="${member.position.y}"><span>J</span>`)
    expect(html.match(/>J<\/span>/g)).toHaveLength(1)
  })

  it('draws each actual member once at its rendered position with one group label', () => {
    const { scenario, view } = mixedTrial()
    useStore.getState().replaceScenario(scenario)
    useStore.getState().setBoardPhase('prepare')
    Object.assign(useStore.getInitialState(), useStore.getState())
    const sweep = trialSweepAt(view, 3)
    const states = new Map(view.assessments.map(a => [a.uasId, trialTelemetryAt(view, a.uasId, 3, sweep)]))
    const render = (t: number) => {
      const geometry = renderedTrialGeometry(scenario, view, 3, t)
      return { geometry, html: renderToStaticMarkup(<EntityLayer {...geometry} states={states} sweep={sweep} spokeIds={new Set()} blink={false} />) }
    }
    const early = render(3)
    const later = render(30)
    for (let memberIdx = 0; memberIdx < 5; memberIdx++) {
      const member = later.geometry.members.get('swarm')![memberIdx]
      expect(later.html.match(new RegExp(`data-name="member:swarm:${memberIdx}"`, 'g'))).toHaveLength(1)
      expect(later.html).toContain(`data-name="member:swarm:${memberIdx}" data-x="${member.position.x}" data-y="${member.position.y}"`)
    }
    expect(later.geometry.members.get('swarm')![3].position).toEqual(early.geometry.members.get('swarm')![3].position)
    expect(later.geometry.members.get('swarm')![0].position).not.toEqual(early.geometry.members.get('swarm')![0].position)
    expect(later.html.match(/>SWARM</g)).toHaveLength(1)
    expect(later.html).toContain('3 active')
    expect(later.html).toContain('1 hard kill')
    expect(later.html).toContain('1 mission kill')
    expect(later.html).toContain('>MK</span>')
  })
})
