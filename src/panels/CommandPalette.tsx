import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react'
import { useStore } from '../state/store'
import { RING_KEYS } from '../state/rings'
import { toggleAnalysisRun } from '../playback/runSession'
import type { Tool } from '../state/store'
import { RING_LABELS } from './ringLabels'
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
  /** Group header the row sits under, e.g. 'Tool'. */
  category: string
  label: string
  /** The App shortcut that runs the same action, shown right-aligned. */
  keys?: string
  run: () => void
}

/** A list click keeps focus in the input, so Escape still reaches the palette. */
function holdInputFocus(e: Pick<ReactMouseEvent, 'preventDefault'>) {
  e.preventDefault()
}

/** Stable grouping by first appearance, so ranking survives inside each group. */
function groupCommands(commands: Command[]): Array<{ category: string; items: Command[] }> {
  const groups = new Map<string, Command[]>()
  for (const c of commands) {
    const items = groups.get(c.category)
    if (items) items.push(c)
    else groups.set(c.category, [c])
  }
  return [...groups].map(([category, items]) => ({ category, items }))
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
  ...RING_KEYS.map((key): Command => ({
    id: `toggle-ring-${key}`,
    category: 'View',
    // Lower the first letter as the other entries do, but keep Pd and acronyms (MIR, MRIR).
    label: `Toggle ${RING_LABELS[key].replace(/^(?!Pd|[A-Z]{2,}\b)\w/, (c) => c.toLowerCase())}`,
    run: () => useStore.getState().toggleLayer(key),
  })),
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
    keys: 'Space',
    run: toggleAnalysisRun,
  },
  {
    id: 'undo',
    category: 'Edit',
    label: 'Undo',
    keys: '⌘Z',
    run: () => useStore.getState().undo(),
  },
  {
    id: 'redo',
    category: 'Edit',
    label: 'Redo',
    keys: '⇧⌘Z',
    run: () => useStore.getState().redo(),
  },
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
  {
    id: 'import-scenario',
    category: 'Scenario',
    label: 'Import scenario',
    run: importScenarioFile,
  },
  {
    id: 'export-library',
    category: 'Library',
    label: 'Export library',
    run: () => exportLibrary(useStore.getState().scenario.library),
  },
  { id: 'import-library', category: 'Library', label: 'Import library', run: importLibraryFile },
]

/** Cmd+K command palette. Mounted only while open. */
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const library = useStore((s) => s.scenario.library)
  const prepare = useStore((s) => s.ui.boardPhase === 'prepare')
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const commands = useMemo<Command[]>(() => {
    const models: Command[] = library.map((m) => ({
      id: `model-${m.id}`,
      category: 'Model',
      label: m.name,
      run: () => useStore.getState().openLibrary(m.kind, m.id),
    }))
    // Board editing tools exist only in Prepare (D3).
    return [...(prepare ? ACTIONS : ACTIONS.filter((c) => c.category !== 'Tool')), ...models]
  }, [library, prepare])

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

  // Arrow keys walk the rows in the grouped order the list draws.
  const groups = useMemo(() => groupCommands(visible), [visible])
  const rows = useMemo(() => groups.flatMap((g) => g.items), [groups])

  // Keep the highlight on a real row as the query narrows the list.
  const active = rows.length === 0 ? -1 : Math.min(highlight, rows.length - 1)

  useEffect(() => {
    listRef.current?.querySelector('.cmdk-item.selected')?.scrollIntoView({ block: 'nearest' })
  }, [active, rows])

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
      if (rows.length === 0) return
      const delta = e.key === 'ArrowDown' ? 1 : -1
      setHighlight((active + delta + rows.length) % rows.length)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (active >= 0) runCommand(rows[active])
    }
  }

  return (
    <div className="cmdk-backdrop" onMouseDown={onClose}>
      <div
        className="cmdk-panel surface-float"
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
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
        <div className="cmdk-list" ref={listRef} onMouseDown={holdInputFocus}>
          {groups.map((g) => (
            <div key={g.category} className="cmdk-group">
              <div className="cmdk-head">{g.category}</div>
              {g.items.map((c) => {
                const i = rows.indexOf(c)
                return (
                  <div
                    key={c.id}
                    className={`cmdk-item${i === active ? ' selected' : ''}`}
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => runCommand(c)}
                  >
                    <span className="cmdk-label">{c.label}</span>
                    {c.keys && <kbd className="kbd kbd-hint">{c.keys}</kbd>}
                  </div>
                )
              })}
            </div>
          ))}
          {rows.length === 0 && <div className="cmdk-empty">No matching commands</div>}
        </div>
      </div>
    </div>
  )
}
