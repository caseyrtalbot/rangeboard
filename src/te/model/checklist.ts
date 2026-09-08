/**
 * Checklist item transitions. The rules live here, not in the panel: which
 * fields an answer writes, when a completion time is stamped, how a blank
 * completer defaults, and what stops a checklist from completing.
 * A completed checklist is a closed record and takes no further answer.
 */

import type { ChecklistInstanceItem, TeChecklist } from './types'
import { checklistBlockers } from '../validate'

/** One control answer. The panel names the field the operator touched. */
export type ChecklistAnswer =
  | { field: 'checked'; checked: boolean }
  | { field: 'na'; na: boolean }
  | { field: 'value'; value: string }
  | { field: 'completer'; completer: string }
  | { field: 'naReason'; naReason: string }

/** Outcome of a completion attempt. A refusal carries every reason. */
export type ChecklistCompletion = { ok: true } | { ok: false; blockers: string[] }

/** The most recent earlier item's completer; one person usually runs a checklist. */
export function previousCompleter(items: ChecklistInstanceItem[], index: number): string {
  for (let i = index - 1; i >= 0; i--) {
    const it = items[i]
    if (it.state !== 'unchecked' && it.completer.trim() !== '') return it.completer
  }
  return ''
}

/** Fields one answer writes. Only a check stamps a time; unchecking clears it. */
function answerPatch(
  items: ChecklistInstanceItem[],
  index: number,
  answer: ChecklistAnswer,
  at: string,
): Partial<ChecklistInstanceItem> {
  switch (answer.field) {
    case 'checked':
      if (!answer.checked) return { state: 'unchecked', at: null }
      return {
        state: 'checked',
        at,
        ...(items[index].completer.trim() === ''
          ? { completer: previousCompleter(items, index) }
          : {}),
      }
    case 'na':
      return { state: answer.na ? 'na' : 'unchecked' }
    case 'value':
      return { value: answer.value }
    case 'completer':
      return { completer: answer.completer }
    case 'naReason':
      return { naReason: answer.naReason }
  }
}

/**
 * The checklist after one answer, or null when the transition does not apply:
 * an unknown item, or a checklist already completed.
 */
export function answerChecklistItem(
  checklist: TeChecklist,
  index: number,
  answer: ChecklistAnswer,
  at: string,
): TeChecklist | null {
  if (checklist.completedAt !== null) return null
  if (!Number.isInteger(index) || index < 0 || index >= checklist.items.length) return null
  const patch = answerPatch(checklist.items, index, answer, at)
  return {
    ...checklist,
    items: checklist.items.map((it, i) => (i === index ? { ...it, ...patch } : it)),
  }
}

/** Everything that stops completion. An empty list means the checklist can complete. */
export function checklistCompletionBlockers(checklist: TeChecklist): string[] {
  if (checklist.completedAt !== null) return ['This checklist is already complete.']
  return checklistBlockers(checklist)
}
