/**
 * Merge the partials of a replicate run by replicate index. The merge of the
 * ranges of 0..n is the summary the sequential loop gives for the same
 * indices, whatever order the ranges landed in.
 */
import type { McPartial } from './mcRun'
import { emptyPartial } from './mcRun'

/** True when two id lists are the same list. */
function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i])
}

/** Grid steps of a partial that has rows; 0 when it has none. */
function gridSteps(partial: McPartial): number {
  return partial.indices.length === 0 ? 0 : partial.kills.length / partial.indices.length
}

/** Copy one packed row from `fromRow` to `toRow`. */
function copyRow(
  into: Float64Array,
  from: Float64Array,
  fromRow: number,
  toRow: number,
  steps: number,
): void {
  into.set(from.subarray(fromRow * steps, (fromRow + 1) * steps), toRow * steps)
}

/**
 * The rows of `partial` for the replicates 0..m-1, where m is the first index
 * the partial is missing; the partial itself when it has no gap. A summary must
 * read a run with no holes, and a stop leaves chunks in flight past the gap.
 * `retained` and `elapsedMs` are carried over unchanged: they measure what the
 * workers did, not what the summary reads.
 */
export function contiguousPrefix(partial: McPartial): McPartial {
  let m = 0
  while (m < partial.indices.length && partial.indices[m] === m) m += 1
  if (m === partial.indices.length) return partial
  const steps = gridSteps(partial)
  const rows = <T>(list: T[][]): T[][] => list.map((row) => row.slice(0, m))
  const grid = (packed: Float64Array): Float64Array => packed.subarray(0, m * steps)
  return {
    ...partial,
    indices: partial.indices.slice(0, m),
    kills: grid(partial.kills),
    leakers: grid(partial.leakers),
    detected: grid(partial.detected),
    tracked: grid(partial.tracked),
    engaged: grid(partial.engaged),
    raidFirstDetect: partial.raidFirstDetect.slice(0, m),
    raidFirmTrack: partial.raidFirmTrack.slice(0, m),
    raidMinWarning: partial.raidMinWarning.slice(0, m),
    operatorDecisions: partial.operatorDecisions.slice(0, m),
    operatorFlooredDecisions: partial.operatorFlooredDecisions.slice(0, m),
    threatKilled: rows(partial.threatKilled),
    threatLeaked: rows(partial.threatLeaked),
    threatFirstDetect: rows(partial.threatFirstDetect),
    threatResidual: partial.threatResidual.map(grid),
    effectorSalvos: rows(partial.effectorSalvos),
    effectorKills: rows(partial.effectorKills),
  }
}

/** How many leading replicates 0..m-1 are present across `parts`. */
export function prefixLength(parts: McPartial[]): number {
  const have = new Set<number>()
  for (const part of parts) for (const index of part.indices) have.add(index)
  let m = 0
  while (have.has(m)) m += 1
  return m
}

/**
 * End-of-run leaker of each replicate 0..m-1, in order, plus the raid's ship
 * list. Null when index 0 has not landed. `steps` is the grid length.
 */
export function prefixLeakerEnds(
  parts: McPartial[],
  steps: number,
): { ends: number[]; ships: number[] } | null {
  const m = prefixLength(parts)
  if (m === 0) return null
  const ends = new Array<number>(m)
  let ships: number[] | null = null
  const last = steps - 1
  for (const part of parts) {
    const rows = part.indices.length
    if (rows === 0) continue
    if (ships == null) ships = part.threatShips
    for (let k = 0; k < rows; k += 1) {
      const index = part.indices[k]
      if (index < m) ends[index] = part.leakers[k * steps + last]
    }
  }
  if (ships == null) return null
  return { ends, ships }
}

/**
 * One partial over every replicate of `parts`, rows in ascending index
 * order. Throws on an empty list, on an index present twice, and when two
 * non-empty partials disagree on their track or effector lists (they ran
 * different scenarios). `retained` and `elapsedMs` are summed over the parts;
 * a pool passes its own wall clock to `finishSummary`.
 */
export function mergePartials(parts: McPartial[]): McPartial {
  if (parts.length === 0) throw new Error('mergePartials needs at least one partial')
  const filled = parts.filter((p) => p.indices.length > 0)
  const first = filled[0]
  const out = emptyPartial()
  if (!first) return out

  // Every replicate as (partial, row) in ascending index order.
  const rows: Array<{ part: McPartial; k: number }> = []
  for (const part of filled) {
    if (!sameIds(part.threatIds, first.threatIds)) {
      throw new Error('mergePartials: the partials list different tracks')
    }
    if (!sameIds(part.effectorIds, first.effectorIds)) {
      throw new Error('mergePartials: the partials list different effectors')
    }
    for (let k = 0; k < part.indices.length; k += 1) rows.push({ part, k })
  }
  rows.sort((a, b) => a.part.indices[a.k] - b.part.indices[b.k])
  for (let r = 1; r < rows.length; r += 1) {
    const index = rows[r].part.indices[rows[r].k]
    if (index === rows[r - 1].part.indices[rows[r - 1].k]) {
      throw new Error(`mergePartials: replicate ${index} is present twice`)
    }
  }

  const steps = gridSteps(first)
  const count = rows.length
  out.threatIds = [...first.threatIds]
  out.threatArrival = [...first.threatArrival]
  out.threatShips = [...first.threatShips]
  out.effectorIds = [...first.effectorIds]
  out.kills = new Float64Array(count * steps)
  out.leakers = new Float64Array(count * steps)
  out.detected = new Float64Array(count * steps)
  out.tracked = new Float64Array(count * steps)
  out.engaged = new Float64Array(count * steps)
  out.threatKilled = first.threatIds.map(() => [])
  out.threatLeaked = first.threatIds.map(() => [])
  out.threatFirstDetect = first.threatIds.map(() => [])
  out.threatResidual = first.threatIds.map(() => new Float64Array(count * steps))
  out.effectorSalvos = first.effectorIds.map(() => [])
  out.effectorKills = first.effectorIds.map(() => [])
  rows.forEach(({ part, k }, r) => {
    out.indices.push(part.indices[k])
    copyRow(out.kills, part.kills, k, r, steps)
    copyRow(out.leakers, part.leakers, k, r, steps)
    copyRow(out.detected, part.detected, k, r, steps)
    copyRow(out.tracked, part.tracked, k, r, steps)
    copyRow(out.engaged, part.engaged, k, r, steps)
    out.raidFirstDetect.push(part.raidFirstDetect[k])
    out.raidFirmTrack.push(part.raidFirmTrack[k])
    out.raidMinWarning.push(part.raidMinWarning[k])
    out.operatorDecisions.push(part.operatorDecisions[k])
    out.operatorFlooredDecisions.push(part.operatorFlooredDecisions[k])
    for (const t of first.threatIds.keys()) {
      out.threatKilled[t].push(part.threatKilled[t][k])
      out.threatLeaked[t].push(part.threatLeaked[t][k])
      out.threatFirstDetect[t].push(part.threatFirstDetect[t][k])
      copyRow(out.threatResidual[t], part.threatResidual[t], k, r, steps)
    }
    for (const e of first.effectorIds.keys()) {
      out.effectorSalvos[e].push(part.effectorSalvos[e][k])
      out.effectorKills[e].push(part.effectorKills[e][k])
    }
  })
  for (const part of parts) {
    out.retained += part.retained
    out.elapsedMs += part.elapsedMs
  }
  return out
}
