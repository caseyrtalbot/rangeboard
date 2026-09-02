import { Fragment, useRef, useState } from 'react'
import type { EntityKind, SpecModel } from '../model/types'
import { useStore } from '../state/store'
import { exportLibrary, importLibraryFile } from '../io/persist'
import { THREAT_TACTICS } from '../playback/tactics'
import { Glyph } from './Glyph'
import { PALETTE_COLLAPSED_KEY, PALETTE_WIDTH_KEY } from '../io/storageKeys'

const WIDTH_KEY = PALETTE_WIDTH_KEY
const COLLAPSE_KEY = PALETTE_COLLAPSED_KEY

const MIN_W = 180
const MAX_W = 480

function savedWidth(): number {
  const n = Number(localStorage.getItem(WIDTH_KEY))
  return n >= MIN_W && n <= MAX_W ? n : 230
}

function savedCollapsed(): Record<string, boolean> {
  try {
    const v = JSON.parse(localStorage.getItem(COLLAPSE_KEY) ?? '{}')
    return v && typeof v === 'object' ? v : {}
  } catch {
    return {}
  }
}

const SECTIONS: { kind: EntityKind; title: string }[] = [
  { kind: 'sensor', title: 'Sensors' },
  { kind: 'effector', title: 'Effectors' },
  { kind: 'c2', title: 'Command & control' },
  { kind: 'uas', title: 'UAS / threats' },
  { kind: 'asset', title: 'Assets' },
  { kind: 'marker', title: 'Markers' },
]

/** Subtype buckets rendered as muted subheads inside a section. */
const SUBGROUPS: Partial<Record<EntityKind, { label: string; match: (m: SpecModel) => boolean }[]>> = {
  sensor: [
    { label: 'Radar', match: (m) => m.sensor?.sensorType === 'radar' },
    { label: 'RF', match: (m) => m.sensor?.sensorType === 'rf' },
    { label: 'Acoustic', match: (m) => m.sensor?.sensorType === 'acoustic' },
    { label: 'EO/IR', match: (m) => m.sensor?.sensorType === 'eo-ir' },
  ],
  effector: [
    { label: 'Interceptor', match: (m) => m.effector?.effectorType === 'interceptor' },
    { label: 'Gun', match: (m) => m.effector?.effectorType === 'gun' },
    { label: 'Jammer', match: (m) => m.effector?.effectorType === 'jammer' },
    { label: 'DE / HPM', match: (m) => m.effector?.effectorType === 'de' || m.effector?.effectorType === 'hpm' },
    { label: 'Net', match: (m) => m.effector?.effectorType === 'net' },
  ],
}

function subtypeLabel(m: SpecModel): string {
  const groups = SUBGROUPS[m.kind]
  return groups?.find((g) => g.match(m))?.label ?? ''
}

/** Split a section's models into labeled buckets; unmatched models land in Other. */
function bucketize(kind: EntityKind, models: SpecModel[]): { label: string | null; models: SpecModel[] }[] {
  const groups = SUBGROUPS[kind]
  if (!groups) return [{ label: null, models }]
  const buckets = groups.map((g) => ({ label: g.label as string | null, models: models.filter(g.match) }))
  const rest = models.filter((m) => !groups.some((g) => g.match(m)))
  if (rest.length) buckets.push({ label: 'Other', models: rest })
  return buckets.filter((b) => b.models.length > 0)
}

function SectionHeading(props: {
  title: string
  count: number
  open: boolean
  onToggle: () => void
  onAdd?: () => void
  addTitle?: string
}) {
  return (
    <div className="palette-heading">
      <button className="palette-toggle" aria-expanded={props.open} onClick={props.onToggle}>
        <span className="caret">{props.open ? '▾' : '▸'}</span>
        <span className="palette-toggle-title">{props.title}</span>
        <span className="palette-count">{props.count}</span>
      </button>
      {props.onAdd && (
        <button className="mini" title={props.addTitle} onClick={props.onAdd}>
          +
        </button>
      )}
    </div>
  )
}

/**
 * Threat-tactics group: click a tactic to arm the raid builder. The builder
 * card opens in the Inspect tab; the next canvas click places the ingress axis.
 */
function TacticsSection(props: { query: string; open: boolean; onToggle: () => void }) {
  const armedTacticId = useStore((s) => s.ui.raidDraft?.tacticId ?? null)
  const { armRaidDraft, cancelRaidDraft, setRightTab } = useStore.getState()
  const q = props.query
  const tactics = q
    ? THREAT_TACTICS.filter((t) => `${t.id} ${t.name} ${t.description}`.toLowerCase().includes(q))
    : THREAT_TACTICS
  if (q && tactics.length === 0) return null
  return (
    <div className="palette-section">
      <SectionHeading title="Threat tactics" count={tactics.length} open={props.open} onToggle={props.onToggle} />
      {props.open &&
        tactics.map((t) => (
          <div
            key={t.id}
            className={`palette-item ${armedTacticId === t.id ? 'selected' : ''}`}
            onClick={() => {
              // Clicking the armed tactic again disarms it; any other click
              // re-arms with that tactic's defaults.
              if (armedTacticId === t.id) {
                cancelRaidDraft()
                return
              }
              armRaidDraft(t.id)
              setRightTab('inspect')
            }}
            title={`${t.name}: ${t.description} (study ${t.sourceRef})`}
          >
            <Glyph kind="uas" color="#c46a5a" size={10} />
            <span className="palette-name">
              {t.id} · {t.name}
            </span>
          </div>
        ))}
    </div>
  )
}

