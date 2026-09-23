import { selectBoardPhase, selectEffectiveLayers } from '../state/selectors'
import { lazy, memo, Suspense, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Seg, State } from '../ui/kit'
import type { StateTone } from '../ui/kit'
import { usePopover } from '../ui/usePopover'
import { useStore } from '../state/store'
import type { Store } from '../state/store'
import { assessRunValidity } from '../analysis/runValidity'
import { Tip } from './Tooltip'
import { DeclutterControl, ViewMenu } from './ViewMenu'
import { RangeSetupMenu } from './RangeSetupMenu'
import type { BoundaryType, EnvironmentSpec, Roe, Scenario } from '../model/types'
import { emptyScenario } from '../model/seed'
import { exportScenario, importScenarioFile, scenarioHasWork } from '../io/persist'
import { StorageMenu } from '../ui/StorageMenu'
import type { BoardPhase } from '../state/runState'
import { formatRunLabel } from '../state/labels'
import { nextTabIndex } from '../ui/rovingTabs'
import { IconRedo, IconUndo } from '../ui/icons'

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
        title="Settings (requirements, run, systems, physics and view)"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="settings-panel"
        onClick={() => setOpen(true)}
      >
        <span aria-hidden="true">⚙</span> Settings
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

const ROE_PILLS: Record<Roe, { label: string; tone: StateTone; hint: string }> = {
  free: {
    label: 'ROE Free',
    tone: 'nominal',
    hint: 'ROE free: engage declared tracks (doctrine on) or on first detection (doctrine off)',
  },
  tight: {
    label: 'ROE Tight',
    tone: 'inactive',
    hint: 'ROE tight: engage tracks declared hostile',
  },
  hold: { label: 'ROE Hold', tone: 'warning', hint: 'ROE hold: no engagements' },
}

const ROE_OPTIONS: { v: Roe; label: string }[] = [
  { v: 'hold', label: 'Hold' },
  { v: 'tight', label: 'Tight' },
  { v: 'free', label: 'Free' },
]

/**
 * The ROE chip and its menu. Below 1600 px the CSS hides the other chips; this
 * button then counts them, and its panel lists them with the autosave time.
 */
function RoeMenu({ folded, children }: { folded: number; children: ReactNode }) {
  const roe = useStore((s) => s.scenario.roe ?? 'tight')
  const wrapRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const { open, setOpen, toggle } = usePopover(wrapRef, buttonRef)
  return (
    <div className="tb-menu-wrap" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className="status-fold"
        title="ROE · click to change"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="roe-menu-panel"
        onClick={toggle}
      >
        <State tone={ROE_PILLS[roe].tone}>{ROE_PILLS[roe].label}</State>
        {folded > 0 && <span className="status-fold-count">+{folded}</span>}
      </button>
      {open && (
        <div
          id="roe-menu-panel"
          className="tb-menu-panel surface-float tb-menu-right roe-menu-panel"
          role="dialog"
          aria-label="Rules of engagement"
        >
          <div className="tb-menu-head">ROE</div>
          <Seg
            value={roe}
            options={ROE_OPTIONS}
            label="ROE"
            onChange={(next) => {
              useStore.getState().patchScenario({ roe: next })
              setOpen(false)
              buttonRef.current?.focus()
            }}
          />
          {ROE_OPTIONS.map(({ v }) => (
            <p key={v} className="roe-hint">
              {ROE_PILLS[v].hint}
            </p>
          ))}
          <div className="status-fold-chips">{children}</div>
        </div>
      )}
    </div>
  )
}

