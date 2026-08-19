import type { EntityKind } from '../model/types'
import { useStore } from '../state/store'
import { exportLibrary, importLibraryFile } from '../io/persist'

const SECTIONS: { kind: EntityKind; title: string }[] = [
  { kind: 'sensor', title: 'Sensors' },
  { kind: 'effector', title: 'Effectors' },
  { kind: 'c2', title: 'Command & control' },
  { kind: 'uas', title: 'UAS / threats' },
  { kind: 'asset', title: 'Assets' },
  { kind: 'marker', title: 'Markers' },
]

/** Left panel: drag a model onto the canvas to place an entity. */
export function Palette() {
  const library = useStore((s) => s.scenario.library)
  const selectedId = useStore((s) => s.selection.libraryId)
  const select = useStore((s) => s.select)
  const setRightTab = useStore((s) => s.setRightTab)
  const addModel = useStore((s) => s.addModel)

  return (
    <aside className="palette">
      <div className="panel-title">Library</div>
      <div className="palette-scroll">
        {SECTIONS.map((section) => {
          const models = library.filter((m) => m.kind === section.kind)
          return (
            <div key={section.kind} className="palette-section">
              <div className="palette-heading">
                {section.title}
                <button
                  className="mini"
                  title={`New ${section.title} model`}
                  onClick={() => {
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
                    e.dataTransfer.setData('text/rangeboard-model', m.id)
                    e.dataTransfer.effectAllowed = 'copy'
                  }}
                  onClick={() => {
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
          )
        })}
      </div>
      <div className="palette-footer">
        <button onClick={() => exportLibrary(library)}>Export library</button>
        <button onClick={importLibraryFile}>Import library</button>
      </div>
    </aside>
  )
}
