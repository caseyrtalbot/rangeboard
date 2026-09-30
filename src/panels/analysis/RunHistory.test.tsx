import { renderToStaticMarkup } from 'react-dom/server'
import { idHash } from '../../geometry/prng'
import { describe, expect, it } from 'vitest'
import type { Scenario } from '../../model/types'
import { createRunManifest } from '../../model/runRecord'
import type { RunRecord } from '../../model/runRecord'
import { runReplicates } from '../../playback/mcRun'
import type { RunSummary } from '../../io/runStore'
import type { RunHistorySave } from './RunHistory'
import { RunHistoryView, RunMenuItems, RunRecordView, SavedRunsView } from './RunHistory'
import { defaultPicks } from './savedRunPicks'
import { useRunHistorySave } from './useRunHistorySave'
import { analysisBasisSignature } from '../../state/analysisBasis'
import { useStore } from '../../state/store'
import probe from '../../../docs/field-te/evidence/onboarding-2026-09-04/firing-scenario.json'

const scenario: Scenario = {
  ...(structuredClone(probe) as unknown as Scenario),
  runMode: 'monte-carlo',
  replicates: 2,
  seed: 7,
}
const summary = runReplicates(scenario)
const savedAt = '2026-09-10T12:00:00.000Z'
const record: RunRecord = {
  id: 'run-1',
  savedAt,
  label: 'Camp Able · saved',
  manifest: createRunManifest(scenario, 'sim-1', 'basis'),
  scenario,
  scenarioHash: 'basis',
  mc: summary,
  sensitivity: null,
}
const listed: RunSummary = {
  id: 'run-1',
  label: record.label,
  savedAt,
  seed: summary.seed,
  replicates: summary.replicates,
  scenarioName: scenario.name,
  bytes: 1024,
}
const save: RunHistorySave = {
  enabled: true,
  reason: 'Save this ensemble to the run history',
  run: () => Promise.resolve({ evicted: [] }),
}
const basis = `Monte Carlo estimate · ${summary.replicates} replicates`

