import type { ReactElement, ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from '../../ui/ErrorBoundary'
import { PrintOverlay } from './PrintOverlay'

vi.mock('react-dom', () => ({ createPortal: (children: ReactNode) => children }))

afterEach(() => vi.unstubAllGlobals())

describe('PrintOverlay', () => {
  it('isolates the artifact while keeping Close available outside its boundary', () => {
    vi.stubGlobal('document', { body: {} })
    const onClose = vi.fn()
    const onExport = vi.fn()
    const artifact = <article>Campaign record</article>
    const overlay = PrintOverlay({
      title: 'Test card', onClose, onExport, children: artifact,
    }) as unknown as ReactElement<{ children: ReactNode }>
    const [toolbar, paper] = overlay.props.children as ReactElement<{ children: ReactNode }>[]
    expect(toolbar.props).toHaveProperty('className', 'print-toolbar')
    expect(paper.props).toHaveProperty('className', 'print-root')
    const close = (toolbar.props.children as ReactElement<{ onClick: () => void }>[]).at(-1)!
    close.props.onClick()
    expect(onClose).toHaveBeenCalledOnce()
    const boundary = paper.props.children as ReactElement<{ onExport: () => void; children: ReactNode }>
    expect(boundary.type).toBe(ErrorBoundary)
    expect(boundary.props.children).toBe(artifact)
    boundary.props.onExport()
    expect(onExport).toHaveBeenCalledOnce()
  })
})
