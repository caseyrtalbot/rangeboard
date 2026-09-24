import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Seg, State } from '../ui/kit'
import type { StateTone } from '../ui/kit'
import { usePopover } from '../ui/usePopover'
import { useStore } from '../state/store'
import { loopEndOf } from './analysis/RunControl'
import type { Store } from '../state/store'
import { selectDurationS, selectEffectiveLayers, selectSimTimeS } from '../state/selectors'
import { formatRunLabel } from '../state/labels'
import { assessRunValidity } from '../analysis/runValidity'
import { engagementPicture } from '../analysis/impact'
import { runSettings } from '../model/types'
import type { EnvironmentSpec, Roe, Scenario } from '../model/types'
import { formatTime } from '../geometry/geo'

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
 * The ROE chip and its menu. It counts the chips the bar hides: all of them below
 * 1600 px, and those that drop off a full row above it. Its panel lists them.
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

interface Validity {
  count: number
  spawn: SpawnWarning | null
}

const validityCache = new WeakMap<Scenario, Validity>()

/**
 * Findings of the deterministic picture, as the Prepare overview reads them, and the
 * spawn-in-ring finding the chip shows. Derived live, never stored, cached by scenario.
 */
function selectValidity(s: Store): Validity {
  const cached = validityCache.get(s.scenario)
  if (cached) return cached
  const { findings } = assessRunValidity(s.scenario, engagementPicture(s.scenario).assessments)
  const finding = findings.find((f) => f.id === 'spawn-in-ring')
  const validity = {
    count: findings.length,
    spawn: finding ? { uasIds: finding.uasIds, hint: finding.message } : null,
  }
  validityCache.set(s.scenario, validity)
  return validity
}

/** Replicates done against the loop end RunControl reports; a dash before any run. */
function selectMcText(s: Store): string {
  const end = loopEndOf(runSettings(s.scenario))
  const { mc } = s
  const done =
    mc.status === 'running'
      ? (mc.pool?.done ?? mc.progress)
      : mc.status === 'done' && mc.summary
        ? mc.summary.replicates
        : null
  return `MC ${done ?? '—'} / ${end}`
}

/**
 * The 24 px status bar under the transport: run identity, clock, seed, replicate
 * progress, the ROE chip with its folded chips, display units and the validity
 * count. Below 1440 px the units, MC and seed cells drop in that order (D8).
 */
/** The `T+` cell holds the clock subscription, so the bar's layout measure does
 * not run on every playback tick. */
function ClockCell() {
  const simTimeS = useStore(selectSimTimeS)
  const durationS = useStore(selectDurationS)
  return (
    <span className="sb-clock">
      T+{formatTime(simTimeS)} / {formatTime(durationS)}
    </span>
  )
}

export const StatusBar = memo(function StatusBar() {
  const runSeq = useStore((s) => s.playback.runSeq)
  const phase = useStore((s) => s.playback.phase)
  const seed = useStore((s) => runSettings(s.scenario).seed)
  const mcText = useStore(selectMcText)
  const units = useStore((s) => s.ui.units)
  const { count: validity, spawn: spawnWarning } = useStore(selectValidity)
  const environment = useStore((s) => s.scenario.environment)
  const threatWez = useStore((s) => selectEffectiveLayers(s).threatWez)
  const save = useStore((s) => s.save)
  // Chips that wrap off the one clipped row are hidden whole; count them. -1
  // means the row is folded away below 1600 px.
  const inlineRef = useRef<HTMLSpanElement>(null)
  const [hidden, setHidden] = useState(0)
  const measure = useCallback(() => {
    const el = inlineRef.current
    if (!el) return
    const box = el.getBoundingClientRect()
    setHidden(
      box.height
        ? [...el.children].filter((c) => c.getBoundingClientRect().top >= box.bottom).length
        : -1,
    )
  }, [])
  useLayoutEffect(measure)
  useEffect(() => {
    const ro = new ResizeObserver(measure)
    ro.observe(inlineRef.current!)
    return () => ro.disconnect()
  }, [measure])

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
    <div className="status-bar" role="group" aria-label="Run status">
      <span className="sb-run">{formatRunLabel(runSeq)}</span>
      <span className="sb-phase">{phase}</span>
      <ClockCell />
      <span className="sb-seed">seed {seed}</span>
      <span className="sb-mc">{mcText}</span>
      <span className="sb-grow" />
      <div className="status-pills" aria-label="Status">
        <RoeMenu
          folded={
            hidden < 0 ? [threatWez, derates.length, spawnWarning].filter(Boolean).length : hidden
          }
        >
          {chips}
        </RoeMenu>
        <span className="status-inline" ref={inlineRef}>
          {chips}
        </span>
        {/* A failed save stays in the bar at every width: it is an alert. */}
        {save.error != null && (
          <State tone="critical" title={save.error} role="alert">
            Save failed
          </State>
        )}
      </div>
      <span className="sb-units">
        {units === 'aviation' ? 'nm · kt · ft AGL' : 'km · m/s · ft AGL'}
      </span>
      <span className="sb-validity">
        Validity {validity}
        {validity > 0 && <span className="sb-limits">LIMITS</span>}
      </span>
    </div>
  )
})
