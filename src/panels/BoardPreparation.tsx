import { memo, useMemo } from 'react'
import { engagementPicture } from '../analysis/impact'
import { assessRunValidity } from '../analysis/runValidity'
import type { Entity } from '../model/types'
import type { ThreatAssessment } from '../playback/sim'
import { entityActive, runSettings } from '../model/types'
import { KIND_NAMES, formatRunLabel } from '../state/labels'
import { useStore } from '../state/store'
import { State } from '../ui/kit'
import { ObjectHeader, Section } from './inspector/kit'
import { ForecastSettings } from './analysis/ForecastSettings'
import { EnvironmentSettings } from './analysis/EnvironmentSettings'
import { FireDoctrineSettings } from './analysis/FireDoctrineSettings'
import { RequirementSettings } from './analysis/RequirementSettings'
import { FindingThreatActions, SEVERITY_PILL, VALIDITY_TEXT } from './analysis/runValidityText'

/** A finding that names every requirement gate is scenario-wide; its gate line says nothing. */
const ALL_GATE_COUNT = 6

/** Select one placed entity and open its existing Inspector editor. */
function openEntityInspector(entityId: string): void {
  const store = useStore.getState()
  store.select({ entityIds: [entityId] })
  store.setRightTab('inspect')
}

function titleCaseStatus(status: string): string {
  return status
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/** One register row, memoized on the entity and its assessment. */
const EntityRegisterRow = memo(function EntityRegisterRow({
  entity,
  assessment,
}: {
  entity: Entity
  assessment: ThreatAssessment | undefined
}) {
  const state = !entityActive(entity)
    ? 'Disabled'
    : assessment
      ? titleCaseStatus(assessment.status)
      : 'Enabled'
  return (
    <button
      className="board-object prepare-entity"
      type="button"
      aria-label={`Inspect ${entity.name}`}
      onClick={() => openEntityInspector(entity.id)}
    >
      <span className="prepare-entity-name">{entity.name}</span>
      <span className="prepare-entity-meta">{KIND_NAMES[entity.kind]}</span>
      <span className="prepare-entity-state">{state}</span>
    </button>
  )
})

/** The three scenario-input disclosures; each settings form subscribes on its own. */
const PrepareSettings = memo(function PrepareSettings() {
  return (
    <div className="prepare-settings">
      <details id="prepare-environment" className="prepare-setting">
        <summary>Environment</summary>
        <div className="prepare-setting-body">
          <EnvironmentSettings />
        </div>
      </details>
      <details id="prepare-doctrine" className="prepare-setting">
        <summary>Fire doctrine</summary>
        <div className="prepare-setting-body">
          <FireDoctrineSettings />
        </div>
      </details>
      <details id="prepare-requirements" className="prepare-setting">
        <summary>Requirement inputs</summary>
        <div className="prepare-setting-body">
          <RequirementSettings />
        </div>
      </details>
    </div>
  )
})

/** Prepare-stage overview for the current Board scenario and playback run. */
export function BoardPreparation() {
  const scenario = useStore((state) => state.scenario)
  const runSeq = useStore((state) => state.playback.runSeq)
  const picture = useMemo(() => engagementPicture(scenario), [scenario])
  const validity = useMemo(
    () => assessRunValidity(scenario, picture.assessments),
    [scenario, picture.assessments],
  )
  const assessmentByEntity = useMemo(
    () => new Map(picture.assessments.map((assessment) => [assessment.uasId, assessment])),
    [picture.assessments],
  )
  const run = runSettings(scenario)
  const validityText = VALIDITY_TEXT[validity.validity]
  const runLabel = formatRunLabel(runSeq)
  // Setup findings that cost a measurement come first; general model caveats follow.
  const findings = [...validity.findings].sort(
    (a, b) => Number(b.severity === 'invalidating') - Number(a.severity === 'invalidating'),
  )

  return (
    <div className="inspector-body board-preparation">
      <ObjectHeader
        name={scenario.name}
        type={`Board scenario · ${runLabel}`}
        status={validityText.tone}
        statusLabel={validityText.pill}
      />

      <div id="prepare-run" tabIndex={-1}>
        <Section
          label="Forecast and analysis"
          note={run.runMode === 'deterministic' ? 'Envelope' : 'Estimate'}
        >
          <ForecastSettings />
        </Section>
      </div>

      <Section label="Scenario inputs">
        <PrepareSettings />
      </Section>

      <Section label="Run validity" note={`${findings.length} findings`}>
        {findings.length === 0 ? (
          <p className="muted small">{validityText.line}</p>
        ) : (
          <div className="prepare-validity">
            {findings.map((finding) => (
              <article className="prepare-finding validity-finding" key={finding.id}>
                <State tone={SEVERITY_PILL[finding.severity].tone}>
                  {SEVERITY_PILL[finding.severity].text}
                </State>
                <div className="prepare-finding-body">
                  <span>{finding.message}</span>
                  {finding.gates.length > 0 && finding.gates.length < ALL_GATE_COUNT && (
                    <span className="prepare-finding-gates">
                      Gates: {finding.gates.map((gate) => gate.toUpperCase()).join(' · ')}
                    </span>
                  )}
                  <FindingThreatActions finding={finding} entities={scenario.entities} />
                </div>
              </article>
            ))}
          </div>
        )}
      </Section>

      <Section label="Entity register" note={`${scenario.entities.length} placed`}>
        <div className="prepare-entity-register">
          {scenario.entities.length === 0 ? (
            <p className="muted small">No entities are placed in this scenario.</p>
          ) : (
            scenario.entities.map((entity) => (
              <EntityRegisterRow
                key={entity.id}
                entity={entity}
                assessment={assessmentByEntity.get(entity.id)}
              />
            ))
          )}
        </div>
      </Section>
    </div>
  )
}
