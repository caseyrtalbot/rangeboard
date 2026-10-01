import { useEffect, useRef, useState } from 'react'
import { buildAarSummary } from '../../analysis/aar'
import { trialForecast, type TrialResultView } from '../../analysis/trialResult'
import { downloadBoardFrame } from '../../canvas/frameCapture'
import { formatTime } from '../../geometry/geo'
import { exportRunCsv } from '../../io/exportCsv'
import type { CsvTableName } from '../../io/exportCsv'
import { exportRunRecord } from '../../io/persist'
import { analysisBasisSignature } from '../../state/analysisBasis'
import { formatRunLabel } from '../../state/labels'
import type { McState } from '../../state/runState'
import { useStore } from '../../state/store'
import { State } from '../../ui/kit'
import { EmptyRow } from './controls'
import { currentSensitivity, currentSummary, runRecordOf } from './mc'

/**
 * Why the CSV tables are unavailable, or null when a finished ensemble exists for
 * the current analysis basis. The tables come from the record Save writes.
 */
function ensembleCsvReason(mc: McState, signature: string): string | null {
  if (mc.status === 'done' && mc.summary != null && mc.basisSignature === signature) return null
  if (mc.status === 'running') return 'The ensemble is still running'
  if (mc.status !== 'done' || mc.summary == null) return 'Run Monte Carlo to export the tables'
  return 'The scenario changed after the ensemble ran'
}

/**
 * The Export menu items. The CSV items stay disabled, with the reason as their
 * title, until a finished ensemble exists for the current basis.
 */
export function ExportMenuItems({
  onJson,
  onPng,
  onCsv,
}: {
  onJson: () => void
  onPng: () => void
  onCsv: (name: CsvTableName) => void
}) {
  const scenario = useStore((state) => state.scenario)
  const mc = useStore((state) => state.mc)
  const csvReason = ensembleCsvReason(mc, analysisBasisSignature(scenario))
  return (
    <>
      <button type="button" className="tb-menu-item" onClick={onJson}>
        Debrief record<span className="out-fmt">JSON</span>
      </button>
      <button type="button" className="tb-menu-item" onClick={onPng}>
        Final board frame<span className="out-fmt">PNG</span>
      </button>
      <hr className="tb-menu-sep" />
      {(
        [
          ['per-threat', 'Per-threat table'],
          ['per-effector', 'Per-effector table'],
        ] as const
      ).map(([name, text]) => (
        <button
          key={name}
          type="button"
          className="tb-menu-item"
          disabled={csvReason != null}
          title={csvReason ?? undefined}
          onClick={() => onCsv(name)}
        >
          {text}
          <span className="out-fmt">CSV</span>
        </button>
      ))}
    </>
  )
}

/**
 * The Outcome Export menu: the debrief record (JSON), the final board frame (PNG),
 * and the per-threat and per-effector tables (CSV) of the current ensemble.
 */
