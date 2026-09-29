import type { EnvironmentSpec, Scenario, SpecModel } from './types'
import { entityActive } from './types'
import { formatSpeed } from '../geometry/geo'

/**
 * Standard threat scenarios and covariates from the COURAGEOUS project
 * (Remote Sens. 2024, 16, 3714): ten usage scenarios in three categories,
 * and the Table 2 list of environmental conditions to measure per run.
 */

/** Table 2 measurement checklist, prefilled with the current scenario environment. */
export function standardCovariates(env: EnvironmentSpec): string {
  return [
    `surface wind ${formatSpeed(env.windSpeedMps, 'aviation')} from ${env.windFromDeg} deg`,
    `visibility / cloud base (${env.precipitation ?? 'clear'})`,
    `air temp ${env.temperatureC} C / dew point`,
    'pressure QNH/QFE',
    `illuminance (${env.light ?? 'day'})`,
    `EM background avg/peak (${env.emBackground ?? 'rural'})`,
    'acoustic background avg/peak',
  ].join('; ')
}

/** Non-varied environment facts for the Controlled variables field. */
export function controlledVarsText(env: EnvironmentSpec): string {
  const wind =
    env.windSpeedMps > 0
      ? `wind ${formatSpeed(env.windSpeedMps, 'aviation')} from ${env.windFromDeg} deg`
      : 'wind calm'
  return [
    wind,
    env.light ?? 'day',
    env.precipitation ?? 'clear',
    `${env.emBackground ?? 'rural'} EM`,
    `air temp ${env.temperatureC} C`,
    `field elevation ${env.fieldElevationFt} ft`,
  ].join(', ')
}

function modelOf(s: Scenario, specId: string | null): SpecModel | undefined {
  return specId ? s.library.find((m) => m.id === specId) : undefined
}

/** Sensor -> C2 -> effector, or direct sensor -> effector, among enabled entities. */
function killChainClosed(s: Scenario): boolean {
  const kind = new Map(s.entities.filter(entityActive).map((e) => [e.id, e.kind]))
  const c2FromSensor = new Set<string>()
  for (const c of s.connections) {
    if (kind.get(c.fromId) === 'sensor' && kind.get(c.toId) === 'c2') c2FromSensor.add(c.toId)
  }
  return s.connections.some(
    (c) =>
      kind.get(c.toId) === 'effector' &&
      (kind.get(c.fromId) === 'sensor' || c2FromSensor.has(c.fromId)),
  )
}

/**
 * One-line System configuration summary from the canvas: enabled blue
 * entities counted by model name, kill-chain state, and ROE.
 */
export function describeConfiguration(s: Scenario): string {
  const blue = s.entities.filter(
    (e) => entityActive(e) && (e.kind === 'sensor' || e.kind === 'effector' || e.kind === 'c2'),
  )
  if (blue.length === 0) return ''
  const counts = new Map<string, number>()
  for (const e of blue) {
    const label = modelOf(s, e.specId)?.name ?? e.name
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  const parts = [...counts.entries()].map(([name, n]) => `${n}x ${name}`)
  parts.push(killChainClosed(s) ? 'kill chain connected' : 'kill chain not connected')
  parts.push(`ROE ${s.roe ?? 'tight'}`)
  return parts.join(', ')
}

/**
 * Threat profile summary from the canvas: enabled UAS entities grouped by
 * designator (model name as fallback) with ship counts, group, altitude
 * band, and cruise speed.
 */
export function describeThreats(s: Scenario): string {
  const uas = s.entities.filter((e) => entityActive(e) && e.kind === 'uas')
  const rows = new Map<string, { ships: number; entities: number; model?: SpecModel }>()
  for (const e of uas) {
    const model = modelOf(s, e.specId)
    const key = model?.threatProfile?.designator || model?.name || e.name
    const row = rows.get(key) ?? { ships: 0, entities: 0, model }
    row.ships += e.formation && e.formation.count > 1 ? e.formation.count : 1
    row.entities += 1
    rows.set(key, row)
  }
  return [...rows.entries()]
    .map(([key, r]) => {
      const u = r.model?.uas
      const parts = [`${r.ships}x ${key}`]
      if (u) {
        parts.push(`Group ${u.group}`)
        parts.push(`${u.altBandFt[0]}-${u.altBandFt[1]} ft AGL`)
        parts.push(`cruise ${formatSpeed(u.cruiseSpeedMps, 'aviation')}`)
      }
      if (r.ships > r.entities) {
        parts.push(`${r.entities} formation${r.entities === 1 ? '' : 's'}`)
      }
      return parts.join(', ')
    })
    .join('; ')
}
