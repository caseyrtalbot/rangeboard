import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { mixedTrial } from '../../playback/__fixtures__/trialFixture'
import { useStore } from '../../state/store'
import { ThreatWezLayer, visibleImpactArrivals } from './ThreatWezLayer'

vi.mock('react-konva', () => ({
  Group: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Text: ({ text }: { text: string }) => <span>{text}</span>,
  Circle: () => null,
  Line: () => null,
  RegularPolygon: () => null,
}))

function fixture() {
  const { view, scenario, result } = mixedTrial()
  scenario.entities[0].specId = 'strike'
  scenario.library.push({
    id: 'strike',
    name: 'Strike',
    kind: 'uas',
    builtin: false,
    description: '',
    color: '#fff',
    uas: {
      group: 1,
      airframe: 'fixed-wing',
      cruiseSpeedMps: 10,
      altBandFt: [100, 100],
      navMode: 'gps',
      weaponProfile: 'impact',
      warheadKg: 10,
      maxSpeedMps: 20,
      enduranceMin: 30,
      emissionsNote: '',
    },
  })
  Object.assign(result.assessments[0], {
    assetId: 'asset',
    cpaAssetId: 'asset',
    cpaDistanceM: 0,
    cpaS: 5,
  })
  return { view, scenario }
}

describe('trial arrival badges', () => {
  it('uses integer reached leakage and preserves credit after late effects', () => {
    const { view } = fixture()
    expect(visibleImpactArrivals(view, 4.99)).toEqual([])
    expect(visibleImpactArrivals(view, 5)[0]).toMatchObject({
      ships: 3,
      warheadKg: 30,
      arrivalS: 5,
    })
    expect(visibleImpactArrivals(view, 20)[0].ships).toBe(3)
    expect(visibleImpactArrivals(null, 20)).toEqual([])
    expect(visibleImpactArrivals(view, null)).toEqual([])
  })

  it('hides future badges during geometry preview and all badges before observation in every phase', () => {
    const { view, scenario } = fixture()
    useStore.getState().replaceScenario(scenario)
    const render = (horizonS: number | null) => {
      Object.assign(useStore.getInitialState(), useStore.getState())
      return renderToStaticMarkup(
        <ThreatWezLayer tracks={new Map()} trial={view} horizonS={horizonS} displayTimeS={50} />,
      )
    }
    for (const phase of ['prepare', 'execute', 'analyze'] as const) {
      useStore.getState().setBoardPhase(phase)
      expect(render(null)).not.toContain('I&amp;W')
      expect(render(4)).not.toContain('I&amp;W')
    }
    expect(render(5)).toContain('3 members · 30 kg')
  })
})