function view(props: Partial<Parameters<typeof RunHistoryView>[0]> = {}) {
  return renderToStaticMarkup(
    <RunHistoryView
      runs={[listed]}
      opened={null}
      notice={null}
      error={null}
      save={save}
      onOpen={() => {}}
      onDelete={() => {}}
      onSave={() => {}}
      onImport={() => {}}
      onExportSqlite={() => {}}
      {...props}
    />,
  )
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
    expect(html).toContain('>Import run</button>')
  })

  it('offers import beside save and never disables it with the save reason', () => {
    const html = view({
      runs: [],
      save: { ...save, enabled: false, reason: 'No finished ensemble to save' },
    })
    expect(html).toContain('title="Read a saved-run JSON file into this history"')
    expect(html.indexOf('>Import run</button>')).toBeLessThan(
      html.indexOf('>Save to history</button>'),
    )
    // Save is disabled by its reason and the SQLite export by the empty list; import never is.
    expect(html.match(/disabled=""/g)).toHaveLength(2)
    expect(html).not.toMatch(/disabled=""[^>]*>Import run</)
  })

  it('reports the empty list, the eviction notice and the load error', () => {
    expect(view({ runs: [] })).toContain('No saved run yet.')
    expect(
      view({ notice: 'Saved · 2 oldest records evicted to stay under the size cap.' }),
    ).toContain('2 oldest records evicted')
    expect(
      view({ runs: [], error: 'Run history is unavailable: this browser provides no IndexedDB.' }),
    ).toContain('this browser provides no IndexedDB')
  })

  it('disables Save with its reason and renders the opened record below the list', () => {
    const disabled = view({
      save: { ...save, enabled: false, reason: 'No finished ensemble to save' },
    })
    expect(disabled).toContain('title="No finished ensemble to save"')
    expect(disabled).toContain('disabled=""')
    const opened = view({ opened: record })
    expect(opened.indexOf('aria-label="Saved runs"')).toBeLessThan(
      opened.indexOf('aria-label="Saved run Camp Able · saved"'),
    )
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
    expect(html).toContain(
      summary.firstDetectS.interval === 'none'
        ? 'no interval'
        : `${summary.firstDetectS.interval} interval`,
    )
  })

  it('renders the per-threat and per-effector tables with the scenario names', () => {
    const html = renderToStaticMarkup(<RunRecordView record={record} />)
    expect(Object.keys(summary.perThreat).length).toBeGreaterThan(0)
    expect(Object.keys(summary.perEffector).length).toBeGreaterThan(0)
    expect(html).toContain('Per threat · ' + basis)
    expect(html).toContain('Per effector · ' + basis)
    for (const id of Object.keys(summary.perThreat)) {
      expect(html).toContain(scenario.entities.find((entity) => entity.id === id)!.name)
    }
    for (const id of Object.keys(summary.perEffector)) {
      expect(html).toContain(scenario.entities.find((entity) => entity.id === id)!.name)
    }
    expect(html).toContain(
      '<th scope="col" style="white-space:normal;overflow-wrap:anywhere">Ships</th>',
    )
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

  it('gives every tile its own lineage, collapsed, with the scenario hash', () => {
    const html = renderToStaticMarkup(<RunRecordView record={record} />)
    // One lineage per tile, and each is closed until the reader opens it.
    expect(html.match(/Lineage<\/summary>/g)).toHaveLength(4)
    expect(html).not.toContain('<details class="analysis-disclosure" open')
    for (const label of ['Kills', 'Leakers', 'First detect', 'Min warning']) {
      expect(html).toContain(`aria-label="${label} lineage"`)
    }
    for (const field of [
      'Seed',
      'Replicates',
      'Uncertainty',
      'Run mode',
      'Engine revision',
      'Draw policy',
      'Data package',
      'Overrides',
      'Physics switches',
      'Fidelity floor',
      'Producer',
    ]) {
      expect(html).toContain(`<dt>${field}</dt>`)
    }
    // FNV-1a 32-bit of 'basis', as idHash computes it; the raw signature never prints.
    expect(html).toContain(
      `<dt>Scenario hash</dt><dd>${idHash('basis').toString(16).padStart(8, '0')}</dd>`,
    )
    expect(html).toContain(`<dt>Seed</dt><dd>${record.manifest.seed}</dd>`)
    expect(html).toContain('<dt>Overrides</dt><dd>none</dd>')
  })

  it('offers JSON and one button per CSV table, the sensitivity one only with rows', () => {
    const html = renderToStaticMarkup(<RunRecordView record={record} />)
    expect(html).toContain('aria-label="Export this run"')
    for (const label of ['JSON', 'Threat CSV', 'Effector CSV', 'Sensitivity CSV']) {
      expect(html).toContain(`>${label}</button>`)
    }
    expect(html).toContain('title="This run carries no sensitivity result"')
    expect(record.sensitivity).toBeNull()
    const withRows = renderToStaticMarkup(
      <RunRecordView
        record={{
          ...record,
          sensitivity: {
            stat: 'leakers',
            rows: [],
            nominal: 1,
            replicates: 2,
            seed: 7,
            elapsedMs: 1,
          },
        }}
      />,
    )
    expect(withRows).toContain('title="Export the sensitivity rows"')
    expect(withRows).not.toContain('title="Export the sensitivity rows" disabled')
  })
})

const second: RunSummary = { ...listed, id: 'run-2', label: 'Camp Able · second' }

function savedRuns(props: Partial<Parameters<typeof SavedRunsView>[0]> = {}) {
  return renderToStaticMarkup(
    <SavedRunsView
      runs={[second, listed]}
      a="run-2"
      b="run-1"
      opened={null}
      notice={null}
      error={null}
      save={save}
      delta={<p>DELTA</p>}
      onPick={() => {}}
      onLoad={() => Promise.resolve(null)}
      onOpen={() => {}}
      onDelete={() => {}}
      onSave={() => {}}
      onImport={() => {}}
      onExportSqlite={() => {}}
      {...props}
    />,
  )
}

