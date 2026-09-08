/**
 * Checklist transition tests. Each answer writes only its own fields;
 * only a check stamps a time; completion states every reason it is refused.
 */

import { describe, expect, it } from 'vitest'
import type { TeChecklist } from './types'
import { templateByKey } from '../seed/checklistTemplates'
import {
  answerChecklistItem,
  checklistCompletionBlockers,
  previousCompleter,
} from './checklist'

const AT = '2026-09-08T12:00:00.000Z'

/** Instance of a gated template: item 0 is a check, item 7 records a value. */
function instance(): TeChecklist {
  const template = templateByKey('integration-sequence')!
  return {
    id: 'VLK-T1-CHK-001',
    templateKey: template.key,
    name: template.name,
    phase: template.phase,
    runner: template.runner,
    startedAt: AT,
    completedAt: null,
    items: template.items.map((it) => ({
      text: it.text,
      type: it.type,
      state: 'unchecked' as const,
      value: '',
      completer: '',
      at: null,
      naReason: '',
    })),
    outcome: null,
    conditionalLimits: '',
    runId: null,
    dayDate: AT.slice(0, 10),
  }
}

/** Answers every control so only the gate fields remain outstanding. */
function answerAll(inst: TeChecklist): TeChecklist {
  return {
    ...inst,
    items: inst.items.map((it) => ({
      ...it,
      state: 'checked' as const,
      value: it.type === 'check' ? '' : 'Recorded',
      completer: 'Integration lead',
      at: AT,
    })),
  }
}

describe('answerChecklistItem', () => {
  it('stamps the check time and defaults a blank completer from the last answered item', () => {
    let inst = answerChecklistItem(instance(), 0, { field: 'checked', checked: true }, AT)!
    inst = answerChecklistItem(inst, 0, { field: 'completer', completer: 'Ops lead' }, AT)!
    const next = answerChecklistItem(inst, 2, { field: 'checked', checked: true }, AT)!
    expect(next.items[2]).toMatchObject({ state: 'checked', at: AT, completer: 'Ops lead' })
    expect(next.items[1]).toEqual(inst.items[1])
  })

  it('keeps a completer the operator already named', () => {
    let inst = answerChecklistItem(instance(), 0, { field: 'completer', completer: 'A' }, AT)!
    inst = answerChecklistItem(inst, 1, { field: 'completer', completer: 'B' }, AT)!
    const next = answerChecklistItem(inst, 1, { field: 'checked', checked: true }, AT)!
    expect(next.items[1].completer).toBe('B')
  })

  it('clears the time when a check is undone and keeps the completer', () => {
    const checked = answerChecklistItem(instance(), 0, { field: 'checked', checked: true }, AT)!
    const undone = answerChecklistItem(checked, 0, { field: 'checked', checked: false }, AT)!
    expect(undone.items[0]).toMatchObject({ state: 'unchecked', at: null })
  })

  it('moves an item to n/a and back without stamping a time', () => {
    const na = answerChecklistItem(instance(), 0, { field: 'na', na: true }, AT)!
    expect(na.items[0]).toMatchObject({ state: 'na', at: null })
    const back = answerChecklistItem(na, 0, { field: 'na', na: false }, AT)!
    expect(back.items[0].state).toBe('unchecked')
  })

  it('writes value, completer and n/a reason without changing the item state', () => {
    let inst = answerChecklistItem(instance(), 7, { field: 'value', value: '0.82' }, AT)!
    inst = answerChecklistItem(inst, 7, { field: 'completer', completer: 'Analyst' }, AT)!
    inst = answerChecklistItem(inst, 7, { field: 'naReason', naReason: 'Not fielded' }, AT)!
    expect(inst.items[7]).toMatchObject({
      state: 'unchecked',
      at: null,
      value: '0.82',
      completer: 'Analyst',
      naReason: 'Not fielded',
    })
  })

  it('refuses an unknown item and any answer on a completed checklist', () => {
    const inst = instance()
    expect(answerChecklistItem(inst, -1, { field: 'checked', checked: true }, AT)).toBeNull()
    expect(answerChecklistItem(inst, 99, { field: 'checked', checked: true }, AT)).toBeNull()
    const complete = { ...inst, completedAt: AT }
    expect(answerChecklistItem(complete, 0, { field: 'checked', checked: true }, AT)).toBeNull()
  })
})

describe('previousCompleter', () => {
  it('takes the nearest earlier answered item and skips unchecked or blank ones', () => {
    const inst = instance()
    inst.items[0] = { ...inst.items[0], state: 'checked', completer: 'First' }
    inst.items[1] = { ...inst.items[1], state: 'unchecked', completer: 'Ignored' }
    inst.items[2] = { ...inst.items[2], state: 'na', completer: '  ' }
    expect(previousCompleter(inst.items, 3)).toBe('First')
    expect(previousCompleter(inst.items, 0)).toBe('')
  })
})

describe('checklistCompletionBlockers', () => {
  it('reports every outstanding control, n/a reason and value', () => {
    const inst = instance()
    inst.items[0] = { ...inst.items[0], state: 'na', naReason: '' }
    inst.items[7] = { ...inst.items[7], state: 'checked', value: '' }
    const blockers = checklistCompletionBlockers(inst)
    expect(blockers).toContain(`Explain N/A: ${inst.items[0].text}`)
    expect(blockers).toContain(`Record the value or signature: ${inst.items[7].text}`)
    expect(blockers).toContain(`Answer the control: ${inst.items[1].text}`)
  })

  it('requires the gate outcome, then the limits behind a conditional go', () => {
    const answered = answerAll(instance())
    expect(checklistCompletionBlockers(answered)).toEqual(['Record the gate outcome.'])
    const conditional = { ...answered, outcome: 'conditional-go' as const }
    expect(checklistCompletionBlockers(conditional)).toEqual(['Record the conditional limits.'])
    const limited = { ...conditional, conditionalLimits: 'Daylight only' }
    expect(checklistCompletionBlockers(limited)).toEqual([])
  })

  it('refuses a checklist that is already complete', () => {
    const done = { ...answerAll(instance()), outcome: 'go' as const, completedAt: AT }
    expect(checklistCompletionBlockers(done)).toEqual(['This checklist is already complete.'])
  })
})
