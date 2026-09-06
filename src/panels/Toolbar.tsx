import { useEffect, useMemo, useRef, useState } from 'react'
import { Seg, State } from '../ui/kit'
import type { StateTone } from '../ui/kit'
import { useStore } from '../state/store'
import type { Theme } from '../state/store'
import { defaultFrameName } from '../state/labels'
import { assessRunValidity } from '../analysis/runValidity'
import { Tip } from './Tooltip'
import { ViewMenu } from './ViewMenu'
import { useTeStore } from '../te/state/teStore'
import type { Workspace } from '../te/state/teStore'
import { captureFrameToCampaign } from '../te/io/frameCapture'
import type { BoundaryType, EnvironmentSpec, Roe } from '../model/types'
import { emptyScenario } from '../model/seed'
import { exportScenario, importScenarioFile, scenarioHasWork } from '../io/persist'

const TOOLS = [
  { id: 'select', label: 'Select', hint: 'Move, pan, edit' },
  { id: 'boundary', label: 'Boundary', hint: 'Draw airspace and range polygons' },
  { id: 'connect', label: 'Connect', hint: 'Link sensor to C2 to effector' },
  { id: 'path', label: 'Path', hint: 'Draw a UAS flight path' },
  { id: 'calibrate', label: 'Calibrate', hint: 'Set image scale from two points' },
] as const

const BOUNDARY_TYPES: BoundaryType[] = ['range', 'restricted', 'asset', 'corridor']

const THEMES: Array<{ v: Theme; label: string }> = [
  { v: 'system', label: 'System' },
  { v: 'dark', label: 'Dark' },
  { v: 'light', label: 'Light' },
]

