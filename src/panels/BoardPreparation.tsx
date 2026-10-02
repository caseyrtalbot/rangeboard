import { Suspense, lazy, memo, useMemo, useState } from 'react'
import { engagementPicture } from '../analysis/impact'
import { buildRequirementGateReport } from '../analysis/requirements'
import { assessRunValidity } from '../analysis/runValidity'
import type { Entity, EntityKind, LaunchPolicy, Scenario } from '../model/types'
import type { ThreatAssessment } from '../playback/sim'
import { effectiveDoctrine, entityActive } from '../model/types'
import { formatSpeed } from '../geometry/geo'
import type { DisplayUnits } from '../geometry/geo'
import { useStore } from '../state/store'
import { PanelSection } from '../ui/PanelSection'
import { State } from '../ui/kit'
import { ForecastSettings } from './analysis/ForecastSettings'
import { EnvironmentEffectsSwitch, EnvironmentSettings } from './analysis/EnvironmentSettings'
import { FireControlInfo, FireDoctrineSettings } from './analysis/FireDoctrineSettings'
import { Info } from './analysis/Info'
import { RequirementTable } from './RequirementTable'

// Settings loads on demand, as it does from the top bar.
const SettingsPanel = lazy(() =>
  import('./SettingsPanel').then((module) => ({ default: module.SettingsPanel })),
)

/** Short launch labels that fit four segments at 280 px; the full hint is the title. */
const LAUNCH_SHORT: Record<LaunchPolicy, string> = {
  'max-range': 'Max range',
  'range-fraction': 'Fraction',
  'pk-commit': 'Pk commit',
  latest: 'Latest',
}

/** Entity groups in kill-chain reading order, with the one-letter kind mark. */
const GROUPS: ReadonlyArray<{ kind: EntityKind; label: string; mark: string }> = [
  { kind: 'uas', label: 'Threats', mark: 'T' },
  { kind: 'sensor', label: 'Sensors', mark: 'S' },
  { kind: 'c2', label: 'C2', mark: 'C2' },
  { kind: 'effector', label: 'Effectors', mark: 'E' },
  { kind: 'asset', label: 'Assets', mark: 'A' },
  { kind: 'marker', label: 'Markers', mark: 'M' },
]

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

/** The closed Environment head: the values in force, or that effects are off. */
function environmentSummary(scenario: Scenario, units: DisplayUnits): string {
  const env = scenario.environment
  if (!env.apply) return 'Effects off'
  return [
    capitalize(env.precipitation ?? 'clear'),
    capitalize(env.light ?? 'day'),
    capitalize(env.emBackground ?? 'rural'),
    `wind ${formatSpeed(env.windSpeedMps, units)}`,
    `${env.temperatureC} °C`,
    `${env.fieldElevationFt.toLocaleString('en-US')} ft`,
  ].join(' · ')
}

/** The closed Fire control head: ROE, then the doctrine factors or that doctrine is off. */
function fireSummary(scenario: Scenario): string {
  const roe = `ROE ${capitalize(scenario.roe ?? 'tight')}`
  if (!(scenario.doctrine?.enabled ?? false)) return `${roe} · doctrine off`
  const doctrine = effectiveDoctrine(scenario)
  return [
    roe,
    LAUNCH_SHORT[doctrine.launchPolicy],
    `${doctrine.opportunities} cycles`,
    `${doctrine.declareHostileS} s dwell`,
  ].join(' · ')
}

/**
 * One register row, memoized on the entity and its assessment. It selects from the
 * panel, so the current tab stays and the Selected object tab is added (D7).
 */
const EntityRegisterRow = memo(function EntityRegisterRow({
  entity,
  mark,
  assessment,
}: {
  entity: Entity
  mark: string
  assessment: ThreatAssessment | undefined
}) {
  const state = !entityActive(entity)
    ? 'disabled'
    : assessment
      ? assessment.status.replaceAll('-', ' ')
      : 'enabled'
  const warn = assessment != null && entityActive(entity) && assessment.status !== 'engageable'
  return (
    <button
      className="prepare-entity"
      type="button"
      aria-label={`Select ${entity.name}`}
      title={`${entity.name} · ${state}`}
      onClick={() => useStore.getState().select({ entityIds: [entity.id] }, false, 'panel')}
    >
      <span className="prepare-entity-kind" aria-hidden="true">
        {mark}
      </span>
      <span className="prepare-entity-name">{entity.name}</span>
      <span className={`prepare-entity-state${warn ? ' warn' : ''}`}>{state}</span>
    </button>
  )
})