/** Left panel: drag a model or a whole system onto the canvas to place it. */
export function Palette() {
  const library = useStore((s) => s.scenario.library)
  const systemPresets = useStore((s) => s.scenario.systemPresets)
  const selectedId = useStore((s) => s.selection.libraryId)
  const select = useStore((s) => s.select)
  const setRightTab = useStore((s) => s.setRightTab)
  const addModel = useStore((s) => s.addModel)
  const deleteSystemPreset = useStore((s) => s.deleteSystemPreset)
  const cancelRaidDraft = useStore((s) => s.cancelRaidDraft)
  const [width, setWidth] = useState(savedWidth)
  const [filter, setFilter] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(savedCollapsed)
  const dragFrom = useRef<{ x: number; w: number } | null>(null)

  const q = filter.trim().toLowerCase()
  // A live filter overrides the collapse state so matches are always visible.
  const isOpen = (key: string) => (q ? true : !collapsed[key])

  function toggleSection(key: string) {
    setCollapsed((c) => {
      const next = { ...c, [key]: !c[key] }
      localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next))
      return next
    })
  }

  function startResize(e: React.MouseEvent) {
    e.preventDefault()
    dragFrom.current = { x: e.clientX, w: width }
    function onMove(ev: MouseEvent) {
      const from = dragFrom.current
      if (!from) return
      const w = Math.min(MAX_W, Math.max(MIN_W, from.w + ev.clientX - from.x))
      setWidth(w)
      localStorage.setItem(WIDTH_KEY, String(w))
    }
    function onUp() {
      dragFrom.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const systems = q
    ? systemPresets.filter((p) => `${p.name} ${p.description ?? ''}`.toLowerCase().includes(q))
    : systemPresets

  function modelMatches(m: SpecModel, sectionTitle: string): boolean {
    if (!q) return true
    return `${m.name} ${m.description} ${subtypeLabel(m)} ${sectionTitle}`.toLowerCase().includes(q)
  }

  return (
    <aside className="palette" style={{ width }}>
      <div className="panel-title">Library</div>
      <div className="palette-filter">
        <input
          type="search"
          placeholder="Filter models…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      <div className="palette-scroll">
        {!(q && systems.length === 0) && (
          <div className="palette-section">
            <SectionHeading
              title="Integrated systems"
              count={systems.length}
              open={isOpen('systems')}
              onToggle={() => toggleSection('systems')}
            />
            {isOpen('systems') &&
              systems.map((p) => (
                <div
                  key={p.id}
                  className="palette-item"
                  draggable
                  onDragStart={(e) => {
                    cancelRaidDraft()
                    e.dataTransfer.setData('text/rangeboard-system', p.id)
                    e.dataTransfer.effectAllowed = 'copy'
                  }}
                  title={p.description || p.name}
                >
                  <Glyph kind="sensor" color="#7da7c4" size={10} />
                  <span className="palette-name">{p.name}</span>
                  {!p.builtin && (
                    <button
                      className="mini"
                      title="Delete system preset"
                      onClick={() => deleteSystemPreset(p.id)}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            {isOpen('systems') && !q && systemPresets.length === 0 && (
              <div className="palette-item" style={{ cursor: 'default', opacity: 0.6 }}>
                <span className="palette-name">Select entities, then save as system</span>
              </div>
            )}
          </div>
        )}
        {SECTIONS.map((section) => {
          const models = library.filter((m) => m.kind === section.kind && modelMatches(m, section.title))
          const tactics = section.kind === 'uas' && (
            <TacticsSection query={q} open={isOpen('tactics')} onToggle={() => toggleSection('tactics')} />
          )
          if (q && models.length === 0) return <Fragment key={section.kind}>{tactics}</Fragment>
          const open = isOpen(section.kind)
          return (
            <Fragment key={section.kind}>
              {tactics}
              <div className="palette-section">
                <SectionHeading
                  title={section.title}
                  count={models.length}
                  open={open}
                  onToggle={() => toggleSection(section.kind)}
                  addTitle={`New ${section.title} model`}
                  onAdd={() => {
                    cancelRaidDraft()
                    const id = addModel(section.kind)
                    select({ libraryId: id })
                    setRightTab('library')
                  }}
                />
                {open &&
                  bucketize(section.kind, models).map((bucket) => (
                    <Fragment key={bucket.label ?? 'all'}>
                      {bucket.label && <div className="palette-subhead">{bucket.label}</div>}
                      {bucket.models.map((m) => (
                        <div
                          key={m.id}
                          className={`palette-item ${selectedId === m.id ? 'selected' : ''}`}
                          draggable
                          onDragStart={(e) => {
                            cancelRaidDraft()
                            e.dataTransfer.setData('text/rangeboard-model', m.id)
                            e.dataTransfer.effectAllowed = 'copy'
                          }}
                          onClick={() => {
                            cancelRaidDraft()
                            select({ libraryId: m.id })
                            setRightTab('library')
                          }}
                          title={m.description || m.name}
                        >
                          <Glyph kind={m.kind} color={m.color} size={10} />
                          <span className="palette-name">{m.name}</span>
                        </div>
                      ))}
                    </Fragment>
                  ))}
              </div>
            </Fragment>
          )
        })}
      </div>
      <div className="palette-footer">
        <button onClick={() => exportLibrary(library)}>Export library</button>
        <button onClick={importLibraryFile}>Import library</button>
      </div>
      <div className="palette-resizer" title="Drag to resize" onMouseDown={startResize} />
    </aside>
  )
}
