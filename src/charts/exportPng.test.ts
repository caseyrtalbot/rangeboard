/**
 * The vitest environment here is node and the project carries no jsdom, so the
 * rasterizer runs against the `PngDeps` doubles below: an image that reports
 * the src it was given and a canvas whose `toDataURL` returns a fixed PNG.
 * `svgMarkup` needs a real document and is covered by the browser check.
 */
import { describe, expect, it, vi } from 'vitest'
import type { PngDeps } from './exportPng'
import { svgToPng } from './exportPng'

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20" fill="#3987e5"/></svg>'
const PNG = 'data:image/png;base64,iVBORw0KGgo='

interface Recorded {
  deps: PngDeps
  src: string | null
  size: { width: number; height: number } | null
  drawn: unknown[]
  fills: string[]
}

/** An image that loads as soon as its src is set, and a canvas that records what was drawn. */
function fakes(toDataURL: () => string = () => PNG): Recorded {
  const recorded: Recorded = { deps: null as unknown as PngDeps, src: null, size: null, drawn: [], fills: [] }
  const context = {
    fillStyle: '',
    fillRect: (...args: unknown[]) => { recorded.fills.push(`${(context as { fillStyle: string }).fillStyle}:${args.join(',')}`) },
    drawImage: (...args: unknown[]) => { recorded.drawn.push(args) },
  }
  const image: Record<string, unknown> = { onload: null, onerror: null }
  Object.defineProperty(image, 'src', {
    set(value: string) {
      recorded.src = value
      queueMicrotask(() => (image.onload as (() => void) | null)?.())
    },
  })
  const canvas = {
    width: 0, height: 0,
    getContext: () => context,
    toDataURL,
  }
  recorded.deps = {
    createImage: () => image as unknown as HTMLImageElement,
    createCanvas: () => {
      recorded.size = canvas
      return canvas as unknown as HTMLCanvasElement
    },
  }
  return recorded
}

describe('svgToPng', () => {
  it('rasterizes SVG markup to a PNG data URL at the requested scale', async () => {
    const recorded = fakes()
    const url = await svgToPng(SVG, 40, 20, { scale: 2 }, recorded.deps)
    expect(url).toBe(PNG)
    expect(url.startsWith('data:image/png')).toBe(true)
    // The image is handed the SVG as a data URL, never a blob the page must revoke.
    expect(recorded.src).toBe(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(SVG)}`)
    // 40 x 20 CSS pixels at scale 2.
    expect(recorded.size).toMatchObject({ width: 80, height: 40 })
    expect(recorded.drawn).toHaveLength(1)
    expect(recorded.fills).toHaveLength(0)
  })

  it('paints the requested ground under the chart, because an SVG has none', async () => {
    const recorded = fakes()
    await svgToPng(SVG, 40, 20, { scale: 1, background: '#171a1d' }, recorded.deps)
    expect(recorded.fills).toEqual(['#171a1d:0,0,40,20'])
  })

  it('rejects with the reason when the canvas cannot be read', async () => {
    const recorded = fakes(() => { throw new Error('Tainted canvas') })
    await expect(svgToPng(SVG, 40, 20, {}, recorded.deps)).rejects.toThrow('Tainted canvas')
  })

  it('rejects when the browser provides no 2D context', async () => {
    const recorded = fakes()
    const deps: PngDeps = {
      ...recorded.deps,
      createCanvas: () => ({ width: 0, height: 0, getContext: () => null }) as unknown as HTMLCanvasElement,
    }
    await expect(svgToPng(SVG, 40, 20, {}, deps)).rejects.toThrow('no 2D canvas context')
  })

  it('rejects when the image cannot decode the markup', async () => {
    const image: Record<string, unknown> = { onload: null, onerror: null }
    Object.defineProperty(image, 'src', {
      set() { queueMicrotask(() => (image.onerror as (() => void) | null)?.()) },
    })
    const deps: PngDeps = {
      createImage: () => image as unknown as HTMLImageElement,
      createCanvas: vi.fn(() => ({}) as unknown as HTMLCanvasElement),
    }
    await expect(svgToPng('<svg>', 40, 20, {}, deps)).rejects.toThrow('Could not rasterize the chart.')
    expect(deps.createCanvas).not.toHaveBeenCalled()
  })
})
