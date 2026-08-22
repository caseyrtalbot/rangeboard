/**
 * Raid wave scheduling.
 * A RaidPlan groups UAS entities into waves; each wave adds a shared launch
 * delay on top of every member path's own startDelayS. Playback and analysis
 * both read the effective delay through effectivePathDelayS so they agree.
 */
import type { FlightPath, RaidPlan, Scenario } from '../model/types'

/** Index of the wave holding an entity, or null when unassigned. */
export function waveIndexFor(raid: RaidPlan | undefined, entityId: string): number | null {
  if (!raid) return null
  const i = raid.waves.findIndex((w) => w.entityIds.includes(entityId))
  return i >= 0 ? i : null
}

/** Extra launch delay from the entity's wave, seconds. Zero when unassigned. */
export function waveDelayS(raid: RaidPlan | undefined, entityId: string): number {
  const i = waveIndexFor(raid, entityId)
  return i == null ? 0 : raid!.waves[i].startDelayS
}

/** Effective start delay for a flight path: its own delay plus its wave's delay. */
export function effectivePathDelayS(scenario: Scenario, path: FlightPath): number {
  return path.startDelayS + waveDelayS(scenario.raid, path.entityId)
}

/**
 * One-click raid construct: how a reported employment pattern maps onto waves.
 * Ported from the SEED_FORMATIONS constructs; wave spacing is derived from the
 * reported in-trail spacing at typical cruise speed.
 */
export interface RaidBuilder {
  name: string
  description: string
  /** UAS entities per wave; extra entities open follow-on waves. */
  shipsPerWave: number
  /** Seconds between consecutive wave launches. */
  waveSpacingS: number
}

export const RAID_BUILDERS: RaidBuilder[] = [
  {
    name: 'Shahed stream raid (single axis)',
    description: 'One ship per wave in trail; 3000 m spacing at ~50 m/s cruise.',
    shipsPerWave: 1,
    waveSpacingS: 60,
  },
  {
    name: 'Shahed multi-axis raid',
    description: 'Pulses of three ships, one per corridor, converging on one target.',
    shipsPerWave: 3,
    waveSpacingS: 60,
  },
  {
    name: 'Decoy-mixed OWA package',
    description: 'Single-ship stream with decoys interleaved; 2000 m spacing at ~50 m/s.',
    shipsPerWave: 1,
    waveSpacingS: 40,
  },
  {
    name: 'FPV swarm wave (Group 1)',
    description: 'Pairs of FPV quads attacking a position in short succession.',
    shipsPerWave: 2,
    waveSpacingS: 10,
  },
  {
    name: 'FPV multi-axis simultaneous attack',
    description: 'All ships launch together from different bearings to beat directional jamming.',
    shipsPerWave: 5,
    waveSpacingS: 0,
  },
  {
    name: 'Recon-cued strike pair (Group 1/2)',
    description: 'ISR spotter launches first; strike ships follow at long trail spacing.',
    shipsPerWave: 1,
    waveSpacingS: 90,
  },
]

/**
 * Build a raid plan: entities fill waves of shipsPerWave in the given order;
 * wave i launches at i * waveSpacingS.
 */
export function buildRaidPlan(builder: RaidBuilder, entityIds: string[]): RaidPlan {
  const perWave = Math.max(1, Math.floor(builder.shipsPerWave))
  const waves: RaidPlan['waves'] = []
  for (let i = 0; i < entityIds.length; i += perWave) {
    waves.push({
      startDelayS: waves.length * builder.waveSpacingS,
      entityIds: entityIds.slice(i, i + perWave),
    })
  }
  return { waves }
}
