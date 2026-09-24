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
        <AnalysisNavigation phase={phase} screen={selected.v} onNavigate={() => {}} />,
      )
      expect(html).toContain('aria-label="Analysis screens"')
      expect(html.match(/<button /g)).toHaveLength(options.length)
      expect(html.match(/aria-pressed="true"/g)).toHaveLength(1)
      expect(html).toContain(`class="active">${selected.label}</button>`)
      for (const option of options) expect(html).toContain(`>${option.label}</button>`)
      expect(html).not.toContain('Layout')
      expect(html).not.toContain('Analysis lenses')
    }
  })

  it('draws no navigation for Execute, which has one screen', () => {
    expect(PHASE_SCREENS.execute).toHaveLength(1)
    expect(
      renderToStaticMarkup(
        <AnalysisNavigation phase="execute" screen="now" onNavigate={() => {}} />,
      ),
    ).toBe('')
  })

  it('carries no Run control in any phase: the top bar holds the one RunControl', () => {
    for (const phase of ['prepare', 'execute', 'analyze'] as BoardPhase[]) {
      const html = renderToStaticMarkup(
        <AnalysisNavigation
          phase={phase}
          screen={PHASE_SCREENS[phase][0].v}
          onNavigate={() => {}}
        />,
      )
      expect(html).not.toContain('class="run-control"')
    }
  })

  it('renders without touching ui state', () => {
    const before = useStore.getState().ui
    const html = renderToStaticMarkup(
      <AnalysisNavigation phase="prepare" screen="inputs" onNavigate={() => {}} />,
    )
    expect(html).not.toContain('Layout')
    expect(useStore.getState().ui).toBe(before)
  })
})
