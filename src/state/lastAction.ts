import type { Entity, Scenario } from '../model/types'

type History = { scenario: Scenario; past: readonly Scenario[]; future: readonly Scenario[] }

const missing = (a: Entity[], b: Entity[]) => a.filter((e) => !b.some((f) => f.id === e.id))

/**
 * Names the undoable action the change from `prev` to `next` recorded, when it
 * deleted or placed entities: the last `past` snapshot against the current
 * scenario. Null for any other edit, and for undo, redo or a load. An edit pushes
 * the prior scenario onto `past`; undo pops it and a load clears it. A redo pushes
 * it too but restores the entities of the first `future` snapshot.
 */
export function lastUndoableAction(next: History, prev: History): string | null {
  const before = next.past[next.past.length - 1]
  const now = next.scenario.entities
  if (before !== prev.scenario || prev.future[0]?.entities === now) return null
  const added = missing(now, before.entities)
  const list = added[0] ? added : missing(before.entities, now)
  if (!list[0] || (added[0] && now.length - added.length < before.entities.length)) return null
  return `${added[0] ? 'Placed' : 'Deleted'} ${list[1] ? `${list.length} entities` : list[0].name}`
}
