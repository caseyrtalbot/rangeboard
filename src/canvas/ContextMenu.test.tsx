import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyScenario } from '../model/seed'
import { useStore } from '../state/store'
import { ContextMenu } from './ContextMenu'

// Node has no DOM renderer; record each menu button by its text so a test can
// fire the real handler.
const buttons = vi.hoisted(() => new Map<string, () => void>())
vi.mock('react/jsx-dev-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react/jsx-dev-runtime')>()
  const jsxDEV: typeof actual.jsxDEV = (type, props, ...rest) => {
    const p = props as { children?: unknown; onClick?: () => void }
    // An Item's children are its label, then an optional key hint.
    const text = Array.isArray(p.children) ? p.children[0] : p.children
    if (type === 'button' && typeof text === 'string' && p.onClick) buttons.set(text, p.onClick)
    return actual.jsxDEV(type, props, ...rest)
  }
  return { ...actual, jsxDEV }
})

function render(): string {
  buttons.clear()
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<ContextMenu />)
}

describe('ContextMenu', () => {
  beforeEach(() => {
    useStore.getState().replaceScenario(emptyScenario())
  })

  it('opens the entity model in the library drawer editor from Edit model specs', () => {
    const store = useStore.getState()
    store.addEntityFromModel('lib-giraffe1x', { x: 0, y: 0 })
    const entity = useStore.getState().scenario.entities[0]
    const seq = useStore.getState().ui.libraryRequest.seq
    const tab = useStore.getState().ui.rightTab
    store.openContextMenu({ x: 10, y: 10 }, { x: 0, y: 0 }, entity.id)

    expect(render()).toContain('>Edit model specs</button>')
    buttons.get('Edit model specs')!()
    expect(useStore.getState().ui.libraryRequest).toEqual({
      seq: seq + 1,
      kind: 'sensor',
      modelId: 'lib-giraffe1x',
    })
    expect(useStore.getState().selection.libraryId).toBe('lib-giraffe1x')
    expect(useStore.getState().ui.rightTab).toBe(tab)
    expect(useStore.getState().ui.contextMenu).toBeNull()
  })
})
