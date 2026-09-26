import { Fragment, memo, useEffect, useRef, useState } from 'react'
import type { DragEvent, KeyboardEvent, MouseEvent as ReactMouseEvent } from 'react'
import type { EntityKind, SpecModel } from '../model/types'
import { useStore } from '../state/store'
import { exportLibrary, importLibraryFile } from '../io/persist'
import { THREAT_TACTICS } from '../playback/tactics'
import { Glyph } from './Glyph'
import { PALETTE_COLLAPSED_KEY, PALETTE_WIDTH_KEY } from '../io/storageKeys'
import { readSetting, writeSetting } from '../io/viewState'
import { KIND_INK } from '../ui/ink'
import { KIND_NAMES } from '../state/labels'
import { IconChevronRight, IconClose, IconMore } from '../ui/icons'
import { usePopover } from '../ui/usePopover'
import { LibraryEditor } from './LibraryEditor'

const WIDTH_KEY = PALETTE_WIDTH_KEY
const COLLAPSE_KEY = PALETTE_COLLAPSED_KEY

const MIN_W = 180
const MAX_W = 480
const DEFAULT_W = 306
const KEYBOARD_STEP_W = 12
/** The editor view is never narrower than the right panel's default width. */
const EDITOR_W = 408

function savedWidth(): number {
  const n = Number(readSetting(WIDTH_KEY))
  return n >= MIN_W && n <= MAX_W ? n : DEFAULT_W
}

