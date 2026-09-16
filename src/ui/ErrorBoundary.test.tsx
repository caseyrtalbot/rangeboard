import { Children, isValidElement } from 'react'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

function button(node: ReactNode, label: string): (() => void) | undefined {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{ children?: ReactNode; onClick?: () => void }>(child)) continue
    if (child.type === 'button' && child.props.children === label) return child.props.onClick
    const found = button(child.props.children, label)
    if (found) return found
  }
  return undefined
}

function failedBoundary(onExport = vi.fn()) {
  const boundary = new ErrorBoundary({ label: 'Run results', onExport, children: <p>results</p> })
  Object.assign(boundary.state, ErrorBoundary.getDerivedStateFromError())
  // Node has no DOM renderer; browser verification exercises React's catch lifecycle.
  vi.spyOn(boundary, 'setState').mockImplementation((update) => {
    Object.assign(
      boundary.state,
      typeof update === 'function' ? update(boundary.state, boundary.props) : update,
    )
  })
  return boundary
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('ErrorBoundary', () => {
  it('leaves a healthy child tree intact without an added layout wrapper', () => {
    const child = <div className="healthy">results</div>
    const boundary = new ErrorBoundary({ label: 'Run results', onExport: vi.fn(), children: child })
    expect(boundary.render()).toBe(child)
  })

  it('offers the design-system alert and both recovery actions after a render failure', () => {
    const html = renderToStaticMarkup(failedBoundary().render())
    expect(html).toContain('aria-label="Run results error"')
    expect(html).toContain('class="state critical"')
    expect(html).toContain('role="alert"')
    expect(html).toContain('Run results could not be displayed.')
    expect(html).toContain('>Export</button>')
    expect(html).toContain('>Reload</button>')
    expect(html).not.toContain('<p>results</p>')
  })

  it('exports through the owner callback without discarding the failed view or its record', () => {
    const record = { name: 'Retained work', frames: ['frame-1'] }
    const exportRecord = vi.fn(() => JSON.stringify(record))
    const boundary = failedBoundary(exportRecord)
    button(boundary.render(), 'Export')!()
    expect(exportRecord).toHaveBeenCalledOnce()
    expect(record).toEqual({ name: 'Retained work', frames: ['frame-1'] })
    expect(boundary.state.failed).toBe(true)
  })

  it('keeps a failed export actionable and clears its notice after a successful retry', () => {
    const exportRecord = vi.fn().mockImplementationOnce(() => {
      throw new Error('Download unavailable')
    })
    const boundary = failedBoundary(exportRecord)
    button(boundary.render(), 'Export')!()
    expect(renderToStaticMarkup(boundary.render())).toContain('Download unavailable')
    button(boundary.render(), 'Export')!()
    expect(exportRecord).toHaveBeenCalledTimes(2)
    expect(boundary.state.exportError).toBeNull()
    expect(boundary.state.failed).toBe(true)
  })

  it('reloads the page only when Reload is activated', () => {
    const reload = vi.fn()
    vi.stubGlobal('window', { location: { reload } })
    const boundary = failedBoundary()
    expect(reload).not.toHaveBeenCalled()
    button(boundary.render(), 'Reload')!()
    expect(reload).toHaveBeenCalledOnce()
  })
})
