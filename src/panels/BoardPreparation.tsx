import { memo, useMemo } from 'react'
import { engagementPicture } from '../analysis/impact'
import type { RunValidityFinding } from '../analysis/runValidity'
import { assessRunValidity } from '../analysis/runValidity'
import type { Entity } from '../model/types'
import type { ThreatAssessment } from '../playback/sim'
import { entityActive, runSettings } from '../model/types'
import { KIND_NAMES, formatRunLabel } from '../state/labels'
import { useStore } from '../state/store'
import { State } from '../ui/kit'
import { Actions, ObjectHeader, Row, Section } from './inspector/kit'
import { ForecastSettings } from './analysis/ForecastSettings'
import { EnvironmentSettings } from './analysis/EnvironmentSettings'
import { FireDoctrineSettings } from './analysis/FireDoctrineSettings'
import { RequirementSettings } from './analysis/RequirementSettings'
import { FindingThreatActions, SEVERITY_PILL, VALIDITY_TEXT } from './analysis/runValidityText'

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

function findingEntityScope(finding: RunValidityFinding, entities: Entity[]): string {
  if (finding.uasIds.length === 0) return 'Scenario-wide'
  return finding.uasIds
    .map((id) => {
      const name = entities.find((entity) => entity.id === id)?.name
      return name ? `${name} · ${id}` : id
    })
    .join(', ')
}

/**
 * One register row. Memoized on the entity and its assessment, so an undo that moves
 * one entity re-renders one row, not the whole register.
 */
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
      <span className="prepare-entity-meta">
        {KIND_NAMES[entity.kind]} · {entity.id}
      </span>
      <span className="prepare-entity-state">{state}</span>
    </button>
  )
})

/**
 * The three scenario-input disclosures. Each settings form subscribes on its own, so
 * this memoized shell keeps a Prepare re-render from re-creating their elements.
 */
const PrepareSettings = memo(function PrepareSettings() {
  return (
    <div className="prepare-settings">
      <details id="prepare-environment" className="prepare-setting">
        <summary>Environment</summary>
        <div className="prepare-setting-body">
          <p className="prepare-setting-impact muted small">
            Scenario · Conditions affect modeled sensor performance and threat reach when
            effects are enabled.
          </p>
          <EnvironmentSettings />
        </div>
      </details>
      <details id="prepare-doctrine" className="prepare-setting">
        <summary>Fire doctrine</summary>
        <div className="prepare-setting-body">
          <p className="prepare-setting-impact muted small">
            Scenario · ROE and doctrine govern modeled engagement eligibility and timing.
          </p>
          <FireDoctrineSettings />
        </div>
      </details>
      <details id="prepare-requirements" className="prepare-setting">
        <summary>Requirement inputs</summary>
        <div className="prepare-setting-body">
          <p className="prepare-setting-impact muted small">
            Scenario · Operator-defined thresholds; unspecified inputs remain unspecified.
          </p>
          <RequirementSettings />
        </div>
      </details>
    </div>
  )
})

/** Prepare-stage overview for the current Board scenario and playback run. */
export function BoardPreparation() {
  const scenario = useStore((state) => state.scenario)
  const runId = useStore((state) => state.playback.runId)
  const runSeq = useStore((state) => state.playback.runSeq)
  const runPhase = useStore((state) => state.playback.phase)
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
  // Keep general model caveats in the disclosure; surface setup consequences first.
  const consequentialFindings = validity.findings
    .filter((finding) => finding.id !== 'planning-envelope' && finding.id !== 'unvalidated-model')
    .sort((a, b) => Number(b.severity === 'invalidating') - Number(a.severity === 'invalidating'))

  return (
    <div className="inspector-body board-preparation">
      <ObjectHeader
        name={scenario.name}
        type={`Board scenario · ${runLabel}`}
        status={validityText.tone}
        statusLabel={validityText.pill}
      />

      <Section label="Scenario and run scope">
        <Row label="Scenario" value={scenario.name} />
        <Row label="Playback run" value={runLabel} />
        <Row label="Run ID" value={runId} />
        <Row label="Lifecycle" value={titleCaseStatus(runPhase)} />
        <Row label="Threats assessed" value={picture.assessments.length} />
      </Section>

      <div id="prepare-run" tabIndex={-1}>
        <Section
          label="Forecast and analysis"
          note={run.runMode === 'deterministic' ? 'Envelope' : 'Estimate'}
        >
          <p className="prepare-setting-impact muted small">
            Forecast mode, seed and uncertainty settings.
            Analysis-affecting changes reset playback and mark estimates stale.
          </p>
          <ForecastSettings />
        </Section>
      </div>

      <Section label="Scenario inputs">
        <PrepareSettings />
      </Section>

      <Section label="Run validity" note={`${validity.findings.length} findings`}>
        <div className="prepare-validity">
          {consequentialFindings.map((finding) => (
            <article className="prepare-finding validity-finding" key={finding.id}>
              <State tone={SEVERITY_PILL[finding.severity].tone}>
                {SEVERITY_PILL[finding.severity].text}
              </State>
              <div className="prepare-finding-body">
                <span>{finding.message}</span>
                <FindingThreatActions finding={finding} entities={scenario.entities} />
              </div>
            </article>
          ))}
        </div>
        <details className="prepare-validity-disclosure">
          <summary>
            <State tone={validityText.tone}>{validityText.pill}</State>
            <span>{validityText.line}</span>
          </summary>
          <div className="prepare-validity">
            {validity.findings.map((finding) => {
              const severity = SEVERITY_PILL[finding.severity]
              return (
                <article className="prepare-finding validity-finding" key={finding.id}>
                  <State tone={severity.tone}>{severity.text}</State>
                  <div className="prepare-finding-body">
                    {!consequentialFindings.includes(finding) && <span>{finding.message}</span>}
                    <dl className="prepare-finding-scope">
                      <div>
                        <dt>Finding</dt>
                        <dd>{finding.id}</dd>
                      </div>
                      <div>
                        <dt>Gates</dt>
                        <dd>{finding.gates.map((gate) => gate.toUpperCase()).join(' · ')}</dd>
                      </div>
                      <div>
                        <dt>Affected</dt>
                        <dd>{findingEntityScope(finding, scenario.entities)}</dd>
                      </div>
                    </dl>
                  </div>
                </article>
              )
            })}
          </div>
        </details>
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

      <Section label="Continue preparation">
        <Actions>
          <button type="button" onClick={() => useStore.getState().setRightTab('cards')}>
            Open Test cards
          </button>
          <button type="button" onClick={() => useStore.getState().setRightTab('library')}>
            Open Library
          </button>
        </Actions>
      </Section>
    </div>
  )
}