/** Local wall-clock HH:MM, 24-hour. */
function clockHHMM(epochMs: number): string {
  const d = new Date(epochMs)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Active derating conditions, matching sensorEnvFactor exactly. Empty = no derate. */
function activeDerates(env: EnvironmentSpec): string[] {
  if (!env.apply) return []
  const out: string[] = []
  const precip = env.precipitation ?? 'clear'
  if (precip !== 'clear') out.push(precip)
  if ((env.light ?? 'day') === 'night') out.push('night')
  if ((env.emBackground ?? 'rural') === 'urban') out.push('urban EM')
  if (env.windSpeedMps > 0) out.push(`wind ${env.windSpeedMps} m/s`)
  return out
}

interface SpawnWarning {
  uasIds: string[]
  hint: string
}

const spawnWarningCache = new WeakMap<Scenario, SpawnWarning | null>()

/**
 * The chip reads the same run-validity finding the requirement gates and the run
 * export read. Derived live, never stored, and cached by scenario identity.
 */
function selectSpawnWarning(s: Store): SpawnWarning | null {
  const cached = spawnWarningCache.get(s.scenario)
  if (cached !== undefined) return cached
  const finding = assessRunValidity(s.scenario, []).findings.find((f) => f.id === 'spawn-in-ring')
  const warning = finding ? { uasIds: finding.uasIds, hint: finding.message } : null
  spawnWarningCache.set(s.scenario, warning)
  return warning
}

// File actions sit behind one button so the bar holds a single row at 1440px.
function OverflowMenu() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const { open, setOpen, toggle } = usePopover(wrapRef, buttonRef)

  return (
    <div className="tb-menu-wrap" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className={`tb-menu ${open ? 'active' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="file-actions-panel"
        aria-label="More actions"
        title="File actions"
        onClick={toggle}
      >
        ⋯
      </button>
      {open && <FileActions onRequestClose={() => setOpen(false)} />}
    </div>
  )
}

export function FileActions({ onRequestClose }: { onRequestClose: () => void }) {
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
    </div>
  )
}

/**
 * The top bar: identity, file actions, Settings and Storage on the left, the
 * lifecycle tablist in the centre, run status, chips and the drawer on the right.
 * The two sides stay near equal width, so the tablist holds the bar centre. It
 * takes only primitives and stable handlers, and subscribes to the scenario fields
 * it shows.
 */
export const Toolbar = memo(function Toolbar({
  drawerOpen,
  onToggleDrawer,
  boardPhase,
  runSeq,
  runPhase,
  onOpenPhase,
}: {
  drawerOpen: boolean
  onToggleDrawer: () => void
  boardPhase: BoardPhase
  runSeq: number
  runPhase: string
  onOpenPhase: (phase: BoardPhase) => void
}) {
  const scenarioName = useStore((s) => s.scenario.name)
  const environment = useStore((s) => s.scenario.environment)
  const spawnWarning = useStore(useShallow(selectSpawnWarning))
  const threatWez = useStore((s) => selectEffectiveLayers(s).threatWez)
  const save = useStore((s) => s.save)
  const { setScenarioName } = useStore.getState()

  const derates = activeDerates(environment)
  // One chip set: inline from 1600 px, and inside the ROE panel below it.
  const chips = (
    <>
      {threatWez && (
        <State tone="critical" title="Threat weapon engagement zones are drawn on the canvas">
          WEZ on
        </State>
      )}
      {derates.length > 0 && (
        <State tone="warning" title={`Sensor ranges derated: ${derates.join(', ')}`}>
          Env derate
        </State>
      )}
      {spawnWarning && (
        <button
          type="button"
          className="status-chip"
          title={spawnWarning.hint}
          onClick={() => useStore.getState().select({ entityIds: spawnWarning.uasIds })}
        >
          <State tone="warning">Spawn in ring {spawnWarning.uasIds.length}</State>
        </button>
      )}
      {save.error == null && save.lastAutosaveAt != null && (
        <State tone="inactive" title="Last autosave to browser storage">
          Saved {clockHHMM(save.lastAutosaveAt)}
        </State>
      )}
    </>
  )

  return (
    <header className="toolbar">
      <div className="toolbar-left">
        <div className="brand">Rangeboard</div>
        <input
          className="scenario-name"
          value={scenarioName}
          onChange={(e) => setScenarioName(e.target.value)}
          aria-label="Scenario name"
          title="Scenario name"
        />
        <OverflowMenu />
        <SettingsButton />
        <StorageMenu />
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
        <span className="board-run-context">
          <span className="num">{formatRunLabel(runSeq)}</span> · {runPhase}
        </span>

        <div className="status-pills" aria-label="Status">
          <RoeMenu folded={[threatWez, derates.length, spawnWarning].filter(Boolean).length}>
            {chips}
          </RoeMenu>
          {chips}
          {/* A failed save stays in the bar at every width: it is an alert. */}
          {save.error != null && (
            <State tone="critical" title={save.error} role="alert">
              Save failed
            </State>
          )}
        </div>

        {/* The one drawer control. The filled column marks the drawer as open. */}
        <button
          id="drawer-toggle"
          type="button"
          className="tb-menu tb-drawer-toggle"
          aria-controls="board-workspace-panel"
          aria-expanded={drawerOpen}
          aria-label="Workspace drawer"
          title={`${drawerOpen ? 'Close' : 'Open'} drawer (])`}
          onClick={onToggleDrawer}
        >
          <svg width="14" height="12" viewBox="0 0 14 12" aria-hidden="true">
            <rect x="0.5" y="0.5" width="13" height="11" fill="none" stroke="currentColor" />
            <rect
              x="8.5"
              y="0.5"
              width="5"
              height="11"
              fill={drawerOpen ? 'currentColor' : 'none'}
              stroke="currentColor"
            />
          </svg>
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
