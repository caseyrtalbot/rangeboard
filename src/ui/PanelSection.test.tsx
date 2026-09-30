import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from '../state/store'
import { PanelSection } from './PanelSection'
import type { PanelSectionProps } from './PanelSection'

function render(props: PanelSectionProps): string {
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<PanelSection {...props} />)
}

describe('PanelSection', () => {
  beforeEach(() => {
    useStore.setState((st) => ({ ui: { ...st.ui, openSections: {} } }))
  })

  it('renders an h3 title, a readout and an end slot, with an optional id', () => {
    const html = render({
      title: 'Ensemble',
      readout: '100 runs',
      end: <button type="button">Pin</button>,
      children: <p>body</p>,
    })
    expect(html).toBe(
      '<section class="psec"><div class="psec-head"><h3 class="psec-title">Ensemble</h3><span class="psec-readout">100 runs</span><span class="psec-end"><button type="button">Pin</button></span></div><div class="psec-body"><p>body</p></div></section>',
    )
    expect(render({ title: 'Run', id: 'prepare-run' })).toContain(
      '<section class="psec" id="prepare-run">',
    )
  })

  it('makes a collapsible head a toggle button with aria-expanded and aria-controls', () => {
    const html = render({
      title: 'Environment',
      id: 'prepare-environment',
      collapsible: true,
      summary: 'Clear · Day',
      children: <p>body</p>,
    })
    expect(html).toContain('<section class="psec" id="prepare-environment">')
    expect(html).toContain(
      '<h3 class="psec-title psec-title-toggle"><button type="button" class="psec-toggle" aria-expanded="true" aria-controls="prepare-environment-body" data-section-id="prepare-environment">',
    )
    expect(html).toContain('<div class="psec-body" id="prepare-environment-body"><p>body</p></div>')
    // Open: the closed summary stays out of the head.
    expect(html).not.toContain('psec-sum')
  })

  it('reads its open state from the store, with the closed summary and no body', () => {
    const props: PanelSectionProps = {
      title: 'Entities',
      id: 'prepare-entities',
      collapsible: true,
      defaultOpen: false,
      summary: '3 placed · 2 threats',
      children: <p>body</p>,
    }
    const closed = render(props)
    expect(closed).toContain('<section class="psec closed" id="prepare-entities">')
    expect(closed).toContain('aria-expanded="false"')
    expect(closed).toContain(
      '<span class="psec-sum" title="3 placed · 2 threats">3 placed · 2 threats</span>',
    )
    expect(closed).toContain('<div class="psec-body" id="prepare-entities-body" hidden=""></div>')
    useStore.getState().setSectionOpen('prepare-entities', true)
    const open = render(props)
    expect(open).toContain('aria-expanded="true"')
    expect(open).toContain('<p>body</p>')
    useStore.getState().setAllSections(false, ['prepare-entities'])
    expect(render(props)).toContain('aria-expanded="false"')
  })
})
