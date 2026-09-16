import type { EnvironmentSpec, Scenario, SpecModel, TestCard } from './types'
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

export interface CardTemplate {
  name: string
  category: string
  purpose: string
  customerQuestion: string
  threatProfile: string
  measures: string[]
}

export const MEASURES_DTI = [
  'First detection range and time per sensor',
  'Track continuity (drops per run)',
  'Classification / identification range',
  'Warning time at the defended asset',
  'Engagement window length per effector',
]

export const CARD_TEMPLATES: CardTemplate[] = [
  {
    name: 'Prison',
    category: 'Sensitive site',
    purpose: 'Assess DTI and defeat of small drones delivering contraband over a perimeter.',
    customerQuestion: 'Can the system detect and stop a low, slow quad before it crosses the wall?',
    threatProfile: 'G1 quad, 30-300 ft AGL, short standoff launch, frequent hovers',
    measures: MEASURES_DTI,
  },
  {
    name: 'Airport',
    category: 'Sensitive site',
    purpose:
      'Assess DTI along approach and departure corridors without interfering with airport RF.',
    customerQuestion: 'How early is a drone incursion into the corridor detected and confirmed?',
    threatProfile: 'G1-G2 quad or fixed-wing, 100-2000 ft AGL, corridor crossing',
    measures: MEASURES_DTI,
  },
  {
    name: 'Nuclear plant',
    category: 'Sensitive site',
    purpose: 'Assess layered DTI and defeat around a hardened point asset with a no-fly zone.',
    customerQuestion: 'Is every axis covered by at least two confirming technologies?',
    threatProfile: 'G1-G3 mixed, including RF-silent ingress',
    measures: MEASURES_DTI,
  },
  {
    name: 'Government building',
    category: 'Sensitive site',
    purpose: 'Assess DTI in a dense urban EM environment with masked sightlines.',
    customerQuestion: 'What is the detection range loss from urban clutter versus open terrain?',
    threatProfile: 'G1 quad, rooftop-level ingress between buildings',
    measures: MEASURES_DTI,
  },
  {
    name: 'Stadium',
    category: 'Public event',
    purpose: 'Assess rapid DTI and low-collateral defeat over a crowded venue.',
    customerQuestion: 'Can a threat be confirmed and engaged before it reaches the bowl?',
    threatProfile: 'G1 quad or FPV, short-range launch inside the outer perimeter',
    measures: MEASURES_DTI,
  },
  {
    name: 'Outdoor concert',
    category: 'Public event',
    purpose:
      'Assess acoustic and RF DTI performance under high crowd noise and dense spectrum use.',
    customerQuestion: 'Which technologies still confirm tracks under noise and EM load?',
    threatProfile: 'G1 quad, night, low altitude, mixed with authorized drones',
    measures: MEASURES_DTI,
  },
  {
    name: 'Outdoor political rally',
    category: 'Public event',
    purpose: 'Assess mobile, fast-setup DTI and defeat for a temporary protected area.',
    customerQuestion: 'What warning time does a rapidly emplaced layout give?',
    threatProfile: 'G1 quad or FPV, unpredictable axis, short timeline',
    measures: MEASURES_DTI,
  },
  {
    name: 'International summit',
    category: 'Public event',
    purpose: 'Assess multi-layer DTI with strict rules of engagement and VIP movement corridors.',
    customerQuestion:
      'Are confirmation and identification achieved before any engagement decision?',
    threatProfile: 'G1-G2 mixed, including decoys and simultaneous tracks',
    measures: MEASURES_DTI,
  },
  {
    name: 'Land border',
    category: 'Border protection',
    purpose: 'Assess wide-area DTI along an extended line with sparse sensor spacing.',
    customerQuestion: 'What is the gap between sensor footprints at typical ingress altitude?',
    threatProfile: 'G1-G3, smuggling or ISR profiles, low-altitude crossings',
    measures: MEASURES_DTI,
  },
  {
    name: 'Maritime border',
    category: 'Border protection',
    purpose: 'Assess DTI over water where surface clutter and weather drive radar performance.',
    customerQuestion: 'How do sea state and precipitation change first-detection range?',
    threatProfile: 'G2-G3 fixed-wing or OWA, low over water, long ingress legs',
    measures: MEASURES_DTI,
  },
]

/** Test-card fields for one template. Card identity fields stay with the caller. */
export function cardFromTemplate(t: CardTemplate, env: EnvironmentSpec): Partial<TestCard> {
  return {
    campaign: t.category,
    customerQuestion: t.customerQuestion,
    purpose: t.purpose,
    threatProfile: t.threatProfile,
    covariates: standardCovariates(env),
    measures: [...t.measures],
  }
}
