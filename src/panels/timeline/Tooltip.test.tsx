import type { ReactElement, RefObject } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RunTimelineModel, RunTimelineRow } from '../../analysis/runTimeline'
import type { RunTimelineHit } from './hit'
import { Tooltip, type TooltipHandle } from './Tooltip'

/**
 * The Node tests have no DOM, so a small hook runtime renders Tooltip as a
 * function: state and refs persist per call order, effects run after each
 * render when their dependencies change (layout effects first), and a state
 * change renders again. React itself renders only the returned markup.
 */
const hooks = vi.hoisted(() => {
  type Deps = readonly unknown[] | undefined
  type Slot = { value?: unknown; deps?: Deps; cleanup?: void | (() => void) }
  type Queued = { slot: Slot; run: () => void | (() => void); layout: boolean }
  const rt = { slots: [] as Slot[], i: 0, pending: false, queue: [] as Queued[] }
  const slot = () => (rt.slots[rt.i++] ??= {})
  const changed = (a: Deps, b: Deps) =>
    !a || !b || a.length !== b.length || a.some((v, k) => !Object.is(v, b[k]))
  const effect = (layout: boolean) => (run: () => void | (() => void), deps?: Deps) => {
    const s = slot()
    if (!('deps' in s) || changed(s.deps, deps)) rt.queue.push({ slot: s, run, layout })
    s.deps = deps
  }
  return {
    rt,
    useState<T>(init: T) {
      const s = slot()
      if (!('value' in s)) s.value = init
      const set = (next: T) => {
        if (Object.is(s.value, next)) return
        s.value = next
        rt.pending = true
      }
      return [s.value as T, set] as const
    },
    useRef<T>(init: T) {
      const s = slot()
      if (!('value' in s)) s.value = { current: init }
      return s.value as { current: T }
    },
    useLayoutEffect: effect(true),
    useEffect: effect(false),
    useImperativeHandle<T>(ref: { current: T | null }, make: () => T, deps?: Deps) {
      effect(true)(() => {
        ref.current = make()
      }, deps)
    },
  }
})

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useState: hooks.useState,
  useRef: hooks.useRef,
  useLayoutEffect: hooks.useLayoutEffect,
  useEffect: hooks.useEffect,
  useImperativeHandle: hooks.useImperativeHandle,
}))

type Props = Parameters<typeof Tooltip>[0]
let props: Props
let out: ReactElement | null = null

function flush() {
  const { rt } = hooks
  for (const layout of [true, false]) {
    for (const q of rt.queue.filter((e) => e.layout === layout)) {
      if (typeof q.slot.cleanup === 'function') q.slot.cleanup()
      q.slot.cleanup = q.run()
    }
  }
  rt.queue = []
}

/** Renders with `next` props until no state change is pending. */
function render(next: Props) {
  props = next
  do {
    hooks.rt.pending = false
    hooks.rt.i = 0
    out = Tooltip(props) as ReactElement | null
    flush()
  } while (hooks.rt.pending)
}

/** Calls the handle, then renders again as React would on its state change. */
function act(fn: () => void) {
  fn()
  if (hooks.rt.pending) render(props)
}

const row: RunTimelineRow = {
  key: 'threat:t1',
  kind: 'threat',
  label: 't1',
  meta: '',
  entityId: 't1',
  spans: [],
  marks: [{ kind: 'detect', tS: 12 }],
}
const hit: RunTimelineHit = { t: 'mark', row, mark: row.marks[0] }
const model: RunTimelineModel = { durationS: 60, horizonS: 30, groups: [] }

describe('Tooltip', () => {
  const handle: RefObject<TooltipHandle | null> = { current: null }
  const rootRef: RefObject<HTMLElement | null> = { current: null }

  beforeEach(() => {
    hooks.rt.slots = []
    hooks.rt.queue = []
    vi.stubGlobal('window', new EventTarget())
    render({ ref: handle, rootRef, model })
    act(() => handle.current?.show(hit, 10, 10))
  })

  it('shows a hit through the handle and keeps it while the model stays', () => {
    expect(out?.props).toMatchObject({ className: 'runtl-tip' })
    const html = renderToStaticMarkup(out as ReactElement)
    expect(html).toContain('<b>Detect</b> t1')
    expect(html).toContain('Shown through T+0:30')
    render({ ref: handle, rootRef, model })
    expect(out?.props).toMatchObject({ className: 'runtl-tip' })
  })

  it('hides on a new model object, whose rows the hit no longer holds', () => {
    render({ ref: handle, rootRef, model: { ...model, horizonS: 32 } })
    expect(out).toBeNull()
    // The same item shows again on the next pointer move.
    act(() => handle.current?.show(hit, 10, 10))
    expect(out?.props).toMatchObject({ className: 'runtl-tip' })
  })
})
