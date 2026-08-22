import { Fragment, useRef, useState } from 'react'
import type { EntityKind } from '../model/types'
import { useStore } from '../state/store'
import { exportLibrary, importLibraryFile } from '../io/persist'
import { THREAT_TACTICS } from '../playback/tactics'

const WIDTH_KEY = 'rangeboard.palette.width'
const MIN_W = 180
const MAX_W = 480

function savedWidth(): number {
  const n = Number(localStorage.getItem(WIDTH_KEY))
  return n >= MIN_W && n <= MAX_W ? n : 230
}

const SECTIONS: { kind: EntityKind; title: string }[] = [
  { kind: 'sensor', title: 'Sensors' },
  { kind: 'effector', title: 'Effectors' },
  { kind: 'c2', title: 'Command & control' },
  { kind: 'uas', title: 'UAS / threats' },
  { kind: 'asset', title: 'Assets' },
  { kind: 'marker', title: 'Markers' },
]

/**
 * Threat-tactics group: click a tactic to arm the raid builder. The builder
 * card opens in the Inspect tab; the next canvas click places the ingress axis.
 */
function TacticsSection() {
  const armedTacticId = useStore((s) => s.ui.raidDraft?.tacticId ?? null)
  const { armRaidDraft, cancelRaidDraft, setRightTab } = useStore.getState()
  return (
    <div className="palette-section">
      <div className="palette-heading">Threat tactics</div>
      {THREAT_TACTICS.map((t) => (
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
          <span className="dot" style={{ background: '#c46a5a' }} />
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
  const dragFrom = useRef<{ x: number; w: number } | null>(null)

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

  return (
    <aside className="palette" style={{ width }}>
      <div className="panel-title">Library</div>
      <div className="palette-scroll">
        <div className="palette-section">
          <div className="palette-heading">Integrated systems</div>
          {systemPresets.map((p) => (
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
              <span className="dot" style={{ background: '#7da7c4' }} />
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
          {systemPresets.length === 0 && (
            <div className="palette-item" style={{ cursor: 'default', opacity: 0.6 }}>
              <span className="palette-name">Select entities, then save as system</span>
            </div>
          )}
        </div>
        {SECTIONS.map((section) => {
          const models = library.filter((m) => m.kind === section.kind)
          return (
            <Fragment key={section.kind}>
              {section.kind === 'uas' && <TacticsSection />}
              <div className="palette-section">
              <div className="palette-heading">
                {section.title}
                <button
                  className="mini"
                  title={`New ${section.title} model`}
                  onClick={() => {
                    cancelRaidDraft()
                    const id = addModel(section.kind)
                    select({ libraryId: id })
                    setRightTab('library')
                  }}
                >
                  +
                </button>
              </div>
              {models.map((m) => (
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
                  <span className="dot" style={{ background: m.color }} />
                  <span className="palette-name">{m.name}</span>
                </div>
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
