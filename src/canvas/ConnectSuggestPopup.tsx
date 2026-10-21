import { useEffect, useLayoutEffect, useRef } from 'react'
import { formatDistance } from '../geometry/geo'
import type { BoardPartner, IntegrationConfidence, PartnerInstance } from '../model/integration'
import { integrationBoardStatus, linkDirection } from '../model/integration'
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

const nearestUnlinked = (p: BoardPartner): PartnerInstance | undefined =>
  p.instances.find((i) => !i.linked)

/** Draw one link in kill-chain order through the regular connect path (one undo step). */
function connect(entityId: string, otherId: string) {
  const st = useStore.getState()
  const a = st.scenario.entities.find((e) => e.id === entityId)
  const b = st.scenario.entities.find((e) => e.id === otherId)
  if (!a || !b) return
  const { fromId, toId } = linkDirection(a, b)
  st.beginConnect(fromId)
  useStore.getState().completeConnect(toId)
}

/** Known integrations for a blue-force entity against the board. Rendered as DOM over the Konva stage. */
export function ConnectSuggestPopup() {
  const suggestion = useStore((s) => s.ui.connectSuggestion)
  const scenario = useStore((s) => s.scenario)
  const units = useStore((s) => s.ui.units)
  const dismissConnectSuggestion = useStore((s) => s.dismissConnectSuggestion)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!suggestion) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) dismissConnectSuggestion()
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [suggestion, dismissConnectSuggestion])

  // The list can be long: keep the whole popup inside the canvas host, 8 px from its
  // right and bottom edges, by moving the placement, never a transform (the surface's
  // entry animation owns that).
  useLayoutEffect(() => {
    const el = ref.current
    const host = el?.offsetParent
    if (!suggestion || !el || !(host instanceof HTMLElement)) return
    const left = Math.min(suggestion.screen.x, host.clientWidth - el.offsetWidth - 8)
    const top = Math.min(suggestion.screen.y, host.clientHeight - el.offsetHeight - 8)
    el.style.left = `${Math.max(8, left)}px`
    el.style.top = `${Math.max(8, top)}px`
  })

  if (!suggestion) return null
  const name = (id: string) => scenario.entities.find((e) => e.id === id)?.name ?? '?'
  const entityId = suggestion.entityId
  const status = integrationBoardStatus(scenario, entityId)
  const partners = status?.partners ?? []
  // Names in a requirement group with no member placed; only those carry the alert.
  const missingNames = new Set(status?.missing.flatMap((m) => m.names) ?? [])
  const reachable = partners.filter((p) => nearestUnlinked(p)?.inRange)

  return (
    <div
      ref={ref}
      className="ctx-menu connect-suggest surface-float"
      style={{ left: suggestion.screen.x, top: suggestion.screen.y }}
    >
      <div className="ctx-head suggest-head">
        <span>Connect {name(entityId)}</span>
        <button
          className="suggest-x"
          onClick={dismissConnectSuggestion}
          title="Dismiss"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
      {status?.missing.map((m) => (
        <div key={m.kind} className="suggest-missing">
          <State tone="critical">
            {m.kind === 'required-c2'
              ? `Not on board: ${m.names.join(' or ')}`
              : `No fire-control source on board: ${m.names.join(' or ')}`}
          </State>
        </div>
      ))}
      <div className="suggest-list">
        {partners.length > 0 && (
          <div className="suggest-group">Known integrations · {partners.length}</div>
        )}
        {partners.map((p) => {
          const open = nearestUnlinked(p)
          // A link wired by this popup's auto-connect is marked so it reads as automatic.
          const auto = suggestion.autoConnected.find((c) =>
            p.instances.some((i) => i.entityId === c.fromId || i.entityId === c.toId),
          )
          const alert = p.required && p.instances.length === 0 && missingNames.has(p.name)
          let title = p.note
          if (open) {
            title = `Nearest unlinked: ${open.name}, ${formatDistance(open.distM, units)}`
            if (!open.inRange) title += ' (beyond the suggest radius for its medium)'
            title += `. ${p.note}`
          }
          return (
            <div key={p.specId} className="suggest-row" title={title}>
              <div className="suggest-info">
                <div>{p.name}</div>
                <div className="suggest-meta">
                  <ProvMark
                    kind={CONFIDENCE_MARK[p.confidence]}
                    title={`${CONFIDENCE_BADGE[p.confidence]} · ${p.note}`}
                  />
                  {p.role.replace('-', ' ')}
                </div>
                <div className="suggest-meta">
                  {open ? (
                    <>
                      <State tone="nominal" hollow>
                        ON BOARD
                      </State>
                      {formatDistance(open.distM, units)}
                    </>
                  ) : p.instances.length > 0 ? (
                    auto ? (
                      <State tone="nominal" title={auto.verdict.note}>
                        LINKED · auto
                      </State>
                    ) : (
                      <State tone="nominal">LINKED</State>
                    )
                  ) : (
                    <State tone={alert ? 'critical' : 'inactive'}>
                      {alert ? 'REQUIRED · NOT ON BOARD' : 'NOT ON BOARD'}
                    </State>
                  )}
                </div>
              </div>
              {open ? (
                <button className="mini" onClick={() => connect(entityId, open.entityId)}>
                  Connect
                </button>
              ) : p.instances.length === 0 ? (
                <button
                  className="mini"
                  onClick={() => useStore.getState().requestPlacement(p.specId)}
                >
                  Place
                </button>
              ) : null}
            </div>
          )
        })}
      </div>
      {reachable.length > 1 && (
        <button
          className="ctx-item"
          onClick={() => {
            for (const p of reachable) connect(entityId, nearestUnlinked(p)!.entityId)
          }}
        >
          Connect all
        </button>
      )}
      {status && partners.length === 0 && (
        <div className="suggest-empty">No known network integrations for this system.</div>
      )}
      {status?.guidance && <div className="suggest-empty">{status.guidance}</div>}
    </div>
  )
}
