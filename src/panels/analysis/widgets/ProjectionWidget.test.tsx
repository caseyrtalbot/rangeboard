import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

// Inspect the authored popover body; browser verification covers opening the real Info.
vi.mock('../Info', () => ({ Info: ({ children }: { children: ReactNode }) => <>{children}</> }))
import { emptyScenario } from '../../../model/seed'
import { useStore } from '../../../state/store'
import { AboutProjection } from './ProjectionWidget'

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
