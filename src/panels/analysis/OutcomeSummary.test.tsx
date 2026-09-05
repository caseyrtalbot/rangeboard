import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { engagementPicture } from '../../analysis/impact'
import { emptyScenario } from '../../model/seed'
import type { BandSeries, Stat } from '../../playback/mcRun'
import { runReplicates } from '../../playback/mcRun'
import { OutcomeSummary } from './OutcomeSummary'

function band(mean: number, lo: number, hi: number): BandSeries {
  return { mean: [mean], lo: [lo], hi: [hi], p10: [0], p90: [4], p025: [0], p975: [4] }
}
function stat(mean: number, n = 4): Stat {
  return { mean, sd: 1, se: 0.5, lo: mean - 1, hi: mean + 1, conf: 0.95,
    p10: mean - 2, p90: mean + 2, p025: mean - 3, p975: mean + 3, n, total: 4,
    defined: { p: n / 4, lo: 0, hi: 1 } }
}
function fixture() {
  const scenario = emptyScenario()
  scenario.replicates = 4
  const { report, assessments } = engagementPicture(scenario)
  // Deliberately distinct envelope and replicate values expose mixed-source readouts.
  report.totals = { ...report.totals, raidSize: 4, expectedKills: 1,
    expectedLateKills: 0.3, expectedLeakers: 3, reportedLeakers: 3 }
  const mc = { ...runReplicates(scenario), kills: band(3, 2.6, 3.4), leakers: band(1, 0.6, 1.4),
    firstDetectS: stat(12), minWarningS: stat(25) }
  const render = () => renderToStaticMarkup(<OutcomeSummary scenario={scenario} assessments={assessments} report={report} mc={mc} />)
  return { scenario, report, mc, render }
}
function metric(html: string, name: string) {
  return html.split(`<span>${name}</span>`)[1]?.split('</div>')[0] ?? ''
}

describe('C2 projection source consistency', () => {
  it('uses the MC defeat proportion and converts its CI to percentage points over the same four ships', () => {
    const { render } = fixture()
    const html = render()
    expect(metric(html, 'Defeat')).toContain('75.0%')
    expect(metric(html, 'Defeat')).toContain('±10.0 pp (95% mean CI)')
    expect(metric(html, 'Leakers')).toContain('>1.0</strong>')
    expect(metric(html, 'Leakers')).toContain('±0.4 (95% mean CI)')
    expect(metric(html, 'First detect')).toContain('0:12')
    expect(metric(html, 'Min warning')).toContain('0:25')
    expect(metric(html, 'Late E[k]')).toContain('>0.3</strong>')
    expect(metric(html, 'Late E[k]')).toContain('planning envelope')
    expect(metric(html, 'First effect')).toContain('planning envelope')
    expect(metric(html, 'Salvos')).toContain('planning envelope')
  })

  it('keeps leakers undefined without an asset, regardless of MC partition values', () => {
    const { report, render } = fixture()
    report.totals.reportedLeakers = null
    const shown = metric(render(), 'Leakers')
    expect(shown).toContain('>—</strong>')
    expect(shown).toContain('no defended asset')
    expect(shown).not.toContain('mean CI')
  })

  it('reports no detection/no arrival as undefined conditional times without falling back', () => {
    const { mc, render } = fixture()
    mc.firstDetectS = stat(NaN, 0)
    mc.minWarningS = stat(NaN, 0)
    const html = render()
    expect(metric(html, 'First detect')).toContain('>—</strong>')
    expect(metric(html, 'First detect')).toContain('detected in 0 of 4')
    expect(metric(html, 'Min warning')).toContain('warning time in 0 of 4')
    expect(html).not.toContain('NaN')
  })

  it('does not advertise a confidence interval from one replicate', () => {
    const { mc, render } = fixture()
    mc.replicates = 1
    mc.firstDetectS = stat(12, 1)
    mc.minWarningS = stat(25, 1)
    const html = render()
    expect(metric(html, 'Defeat')).toContain('75.0%')
    expect(html).toContain('CI unavailable')
    expect(html).not.toContain('mean CI')
  })

  it('renders empty/zero-replicate estimates unavailable and an empty raid undefined', () => {
    const { mc, report, render } = fixture()
    mc.replicates = 0
    mc.kills = band(NaN, NaN, NaN)
    expect(metric(render(), 'Defeat')).toContain('MC estimate unavailable')
    expect(render()).not.toContain('NaN')
    report.totals.raidSize = 0
    expect(metric(render(), 'Defeat')).toContain('no ships')
  })
})
