import type { ReactNode } from 'react'
import { isValidElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import {
  armOverrideFault,
  clearOverrideFault,
  reportOverrideFault,
  subscribeOverrideFault,
} from '../state/overrideFault'
import { ErrorBoundary } from './ErrorBoundary'
import { OverrideSubscriberBoundary } from './OverrideSubscriber'

let disarm = () => {}

afterEach(() => {
  disarm()
  disarm = () => {}
  clearOverrideFault()
})

describe('OverrideSubscriberBoundary', () => {
  it('renders nothing while the subscriber has not thrown', () => {
    expect(renderToStaticMarkup(<OverrideSubscriberBoundary />)).toBe('')
  })

  it('mounts the subscriber under the override boundary', () => {
    const element = OverrideSubscriberBoundary()
    const boundary = element.props.children
    expect(isValidElement(boundary)).toBe(true)
    if (!isValidElement<{ label: string; children: ReactNode }>(boundary)) return
    expect(boundary.type).toBe(ErrorBoundary)
    expect(boundary.props.label).toBe('Override updates')
    expect(isValidElement(boundary.props.children)).toBe(true)
    if (!isValidElement(boundary.props.children)) return
    const child = boundary.props.children.type
    expect(typeof child === 'function' && child.name).toBe('OverrideSubscriber')
  })

  it('rethrows a held subscriber throw during render', () => {
    disarm = armOverrideFault()
    const unsubscribe = subscribeOverrideFault(() => {})
    reportOverrideFault(new Error('injected subscriber throw'))
    unsubscribe()
    // Node has no DOM renderer; the browser check exercises the catch lifecycle.
    expect(() => renderToStaticMarkup(<OverrideSubscriberBoundary />)).toThrow(
      'injected subscriber throw',
    )
  })
})
