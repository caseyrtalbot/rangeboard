import { selectEffectiveLayers } from '../state/selectors'
import { lazy, memo, Suspense, useRef, useState } from 'react'
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

const SettingsPanel = lazy(() => import('./SettingsPanel').then((module) => ({ default: module.SettingsPanel })))

function SettingsButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" title="Settings (all scenario, run and view settings)"
        aria-haspopup="dialog" aria-expanded={open} aria-controls="settings-panel"
        onClick={() => setOpen(true)}>
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
  free: { label: 'ROE Free', tone: 'nominal', hint: 'ROE free: engage declared tracks (doctrine on) or on first detection (doctrine off)' },
  tight: { label: 'ROE Tight', tone: 'inactive', hint: 'ROE tight: engage tracks declared hostile' },
  hold: { label: 'ROE Hold', tone: 'warning', hint: 'ROE hold: no engagements' },
}

const ROE_OPTIONS: { v: Roe; label: string }[] = [
  { v: 'hold', label: 'Hold' },
  { v: 'tight', label: 'Tight' },
  { v: 'free', label: 'Free' },
]

function RoeMenu() {
  const roe = useStore((s) => s.scenario.roe ?? 'tight')
  const wrapRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const { open, setOpen, toggle } = usePopover(wrapRef, buttonRef)
  return (
    <div className="tb-menu-wrap" ref={wrapRef}>
      <button ref={buttonRef} type="button" title="ROE · click to change"
        aria-haspopup="dialog" aria-expanded={open} aria-controls="roe-menu-panel"
        onClick={toggle}>
        <State tone={ROE_PILLS[roe].tone}>{ROE_PILLS[roe].label}</State>
      </button>
      {open && (
        <div id="roe-menu-panel" className="tb-menu-panel tb-menu-right roe-menu-panel"
          role="dialog" aria-label="Rules of engagement">
          <div className="tb-menu-head">ROE</div>
          <Seg value={roe} options={ROE_OPTIONS} label="ROE" onChange={(next) => {
            useStore.getState().patchScenario({ roe: next })
            setOpen(false)
            buttonRef.current?.focus()
          }} />
          {ROE_OPTIONS.map(({ v }) => <p key={v} className="roe-hint">{ROE_PILLS[v].hint}</p>)}
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
  count: number
  hint: string
}

const spawnWarningCache = new WeakMap<Scenario, SpawnWarning | null>()

/**
 * One source of truth with the analysis record: the chip reads the same run-validity
 * finding the requirement gates and the run export read, so the toolbar and the evidence
 * can never disagree. Derived live, never stored; cached by scenario identity so the
 * selector costs nothing on a publication that leaves the scenario alone.
 */
function selectSpawnWarning(s: Store): SpawnWarning | null {
  const cached = spawnWarningCache.get(s.scenario)
  if (cached !== undefined) return cached
  const finding = assessRunValidity(s.scenario, []).findings.find((f) => f.id === 'spawn-in-ring')
  const warning = finding ? { count: finding.uasIds.length, hint: finding.message } : null
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
      className="tb-menu-panel tb-menu-right"
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
 * The top bar. Memoized with no props, so an `App` render never reaches it; it
 * subscribes to the scenario fields it shows, never to the whole scenario.
 */
export const Toolbar = memo(function Toolbar() {
  const scenarioName = useStore((s) => s.scenario.name)
  const environment = useStore((s) => s.scenario.environment)
  const spawnWarning = useStore(useShallow(selectSpawnWarning))
  const threatWez = useStore((s) => selectEffectiveLayers(s).threatWez)
  const save = useStore((s) => s.save)
  const { setScenarioName } = useStore.getState()

  const derates = activeDerates(environment)

  return (
    <header className="toolbar">
      <div className="brand">Rangeboard</div>
      <input
        className="scenario-name"
        value={scenarioName}
        onChange={(e) => setScenarioName(e.target.value)}
        aria-label="Scenario name"
        title="Scenario name"
      />
      <OverflowMenu />

      <div className="spacer" />

      <SettingsButton />
      <StorageMenu />

      <div className="status-pills" aria-label="Status">
        <RoeMenu />
        {threatWez && (
          <State tone="critical" title="Threat weapon engagement zones are drawn on the canvas">
            WEZ On
          </State>
        )}
        {derates.length > 0 && (
          <State tone="warning" title={`Sensor ranges derated: ${derates.join(', ')}`}>
            Env Derate
          </State>
        )}
        {spawnWarning && (
          <State tone="warning" title={spawnWarning.hint}>
            Spawn In Ring {spawnWarning.count}
          </State>
        )}
        {save.error != null ? (
          <State tone="critical" title={save.error} role="alert">
            Save failed
          </State>
        ) : (
          save.lastAutosaveAt != null && (
            <State tone="inactive" title="Last autosave to browser storage">
              Saved {clockHHMM(save.lastAutosaveAt)}
            </State>
          )
        )}
      </div>
    </header>
  )
})

/** Canvas-local Board controls, placed over the canvas by App. Memoized: App passes one stable handler. */
export const BoardTools = memo(function BoardTools({ onSelectTool }: { onSelectTool?: () => void }) {
  const tool = useStore((s) => s.ui.tool)
  const boundaryType = useStore((s) => s.ui.boundaryType)
  const canUndo = useStore((s) => s.past.length > 0)
  const canRedo = useStore((s) => s.future.length > 0)
  const { setTool, setBoundaryType, undo, redo } = useStore.getState()

  return (
    <div className="board-tools" role="toolbar" aria-label="Board tools">
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
      <RangeSetupMenu onSelectTool={onSelectTool} />
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
          ↶
        </button>
        <button
          type="button"
          className="tb-glyph"
          title="Redo (⇧⌘Z)"
          aria-label="Redo"
          onClick={redo}
          disabled={!canRedo}
        >
          ↷
        </button>
      </div>
    </div>
  )
})
