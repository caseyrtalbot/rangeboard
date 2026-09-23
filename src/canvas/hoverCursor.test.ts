import { describe, expect, it } from 'vitest'
import { hoverCursor, releaseHover } from './hoverCursor'

const element = () => ({ style: { cursor: '' } }) as HTMLElement

describe('hoverCursor', () => {
  it('clears the pointer when the hovered entity leaves the scene', () => {
    const el = element()
    hoverCursor('radar', el, true)
    expect(el.style.cursor).toBe('pointer')
    releaseHover('other')
    expect(el.style.cursor).toBe('pointer')
    releaseHover('radar')
    expect(el.style.cursor).toBe('')
  })

  it('leaves the cursor alone after a normal leave', () => {
    const el = element()
    hoverCursor('radar', el, true)
    hoverCursor('radar', el, false)
    el.style.cursor = 'crosshair'
    releaseHover('radar')
    expect(el.style.cursor).toBe('crosshair')
  })
})
