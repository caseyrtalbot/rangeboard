import { useMemo, type ReactNode } from 'react'
import { modelsForEntity } from '../../../analysis/fidelity'
import { formatTime } from '../../../geometry/geo'
import type { Entity, Scenario } from '../../../model/types'
import { entityActive } from '../../../model/types'
import { killChainRoutes } from '../../../playback/sim'
import { modelFor } from '../../../state/store'
import { STATE_LABEL, stateClass } from '../SystemStatus'
import { DetailHeader } from './DetailHeader'
import { DetailSection } from './DetailSection'
import type { DetailRow } from './detailRows'
import { DASH, DetailTable, Rows, useComponentAt, useDetailRun } from './detailRows'

/** Entity display name, else its id. */
function entityName(scenario: Scenario, id: string): string {
  return scenario.entities.find((e) => e.id === id)?.name ?? id
}

/** The C2 pane: kill-chain hops through this node, detect to effect, and route coverage. */
export function SystemDetail({ entity }: { entity: Entity }) {
  const run = useDetailRun()
  const { scenario, runId, assessments, report } = run
  const model = modelFor(scenario, entity)
  const component = useComponentAt(run, entity.id)
  const color = entity.color ?? model?.color ?? '#c46a5a'
  const threats = useMemo(() => assessments.filter((a) => a.status !== 'no-path'), [assessments])

  const hopRows = useMemo<ReactNode[][]>(() => {
    void runId
    const detecting = new Set(assessments.flatMap((a) => a.detectingSensorIds))
    const sensorIds =
      detecting.size > 0
        ? detecting
        : new Set(
            scenario.entities
              .filter((e) => e.kind === 'sensor' && entityActive(e))
              .map((e) => e.id),
          )
    const rows: ReactNode[][] = []
    for (const route of killChainRoutes(scenario, sensorIds).values()) {
      if (!route.viaC2Ids.includes(entity.id)) continue
      const link = scenario.connections.find(
        (c) => c.toId === route.effectorId && route.viaC2Ids.includes(c.fromId),
      )
      rows.push([
        entityName(scenario, route.effectorId),
        route.viaC2Ids.map((id) => entityName(scenario, id)).join(' > '),
        link?.medium ?? 'untyped',
        `${route.latencyS} s`,
      ])
    }
    return rows
  }, [scenario, runId, assessments, entity.id])

  const timingRows = useMemo<ReactNode[][]>(() => {
    void runId
    return threats.map((a) => {
      const effect = report.events
        .filter((ev) => ev.uasId === a.uasId && ev.killDelta > 0)
        .sort((x, y) => x.tEffectS - y.tEffectS)[0]
      const detect = a.firstDetectS
      const effectS = effect?.tEffectS ?? null
      return [
        entityName(scenario, a.uasId),
        detect != null ? formatTime(detect) : DASH,
        effectS != null ? formatTime(effectS) : DASH,
        detect != null && effectS != null ? formatTime(effectS - detect) : DASH,
      ]
    })
  }, [scenario, runId, threats, report])

  const uncovered = useMemo<DetailRow[]>(() => {
    void runId
    return threats
      .filter((a) => {
        const routes = killChainRoutes(scenario, new Set(a.detectingSensorIds))
        return ![...routes.values()].some((r) => r.viaC2Ids.includes(entity.id))
      })
      .map((a) => ({ label: entityName(scenario, a.uasId), value: 'no route' }))
  }, [scenario, runId, threats, entity.id])

  const pill = component
    ? { word: STATE_LABEL[component.state], className: stateClass(component.state) }
    : { word: 'OFFLINE', className: 'bad' }
  const modelLine = model ? `${model.name} · command and control` : 'no model linked'

  return (
    <div className="detail" data-detail="system">
      <p className="muted small">Planning envelope · deterministic readouts and charts.</p>
      <DetailHeader
        entity={entity}
        color={color}
        pill={pill}
        modelLine={modelLine}
        tags={modelsForEntity(scenario, entity.id)}
      />
      <DetailSection id="hops" title="Kill-chain hops">
        {hopRows.length > 0 ? (
          <DetailTable head={['Effector', 'Via', 'Medium', 'Latency']} rows={hopRows} />
        ) : (
          <p className="muted small">No route through this node.</p>
        )}
      </DetailSection>
      <DetailSection id="timing" title="Detect to effect">
        {timingRows.length > 0 ? (
          <DetailTable head={['Threat', 'Detect', 'Effect', 'Delta']} rows={timingRows} />
        ) : (
          <p className="muted small">No threats with flight paths.</p>
        )}
      </DetailSection>
      <DetailSection id="coverage" title="Route coverage">
        {uncovered.length > 0 ? (
          <Rows rows={uncovered} />
        ) : (
          <p className="muted small">Every detected threat routes through this node.</p>
        )}
      </DetailSection>
    </div>
  )
}
