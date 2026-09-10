import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Scenario } from '../../model/types'
import { createRunManifest } from '../../model/runRecord'
import type { RunRecord } from '../../model/runRecord'
import { runReplicates } from '../../playback/mcRun'
import type { RunSummary } from '../../io/runStore'
import type { RunHistorySave } from './RunHistory'
import { RunHistoryView, RunRecordView } from './RunHistory'
import probe from '../../../docs/field-te/evidence/onboarding-2026-09-04/firing-scenario.json'

const scenario: Scenario = { ...structuredClone(probe) as unknown as Scenario, runMode: 'monte-carlo', replicates: 2, seed: 7 }
const summary = runReplicates(scenario)
const savedAt = '2026-09-10T12:00:00.000Z'
const record: RunRecord = {
  id: 'run-1', savedAt, label: 'Camp Able · saved',
  manifest: createRunManifest(scenario, 'sim-1', 'basis'),
  scenario, scenarioHash: 'basis', mc: summary, sensitivity: null,
}
const listed: RunSummary = {
  id: 'run-1', label: record.label, savedAt, seed: summary.seed,
  replicates: summary.replicates, scenarioName: scenario.name, bytes: 1024,
}
const save: RunHistorySave = { enabled: true, reason: 'Save this ensemble to the run history', run: () => Promise.resolve({ evicted: [] }) }
const basis = `Monte Carlo estimate · ${summary.replicates} replicates`

function view(props: Partial<Parameters<typeof RunHistoryView>[0]> = {}) {
  return renderToStaticMarkup(<RunHistoryView
    runs={[listed]} opened={null} notice={null} error={null} save={save}
    onOpen={() => {}} onDelete={() => {}} onSave={() => {}} {...props} />)
}

describe('RunHistoryView', () => {
  it('lists a saved run with its label, time, seed, replicates and row actions', () => {
    const html = view()
    expect(html).toContain('<h4>Run history</h4>')
    expect(html).toContain('1 saved run')
    expect(html).toContain(record.label)
    expect(html).toContain(`>${summary.seed}<`)
    expect(html).toContain(`>${summary.replicates}<`)
    expect(html).toContain('>Open</button>')
    expect(html).toContain('>Delete</button>')
    expect(html).toContain('>Save to history</button>')
  })

  it('reports the empty list, the eviction notice and the load error', () => {
    expect(view({ runs: [] })).toContain('No saved run yet.')
    expect(view({ notice: 'Saved · 2 oldest records evicted to stay under the size cap.' }))
      .toContain('2 oldest records evicted')
    expect(view({ runs: [], error: 'Run history is unavailable: this browser provides no IndexedDB.' }))
      .toContain('this browser provides no IndexedDB')
  })

  it('disables Save with its reason and renders the opened record below the list', () => {
    const disabled = view({ save: { ...save, enabled: false, reason: 'No finished ensemble to save' } })
    expect(disabled).toContain('title="No finished ensemble to save"')
    expect(disabled).toContain('disabled=""')
    const opened = view({ opened: record })
    expect(opened.indexOf('aria-label="Saved runs"')).toBeLessThan(opened.indexOf('aria-label="Saved run Camp Able · saved"'))
  })
})

describe('RunRecordView', () => {
  it('prints four end-of-run tiles, each with the record basis', () => {
    const html = renderToStaticMarkup(<RunRecordView record={record} />)
    expect(html.match(/class="tile"/g)).toHaveLength(4)
    for (const label of ['Kills', 'Leakers', 'First detect', 'Min warning']) {
      expect(html).toContain(`<span class="tl">${label}</span>`)
    }
    expect(html).toContain(`${basis} · seed ${summary.seed}`)
    // One basis line per tile, one per table, one in the scope line.
    expect(html.match(new RegExp(basis, 'g'))!.length).toBeGreaterThanOrEqual(7)
    expect(html).toContain(summary.firstDetectS.interval === 'none' ? 'no interval' : `${summary.firstDetectS.interval} interval`)
  })

  it('renders the per-threat and per-effector tables with the scenario names', () => {
    const html = renderToStaticMarkup(<RunRecordView record={record} />)
    expect(Object.keys(summary.perThreat).length).toBeGreaterThan(0)
    expect(Object.keys(summary.perEffector).length).toBeGreaterThan(0)
    expect(html).toContain('Per threat · ' + basis)
    expect(html).toContain('Per effector · ' + basis)
    for (const id of Object.keys(summary.perThreat)) {
      expect(html).toContain(scenario.entities.find(entity => entity.id === id)!.name)
    }
    for (const id of Object.keys(summary.perEffector)) {
      expect(html).toContain(scenario.entities.find(entity => entity.id === id)!.name)
    }
    expect(html).toContain('<th scope="col" style="white-space:normal;overflow-wrap:anywhere">Ships</th>')
    expect(html).toContain('>Salvos</th>')
  })

  it('prints every manifest field, an array as a count with its JSON', () => {
    const html = renderToStaticMarkup(<RunRecordView record={record} />)
    for (const key of Object.keys(record.manifest)) expect(html).toContain(`<dt>${key}</dt>`)
    expect(html).toContain('<dt>overrides</dt><dd>none</dd>')
    expect(html).toContain(`<dt>seed</dt><dd>${summary.seed}</dd>`)
    expect(html).toContain('<dt>buildRevision</dt><dd>—</dd>')
    expect(html).not.toContain('[object Object]')
  })
})