export function ExportMenu({ view }: { view: TrialResultView }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  // The dismissal rules of ui/usePopover, kept local: a static import of that hook
  // from this lazy chunk splits the store into a preloaded chunk (check:bundle).
  const [open, setOpen] = useState(false)
  const toggle = () => setOpen((value) => !value)
  useEffect(() => {
    if (!open) return
    wrapRef.current?.querySelector<HTMLElement>('[role="dialog"] button:not(:disabled)')?.focus()
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
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
  const [error, setError] = useState<string | null>(null)
  const label = formatRunLabel(useStore((state) => state.playback.runSeq))

  const done = (message: string | null) => {
    setError(message)
    setOpen(false)
    buttonRef.current?.focus()
  }

  function exportJson() {
    const state = useStore.getState()
    const { playback } = state
    const forecast = trialForecast(view)
    const aar = buildAarSummary(
      view.scenario,
      forecast.assessments,
      forecast.report,
      forecast.impacts,
    )
    const runMeta = {
      id: playback.runId,
      label,
      sequence: playback.runSeq,
      startedAt: new Date(playback.startedAtMs ?? Date.now()).toISOString(),
      completedAt: new Date(playback.completedAtMs ?? Date.now()).toISOString(),
      durationS: view.durationS,
      observedThroughS: playback.observedThroughS,
    }
    exportRunRecord(
      view.scenario,
      runMeta,
      forecast.assessments,
      forecast.report,
      aar,
      currentSummary(state.mc, playback.runId),
      currentSensitivity(state.mc, playback.runId),
      view.observedThroughS >= view.durationS ? view : null,
    )
    done(null)
  }

  function captureFinal() {
    useStore.getState().scrubTo(view.durationS)
    done(null)
    window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() => {
        try {
          setError(
            downloadBoardFrame(`${view.scenario.name}-${label}-final`)
              ? null
              : 'Could not capture the board canvas.',
          )
        } catch (failure) {
          setError(
            failure instanceof Error ? failure.message : 'Could not capture the board canvas.',
          )
        }
      }),
    )
  }

  function exportCsv(name: CsvTableName) {
    const state = useStore.getState()
    const signature = analysisBasisSignature(state.scenario)
    const sensitivity =
      state.mc.sensitivity.status === 'done' && state.mc.sensitivity.basisSignature === signature
        ? state.mc.sensitivity.summary
        : null
    const record = runRecordOf(
      state.scenario,
      state.mc,
      state.playback.runId,
      signature,
      sensitivity,
    )
    done(exportRunCsv(record, name) ? null : `The record holds no ${name} table.`)
  }

  return (
    <div className="tb-menu-wrap" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className="mini"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="outcome-export-panel"
        onClick={toggle}
      >
        Export
      </button>
      {open && (
        <div
          id="outcome-export-panel"
          className="tb-menu-panel surface-float tb-menu-right"
          role="dialog"
          aria-label="Export"
        >
          <ExportMenuItems onJson={exportJson} onPng={captureFinal} onCsv={exportCsv} />
        </div>
      )}
      {error && (
        <State tone="critical" role="status">
          {error}
        </State>
      )}
    </div>
  )
}

export function TrialManifestRecord({ view }: { view: TrialResultView }) {
  return (
    <dl style={{ overflowWrap: 'anywhere' }}>
      {Object.entries(view.manifest).map(([key, value]) => (
        <div key={key}>
          <dt>{key}</dt>
          <dd>
            {Array.isArray(value) ? (
              value.length === 0 ? (
                'none'
              ) : (
                <code>{JSON.stringify(value)}</code>
              )
            ) : (
              (value ?? 'Build revision unavailable')
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function TrialEventLedger({ view }: { view: TrialResultView }) {
  const [visible, setVisible] = useState(20)
  const name = (id: string) => view.scenario.entities.find((entity) => entity.id === id)?.name ?? id
  return (
    <div className="event-ledger">
      {view.attrition.events.slice(0, visible).map((event, index) => {
        const jam =
          event.channel === 'jam'
            ? view.jamDecisions.find(
                (decision) =>
                  decision.effectorId === event.effectorId &&
                  decision.uasId === event.uasId &&
                  decision.tEffectS === event.tEffectS,
              )
            : null
        return (
          <div className="event-row" key={index}>
            <span className="event-time">
              {formatTime(event.tS)} → {formatTime(event.tEffectS)}
            </span>
            <span className="event-route">
              <strong>{name(event.effectorId)}</strong>
              <small>
                {name(event.uasId)} · ship {event.shipIdx + 1}
              </small>
            </span>
            <span className="event-effect">
              {event.killDelta} {event.softShot ? 'mission kills' : 'hard kills'}
              <small>
                {jam
                  ? `Jam ${jam.outcome === 1 ? 'succeeded' : 'failed'}`
                  : event.lateEffect
                    ? 'late effect'
                    : 'pre-arrival effect'}
              </small>
            </span>
          </div>
        )
      })}
      {view.attrition.events.length === 0 && <EmptyRow>No engagement events recorded.</EmptyRow>}
      {visible < view.attrition.events.length && (
        <button type="button" onClick={() => setVisible((count) => count + 20)}>
          Show next events
        </button>
      )}
    </div>
  )
}
