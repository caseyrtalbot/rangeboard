import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { CommandPalette } from './CommandPalette'
import { useStore } from '../state/store'

type Props = Record<string, unknown>

// Record the props of each rendered element by class, so the test can fire the
// real handlers without a DOM.
const seen = vi.hoisted(() => new Map<string, Props>())

function record(props: Props) {
  if (typeof props?.className === 'string') seen.set(props.className, props)
}

vi.mock('react/jsx-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react/jsx-runtime')>()
  return {
    ...actual,
    jsx: (type: never, props: Props, key?: string) => (record(props), actual.jsx(type, props, key)),
    jsxs: (type: never, props: Props, key?: string) => (
      record(props),
      actual.jsxs(type, props, key)
    ),
  }
})

vi.mock('react/jsx-dev-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react/jsx-dev-runtime')>()
  return {
    ...actual,
    jsxDEV: (...args: Parameters<typeof actual.jsxDEV>) => (
      record(args[1] as Props),
      actual.jsxDEV(...args)
    ),
  }
})

describe('CommandPalette', () => {
  // F1: a list click moved focus to the body, so Escape never reached the palette.
  it('keeps focus in the palette after a list click, so Escape closes it', () => {
    seen.clear()
    const onClose = vi.fn()
    const html = renderToStaticMarkup(<CommandPalette onClose={onClose} />)
    expect(html).toContain('tabindex="-1"')

    const preventDefault = vi.fn()
    const list = seen.get('cmdk-list') as { onMouseDown: (e: unknown) => void }
    list.onMouseDown({ preventDefault })
    expect(preventDefault).toHaveBeenCalledOnce()

    const panel = seen.get('cmdk-panel surface-float') as { onKeyDown: (e: unknown) => void }
    panel.onKeyDown({ key: 'Escape', preventDefault() {}, stopPropagation() {} })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('opens a model command in the library drawer editor, not a panel tab', () => {
    seen.clear()
    const onClose = vi.fn()
    const tab = useStore.getState().ui.rightTab
    const seq = useStore.getState().ui.libraryRequest.seq
    renderToStaticMarkup(<CommandPalette onClose={onClose} />)
    const library = useStore.getState().scenario.library
    const last = library[library.length - 1]

    const item = seen.get('cmdk-item') as { onClick: () => void }
    item.onClick()
    expect(useStore.getState().ui.libraryRequest).toEqual({
      seq: seq + 1,
      kind: last.kind,
      modelId: last.id,
    })
    expect(useStore.getState().selection.libraryId).toBe(last.id)
    expect(useStore.getState().ui.rightTab).toBe(tab)
  })

  it('offers the board editing tools only in Prepare (D3)', () => {
    const head = 'class="cmdk-head">Tool<'
    const renderIn = (phase: 'prepare' | 'execute') => {
      useStore.getState().setBoardPhase(phase)
      Object.assign(useStore.getInitialState(), useStore.getState())
      return renderToStaticMarkup(<CommandPalette onClose={() => {}} />)
    }
    expect(renderIn('execute')).not.toContain(head)
    expect(renderIn('prepare')).toContain(head)
  })

  it('draws one header per category and the App keys', () => {
    const html = renderToStaticMarkup(<CommandPalette onClose={() => {}} />)
    expect(html.match(/class="cmdk-head">Edit</g)).toHaveLength(1)
    expect(html).toContain('<kbd class="kbd kbd-hint">⌘Z</kbd>')
    expect(html).not.toContain('Edit:')
  })
})
