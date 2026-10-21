import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyScenario } from '../model/seed'
import { useStore } from '../state/store'
import { ConnectSuggestPopup } from './ConnectSuggestPopup'

// Node has no DOM renderer; record each button by its text, and a row's button
// also under `<row key>|<text>` (partner rows are keyed by spec id), so a test
// can fire the real handler.
const buttons = vi.hoisted(() => new Map<string, () => void>())
vi.mock('react/jsx-dev-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react/jsx-dev-runtime')>()
  type Props = { children?: unknown; onClick?: () => void; className?: string }
  const jsxDEV: typeof actual.jsxDEV = (type, props, key, ...rest) => {
    const p = props as Props
    if (type === 'button' && typeof p.children === 'string' && p.onClick)
      buttons.set(p.children, p.onClick)
    if (type === 'div' && p.className === 'suggest-row' && key != null) {
      for (const c of [p.children].flat(2)) {
        const el = c as { type?: unknown; props?: Props } | null
        if (el?.type === 'button' && typeof el.props?.children === 'string' && el.props.onClick)
          buttons.set(`${key}|${el.props.children}`, el.props.onClick)
      }
    }
    return actual.jsxDEV(type, props, key, ...rest)
  }
  return { ...actual, jsxDEV }
})

function render(): string {
  buttons.clear()
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<ConnectSuggestPopup />)
}

function click(key: string) {
  const fn = buttons.get(key)
  if (!fn) throw new Error(`no button ${key}`)
  fn()
}

/** The markup of the row that names `name`, up to the next row. */
function row(html: string, name: string): string {
  const i = html.indexOf(`<div>${name}</div>`)
  if (i < 0) throw new Error(`no row ${name}`)
  const start = html.lastIndexOf('class="suggest-row"', i)
  const end = html.indexOf('class="suggest-row"', i)
  return html.slice(start, end < 0 ? undefined : end)
}

function place(specId: string, x: number): string {
  useStore.getState().addEntityFromModel(specId, { x, y: 0 })
  const ents = useStore.getState().scenario.entities
  return ents[ents.length - 1].id
}

function nameOf(specId: string): string {
  return useStore.getState().scenario.library.find((m) => m.id === specId)!.name
}

describe('ConnectSuggestPopup', () => {
  beforeEach(() => {
    useStore.getState().replaceScenario(emptyScenario())
  })

  it('shows an unlinked partner ON BOARD with its distance; Connect flips it to LINKED in place', () => {
    // Lattice and EchoShield pair at probable confidence, so nothing auto-connects.
    const lattice = place('lib-lattice', 0)
    place('lib-echoshield', 200)
    useStore.getState().openConnectSuggestion(lattice, { x: 0, y: 0 }, { always: true })
    expect(useStore.getState().scenario.connections).toHaveLength(0)

    let r = row(render(), nameOf('lib-echoshield'))
    expect(r).toContain('ON BOARD')
    expect(r).toContain('200 m')
    expect(r).toContain('>Connect</button>')
    click('lib-echoshield|Connect')

    const conns = useStore.getState().scenario.connections
    expect(conns).toHaveLength(1)
    // Kill-chain order: the sensor feeds the C2.
    expect(conns[0].toId).toBe(lattice)
    expect(useStore.getState().ui.connectSuggestion).not.toBeNull()
    r = row(render(), nameOf('lib-echoshield'))
    expect(r).toContain('LINKED')
    expect(r).not.toContain('>Connect</button>')
  })

  it('lists a shared-protocol partner in range; Connect draws a typed probable link', () => {
    // RfOne and Lattice share cot-tak with no researched pair.
    const lattice = place('lib-lattice', 0)
    const rf = place('lib-rfone', 200)
    useStore.getState().openConnectSuggestion(rf, { x: 0, y: 0 }, { always: true })
    let r = row(render(), nameOf('lib-lattice'))
    expect(r).toContain('ON BOARD')
    expect(r).toContain('200 m')
    click('lib-lattice|Connect')
    const conns = useStore.getState().scenario.connections
    expect(conns).toHaveLength(1)
    expect(conns[0]).toMatchObject({ fromId: rf, toId: lattice, confidence: 'probable' })
    r = row(render(), nameOf('lib-lattice'))
    expect(r).toContain('LINKED')
  })

  it('marks an auto-connected partner LINKED · auto with no separate row', () => {
    // RPS-42 and FAAD C2 are a documented pair in cable range: auto-connected on open.
    place('lib-faadc2', 0)
    const radar = place('lib-rps42', 200)
    useStore.getState().openConnectSuggestion(radar, { x: 0, y: 0 })
    expect(useStore.getState().scenario.connections).toHaveLength(1)
    const html = render()
    const name = nameOf('lib-faadc2')
    expect(html.split(`<div>${name}</div>`)).toHaveLength(2)
    expect(row(html, name)).toContain('LINKED · auto')
  })

  it('offers Place for a partner not on board; Place requests board placement', () => {
    const lattice = place('lib-lattice', 0)
    useStore.getState().openConnectSuggestion(lattice, { x: 0, y: 0 }, { always: true })
    const r = row(render(), nameOf('lib-spyglass'))
    expect(r).toContain('NOT ON BOARD')
    expect(r).not.toContain('REQUIRED')
    expect(r).toContain('>Place</button>')
    const seq = useStore.getState().ui.placementRequest.seq
    click('lib-spyglass|Place')
    expect(useStore.getState().ui.placementRequest).toEqual({
      seq: seq + 1,
      modelId: 'lib-spyglass',
    })
  })

  it('flags a required partner and its missing group under the head', () => {
    const coyote = place('lib-coyote', 0)
    useStore.getState().openConnectSuggestion(coyote, { x: 0, y: 0 }, { always: true })
    const html = render()
    expect(html).toContain(`Not on board: ${nameOf('lib-faadc2')} or ${nameOf('lib-lattice')}`)
    expect(html).toContain(
      `No fire-control source on board: ${nameOf('lib-kurfs')} or ${nameOf('lib-tpq53')}`,
    )
    expect(row(html, nameOf('lib-faadc2'))).toContain('REQUIRED · NOT ON BOARD')
    expect(row(html, nameOf('lib-faadc2'))).toContain('state critical')
    // No cap: every known partner is listed.
    expect(html).not.toContain('more in the Inspector')
  })

  it('Connect all links every partner whose nearest unlinked instance is in range', () => {
    const lattice = place('lib-lattice', 0)
    place('lib-spyglass', 200)
    place('lib-echoshield', 300)
    // Far beyond any suggest radius: listed with Connect, left out of Connect all.
    place('lib-kurfs', 90000)
    useStore.getState().openConnectSuggestion(lattice, { x: 0, y: 0 }, { always: true })
    const before = useStore.getState().scenario.connections.length
    const html = render()
    expect(html).toContain('>Connect all</button>')
    expect(row(html, nameOf('lib-kurfs'))).toContain('beyond the suggest radius')
    click('Connect all')
    const after = useStore.getState().scenario.connections
    expect(after.length - before).toBe(2)
    expect(after.some((c) => c.fromId === lattice || c.toId === lattice)).toBe(true)
    expect(render()).not.toContain('>Connect all</button>')
  })
})
