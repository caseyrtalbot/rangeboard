import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import fixture from '../../docs/field-te/evidence/onboarding-2026-09-04/firing-scenario.json'
import { parseAutosave } from '../io/persist'
import { emptyScenario } from '../model/seed'
import { runSettings } from '../model/types'
import { useStore } from '../state/store'
import { StatusBar } from './StatusBar'

function render(): string {
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<StatusBar />)
}

/** The text of the status bar with tags removed, one space between cells. */
function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

describe('status bar', () => {
  beforeEach(() => {
    useStore.getState().replaceScenario(emptyScenario())
    useStore.getState().setUnits('aviation')
  })

  it('lists run id, phase, clock, seed, MC, ROE, units and validity in order', () => {
    const html = render()
    const seed = runSettings(useStore.getState().scenario).seed
    const cells = [
      'RUN-',
      useStore.getState().playback.phase,
      'T+0:00 / ',
      `seed ${seed}`,
      'MC — / ',
      'ROE ',
      'nm · kt · ft AGL',
      'Validity ',
    ]
    const flat = text(html)
    const at = cells.map((cell) => flat.indexOf(cell))
    expect(at.every((i) => i >= 0)).toBe(true)
    expect(at).toEqual([...at].sort((a, b) => a - b))
    expect(html).toContain('class="status-bar" role="group" aria-label="Run status"')
    expect(html).toContain('title="ROE · click to change"')
  })

  it('reads the units cell from the saved view', () => {
    useStore.getState().setUnits('metric')
    expect(render()).toContain('km · m/s · ft AGL')
  })

  it('makes the validity cell a frameless button (D10)', () => {
    expect(render()).toContain(
      '<button type="button" class="sb-validity" title="Open the validity findings">Validity ',
    )
  })

  it('tags validity findings with LIMITS', () => {
    useStore.getState().replaceScenario(parseAutosave(JSON.stringify(fixture)))
    const html = render()
    expect(html).toMatch(/Validity [1-9]\d*<span class="sb-limits">LIMITS<\/span>/)
  })

  it('writes status chips in sentence case and makes the spawn chip a button', () => {
    useStore.getState().replaceScenario(parseAutosave(JSON.stringify(fixture)))
    const html = render()

    expect(html).toMatch(/<button type="button" class="status-chip"[^>]*>.*Spawn in ring 1</)
    expect(html).toContain('class="status-inline"')
    expect(html).not.toContain('Spawn In Ring')
    expect(html).not.toContain('WEZ On')
    expect(html).not.toContain('Env Derate')
  })
})
