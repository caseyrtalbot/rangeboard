import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { useStore } from '../../state/store'
import { AnalysisNavigation } from './AnalysisNavigation'
import { PHASE_SCREENS } from './screens/navigation'
import type { BoardPhase } from '../../state/runState'

describe('AnalysisNavigation', () => {
  it.each(['prepare', 'execute', 'analyze'] as BoardPhase[])('shows only the screens for %s', phase => {
    const options = PHASE_SCREENS[phase]
    for (const selected of options) {
      const html = renderToStaticMarkup(<AnalysisNavigation phase={phase} screen={selected.v} onNavigate={() => {}} />)
      expect(html).toContain('aria-label="Analysis screens"')
      expect(html.match(/<button /g)).toHaveLength(options.length)
      expect(html.match(/aria-pressed="true"/g)).toHaveLength(1)
      expect(html).toContain(`class="active">${selected.label}</button>`)
      for (const option of options) expect(html).toContain(`>${option.label}</button>`)
      expect(html).not.toContain('Layout')
      expect(html).not.toContain('Analysis lenses')
    }
  })

  it('renders without touching ui state', () => {
    const before = useStore.getState().ui
    const html = renderToStaticMarkup(<AnalysisNavigation phase="prepare" screen="inputs" onNavigate={() => {}} />)
    expect(html).not.toContain('Layout')
    expect(useStore.getState().ui).toBe(before)
  })
})
