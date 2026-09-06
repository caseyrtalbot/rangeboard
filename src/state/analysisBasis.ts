import type { Scenario } from '../model/types'
import {
  DEFAULT_REQUIREMENT_THRESHOLDS,
  effectiveDoctrine,
  entityActive,
  runSettings,
} from '../model/types'
import { uncertainFields } from '../analysis/parameterBasis'
import { defaultLinkLatencyS } from '../analysis/doctrineFactors'
import { defendedRadiusOf } from '../playback/sim'
import { threatAltitudeFt } from '../playback/tracks'

/** Remove only known metadata: future input fields are included by default. */
function without<T extends object, K extends keyof T>(value: T, keys: K[]): Omit<T, K> {
  const result = { ...value }
  for (const key of keys) delete result[key]
  return result
}

/** Object key insertion order is not an input; array order (including draw order) is. */
function basisJson(value: unknown): string {
  return JSON.stringify(value, (_key, part) => {
    if (part == null || typeof part !== 'object' || Array.isArray(part)) return part
    return Object.fromEntries(Object.keys(part).sort().map((key) => [key, part[key]]))
  })
}

/**
 * Numerical/configuration identity, excluding named presentation and evidence fields.
 * New domain fields are included automatically. Defaults use the engine's resolvers;
 * uncertainFields is also the sampler's enumeration, including connection draw IDs.
 */
export function analysisBasisSignature(s: Scenario): string {
  const doctrine = effectiveDoctrine(s)
  const kindOf = new Map(s.entities.map((e) => [e.id, e.kind]))
  return basisJson({
    ...without(s, [
      'schemaVersion', 'name', 'systemPresets', 'deletedSeedIds', 'observedPresetId',
      'engageOn', 'mcdaWeights', 'scorecards', 'boundaries', 'testCards', 'frames',
      'underlay', 'geoRef', 'runMode', 'seed', 'replicates', 'targetHalfWidth', 'uncertainty',
    ]),
    environment: {
      ...s.environment,
      precipitation: s.environment.precipitation ?? 'clear',
      light: s.environment.light ?? 'day',
      emBackground: s.environment.emBackground ?? 'rural',
      visibilityM: s.environment.visibilityM ?? null,
    },
    roe: s.roe ?? 'tight',
    raid: s.raid ?? { waves: [] },
    doctrine,
    requirements: { ...DEFAULT_REQUIREMENT_THRESHOLDS, ...s.requirements },
    run: runSettings(s),
    spreads: uncertainFields(s),
    library: s.library.map((m) => ({
      ...without(m, ['name', 'description', 'color', 'builtin', 'provenance']),
      uas: m.uas ? without(m.uas, ['emissionsNote', 'rangeNote']) : undefined,
      // routeIntent is read by hostile-ID logic, so it is an input despite being text.
      threatProfile: m.threatProfile ? without(m.threatProfile, ['designator']) : undefined,
    })),
    entities: s.entities.map((e) => ({
      ...without(e, ['name', 'color', 'notes', 'systemId', 'showRange']),
      enabled: entityActive(e),
      formation: e.formation ?? null,
      altitudeFt: e.kind === 'uas' ? threatAltitudeFt(s, e) : e.altitudeFt ?? null,
      defendedRadiusM: e.kind === 'asset' ? defendedRadiusOf(e) : e.defendedRadiusM ?? null,
    })),
    connections: s.connections.map((c) => ({
      ...without(c, ['label', 'note']),
      medium: c.medium ?? null,
      confidence: c.confidence ?? null,
      latencyS: c.latencyS ?? (doctrine.enabled
        ? defaultLinkLatencyS(kindOf.get(c.fromId) ?? 'sensor', kindOf.get(c.toId) ?? 'c2')
        : 0),
    })),
  })
}

