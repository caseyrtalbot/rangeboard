/**
 * Merge the partials of a replicate run by replicate index. A pool splits
 * 0..n into ranges, runs each on its own worker with `replicateRangeLoop`,
 * merges here and calls `finishSummary`; the result is the summary the
 * sequential loop gives for the same indices, whatever the range order.
 * Plain data only: a partial arrives through a worker message.
 */
import type { McPartial } from './mcRun'
import { emptyPartial } from './mcRun'

/** True when two id lists are the same list. */
function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i])
}

/**
 * The rows of `partial` for the replicates 0..m-1, where m is the first index
 * the partial is missing. A pool that stops on the half-width rule or on a
 * cancel has chunks in flight past the stop, so the merged partial can hold
 * indices beyond a gap; a summary must read a run with no holes, so the
 * coordinator finishes on this prefix. The partial itself is returned when it
 * has no gap. `retained` and `elapsedMs` are carried over unchanged: they
 * measure what the workers did, not what the summary reads, and the pool
 * passes its own wall clock to `finishSummary`.
 */
export function contiguousPrefix(partial: McPartial): McPartial {
  let m = 0
  while (m < partial.indices.length && partial.indices[m] === m) m += 1
  if (m === partial.indices.length) return partial
  const rows = <T>(list: T[][]): T[][] => list.map((row) => row.slice(0, m))
  return {
    ...partial,
    indices: partial.indices.slice(0, m),
    kills: partial.kills.slice(0, m),
    leakers: partial.leakers.slice(0, m),
    detected: partial.detected.slice(0, m),
    tracked: partial.tracked.slice(0, m),
    engaged: partial.engaged.slice(0, m),
    raidFirstDetect: partial.raidFirstDetect.slice(0, m),
    raidFirmTrack: partial.raidFirmTrack.slice(0, m),
    raidMinWarning: partial.raidMinWarning.slice(0, m),
    operatorDecisions: partial.operatorDecisions.slice(0, m),
    operatorFlooredDecisions: partial.operatorFlooredDecisions.slice(0, m),
    threatKilled: rows(partial.threatKilled),
    threatLeaked: rows(partial.threatLeaked),
    threatFirstDetect: rows(partial.threatFirstDetect),
    threatResidual: partial.threatResidual.map((row) => row.slice(0, m)),
    effectorSalvos: rows(partial.effectorSalvos),
    effectorKills: rows(partial.effectorKills),
  }
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

  out.threatIds = [...first.threatIds]
  out.threatArrival = [...first.threatArrival]
  out.threatShips = [...first.threatShips]
  out.effectorIds = [...first.effectorIds]
  out.threatKilled = first.threatIds.map(() => [])
  out.threatLeaked = first.threatIds.map(() => [])
  out.threatFirstDetect = first.threatIds.map(() => [])
  out.threatResidual = first.threatIds.map(() => [])
  out.effectorSalvos = first.effectorIds.map(() => [])
  out.effectorKills = first.effectorIds.map(() => [])
  for (const { part, k } of rows) {
    out.indices.push(part.indices[k])
    out.kills.push(part.kills[k])
    out.leakers.push(part.leakers[k])
    out.detected.push(part.detected[k])
    out.tracked.push(part.tracked[k])
    out.engaged.push(part.engaged[k])
    out.raidFirstDetect.push(part.raidFirstDetect[k])
    out.raidFirmTrack.push(part.raidFirmTrack[k])
    out.raidMinWarning.push(part.raidMinWarning[k])
    out.operatorDecisions.push(part.operatorDecisions[k])
    out.operatorFlooredDecisions.push(part.operatorFlooredDecisions[k])
    for (const t of first.threatIds.keys()) {
      out.threatKilled[t].push(part.threatKilled[t][k])
      out.threatLeaked[t].push(part.threatLeaked[t][k])
      out.threatFirstDetect[t].push(part.threatFirstDetect[t][k])
      out.threatResidual[t].push(part.threatResidual[t][k])
    }
    for (const e of first.effectorIds.keys()) {
      out.effectorSalvos[e].push(part.effectorSalvos[e][k])
      out.effectorKills[e].push(part.effectorKills[e][k])
    }
  }
  for (const part of parts) {
    out.retained += part.retained
    out.elapsedMs += part.elapsedMs
  }
  return out
}
