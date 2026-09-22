import { afterEach, describe, expect, it } from 'vitest'
import { useOverrides } from './overrides'
import {
  armOverrideFault,
  clearOverrideFault,
  readOverrideFault,
  reportOverrideFault,
  subscribeOverrideFault,
} from './overrideFault'
import { useStore } from './store'

function injectThrow(message: string): () => void {
  const original = useStore.getState().overridesChanged
  useStore.setState({
    overridesChanged: () => {
      throw new Error(message)
    },
  })
  return () => useStore.setState({ overridesChanged: original })
}

let restoreOverride = () => {}
let disarm = () => {}

afterEach(() => {
  restoreOverride()
  restoreOverride = () => {}
  disarm()
  disarm = () => {}
  clearOverrideFault()
  useOverrides.getState().resetAll()
})

describe('override subscriber faults', () => {
  it('rethrows an injected throw while the boundary is not mounted', () => {
    restoreOverride = injectThrow('injected subscriber throw')
    expect(() => useOverrides.getState().setOverride('lib-coyote', 'pk', 0.02, 'check')).toThrow(
      'injected subscriber throw',
    )
    expect(readOverrideFault()).toBeNull()
  })

  it('keeps an injected throw for the mounted boundary and still updates the list', () => {
    disarm = armOverrideFault()
    const seen: Array<ReturnType<typeof readOverrideFault>> = []
    const unsubscribe = subscribeOverrideFault(() => {
      seen.push(readOverrideFault())
    })
    restoreOverride = injectThrow('injected subscriber throw')
    const later: string[] = []
    const stopLater = useOverrides.subscribe(() => {
      later.push('ran')
    })

    expect(() =>
      useOverrides.getState().setOverride('lib-coyote', 'pk', 0.02, 'check'),
    ).not.toThrow()

    expect(useOverrides.getState().overrides).toMatchObject([
      { modelId: 'lib-coyote', field: 'pk', value: 0.02 },
    ])
    expect(seen[0]?.error).toBeInstanceOf(Error)
    if (!(seen[0]?.error instanceof Error)) return
    expect(seen[0].error.message).toBe('injected subscriber throw')
    expect(later).toEqual(['ran'])

    stopLater()
    unsubscribe()
  })

  it('contains a later throw while the alert is up and the child is gone', () => {
    disarm = armOverrideFault()
    const unsubscribe = subscribeOverrideFault(() => {})
    unsubscribe()
    restoreOverride = injectThrow('injected subscriber throw')
    expect(() =>
      useOverrides.getState().setOverride('lib-coyote', 'pk', 0.03, 'again'),
    ).not.toThrow()
    expect(readOverrideFault()).toBeNull()
    expect(useOverrides.getState().overrides).toMatchObject([
      { modelId: 'lib-coyote', field: 'pk', value: 0.03 },
    ])
  })

  it('rethrows again after the shell disarms', () => {
    const release = armOverrideFault()
    release()
    restoreOverride = injectThrow('injected subscriber throw')
    expect(() => useOverrides.getState().setOverride('lib-coyote', 'pk', 0.04, 'again')).toThrow(
      'injected subscriber throw',
    )
    expect(readOverrideFault()).toBeNull()
  })
})
