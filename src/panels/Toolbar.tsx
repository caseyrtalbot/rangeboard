import { selectBoardPhase } from '../state/selectors'
import { lazy, memo, Suspense, useRef, useState, useSyncExternalStore } from 'react'
import { usePopover } from '../ui/usePopover'
import { useStore } from '../state/store'
import { Tip } from './Tooltip'
import { DeclutterControl, ViewMenu } from './ViewMenu'
import { RangeSetupMenu } from './RangeSetupMenu'
import type { BoundaryType } from '../model/types'
import { emptyScenario } from '../model/seed'
import { exportScenario, importScenarioFile, scenarioHasWork } from '../io/persist'
import { StorageDialog, StorageMenuItem } from '../ui/StorageMenu'
import { getRecoveryNotices, subscribeRecoveryNotices } from '../io/recovery'
import type { BoardPhase } from '../state/runState'
import { nextTabIndex } from '../ui/rovingTabs'
import { RunControl } from './analysis/RunControl'
import { IconDrawer, IconMore, IconPencil, IconRedo, IconSettings, IconUndo } from '../ui/icons'

const PHASES: { id: BoardPhase; label: string }[] = [
  { id: 'prepare', label: 'Prepare' },
  { id: 'execute', label: 'Execute' },
  { id: 'analyze', label: 'Analyze' },
]

const SettingsPanel = lazy(() =>
  import('./SettingsPanel').then((module) => ({ default: module.SettingsPanel })),
)

function SettingsButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className="tb-icon"
        aria-label="Settings"
        title="Settings"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="settings-panel"
        onClick={() => setOpen(true)}
      >
        <IconSettings />
      </button>
      {open && (
        <Suspense fallback={null}>
          <SettingsPanel onRequestClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  )
}

const BOARD_TOOLS = [
  { id: 'select', label: 'Select', hint: 'Move, pan, edit' },
  { id: 'boundary', label: 'Boundary', hint: 'Draw airspace and range polygons' },
  { id: 'connect', label: 'Connect', hint: 'Link sensor to C2 to effector' },
  { id: 'path', label: 'Path', hint: 'Draw a UAS flight path' },
] as const

const BOUNDARY_TYPES: BoundaryType[] = ['range', 'restricted', 'asset', 'corridor']

/**
 * The scenario ⋯ menu: file actions, then Storage (D5). Storage replaces the menu
 * with its panel in the same wrapper, so one set of dismissal rules covers both.
 * A warning mark on the trigger keeps startup recovery notices visible while shut.
 */
