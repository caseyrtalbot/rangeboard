import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { BUILTIN_LENSES, defaultAnalysisView } from '../../state/analysisLayout'
import { useStore } from '../../state/store'
import { AnalysisNavigation } from './AnalysisNavigation'

function render(): string {
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<AnalysisNavigation />)
}

describe('AnalysisNavigation', () => {
  beforeEach(() => {
    useStore.setState((state) => ({
      ui: { ...state.ui, analysis: defaultAnalysisView(), analysisCustomize: false },
    }))
  })

  it('keeps the five built-in lenses in one roving tablist', () => {
    const html = render()

    expect(html.match(/role="tab"/g)?.length).toBe(BUILTIN_LENSES.length)
    expect(html.match(/tabindex="0"/g)?.length).toBe(1)
    expect(html.match(/tabindex="-1"/g)?.length).toBe(BUILTIN_LENSES.length - 1)
    for (const preset of BUILTIN_LENSES) expect(html).toContain(`>${preset.label}</button>`)
  })

  it('exposes Layout as a dialog trigger outside the built-in tablist', () => {
    const html = render()
    const tablistEnd = html.indexOf('</div>')
    const layout = html.indexOf('aria-haspopup="dialog"')

    expect(layout).toBeGreaterThan(tablistEnd)
    expect(html).toContain('aria-expanded="false"')
    expect(html).toMatch(/aria-controls="[^"]+-analysis-layout"/)
  })

  it('keeps layout editing state visible when the popover is closed', () => {
    useStore.getState().setAnalysisCustomize(true)

    expect(render()).toContain('>Layout · editing</button>')
  })
})
