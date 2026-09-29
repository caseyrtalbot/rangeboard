/**
 * Chart PNG export. A `var(--token)` does not survive serialization, so the clone
 * takes the computed paint of every element before it is written out, then
 * rasterizes the markup through an image and a canvas. The DOM pieces arrive as
 * `PngDeps` so the rasterizer runs under a test double.
 */

export interface PngDeps {
  createImage(): HTMLImageElement
  createCanvas(): HTMLCanvasElement
}

const domDeps: PngDeps = {
  createImage: () => new Image(),
  createCanvas: () => document.createElement('canvas'),
}

/** The paint the kit sets through custom properties, baked into the clone. */
const PAINT = [
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-dasharray',
  'stroke-opacity',
  'font-family',
  'font-size',
  'font-weight',
  'opacity',
] as const

/** Both trees are structurally identical, so one parallel walk pairs the nodes. */
function bakePaint(source: Element, clone: Element): void {
  const computed = getComputedStyle(source)
  const parts: string[] = []
  for (const property of PAINT) {
    const value = computed.getPropertyValue(property)
    if (value) parts.push(`${property}:${value}`)
  }
  if (parts.length > 0) clone.setAttribute('style', parts.join(';'))
  const from = source.children
  const to = clone.children
  for (let i = 0; i < from.length && i < to.length; i++) bakePaint(from[i], to[i])
}

/** A rendered SVG as standalone markup at an explicit pixel size. */
function svgMarkup(svg: SVGSVGElement, width: number, height: number): string {
  const clone = svg.cloneNode(true) as SVGSVGElement
  bakePaint(svg, clone)
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))
  if (!clone.getAttribute('viewBox')) clone.setAttribute('viewBox', `0 0 ${width} ${height}`)
  return new XMLSerializer().serializeToString(clone)
}

export interface PngOptions {
  /** Device pixels per CSS pixel; 2 keeps the text legible at panel width. */
  scale?: number
  /** Painted under the chart, because an SVG has no ground of its own. */
  background?: string
}

/** Rasterize standalone SVG markup to a PNG data URL. */
export function svgToPng(
  markup: string,
  width: number,
  height: number,
  options: PngOptions = {},
  deps: PngDeps = domDeps,
): Promise<string> {
  const scale = options.scale ?? 2
  return new Promise((resolve, reject) => {
    const image = deps.createImage()
    image.onload = () => {
      const canvas = deps.createCanvas()
      canvas.width = Math.max(1, Math.round(width * scale))
      canvas.height = Math.max(1, Math.round(height * scale))
      const context = canvas.getContext('2d')
      if (!context) {
        reject(new Error('This browser provides no 2D canvas context.'))
        return
      }
      if (options.background) {
        context.fillStyle = options.background
        context.fillRect(0, 0, canvas.width, canvas.height)
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      try {
        resolve(canvas.toDataURL('image/png'))
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Could not read the canvas.'))
      }
    }
    image.onerror = () => reject(new Error('Could not rasterize the chart.'))
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
  })
}

/** The rendered size of a chart SVG: its laid-out box, else its own attributes. */
function sizeOf(svg: SVGSVGElement): { width: number; height: number } {
  const box = svg.getBoundingClientRect()
  const width = box.width || Number(svg.getAttribute('width')) || 0
  const height = box.height || Number(svg.getAttribute('height')) || 0
  return { width, height }
}

/** The first chart SVG inside `container`, rasterized. Rejects when none is mounted. */
function chartPng(container: Element | null, options: PngOptions = {}): Promise<string> {
  const svg = container?.querySelector('svg') as SVGSVGElement | null
  if (!svg) return Promise.reject(new Error('No chart is mounted to export.'))
  const { width, height } = sizeOf(svg)
  if (width <= 0 || height <= 0)
    return Promise.reject(new Error('The chart has no rendered size to export.'))
  return svgToPng(svgMarkup(svg, width, height), width, height, options)
}

function downloadPng(dataUrl: string, filename: string): void {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename.endsWith('.png') ? filename : `${filename}.png`
  a.click()
}

/** Export the chart inside `container` as a PNG file. Rejects with the reason it could not. */
export async function exportChartPng(
  container: Element | null,
  filename: string,
  options: PngOptions = {},
): Promise<void> {
  downloadPng(await chartPng(container, options), filename)
}
