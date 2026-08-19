/**
 * CSV export layer (MASTER-FORMS section 4 deliverables map).
 * UTF-8 BOM prefix and CRLF line endings so Excel opens the files cleanly.
 * Pure derivation from campaign state; no store writes.
 */

import type { TeCampaign } from '../model/types'
import { runAccounting, validRunRate } from '../calc/accounting'
import { computeAllMeasures } from '../calc/measures'
import { coverage } from '../calc/matrix'
import { displayId } from '../model/ids'

type CsvValue = string | number | boolean | null | undefined

function csvField(value: CsvValue): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function downloadCsv(campaign: TeCampaign, suffix: string, rows: CsvValue[][]): void {
  const text = '\ufeff' + rows.map((row) => row.map(csvField).join(',')).join('\r\n') + '\r\n'
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${campaign.code.toLowerCase()}-${suffix}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function exportRunsCsv(campaign: TeCampaign): void {
  const rows: CsvValue[][] = [
    [
      'id',
      'card',
      'matrixCell',
      'start',
      'end',
      'validity',
      'excluded',
      'deviationCount',
      'anomalyCount',
      'preliminaryUse',
      'eventCount',
    ],
  ]
  for (const run of campaign.runs) {
    const card = campaign.cards.find((c) => c.id === run.cardId)
    rows.push([
      run.id,
      card ? displayId(card.cardCode, run.cardVersion) : run.cardId,
      run.matrixCellId,
      run.startAt,
      run.endAt,
      run.validity,
      run.excluded,
      run.deviationIds.length,
      run.anomalyIds.length,
      run.preliminaryUse,
      run.events.length,
    ])
  }
  downloadCsv(campaign, 'runs', rows)
}

export function exportMeasureResultsCsv(campaign: TeCampaign): void {
  const rows: CsvValue[][] = [
    [
      'measureId',
      'row',
      'name',
      'unit',
      'family',
      'label',
      'estimate',
      'intervalLo',
      'intervalHi',
      'intervalMethod',
      'nPlanned',
      'nAttempted',
      'nEligible',
      'nValid',
      'nIncluded',
      'threshold',
      'thresholdShown',
      'runId',
      'status',
      'success',
      'value',
      'included',
    ],
  ]
  for (const comp of computeAllMeasures(campaign)) {
    const measure = campaign.measures.find((m) => m.id === comp.measureId)
    rows.push([
      comp.measureId,
      'measure',
      comp.name,
      comp.unit,
      comp.family,
      comp.label,
      comp.estimate,
      comp.interval?.lo,
      comp.interval?.hi,
      comp.interval?.method,
      comp.nPlanned,
      comp.nAttempted,
      comp.nEligible,
      comp.nValid,
      comp.nIncluded,
      measure?.threshold,
      comp.thresholdShown,
      null,
      null,
      null,
      null,
      null,
    ])
    for (const pr of comp.perRun) {
      rows.push([
        comp.measureId,
        'run',
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        pr.runId,
        pr.status,
        pr.success,
        pr.value,
        pr.included,
      ])
    }
  }
  downloadCsv(campaign, 'measure-results', rows)
}

export function exportMatrixCsv(campaign: TeCampaign): void {
  const cov = coverage(campaign)
  const rows: CsvValue[][] = [
    [
      'cellId',
      'question',
      'config',
      'threat',
      'condition',
      'method',
      'plannedReps',
      'minValid',
      'attempted',
      'valid',
      'state',
      'priority',
      'dropOrder',
    ],
  ]
  for (const cell of campaign.matrix) {
    const c = cov.find((x) => x.cellId === cell.id)
    rows.push([
      cell.id,
      cell.questionId,
      cell.configId,
      cell.threatId,
      cell.conditionId,
      cell.method,
      cell.plannedReps,
      cell.minValidEvidence,
      c?.attempted ?? 0,
      c?.valid ?? 0,
      c?.state ?? 'empty',
      cell.priority,
      cell.dropOrder,
    ])
  }
  downloadCsv(campaign, 'matrix', rows)
}

export function exportAccountingCsv(campaign: TeCampaign): void {
  const acc = runAccounting(campaign)
  const rows: CsvValue[][] = [
    ['metric', 'value'],
    ['planned', acc.planned],
    ['attempted', acc.attempted],
    ['valid', acc.valid],
    ['conditional', acc.conditional],
    ['invalid', acc.invalid],
    ['excluded', acc.excluded],
    ['pending', acc.pending],
    ['validRunRate', validRunRate(campaign)],
  ]
  downloadCsv(campaign, 'accounting', rows)
}

export function exportFindingsCsv(campaign: TeCampaign): void {
  const rows: CsvValue[][] = [
    [
      'id',
      'statement',
      'question',
      'strength',
      'ladderLevel',
      'appliesTo',
      'doesNotApplyTo',
      'decisionImplication',
      'supportingRuns',
      'contradictingRuns',
    ],
  ]
  for (const f of campaign.findings) {
    rows.push([
      f.id,
      f.statement,
      f.questionId,
      f.strength,
      f.ladderLevel,
      f.appliesTo,
      f.doesNotApplyTo,
      f.decisionImplication,
      f.supportingRunIds.join('; '),
      f.contradictingRunIds.join('; '),
    ])
  }
  downloadCsv(campaign, 'findings', rows)
}

export function exportActionsCsv(campaign: TeCampaign): void {
  const rows: CsvValue[][] = [
    [
      'id',
      'findingId',
      'decisionOwner',
      'executionOwner',
      'dueDate',
      'requiredWork',
      'evidenceForClosure',
      'riskIfLate',
      'status',
      'communicationRequired',
    ],
  ]
  for (const a of campaign.actions) {
    rows.push([
      a.id,
      a.findingId,
      a.decisionOwner,
      a.executionOwner,
      a.dueDate,
      a.requiredWork,
      a.evidenceForClosure,
      a.riskIfLate,
      a.status,
      a.communicationRequired,
    ])
  }
  downloadCsv(campaign, 'actions', rows)
}

export function exportEventsCsv(campaign: TeCampaign): void {
  const rows: CsvValue[][] = [['runId', 'mark', 'at', 'note']]
  for (const run of campaign.runs) {
    for (const event of run.events) {
      rows.push([run.id, event.mark, event.at, event.note])
    }
  }
  downloadCsv(campaign, 'events', rows)
}

export function exportAllCsv(campaign: TeCampaign): void {
  exportRunsCsv(campaign)
  exportMeasureResultsCsv(campaign)
  exportMatrixCsv(campaign)
  exportAccountingCsv(campaign)
  exportFindingsCsv(campaign)
  exportActionsCsv(campaign)
  exportEventsCsv(campaign)
}
