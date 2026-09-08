import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_HORIZON, FULL_RUN } from '../../analysis/horizon'
import type { LeakerImpact } from '../../analysis/impact'
import { emptyScenario } from '../../model/seed'
import { useStore } from '../../state/store'
import { ThreatWezLayer, visibleImpactArrivals } from './ThreatWezLayer'

// Konva draws into canvas; expose only text and child content for markup checks.
vi.mock('react-konva', () => ({
  Group: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Text: ({ text }: { text: string }) => <span>{text}</span>,
  Circle: () => null,
  Line: () => null,
  RegularPolygon: () => null,
}))

const impact: LeakerImpact = {
  uasId: 'threat', name: 'Threat', assetId: 'asset', assetName: 'Asset',
  arrivalS: 475, cpaS: 500, assetInWez: true,
  expectedShipsArriving: 2, expectedWarheadKg: 40, jamDegradedProb: 0, severity: 'severe',
}
const early: LeakerImpact = {
  ...impact, uasId: 'early', arrivalS: 20, severity: 'moderate',
  expectedShipsArriving: 0.5, expectedWarheadKg: 5,
}

describe('visibleImpactArrivals', () => {
  it('keeps full-run display-time behavior and arrival order', () => {
    expect(visibleImpactArrivals([impact, early], 0, FULL_RUN)).toEqual([])
    expect(visibleImpactArrivals([impact, early], 30, FULL_RUN)).toEqual([early])
    expect(visibleImpactArrivals([impact, early], 500, FULL_RUN)).toEqual([early, impact])
  })

  it('requires both cursor and observed horizon to reach an arrival', () => {
    const h = { scoped: true, horizonS: 30 }
    expect(visibleImpactArrivals([impact, early], 500, h)).toEqual([early])
    expect(visibleImpactArrivals([impact, early], 10, h)).toEqual([])
    expect(visibleImpactArrivals([impact], 500, { scoped: true, horizonS: 475 })).toEqual([impact])
    expect(visibleImpactArrivals([impact, early], 500, EMPTY_HORIZON)).toEqual([])
    expect(visibleImpactArrivals([{ ...early, arrivalS: 0 }], 500, { scoped: true, horizonS: 0 })).toEqual([])
  })

  it('requires severity, asset and arrival', () => {
    expect(visibleImpactArrivals([
      { ...early, severity: null }, { ...early, assetId: null }, { ...early, arrivalS: null },
    ], 500, FULL_RUN)).toEqual([])
  })
})

describe('ThreatWezLayer execution badges', () => {
  beforeEach(() => {
    const scenario = emptyScenario()
    scenario.entities = [{
      id: 'asset', name: 'Asset', kind: 'asset', specId: 'lib-asset',
      pos: { x: 0, y: 0 }, headingDeg: 0, color: null, notes: '',
    }]
    useStore.getState().replaceScenario(scenario)
    useStore.getState().setBoardPhase('execute')
  })

  function render(displayTimeS: number) {
    Object.assign(useStore.getInitialState(), useStore.getState())
    return renderToStaticMarkup(<ThreatWezLayer tracks={new Map()} impacts={[impact, early]} displayTimeS={displayTimeS} />)
  }

  it('hides all summary and leaker text before Play and at T0', () => {
    expect(render(0)).not.toContain('I&amp;W')
    useStore.getState().scrubTo(500)
    expect(render(500)).not.toContain('ships')
    useStore.getState().advanceRun(0)
    expect(render(0)).not.toContain('ships')
  })

  it('counts only reached arrivals when geometry previews beyond them', () => {
    useStore.getState().advanceRun(30)
    useStore.getState().pauseRun()
    useStore.getState().scrubTo(500)
    const html = render(500)
    expect(html).toContain('0.5 ships · 5 kg')
    expect(html).not.toContain('SEVERE')
    expect(html).not.toContain('40 kg')
  })

  it('keeps the original T0 aggregate in Prepare and Analyze', () => {
    useStore.getState().setBoardPhase('prepare')
    const prepare = render(0)
    expect(prepare).toContain('2.5 ships · 45 kg')
    useStore.getState().setBoardPhase('analyze')
    expect(render(0)).toBe(prepare)
  })
})