describe('SavedRunsView', () => {
  it('lists each run with its A and B picks, its saved time and a row menu', () => {
    const html = savedRuns()
    expect(html).toContain('>Saved runs</h3><span class="psec-readout">2</span>')
    expect(html).toContain('aria-label="Saved runs"')
    expect(html.match(/class="saved-pick"/g)).toHaveLength(4)
    expect(html).toContain('aria-pressed="true" aria-label="Set Camp Able · second as A"')
    expect(html).toContain('aria-pressed="false" aria-label="Set Camp Able · second as B"')
    expect(html).toContain('aria-pressed="true" aria-label="Set Camp Able · saved as B"')
    expect(html).toContain(
      `title="${record.label} · seed ${summary.seed} · ${summary.replicates} replicates"`,
    )
    expect(html).toContain('aria-label="Camp Able · saved actions"')
    // The menu stays shut until it is pressed; no row button reads Open or Delete.
    expect(html).not.toContain('>Open</button>')
    expect(html).not.toContain('Save to history')
  })

  it('shows the A − B comparison only when A and B are two different records', () => {
    expect(savedRuns()).toContain('<p>DELTA</p>')
    expect(savedRuns({ b: 'run-2' })).not.toContain('DELTA')
    expect(savedRuns({ b: 'run-2' })).toContain('Pick A and B to see the difference.')
    expect(savedRuns({ b: null })).toContain('Pick A and B to see the difference.')
  })

  it('enables Save current by the save rule, with the reason as its title', () => {
    expect(savedRuns()).toMatch(/title="Save this ensemble to the run history">Save current</)
    const off = savedRuns({
      save: { ...save, enabled: false, reason: 'No finished ensemble to save' },
    })
    expect(off).toContain('disabled="" title="No finished ensemble to save">Save current</button>')
    expect(off).toContain('aria-label="Saved run options"')
  })

  it('reports the empty list, the notice and the error, and opens a record below the list', () => {
    expect(savedRuns({ runs: [] })).toContain('No saved run yet.')
    expect(savedRuns({ runs: [] })).not.toContain('<table')
    expect(savedRuns({ notice: 'Saved to history.' })).toContain('role="status">Saved to history.')
    expect(savedRuns({ error: 'Run history is unavailable.' })).toContain(
      'Run history is unavailable.',
    )
    const opened = savedRuns({ opened: record })
    expect(opened.indexOf('aria-label="Saved runs"')).toBeLessThan(
      opened.indexOf('aria-label="Saved run Camp Able · saved"'),
    )
  })
})

describe('RunMenuItems', () => {
  const items = (value: RunRecord | null) =>
    renderToStaticMarkup(
      <RunMenuItems record={value} onOpen={() => {}} onExport={() => {}} onDelete={() => {}} />,
    )

  it('offers Open, the four exports and Delete, in that order', () => {
    const html = items({ ...record, sensitivity: null })
    const labels = [...html.matchAll(/>([^<>]+)<\/button>/g)].map((m) => m[1])
    expect(labels).toEqual([
      'Open',
      'JSON',
      'Per-threat CSV',
      'Per-effector CSV',
      'Sensitivity CSV',
      'Delete',
    ])
    expect(html).toContain('title="This run carries no sensitivity result">Sensitivity CSV')
  })

  it('holds the exports until the record is read', () => {
    expect(items(null).match(/title="Reading the saved run"/g)).toHaveLength(4)
  })
})

describe('defaultPicks', () => {
  const runs = [second, listed]
  it('defaults A and B to the two newest records', () => {
    expect(defaultPicks(runs, { a: null, b: null })).toEqual({ a: 'run-2', b: 'run-1' })
    expect(defaultPicks([listed], { a: null, b: null })).toEqual({ a: 'run-1', b: null })
    expect(defaultPicks([], { a: null, b: null })).toEqual({ a: null, b: null })
  })

  it('keeps a pick that still exists and refills a deleted one', () => {
    expect(defaultPicks(runs, { a: 'run-1', b: 'run-2' })).toEqual({ a: 'run-1', b: 'run-2' })
    expect(defaultPicks(runs, { a: 'gone', b: 'run-2' })).toEqual({ a: 'run-1', b: 'run-2' })
  })
})

describe('useRunHistorySave', () => {
  function Probe() {
    const value = useRunHistorySave()
    return <i>{`${value.enabled}|${value.reason}`}</i>
  }
  // A server render reads the initial state, so each render copies the live state there.
  const probeText = () => {
    Object.assign(useStore.getInitialState(), useStore.getState())
    return renderToStaticMarkup(<Probe />)
  }

  it('enables a save only for a finished ensemble on the current basis', () => {
    const state = useStore.getState()
    useStore.setState({ scenario })
    expect(probeText()).toContain('false|No finished ensemble to save')
    useStore.setState({ mc: { ...state.mc, status: 'running' } })
    expect(probeText()).toContain('false|The ensemble is still running')
    const signature = analysisBasisSignature(scenario)
    useStore.setState({
      mc: { ...state.mc, status: 'done', summary, basisSignature: signature },
    })
    expect(probeText()).toContain('true|Save this ensemble to the run history')
    useStore.setState({ mc: { ...state.mc, status: 'done', summary, basisSignature: 'other' } })
    expect(probeText()).toContain('false|The scenario changed after the ensemble ran')
    useStore.setState(state)
  })
})