function OverflowMenu() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const { open, setOpen, toggle } = usePopover(wrapRef, buttonRef)
  const [storage, setStorage] = useState(false)
  const notices = useSyncExternalStore(
    subscribeRecoveryNotices,
    getRecoveryNotices,
    getRecoveryNotices,
  ).length
  const close = () => {
    setOpen(false)
    setStorage(false)
  }

  return (
    <div className="tb-menu-wrap" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className={`tb-icon ${open ? 'active' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="file-actions-panel"
        aria-label="More actions"
        title={notices > 0 ? `More actions: ${notices} recovery notices` : 'More actions'}
        onClick={() => {
          setStorage(false)
          toggle()
        }}
      >
        <IconMore />
        {notices > 0 && <span className="tb-icon-mark" aria-hidden="true" />}
      </button>
      {open &&
        (storage ? (
          <StorageDialog onRequestClose={close} />
        ) : (
          <FileActions onRequestClose={close} onOpenStorage={() => setStorage(true)} />
        ))}
    </div>
  )
}

export function FileActions({
  onRequestClose,
  onOpenStorage,
}: {
  onRequestClose: () => void
  onOpenStorage: () => void
}) {
  const scenario = useStore((s) => s.scenario)
  const replaceScenario = useStore((s) => s.replaceScenario)

  return (
    <div
      id="file-actions-panel"
      className="tb-menu-panel surface-float tb-menu-right"
      role="dialog"
      aria-label="File actions"
    >
      <button
        type="button"
        className="tb-menu-item"
        onClick={() => {
          onRequestClose()
          if (
            !scenarioHasWork(scenario) ||
            window.confirm('Start a new empty scenario? Unsaved work is replaced.')
          ) {
            replaceScenario(emptyScenario())
          }
        }}
      >
        New
      </button>
      <button
        type="button"
        className="tb-menu-item"
        onClick={() => {
          onRequestClose()
          importScenarioFile()
        }}
      >
        Import
      </button>
      <button
        type="button"
        className="tb-menu-item"
        onClick={() => {
          onRequestClose()
          exportScenario(scenario)
        }}
      >
        Export
      </button>
      <hr className="tb-menu-sep" />
      <StorageMenuItem onOpen={onOpenStorage} />
    </div>
  )
}

/**
 * The top bar: brand and scenario name on the left, the lifecycle tablist in the
 * centre, then the phase's one primary action, Settings, the ⋯ menu and the drawer
 * on the right. The two side tracks are equal, so the tablist holds the bar centre.
 * It takes only primitives and stable handlers, and subscribes to the name it shows.
 * `runSeq` and `runPhase` are unused: the run status moved to the status bar.
 */
export const Toolbar = memo(function Toolbar({
  drawerOpen,
  onToggleDrawer,
  boardPhase,
  onOpenPhase,
}: {
  drawerOpen: boolean
  onToggleDrawer: () => void
  boardPhase: BoardPhase
  runSeq?: number
  runPhase?: string
  onOpenPhase: (phase: BoardPhase) => void
}) {
  const scenarioName = useStore((s) => s.scenario.name)
  const { setScenarioName } = useStore.getState()
  const nameRef = useRef<HTMLInputElement>(null)

  return (
    // F2 renames from anywhere in the bar, as in a file list.
    <header
      className="toolbar"
      onKeyDown={(event) => {
        if (event.key !== 'F2') return
        event.preventDefault()
        nameRef.current?.focus()
        nameRef.current?.select()
      }}
    >
      <div className="toolbar-left">
        <div className="brand">Rangeboard</div>
        <label className="scenario-name-wrap">
          <input
            ref={nameRef}
            className="scenario-name"
            value={scenarioName}
            onChange={(e) => setScenarioName(e.target.value)}
            aria-label="Scenario name"
            title="Scenario name (F2)"
          />
          <span className="scenario-name-edit" aria-hidden="true">
            <IconPencil />
          </span>
        </label>
      </div>

      <nav className="board-phases" role="tablist" aria-label="Lifecycle views">
        {PHASES.map((phase, index) => (
          <button
            key={phase.id}
            id={`board-phase-${phase.id}`}
            role="tab"
            aria-selected={boardPhase === phase.id}
            aria-controls="board-workspace"
            tabIndex={boardPhase === phase.id ? 0 : -1}
            onClick={() => onOpenPhase(phase.id)}
            onKeyDown={(event) => {
              const to = nextTabIndex(event.key, index, PHASES.length)
              if (to < 0) return
              event.preventDefault()
              onOpenPhase(PHASES[to].id)
              document.getElementById(`board-phase-${PHASES[to].id}`)?.focus()
            }}
          >
            <span className="num">0{index + 1}</span> {phase.label}
          </button>
        ))}
      </nav>

      <div className="toolbar-right">
        <RunControl phase={boardPhase} />
        <SettingsButton />
        <OverflowMenu />
        <button
          id="drawer-toggle"
          type="button"
          className="tb-icon"
          aria-controls="board-workspace-panel"
          aria-expanded={drawerOpen}
          aria-label="Workspace drawer"
          title={`${drawerOpen ? 'Close' : 'Open'} drawer (])`}
          onClick={onToggleDrawer}
        >
          <IconDrawer />
        </button>
      </div>
    </header>
  )
})

/** Canvas-local Board controls, placed over the canvas by App. */
export const BoardTools = memo(function BoardTools({
  onSelectTool,
}: {
  onSelectTool?: () => void
}) {
  const tool = useStore((s) => s.ui.tool)
  const boundaryType = useStore((s) => s.ui.boundaryType)
  const canUndo = useStore((s) => s.past.length > 0)
  const canRedo = useStore((s) => s.future.length > 0)
  const editing = useStore(selectBoardPhase) === 'prepare'
  const { setTool, setBoundaryType, undo, redo } = useStore.getState()

  return (
    <div className="board-tools" role="toolbar" aria-label="Board tools">
      {editing && (
        <div className="seg" role="group" aria-label="Drawing tools">
          {BOARD_TOOLS.map((item) => (
            <Tip key={item.id} label={item.hint}>
              <button
                type="button"
                aria-pressed={tool === item.id}
                className={tool === item.id ? 'active' : ''}
                onClick={() => {
                  onSelectTool?.()
                  setTool(item.id)
                }}
              >
                {item.label}
              </button>
            </Tip>
          ))}
          {tool === 'boundary' && (
            <select
              value={boundaryType}
              onChange={(e) => setBoundaryType(e.target.value as BoundaryType)}
              aria-label="Boundary type"
              title="Boundary type"
            >
              {BOUNDARY_TYPES.map((boundary) => (
                <option key={boundary} value={boundary}>
                  {boundary}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
      {editing && <RangeSetupMenu onSelectTool={onSelectTool} />}
      <ViewMenu />
      <DeclutterControl />
      <div className="seg" role="group" aria-label="History">
        <button
          type="button"
          className="tb-glyph"
          title="Undo (⌘Z)"
          aria-label="Undo"
          onClick={undo}
          disabled={!canUndo}
        >
          <IconUndo />
        </button>
        <button
          type="button"
          className="tb-glyph"
          title="Redo (⇧⌘Z)"
          aria-label="Redo"
          onClick={redo}
          disabled={!canRedo}
        >
          <IconRedo />
        </button>
      </div>
    </div>
  )
})