const ROE_PILLS: Record<Roe, { label: string; tone: StateTone; hint: string }> = {
  free: { label: 'ROE Free', tone: 'nominal', hint: 'ROE free: engage declared tracks (doctrine on) or on first detection (doctrine off)' },
  tight: { label: 'ROE Tight', tone: 'inactive', hint: 'ROE tight: engage tracks declared hostile' },
  hold: { label: 'ROE Hold', tone: 'warning', hint: 'ROE hold: no engagements' },
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

// File actions sit behind one button so the bar holds a single row at 1440px.
function OverflowMenu() {
  const scenario = useStore((s) => s.scenario)
  const replaceScenario = useStore((s) => s.replaceScenario)
  const hasCampaign = useTeStore((s) => s.activeCampaignId != null)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    // Capture phase: Escape must close only the menu, never also reach the
    // global canvas shortcut in App.tsx that clears the tool and the selection.
    // The command palette can open over the menu, and then it owns Escape.
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (document.querySelector('.cmdk-panel')) return
      e.stopPropagation()
      setOpen(false)
      buttonRef.current?.focus()
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  return (
    <div className="tb-menu-wrap" ref={wrapRef}>
      <button
        ref={buttonRef}
        className={`tb-menu ${open ? 'active' : ''}`}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="More actions"
        title="File actions"
        onClick={() => setOpen((v) => !v)}
      >
        ⋯
      </button>
      {open && (
        <div className="tb-menu-panel tb-menu-right" role="menu" aria-label="More actions">
          <button
            className="tb-menu-item"
            onClick={() => {
              setOpen(false)
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
            className="tb-menu-item"
            onClick={() => {
              setOpen(false)
              importScenarioFile()
            }}
          >
            Import
          </button>
          <button
            className="tb-menu-item"
            onClick={() => {
              setOpen(false)
              exportScenario(scenario)
            }}
          >
            Export
          </button>
          {hasCampaign && (
            <button
              className="tb-menu-item"
              title="Save the current board view as a PNG frame on the active T&E campaign"
              onClick={() => {
                setOpen(false)
                const st = useStore.getState()
                const frameName = defaultFrameName(
                  st.scenario.name,
                  st.playback.simTimeS,
                  st.ui.basemap,
                )
                if (!captureFrameToCampaign(frameName)) {
                  window.alert('Could not capture: no active campaign or canvas.')
                }
              }}
            >
              Capture frame
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function Toolbar() {
  const scenario = useStore((s) => s.scenario)
  const ui = useStore((s) => s.ui)
  const save = useStore((s) => s.save)
  const canUndo = useStore((s) => s.past.length > 0)
  const canRedo = useStore((s) => s.future.length > 0)
  const { setTool, setBoundaryType, setScenarioName, undo, redo } = useStore.getState()

  const theme = useStore((s) => s.ui.theme)
  const setTheme = useStore((s) => s.setTheme)
  const workspace = useTeStore((s) => s.ui.workspace)
  const setWorkspace = useTeStore((s) => s.setWorkspace)
  const workspaces: Array<{ id: Workspace; label: string }> = [
    { id: 'board', label: 'Board' },
    { id: 'ops', label: 'T&E Ops' },
  ]

  const roe = scenario.roe ?? 'tight'
  const derates = activeDerates(scenario.environment)

  // One source of truth with the analysis record: the chip reads the same
  // run-validity finding the requirement gates and the run export read, so the
  // toolbar and the evidence can never disagree. Derived live, never stored.
  const spawnWarning = useMemo(() => {
    const finding = assessRunValidity(scenario, []).findings.find((f) => f.id === 'spawn-in-ring')
    if (!finding) return null
    return { count: finding.uasIds.length, hint: finding.message }
  }, [scenario])

  if (workspace === 'ops') {
    return (
      <header className="toolbar">
        <div className="brand">Rangeboard</div>
        <div className="seg" aria-label="Workspace">
          {workspaces.map((w) => (
            <button
              key={w.id}
              className={workspace === w.id ? 'active' : ''}
              onClick={() => setWorkspace(w.id)}
            >
              {w.label}
            </button>
          ))}
        </div>
        <div className="spacer" />
        <Seg value={theme} options={THEMES} label="Theme" onChange={setTheme} />
      </header>
    )
  }

  return (
    <header className="toolbar">
      <div className="brand">Rangeboard</div>
      <Seg
        value={workspace}
        options={workspaces.map((w) => ({ v: w.id, label: w.label }))}
        label="Workspace"
        onChange={setWorkspace}
      />
      <input
        className="scenario-name"
        value={scenario.name}
        onChange={(e) => setScenarioName(e.target.value)}
        aria-label="Scenario name"
        title="Scenario name"
      />

      <div className="seg" role="toolbar" aria-label="Tools">
        {TOOLS.map((t) => (
          <Tip key={t.id} label={t.hint}>
            <button className={ui.tool === t.id ? 'active' : ''} onClick={() => setTool(t.id)}>
              {t.label}
            </button>
          </Tip>
        ))}
        {ui.tool === 'boundary' && (
          <select
            value={ui.boundaryType}
            onChange={(e) => setBoundaryType(e.target.value as BoundaryType)}
            title="Boundary type"
          >
            {BOUNDARY_TYPES.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        )}
      </div>

      <ViewMenu />

      <Seg value={theme} options={THEMES} label="Theme" onChange={setTheme} />

      <div className="spacer" />

      <div className="status-pills" aria-label="Status">
        <State tone={ROE_PILLS[roe].tone} title={ROE_PILLS[roe].hint}>
          {ROE_PILLS[roe].label}
        </State>
        {ui.layers.threatWez && (
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

      <div className="seg" role="group" aria-label="History">
        <button className="tb-glyph" title="Undo (⌘Z)" aria-label="Undo" onClick={undo} disabled={!canUndo}>
          ↶
        </button>
        <button className="tb-glyph" title="Redo (⇧⌘Z)" aria-label="Redo" onClick={redo} disabled={!canRedo}>
          ↷
        </button>
      </div>
      <OverflowMenu />
    </header>
  )
}
