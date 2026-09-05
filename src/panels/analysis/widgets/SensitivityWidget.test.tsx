import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { emptyScenario } from '../../../model/seed'
import { DEFAULT_FIRE_DOCTRINE } from '../../../model/types'
import type { SensitivitySummary } from '../../../playback/mcRun'
import { useStore } from '../../../state/store'
import { IDLE_SENSITIVITY } from '../../../state/runState'
import { SensitivityWidget } from './SensitivityWidget'

// zustand 5 gives react-dom/server the store's initial state, not the live one,
// so every static render of a store-reading widget needs the two in step.
function render(): string {
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(
    <SensitivityWidget
      id="th-sensitivity"
      params={{}}
      collapsed={false}
      customize={false}
      index={0}
      count={1}
    />,
  )
}

/** Two hand-built rows: the tornado draws them and the table lists them. */
function summary(): SensitivitySummary {
  return {
    stat: 'leakers',
    rows: [
      { modelId: 'lib-coyote', field: 'pk', label: 'Coyote', low: 1.2, high: 1.9, swing: 0.7 },
      { modelId: 'lib-mavic3', field: 'rcsM2', label: 'Mavic 3', low: 1.5, high: 1.6, swing: 0.1 },
    ],
    nominal: 1.5,
    replicates: 20,
    seed: 4821,
    elapsedMs: 42,
  }
}

function setSensitivity(patch: Partial<SensitivitySummary> | null, status: 'done' | 'stale'): void {
  useStore.setState((st) => ({
    mc: {
      ...st.mc,
      sensitivity: {
        ...IDLE_SENSITIVITY,
        runId: st.playback.runId,
        status,
        progress: 2,
        total: 2,
        summary: patch == null ? null : { ...summary(), ...patch },
      },
    },
  }))
}

describe('SensitivityWidget', () => {
  beforeEach(() => {
    const s = emptyScenario()
    s.entities.push({ id: 'asset', name: 'asset', kind: 'asset', specId: null, pos: { x: 0, y: 0 }, headingDeg: 0, color: null, notes: '' })
    useStore.getState().replaceScenario(s)
  })

  it('asks for the Monte Carlo run mode under the deterministic mode', () => {
    const html = render()
    expect(html).toContain('Sensitivity needs the Monte Carlo run mode.')
    expect(html).not.toContain('Run sensitivity')
  })

  it('offers the run button while idle under Monte Carlo', () => {
    useStore.getState().patchScenario({ runMode: 'monte-carlo' })
    const html = render()
    expect(html).toContain('Run sensitivity')
    expect(html).toContain('<span class="wg-m">leakers</span>')
    expect(html).not.toContain('chart-tornado')
  })

  it('says so when no field carries a spread', () => {
    const s = useStore.getState().scenario
    useStore.getState().replaceScenario({
      ...s,
      runMode: 'monte-carlo',
      library: [],
      connections: [],
      doctrine: { ...DEFAULT_FIRE_DOCTRINE, enabled: false },
    })
    const html = render()
    expect(html).toContain('No field carries a spread.')
    expect(html).not.toContain('Run sensitivity')
  })

  it('counts the fields while the run streams progress', () => {
    useStore.getState().patchScenario({ runMode: 'monte-carlo' })
    useStore.setState((st) => ({
      mc: {
        ...st.mc,
        sensitivity: {
          ...IDLE_SENSITIVITY,
          runId: st.playback.runId,
          status: 'running',
          progress: 3,
          total: 9,
        },
      },
    }))
    expect(render()).toContain('3 of 9 fields')
  })

  it('draws the tornado, the row table and the meta when the run is done', () => {
    useStore.getState().patchScenario({ runMode: 'monte-carlo' })
    setSensitivity({}, 'done')
    const html = render()
    expect(html).toContain('chart-tornado')
    expect(html).toContain('<span class="wg-m">leakers · 20 reps · seed 4821</span>')
    // The gutter label of each row, then the table cells.
    expect(html).toContain('>pk<')
    expect(html).toContain('>rcsM2<')
    expect(html).toContain('<td>Coyote</td>')
    expect(html).toContain('<td>0.7</td>')
    expect(html).toContain('Run again')
    expect(html).toContain('parameter perturbations, not uncertainty intervals')
    expect(html).toContain('Mean CI unavailable')
    expect(html).not.toContain('STALE')
  })

  it('hides sensitivity partition values without an active defended asset', () => {
    useStore.getState().replaceScenario({ ...emptyScenario(), runMode: 'monte-carlo' })
    setSensitivity({}, 'done')
    const html = render()
    expect(html).toContain('Leakers unavailable: no defended asset')
    expect(html).not.toContain('chart-tornado')
    expect(html).not.toContain('<td>Coyote</td>')
    expect(html).not.toContain('reps · seed')
  })

  it('marks a stale run and hides its rows and replicate metadata', () => {
    useStore.getState().patchScenario({ runMode: 'monte-carlo' })
    setSensitivity({}, 'stale')
    const html = render()
    expect(html).toContain('<span class="status warn">STALE</span>')
    expect(html).not.toContain('<td>Mavic 3</td>')
    expect(html).not.toContain('reps · seed')
    expect(html).toContain('Run sensitivity')
  })
})