function savedCollapsed(): Record<string, boolean> {
  try {
    const v = JSON.parse(readSetting(COLLAPSE_KEY) ?? '{}')
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
const SUBGROUPS: Partial<
  Record<EntityKind, { label: string; match: (m: SpecModel) => boolean }[]>
> = {
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
    {
      label: 'DE / HPM',
      match: (m) => m.effector?.effectorType === 'de' || m.effector?.effectorType === 'hpm',
    },
    { label: 'Net', match: (m) => m.effector?.effectorType === 'net' },
  ],
}

function subtypeLabel(m: SpecModel): string {
  const groups = SUBGROUPS[m.kind]
  return groups?.find((g) => g.match(m))?.label ?? ''
}

/**
 * A row's two lines. The model record has no vendor field; a library name carries
 * its vendor or variant as a trailing parenthetical, so that moves to line 2 beside
 * the type and line 1 never wraps.
 */
function rowLines(m: SpecModel): { name: string; meta: string } {
  const split = /^(.*\S)\s*\(([^()]+)\)$/.exec(m.name.trim())
  const type = subtypeLabel(m) || KIND_NAMES[m.kind]
  return split ? { name: split[1], meta: `${split[2]} · ${type}` } : { name: m.name, meta: type }
}

/** Line 1 at 13/500 with its full text in the title, line 2 in 11 px mono. */
function RowText({ name, meta, full }: { name: string; meta: string; full: string }) {
  return (
    <span className="palette-text">
      <span className="palette-name" title={full}>
        {name}
      </span>
      <span className="palette-meta">{meta}</span>
    </span>
  )
}

/** Split a section's models into labeled buckets; unmatched models land in Other. */
function bucketize(
  kind: EntityKind,
  models: SpecModel[],
): { label: string | null; models: SpecModel[] }[] {
  const groups = SUBGROUPS[kind]
  if (!groups) return [{ label: null, models }]
  const buckets = groups.map((g) => ({
    label: g.label as string | null,
    models: models.filter(g.match),
  }))
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
      <button
        className="palette-toggle"
        type="button"
        aria-label={`${props.open ? 'Collapse' : 'Expand'} ${props.title}`}
        aria-expanded={props.open}
        onClick={props.onToggle}
      >
        <span className="caret">{props.open ? '▾' : '▸'}</span>
        <span className="palette-toggle-title">{props.title}</span>
        <span className="palette-count">{props.count}</span>
      </button>
      {props.onAdd && (
        <button
          className="mini"
          type="button"
          aria-label={props.addTitle}
          title={props.addTitle}
          onClick={props.onAdd}
        >
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
function TacticsSection(props: {
  query: string
  open: boolean
  onToggle: () => void
  onClose?: () => void
}) {
  const armedTacticId = useStore((s) => s.ui.raidDraft?.tacticId ?? null)
  const { armRaidDraft, cancelRaidDraft, setRightTab } = useStore.getState()
  const q = props.query
  const tactics = q
    ? THREAT_TACTICS.filter((t) => `${t.id} ${t.name} ${t.description}`.toLowerCase().includes(q))
    : THREAT_TACTICS
  if (q && tactics.length === 0) return null
  return (
    <div className="palette-section">
      <SectionHeading
        title="Threat tactics"
        count={tactics.length}
        open={props.open}
        onToggle={props.onToggle}
      />
      {props.open &&
        tactics.map((t) => (
          <button
            key={t.id}
            className={`palette-item ${armedTacticId === t.id ? 'selected' : ''}`}
            type="button"
            onClick={() => {
              // Clicking the armed tactic again disarms it; another click re-arms.
              if (armedTacticId === t.id) {
                cancelRaidDraft()
                return
              }
              armRaidDraft(t.id)
              setRightTab('inspect')
              props.onClose?.()
            }}
            title={`${t.name}: ${t.description} (study ${t.sourceRef})`}
          >
            <Glyph kind="uas" color={KIND_INK.uas} size={12} />
            <RowText name={t.name} meta={`${t.id} · Tactic`} full={`${t.id} · ${t.name}`} />
          </button>
        ))}
    </div>
  )
}

/** Library file actions behind one ⋯ button in the drawer header. */
function LibraryActions({ library }: { library: SpecModel[] }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const { open, setOpen, toggle } = usePopover(wrapRef, buttonRef)

  return (
    <div className="tb-menu-wrap" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className="palette-icon"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="library-actions-panel"
        aria-label="Library actions"
        title="Library actions"
        onClick={toggle}
      >
        <IconMore />
      </button>
      {open && (
        <div
          id="library-actions-panel"
          className="tb-menu-panel surface-float tb-menu-right"
          role="dialog"
          aria-label="Library actions"
        >
          <button
            type="button"
            className="tb-menu-item"
            onClick={() => {
              setOpen(false)
              importLibraryFile()
            }}
          >
            Import library
          </button>
          <button
            type="button"
            className="tb-menu-item"
            onClick={() => {
              setOpen(false)
              exportLibrary(library)
            }}
          >
            Export library
          </button>
        </div>
      )}
    </div>
  )
}

export interface LibraryPlacement {
  kind: 'model' | 'system'
  id: string
  name: string
}

interface PaletteProps {
  open?: boolean
  onClose?: () => void
  onArmPlacement?: (placement: LibraryPlacement) => void
  onPlacementStart?: () => void
}

/** Drawer-ready library: place, drag or inspect a model or integrated system. */
export const Palette = memo(function Palette({
  open = true,
  onClose,
  onArmPlacement,
  onPlacementStart,
}: PaletteProps) {
  const library = useStore((s) => s.scenario.library)
  const systemPresets = useStore((s) => s.scenario.systemPresets)
  const selectedId = useStore((s) => s.selection.libraryId)
  const addModel = useStore((s) => s.addModel)
  const deleteSystemPreset = useStore((s) => s.deleteSystemPreset)
  const cancelRaidDraft = useStore((s) => s.cancelRaidDraft)
  const openLibrary = useStore((s) => s.openLibrary)
  const request = useStore((s) => s.ui.libraryRequest)
  const [width, setWidth] = useState(savedWidth)
  const [filter, setFilter] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(savedCollapsed)
  // The last request that no longer shows the editor: Back and Close dismiss it.
  const [dismissed, setDismissed] = useState(0)
  // The request and open state this drawer last acted on.
  const [seen, setSeen] = useState({ seq: request.seq, open })
  // The control to focus once the render that shows it is on screen.
  const [focus, setFocus] = useState<{ selector: string } | null>(null)
  const dragFrom = useRef<{ x: number; w: number } | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const asideRef = useRef<HTMLElement>(null)
  // A request with a model shows the selected model's editor in place of the list.
  const editModel =
    open && request.modelId != null && request.seq > dismissed
      ? library.find((m) => m.id === selectedId)
      : undefined
  const shownWidth = editModel ? Math.max(width, EDITOR_W) : width

  // Close dismisses the editor. An `openLibrary` call on an open drawer clears the
  // filter and focuses the model's editor or the kind's group.
  if (seen.open !== open || (open && seen.seq !== request.seq)) {
    setSeen({ seq: open ? request.seq : seen.seq, open })
    if (!open) setDismissed(request.seq)
    else if (seen.seq !== request.seq) {
      setFilter('')
      if (request.modelId != null) setFocus({ selector: '.lib-back' })
      else if (request.kind) showGroup(request.kind)
    }
  }

  useEffect(() => {
    if (open) searchRef.current?.focus()
  }, [open])

  useEffect(() => {
    const target = focus && asideRef.current?.querySelector<HTMLElement>(focus.selector)
    target?.scrollIntoView({ block: 'nearest' })
    target?.focus()
  }, [focus])

  // The undo cue beside the drawer reads the width to stay clear of it.
  useEffect(() => {
    asideRef.current
      ?.closest<HTMLElement>('.board-stage')
      ?.style.setProperty('--library-w', `${shownWidth}px`)
  }, [shownWidth])

  const q = filter.trim().toLowerCase()
  // A live filter overrides the collapse state so matches are always visible.
  const isOpen = (key: string) => (q ? true : !collapsed[key])

  function toggleSection(key: string) {
    setCollapsed((c) => {
      const next = { ...c, [key]: !c[key] }
      writeSetting(COLLAPSE_KEY, JSON.stringify(next))
      return next
    })
  }

  /** Expand the kind's group for this session and focus its toggle. */
  function showGroup(kind: EntityKind) {
    setCollapsed((c) => (c[kind] ? { ...c, [kind]: false } : c))
    setFocus({ selector: `#library-group-${kind} .palette-toggle` })
  }

  function openEditor(m: SpecModel) {
    cancelRaidDraft()
    openLibrary(m.kind, m.id)
  }

  function commitWidth(nextWidth: number) {
    const clamped = Math.min(MAX_W, Math.max(MIN_W, nextWidth))
    setWidth(clamped)
    writeSetting(WIDTH_KEY, String(clamped))
  }

  function startResize(e: ReactMouseEvent<HTMLDivElement>) {
    e.preventDefault()
    dragFrom.current = { x: e.clientX, w: shownWidth }
    function onMove(ev: MouseEvent) {
      const from = dragFrom.current
      if (!from) return
      commitWidth(from.w + ev.clientX - from.x)
    }
    function onUp() {
      dragFrom.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function resizeWithKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    const next =
      event.key === 'ArrowLeft'
        ? shownWidth - KEYBOARD_STEP_W
        : event.key === 'ArrowRight'
          ? shownWidth + KEYBOARD_STEP_W
          : event.key === 'Home'
            ? MIN_W
            : event.key === 'End'
              ? MAX_W
              : null
    if (next === null) return
    event.preventDefault()
    commitWidth(next)
  }

  function finishDrag(event: DragEvent<HTMLDivElement>) {
    if (event.dataTransfer.dropEffect !== 'none') onPlacementStart?.()
  }

  const systems = q
    ? systemPresets.filter((p) => `${p.name} ${p.description ?? ''}`.toLowerCase().includes(q))
    : systemPresets

  function modelMatches(m: SpecModel, sectionTitle: string): boolean {
    if (!q) return true
    return `${m.name} ${m.description} ${subtypeLabel(m)} ${sectionTitle}`.toLowerCase().includes(q)
  }

  const close = (
    <button
      className="palette-icon palette-close"
      type="button"
      aria-label="Close library"
      title="Close library (Esc)"
      onClick={onClose}
    >
      <IconClose />
    </button>
  )

  return (
    <aside
      ref={asideRef}
      className="palette"
      style={{ width: shownWidth }}
      hidden={!open}
      aria-label="Model library"
    >
      {editModel ? (
        <>
          <div className="palette-header lib-editor-header">
            <button
              className="lib-back"
              type="button"
              aria-label="Back to library"
              title="Back to library"
              onClick={() => {
                setDismissed(request.seq)
                showGroup(editModel.kind)
              }}
            >
              <IconChevronRight />
              <span>Library</span>
            </button>
            {close}
          </div>
          <LibraryEditor />
        </>
      ) : (
        <>
          <div className="palette-header">
            <div className="panel-title">Library</div>
            <LibraryActions library={library} />
            {close}
          </div>
          <div className="palette-filter">
            <input
              ref={searchRef}
              type="search"
              aria-label="Search library"
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
                      onDragEnd={finishDrag}
                      title={p.description || p.name}
                    >
                      <button
                        className="palette-place"
                        type="button"
                        aria-label={`Place ${p.name}`}
                        onClick={() => {
                          cancelRaidDraft()
                          onArmPlacement?.({ kind: 'system', id: p.id, name: p.name })
                        }}
                      >
                        <Glyph kind="sensor" color="#7da7c4" size={12} />
                        <RowText name={p.name} meta="Integrated system" full={p.name} />
                      </button>
                      {!p.builtin ? (
                        <div className="palette-item-actions">
                          <button
                            className="mini palette-delete"
                            type="button"
                            aria-label={`Delete ${p.name} system preset`}
                            title="Delete system preset"
                            onClick={() => deleteSystemPreset(p.id)}
                          >
                            ×
                          </button>
                        </div>
                      ) : null}
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
              const models = library.filter(
                (m) => m.kind === section.kind && modelMatches(m, section.title),
              )
              const tactics = section.kind === 'uas' && (
                <TacticsSection
                  query={q}
                  open={isOpen('tactics')}
                  onToggle={() => toggleSection('tactics')}
                  onClose={onClose}
                />
              )
              if (q && models.length === 0) return <Fragment key={section.kind}>{tactics}</Fragment>
              const open = isOpen(section.kind)
              return (
                <Fragment key={section.kind}>
                  {tactics}
                  <div className="palette-section" id={`library-group-${section.kind}`}>
                    <SectionHeading
                      title={section.title}
                      count={models.length}
                      open={open}
                      onToggle={() => toggleSection(section.kind)}
                      addTitle={`New ${section.title} model`}
                      onAdd={() => {
                        cancelRaidDraft()
                        openLibrary(section.kind, addModel(section.kind))
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
                              onDragEnd={finishDrag}
                              title={m.description || m.name}
                            >
                              <button
                                className="palette-place"
                                type="button"
                                aria-label={`Place ${m.name}`}
                                onClick={() => {
                                  cancelRaidDraft()
                                  onArmPlacement?.({ kind: 'model', id: m.id, name: m.name })
                                }}
                              >
                                <Glyph kind={m.kind} color={m.color} size={12} />
                                <RowText {...rowLines(m)} full={m.name} />
                              </button>
                              <div className="palette-item-actions">
                                <button
                                  className="mini palette-basis"
                                  type="button"
                                  aria-label={`Open ${m.name} model basis`}
                                  onClick={() => openEditor(m)}
                                >
                                  Model basis
                                </button>
                              </div>
                            </div>
                          ))}
                        </Fragment>
                      ))}
                  </div>
                </Fragment>
              )
            })}
          </div>
        </>
      )}
      <div
        className="palette-resizer"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize library"
        aria-valuenow={shownWidth}
        aria-valuemin={MIN_W}
        aria-valuemax={MAX_W}
        tabIndex={0}
        title="Drag or use the arrow keys to resize"
        onMouseDown={startResize}
        onKeyDown={resizeWithKeyboard}
      />
    </aside>
  )
})
