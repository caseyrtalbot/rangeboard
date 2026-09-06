import { useEffect, useRef } from 'react'
import type { IntegrationConfidence } from '../model/integration'
import { integrationSummary } from '../model/integration'
import { useStore } from '../state/store'
import { ProvMark, State } from '../ui/kit'
import type { ProvKind } from '../ui/kit'

const CONFIDENCE_BADGE: Record<IntegrationConfidence, string> = {
  documented: 'DOC',
  probable: 'PROB',
  inferred: 'INF',
}

/** A documented pairing is sourced; the other two confidences keep their names. */
const CONFIDENCE_MARK: Record<IntegrationConfidence, ProvKind> = {
  documented: 'sourced',
  probable: 'probable',
  inferred: 'inferred',
}

/** Connect offers after placing or dragging a blue-force entity. Rendered as DOM over the Konva stage. */
export function ConnectSuggestPopup() {
  const suggestion = useStore((s) => s.ui.connectSuggestion)
  const scenario = useStore((s) => s.scenario)
  const dismissConnectSuggestion = useStore((s) => s.dismissConnectSuggestion)
  const applyConnectSuggestion = useStore((s) => s.applyConnectSuggestion)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!suggestion) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) dismissConnectSuggestion()
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [suggestion, dismissConnectSuggestion])

  if (!suggestion) return null
  const name = (id: string) => scenario.entities.find((e) => e.id === id)?.name ?? '?'
  const entity = scenario.entities.find((e) => e.id === suggestion.entityId)
  const summary = integrationSummary(entity?.specId ?? null, scenario.library)
  const empty = suggestion.candidates.length === 0 && suggestion.autoConnected.length === 0

  return (
    <div
      ref={ref}
      className="ctx-menu connect-suggest"
      style={{ left: suggestion.screen.x, top: suggestion.screen.y }}
    >
      <div className="ctx-head suggest-head">
        <span>Connect {name(suggestion.entityId)}</span>
        <button className="suggest-x" onClick={dismissConnectSuggestion} title="Dismiss">
          ×
        </button>
      </div>
      {suggestion.autoConnected.map((c) => {
        const partnerId = c.fromId === suggestion.entityId ? c.toId : c.fromId
        return (
          <div key={`${c.fromId}:${c.toId}`} className="suggest-row" title={c.verdict.note}>
            <div className="suggest-info">
              <div>{name(partnerId)}</div>
              <div className="suggest-meta">
                <State tone="nominal">LINKED</State>
                {c.verdict.label}
                {c.verdict.medium ? ` · ${c.verdict.medium}` : ''}
              </div>
            </div>
          </div>
        )
      })}
      {suggestion.candidates.map((c, i) => {
        const partnerId = c.fromId === suggestion.entityId ? c.toId : c.fromId
        const confidence = c.verdict.confidence ?? 'inferred'
        return (
          <div key={`${c.fromId}:${c.toId}`} className="suggest-row" title={c.verdict.note}>
            <div className="suggest-info">
              <div>{name(partnerId)}</div>
              <div className="suggest-meta">
                <ProvMark kind={CONFIDENCE_MARK[confidence]} title={`${CONFIDENCE_BADGE[confidence]} · ${c.verdict.note}`} />
                {c.verdict.label}
                {c.verdict.medium ? ` · ${c.verdict.medium}` : ''}
              </div>
            </div>
            <button className="mini" onClick={() => applyConnectSuggestion([i])}>
              Connect
            </button>
          </div>
        )
      })}
      {suggestion.candidates.length > 1 && (
        <button
          className="ctx-item"
          onClick={() => applyConnectSuggestion(suggestion.candidates.map((_, i) => i))}
        >
          Connect all
        </button>
      )}
      {empty && summary && (
        <>
          <div className="suggest-empty">
            {summary.partners.length > 0
              ? 'No compatible system in range. Known integrations:'
              : 'No known network integrations for this system.'}
          </div>
          {summary.partners.slice(0, 5).map((p) => (
            <div key={p.specId} className="suggest-row" title={p.note}>
              <div className="suggest-info">
                <div>{p.name}</div>
                <div className="suggest-meta">
                  <ProvMark kind={CONFIDENCE_MARK[p.confidence]} title={`${CONFIDENCE_BADGE[p.confidence]} · ${p.note}`} />
                  {p.role.replace('-', ' ')}
                </div>
              </div>
            </div>
          ))}
          {summary.partners.length > 5 && (
            <div className="suggest-empty">
              +{summary.partners.length - 5} more in the Inspector
            </div>
          )}
        </>
      )}
      {summary?.guidance && <div className="suggest-empty">{summary.guidance}</div>}
    </div>
  )
}
