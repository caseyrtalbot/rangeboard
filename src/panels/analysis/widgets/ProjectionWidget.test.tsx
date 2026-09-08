import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

// Inspect the authored popover body; browser verification covers opening the real Info.
vi.mock('../Info', () => ({ Info: ({ children }: { children: ReactNode }) => <>{children}</> }))
import { emptyScenario } from '../../../model/seed'
import { useStore } from '../../../state/store'
import { AboutProjection, ProjectionWidget } from './ProjectionWidget'

it('uses the edited residual threshold in methodology copy and explains blocked routes', () => {
  const scenario = emptyScenario()
  scenario.requirements.maxResidualPerTrack = 0.27
  useStore.getState().replaceScenario(scenario)
  Object.assign(useStore.getInitialState(), useStore.getState())
  const html = renderToStaticMarkup(<AboutProjection />)
  expect(html).toContain('27% per track')
  expect(html).not.toContain('5% expected residual')
  expect(html).toContain('no shot')
  expect(html).toContain('do not estimate probability of passing')
})

it.each(['active', 'absent'] as const)('uses the %s asset forecast label and retains full-run qualifiers', (assetState) => {
  const scenario = emptyScenario()
  scenario.entities = [{ id: 'uas', name: 'UAS', kind: 'uas', specId: 'lib-mavic3',
    pos: { x: -3000, y: 0 }, headingDeg: 90, color: null, notes: '' }]
  if (assetState === 'active') scenario.entities.push({ id: 'asset', name: 'Asset', kind: 'asset', specId: 'lib-asset',
    pos: { x: 0, y: 0 }, headingDeg: 0, color: null, notes: '' })
  scenario.paths = [{ id: 'path', entityId: 'uas', points: [{ x: -3000, y: 0 }, { x: 3000, y: 0 }],
    speedMps: 20, startDelayS: 0 }]
  useStore.getState().replaceScenario(scenario)
  Object.assign(useStore.getInitialState(), useStore.getState())
  const html = renderToStaticMarkup(<ProjectionWidget id="projection" params={{}} collapsed={false} customize={false} index={0} count={1} />)
  expect(html).toContain(`<span>${assetState === 'active' ? 'Expected kills' : 'Expected neutralization'}</span>`)
  expect(html).toContain('Residual survival')
  expect(html).toContain('full run · not live')
  expect(html).toContain('planning envelope')
  if (assetState !== 'active') {
    const residual = html.split('<span>Residual survival</span>')[1].split('</div>')[0]
    expect(residual).toContain('>—</strong>')
    expect(residual).toContain('no defended asset placed')
    expect(residual).not.toContain('0.0%')
  }
})
