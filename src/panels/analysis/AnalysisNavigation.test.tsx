import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { useStore } from '../../state/store'
import { AnalysisNavigation } from './AnalysisNavigation'
import { PHASE_SCREENS } from './screens/navigation'
import type { BoardPhase } from '../../state/runState'

describe('AnalysisNavigation', () => {
  it.each(['prepare', 'analyze'] as BoardPhase[])('shows only the screens for %s', (phase) => {
    const options = PHASE_SCREENS[phase]
    for (const selected of options) {
      const html = renderToStaticMarkup(
        <AnalysisNavigation phase={phase} screen={selected.v} selected onNavigate={() => {}} />,
      )
      expect(html).toContain('class="insp-tab-group"')
      expect(html.match(/role="tab"/g)).toHaveLength(options.length)
      expect(html.match(/aria-selected="true"/g)).toHaveLength(1)
      expect(html).toContain(`class="active">${selected.label}</button>`)
      expect(html.match(/id="insp-tab-analysis"/g)).toHaveLength(1)
      for (const option of options) expect(html).toContain(`>${option.label}</button>`)
      expect(html).not.toContain('class="seg"')
    }
  })

  it('orders Prepare as Inputs, Fragility, Placement', () => {
    const html = renderToStaticMarkup(
      <AnalysisNavigation phase="prepare" screen="fragility" selected onNavigate={() => {}} />,
    )
    const labels = [...html.matchAll(/>([^<>]+)<\/button>/g)].map((m) => m[1])
    expect(labels).toEqual(['Inputs', 'Fragility', 'Placement'])
  })

  it('draws one Run monitor tab for Execute and no segmented control', () => {
    expect(PHASE_SCREENS.execute).toHaveLength(1)
    const html = renderToStaticMarkup(
      <AnalysisNavigation phase="execute" screen="now" selected onNavigate={() => {}} />,
    )
    expect(html.match(/role="tab"/g)).toHaveLength(1)
    expect(html).toContain('>Run monitor</button>')
    expect(html).not.toContain('class="seg"')
  })

  it('selects no screen while another panel view is active', () => {
    const html = renderToStaticMarkup(
      <AnalysisNavigation
        phase="analyze"
        screen="outcome"
        selected={false}
        onNavigate={() => {}}
      />,
    )
    expect(html).not.toContain('aria-selected="true"')
    expect(html).not.toContain('tabindex="0"')
    expect(html).toContain('id="insp-tab-analysis"')
  })

  it('carries no Run control in any phase: the top bar holds the one RunControl', () => {
    for (const phase of ['prepare', 'execute', 'analyze'] as BoardPhase[]) {
      const html = renderToStaticMarkup(
        <AnalysisNavigation
          phase={phase}
          screen={PHASE_SCREENS[phase][0].v}
          selected
          onNavigate={() => {}}
        />,
      )
      expect(html).not.toContain('class="run-control"')
    }
  })

  it('renders without touching ui state', () => {
    const before = useStore.getState().ui
    const html = renderToStaticMarkup(
      <AnalysisNavigation phase="prepare" screen="inputs" selected onNavigate={() => {}} />,
    )
    expect(html).not.toContain('Layout')
    expect(useStore.getState().ui).toBe(before)
  })
})
