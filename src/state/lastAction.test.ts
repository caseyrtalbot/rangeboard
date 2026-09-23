import { beforeEach, describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import { useStore } from './store'
import { lastUndoableAction } from './lastAction'

/** Runs one store action and returns the action a new edit recorded, if any. */
function cueAfter(action: () => void): string | null {
  const prev = useStore.getState()
  action()
  return lastUndoableAction(useStore.getState(), prev)
}

function place(): string {
  const st = useStore.getState()
  const model = st.scenario.library.find((m) => m.kind === 'sensor')!
  st.addEntityFromModel(model.id, { x: 0, y: 0 })
  const entities = useStore.getState().scenario.entities
  return entities[entities.length - 1].id
}

describe('last undoable action', () => {
  beforeEach(() => useStore.getState().replaceScenario(emptyScenario()))

  it('names a place and a delete by the display name', () => {
    expect(cueAfter(place)).toMatch(/^Placed .+ 1$/)
    const { id, name } = useStore.getState().scenario.entities[0]
    useStore.getState().select({ entityIds: [id] })
    expect(cueAfter(() => useStore.getState().deleteSelection())).toBe(`Deleted ${name}`)
  })

  it('counts several entities', () => {
    const ids = [place(), place(), place()]
    useStore.getState().select({ entityIds: ids })
    expect(cueAfter(() => useStore.getState().deleteSelection())).toBe('Deleted 3 entities')
  })

  it('names no other edit', () => {
    const id = place()
    const other = place()
    useStore.getState().select({ entityIds: [other] })
    const { scenario } = useStore.getState()
    useStore.getState().deleteSelection()
    place()
    // One step that deletes and places names neither.
    const next = { scenario: useStore.getState().scenario, past: [scenario], future: [] }
    expect(lastUndoableAction(next, { scenario, past: [], future: [] })).toBeNull()
    expect(lastUndoableAction({ ...next, scenario }, { scenario, past: [], future: [] })).toBeNull()
    expect(cueAfter(() => useStore.getState().updateEntity(id, { name: 'Renamed' }))).toBeNull()
    expect(cueAfter(() => useStore.getState().setScenarioName('Other'))).toBeNull()
  })

  it('stays silent after undo, redo and a scenario load', () => {
    place()
    expect(cueAfter(() => useStore.getState().undo())).toBeNull()
    expect(cueAfter(() => useStore.getState().redo())).toBeNull()
    expect(cueAfter(() => useStore.getState().replaceScenario(emptyScenario()))).toBeNull()
  })
})
