import type { ComponentType } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { emptyScenario } from '../../../model/seed'
import { effectiveDoctrine } from '../../../model/types'
import { useStore } from '../../../state/store'
import { EnvironmentWidget } from './EnvironmentWidget'
import { FireDoctrineWidget } from './FireDoctrineWidget'
import type { WidgetProps } from './registry'
import { RequirementGatesWidget } from './RequirementGatesWidget'

const BASE_PROPS: WidgetProps = {
  id: 'settings-test',
  params: {},
  collapsed: false,
  customize: false,
  index: 0,
  count: 1,
}

function render(Widget: ComponentType<WidgetProps>, preparation = false): string {
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(
    <Widget
      {...BASE_PROPS}
      onOpenPreparation={preparation ? () => undefined : undefined}
    />,
  )
}

describe('scenario settings analysis context', () => {
  beforeEach(() => {
    useStore.getState().replaceScenario(emptyScenario())
    useStore.getState().setUnits('metric')
  })

  it('reads every environment field without rendering an editor', () => {
    useStore.getState().updateEnvironment({
      apply: false,
      precipitation: undefined,
      light: 'night',
      emBackground: 'urban',
      visibilityM: null,
      windSpeedMps: 5,
      windFromDeg: 45,
      temperatureC: -5,
      fieldElevationFt: 4000,
    })
    const html = render(EnvironmentWidget, true)

    expect(html).toContain('data-settings-scope="environment"')
    expect(html).toContain('Scenario inputs · edit in Prepare')
    expect(html).toContain('Environment · planning · none')
    expect(html).toContain('Clear · default')
    expect(html).toContain('Night')
    expect(html).toContain('Urban (dense)')
    expect(html).toContain('Unspecified ·')
    expect(html).toContain('5 m/s')
    expect(html).toContain('45° (NE)')
    expect(html).toContain('-5<em> °C</em>')
    expect(html).toContain('4000<em> ft</em>')
    expect(html).toContain('data-preparation-section="environment"')
    expect(html).toContain('Edit environment in Prepare')
    expect(html).not.toContain('<input')

    expect(render(EnvironmentWidget)).toContain(
      'title="Apply environment effects to sensors and threats"',
    )

    useStore.getState().setUnits('aviation')
    expect(render(EnvironmentWidget, true)).toContain('10 kt')
  })

  it('reads ROE and every resolved doctrine field without rendering controls', () => {
    const doctrine = effectiveDoctrine(useStore.getState().scenario)
    useStore.getState().patchScenario({
      roe: 'hold',
      doctrine: {
        ...doctrine,
        enabled: false,
        trackFirmS: 7,
        declareHostileS: 11,
        targetS: 6,
        bdaS: 13,
        pkCommit: 0.4,
        opportunities: 3,
        launchPolicy: 'range-fraction',
        launchRangeFraction: 0.75,
      },
    })
    const html = render(FireDoctrineWidget, true)

    expect(html).toContain('data-settings-scope="doctrine"')
    expect(html).toContain('Scenario inputs · edit in Prepare')
    expect(html).toContain('Doctrine · planning · none')
    for (const label of [
      'ROE',
      'Doctrine',
      'Launch point',
      'Release inside max range',
      'Re-engagement depth',
      'Hostile declaration dwell',
      'Track initiation fallback',
      'Target dwell fallback',
      'BDA dwell fallback',
      'Commit Pk fallback',
    ]) {
      expect(html).toContain(label)
    }
    expect(html).toContain('Range fraction')
    expect(html).toContain('75<em> %</em>')
    expect(html).toContain('data-preparation-section="doctrine"')
    expect(html).toContain('Edit fire doctrine in Prepare')
    expect(html).not.toContain('<input')
    expect(html).not.toContain('data-role="roe"')

    expect(render(FireDoctrineWidget)).toContain('data-role="roe"')
  })

  it('keeps gate results and reads every threshold without rendering inputs', () => {
    useStore.getState().patchScenario({
      requirements: {
        pdDetect: 0.6,
        pdTrackCumulative: 0.95,
        maxResidualPerTrack: 0.2,
        minWarningS: null,
      },
    })
    const html = render(RequirementGatesWidget, true)

    expect(html).toContain('No threats with flight paths.')
    expect(html).toContain('data-settings-scope="requirements"')
    expect(html).toContain('Scenario inputs · edit in Prepare')
    expect(html).toContain('Detect: single-scan Pd')
    expect(html).toContain('0.6')
    expect(html).toContain('Track: cumulative Pd')
    expect(html).toContain('0.95')
    expect(html).toContain('Effect: max residual per track')
    expect(html).toContain('0.2')
    expect(html).toContain('Detect: min warning')
    expect(html).toContain('Unspecified')
    expect(html).toContain('data-preparation-section="requirements"')
    expect(html).toContain('Edit requirement inputs in Prepare')
    expect(html).not.toContain('<input')

    const standalone = render(RequirementGatesWidget)
    expect(standalone).toContain('Thresholds')
    expect(standalone).not.toContain('Edit requirement inputs in Prepare')
  })

  it('labels resolved legacy doctrine and requirement defaults', () => {
    const legacy = emptyScenario()
    legacy.roe = undefined
    legacy.doctrine = undefined
    legacy.requirements = {} as typeof legacy.requirements
    useStore.getState().replaceScenario(legacy)

    const doctrine = render(FireDoctrineWidget, true)
    expect(doctrine).toContain('Tight · default')
    expect(doctrine).toContain('On · default')
    expect(doctrine).toContain('0.35 · default')

    const requirements = render(RequirementGatesWidget, true)
    expect(requirements).toContain('0.5 · default')
    expect(requirements).toContain('0.9 · default')
    expect(requirements).toContain('Unspecified · default')
  })
})
