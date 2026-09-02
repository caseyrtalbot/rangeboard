import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useStore } from '../state/store'
import { toggleAnalysisRun } from '../playback/runSession'
import type { Tool } from '../state/store'
import type { BasemapMode } from '../model/types'
import { emptyScenario } from '../model/seed'
import {
  exportLibrary,
  exportScenario,
  importLibraryFile,
  importScenarioFile,
  scenarioHasWork,
} from '../io/persist'

interface Command {
  id: string
  /** Dim prefix shown before the label, e.g. 'Tool'. */
  category: string
  label: string
  run: () => void
}

const TOOLS: Array<[Tool, string]> = [
  ['select', 'Select'],
  ['boundary', 'Boundary'],
  ['connect', 'Connect'],
  ['path', 'Path'],
  ['calibrate', 'Calibrate'],
]

const BASEMAPS: Array<[BasemapMode, string]> = [
  ['canvas', 'Canvas'],
  ['sat', 'Satellite'],
  ['airspace', 'Airspace'],
]

/** Fixed action commands; each reads fresh store state when it runs. */
const ACTIONS: Command[] = [
  ...TOOLS.map(([id, label]): Command => ({
    id: `tool-${id}`,
    category: 'Tool',
    label,
    run: () => useStore.getState().setTool(id),
  })),
  ...BASEMAPS.map(([id, label]): Command => ({
    id: `basemap-${id}`,
    category: 'Basemap',
    label,
    run: () => useStore.getState().setBasemap(id),
  })),
  {
    id: 'toggle-wez',
    category: 'View',
    label: 'Toggle threat WEZ overlay',
    run: () => useStore.getState().toggleLayer('threatWez'),
  },
  {
    id: 'toggle-units',
    category: 'View',
    label: 'Toggle units (kt nm / m km)',
    run: () => {
      const st = useStore.getState()
      st.setUnits(st.ui.units === 'aviation' ? 'metric' : 'aviation')
    },
  },
  {
    id: 'play-pause',
    category: 'Playback',
    label: 'Play / pause',
    run: toggleAnalysisRun,
  },
  { id: 'undo', category: 'Edit', label: 'Undo', run: () => useStore.getState().undo() },
  { id: 'redo', category: 'Edit', label: 'Redo', run: () => useStore.getState().redo() },
  {
    id: 'new-scenario',
    category: 'Scenario',
    label: 'New scenario',
    run: () => {
      if (
        !scenarioHasWork(useStore.getState().scenario) ||
        window.confirm('Start a new empty scenario? Unsaved work is replaced.')
      ) {
        useStore.getState().replaceScenario(emptyScenario())
      }

    },
  },
  {
    id: 'export-scenario',
    category: 'Scenario',
    label: 'Export scenario',
    run: () => exportScenario(useStore.getState().scenario),
  },
  { id: 'import-scenario', category: 'Scenario', label: 'Import scenario', run: importScenarioFile },
  {
    id: 'export-library',
    category: 'Library',
    label: 'Export library',
    run: () => exportLibrary(useStore.getState().scenario.library),
  },
  { id: 'import-library', category: 'Library', label: 'Import library', run: importLibraryFile },
]

/** Cmd+K command palette. Mounted only while open, Board workspace only. */
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const library = useStore((s) => s.scenario.library)
  const testCards = useStore((s) => s.scenario.testCards)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const commands = useMemo<Command[]>(() => {
    const models: Command[] = library.map((m) => ({
      id: `model-${m.id}`,
      category: 'Model',
      label: m.name,
      run: () => {
        const st = useStore.getState()
        st.select({ libraryId: m.id })
        st.setRightTab('library')
      },
    }))
    const cards: Command[] = testCards.map((c) => ({
      id: `card-${c.id}`,
      category: 'Card',
      label: `${c.cardId} v${c.version}${c.purpose ? ` · ${c.purpose}` : ''}`,
      run: () => {
        const st = useStore.getState()
        st.select({ cardId: c.id })
        st.setRightTab('cards')
      },
    }))
    return [...ACTIONS, ...models, ...cards]
  }, [library, testCards])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    const prefix: Command[] = []
    const rest: Command[] = []
    for (const c of commands) {
      const label = c.label.toLowerCase()
      const full = `${c.category.toLowerCase()}: ${label}`
      if (label.startsWith(q) || full.startsWith(q)) prefix.push(c)
      else if (full.includes(q)) rest.push(c)
    }
    return [...prefix, ...rest]
  }, [commands, query])

  // Keep the highlight on a real row as the query narrows the list.
  const active = visible.length === 0 ? -1 : Math.min(highlight, visible.length - 1)

  useEffect(() => {
    listRef.current?.querySelector('.cmdk-item.selected')?.scrollIntoView({ block: 'nearest' })
  }, [active, visible])

  function runCommand(c: Command) {
    onClose()
    c.run()
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    // The global App shortcuts must not also fire while the palette is up.
    e.stopPropagation()
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      onClose()
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (visible.length === 0) return
      const delta = e.key === 'ArrowDown' ? 1 : -1
      setHighlight((active + delta + visible.length) % visible.length)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (active >= 0) runCommand(visible[active])
    }
  }

  return (
    <div className="cmdk-backdrop" onMouseDown={onClose}>
      <div className="cmdk-panel" onMouseDown={(e) => e.stopPropagation()} onKeyDown={onKeyDown}>
        <input
          className="cmdk-input"
          autoFocus
          placeholder="Type a command…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setHighlight(0)
          }}
        />
        <div className="cmdk-list" ref={listRef}>
          {visible.map((c, i) => (
            <div
              key={c.id}
              className={`cmdk-item${i === active ? ' selected' : ''}`}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => runCommand(c)}
            >
              <span className="cmdk-cat">{c.category}:</span>
              <span className="cmdk-label">{c.label}</span>
            </div>
          ))}
          {visible.length === 0 && <div className="cmdk-empty">No matching commands</div>}
        </div>
      </div>
    </div>
  )
}