/** The Run head end: the stale chip and the link to Settings at Run. */
function RunHeadEnd() {
  const stale = useStore((state) => state.mc.status === 'stale')
  const [settingsOpen, setSettingsOpen] = useState(false)
  return (
    <>
      {stale && (
        <State tone="warning" title="An input changed after the ensemble ran">
          ENSEMBLE STALE
        </State>
      )}
      <button
        type="button"
        className="mini prep-settings-link"
        title="Stop rule, what varies and sensitivity depth"
        onClick={() => setSettingsOpen(true)}
      >
        Settings
      </button>
      {settingsOpen && (
        <Suspense fallback={null}>
          <SettingsPanel initialSection="run" onRequestClose={() => setSettingsOpen(false)} />
        </Suspense>
      )}
    </>
  )
}

/** Prepare, Inputs: Run, Environment, Fire control, Requirements and Entities. */
export function BoardPreparation() {
  const scenario = useStore((state) => state.scenario)
  const units = useStore((state) => state.ui.units)
  const picture = useMemo(() => engagementPicture(scenario), [scenario])
  const requirements = useMemo(
    () =>
      buildRequirementGateReport(
        scenario,
        picture.assessments,
        picture.report,
        assessRunValidity(scenario, picture.assessments),
      ),
    [scenario, picture.assessments, picture.report],
  )
  const assessmentByEntity = useMemo(
    () => new Map(picture.assessments.map((assessment) => [assessment.uasId, assessment])),
    [picture.assessments],
  )
  const groups = GROUPS.map((group) => ({
    ...group,
    entities: scenario.entities.filter((entity) => entity.kind === group.kind),
  })).filter((group) => group.entities.length > 0)
  const threatCount = scenario.entities.filter((entity) => entity.kind === 'uas').length
  const passed = requirements.gates.filter((gate) => gate.status === 'pass').length
  const notEvaluated = requirements.gates.filter((gate) => gate.status === 'not-evaluated').length

  return (
    <div className="inspector-body board-preparation">
      <PanelSection id="prepare-run" title="Run" end={<RunHeadEnd />}>
        <ForecastSettings />
      </PanelSection>

      <PanelSection
        id="prepare-environment"
        collapsible
        title="Environment"
        summary={environmentSummary(scenario, units)}
        end={<EnvironmentEffectsSwitch />}
      >
        <EnvironmentSettings />
      </PanelSection>

      <PanelSection
        id="prepare-doctrine"
        collapsible
        title="Fire control"
        summary={fireSummary(scenario)}
        end={<FireControlInfo />}
      >
        <FireDoctrineSettings launchLabels={LAUNCH_SHORT} />
      </PanelSection>

      <PanelSection
        id="prepare-requirements"
        collapsible
        title="Requirements"
        summary={`${passed} of ${requirements.gates.length} gates met${
          notEvaluated > 0 ? ` · ${notEvaluated} not evaluated` : ''
        } · forecast`}
        end={
          <Info label="About the requirement gates">
            <p>
              Pass lines are inputs the test defines. Met is the forecast result of each gate: the
              deterministic planning envelope. It does not adjudicate the simulated trial.
            </p>
            <p>Open a failed gate to see its blocking tracks.</p>
          </Info>
        }
      >
        <RequirementTable report={requirements} />
      </PanelSection>

      <PanelSection
        id="prepare-entities"
        collapsible
        defaultOpen={false}
        title="Entities"
        summary={`${scenario.entities.length} placed · ${threatCount} threats`}
        end={
          <Info label="About the entities">
            <p>
              Every placed entity with its forecast state. Select a row to select the entity on the
              board; the Selected object tab opens it. The Entities button in the board rail opens
              this section.
            </p>
          </Info>
        }
      >
        {groups.length === 0 ? (
          <p className="prep-note">No entities are placed in this scenario.</p>
        ) : (
          groups.map((group) => (
            <div className="prepare-entity-group" key={group.kind}>
              <div className="prepare-entity-head">
                {group.label} <span className="mono">{group.entities.length}</span>
              </div>
              {group.entities.map((entity) => (
                <EntityRegisterRow
                  key={entity.id}
                  entity={entity}
                  mark={group.mark}
                  assessment={assessmentByEntity.get(entity.id)}
                />
              ))}
            </div>
          ))
        )}
      </PanelSection>
    </div>
  )
}
