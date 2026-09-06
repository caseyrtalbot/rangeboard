import { modelsForEntity } from '../analysis/fidelity'
import { modelFor } from '../model/scenario'
import { useStore } from '../state/store'
import { DetailPane } from './analysis/detail/DetailPane'
import { DetailOverviewContext } from './analysis/detail/DetailNavigation'
import { LiveStrip } from './analysis/LiveStrip'
import { Inspector } from './Inspector'
import { LibraryEditor } from './LibraryEditor'
import { EmptyState, Section } from './inspector/kit'

export type EntityWorkspaceSection = 'telemetry' | 'configure' | 'model'

const SECTIONS: Array<{ id: EntityWorkspaceSection; label: string }> = [
  { id: 'telemetry', label: 'Telemetry' },
  { id: 'configure', label: 'Configure' },
  { id: 'model', label: 'Model basis' },
]

/** One selected Board entity, with navigation outside its shared scroll region. */
export function EntityWorkspace({
  entityId,
  section,
  onSectionChange,
  onOverview,
  onOpenSettings,
}: {
  entityId: string
  section: EntityWorkspaceSection
  onSectionChange: (section: EntityWorkspaceSection) => void
  onOverview: () => void
  onOpenSettings?: () => void
}) {
  const scenario = useStore((s) => s.scenario)
  const entity = scenario.entities.find((item) => item.id === entityId)
  const model = entity ? modelFor(scenario, entity) : undefined
  const linked = model ? scenario.entities.filter((item) => item.specId === model.id) : []
  const tags = model ? modelsForEntity(scenario, entityId) : []
  const hasTelemetry = entity && ['sensor', 'effector', 'uas', 'c2'].includes(entity.kind)

  return (
    <div className="entity-workspace">
      <div className="entity-workspace-header">
        <button className="mini" onClick={onOverview}>‹ Overview</button>
        <div>
          <h2>{entity?.name || (entity ? 'Unnamed entity' : 'Entity unavailable')}</h2>
          <p>{entity ? `${entity.kind} · ${model?.name ?? 'No linked model'}` : entityId}</p>
        </div>
      </div>
      <div className="entity-workspace-tabs" role="tablist" aria-label="Entity workspace sections">
        {SECTIONS.map((item, index) => (
          <button
            key={item.id}
            id={`entity-section-${item.id}`}
            role="tab"
            aria-selected={section === item.id}
            aria-controls="entity-workspace-content"
            tabIndex={section === item.id ? 0 : -1}
            className={section === item.id ? 'active' : ''}
            onClick={() => onSectionChange(item.id)}
            onKeyDown={(event) => {
              let next = index
              if (event.key === 'ArrowRight') next = (index + 1) % SECTIONS.length
              else if (event.key === 'ArrowLeft') next = (index + SECTIONS.length - 1) % SECTIONS.length
              else if (event.key === 'Home') next = 0
              else if (event.key === 'End') next = SECTIONS.length - 1
              else return
              event.preventDefault()
              onSectionChange(SECTIONS[next].id)
              document.getElementById(`entity-section-${SECTIONS[next].id}`)?.focus()
            }}
          >{item.label}</button>
        ))}
      </div>
      <div
        id="entity-workspace-content"
        className="entity-workspace-scroll"
        role="tabpanel"
        aria-labelledby={`entity-section-${section}`}
        tabIndex={0}
      >
        {!entity ? (
          <div className="inspector-body insp">
            <EmptyState title="Entity unavailable" body="This entity is no longer on the board. Return to Overview to choose another entity." />
          </div>
        ) : section === 'configure' ? (
          <Inspector entityId={entity.id} />
        ) : section === 'model' ? model ? (
          <>
            <div className="inspector-body insp entity-model-scope">
              <Section label="Shared model">
                <p>{model.name}</p>
                <p>Edits to this model affect all {linked.length} linked {linked.length === 1 ? 'instance' : 'instances'}.</p>
                <ul aria-label="Linked instances">
                  {linked.map((item) => <li key={item.id}>{item.name || 'Unnamed entity'} · {item.id}</li>)}
                </ul>
                <p>Deleting this model removes the link from these instances. Their board configuration remains.</p>
              </Section>
              <Section label="Model fidelity">
                {tags.length > 0 ? tags.map((tag) => (
                  <div key={tag.id}>
                    <span className="fid-tag" data-tier={tag.tier} data-validation={tag.validation} title={tag.note}>
                      {tag.label} · {tag.tier} · {tag.validation}
                    </span>
                    <p>{tag.note}</p>
                  </div>
                )) : <p>No active engine fidelity tags apply to this entity.</p>}
              </Section>
            </div>
            <LibraryEditor key={model.id} modelId={model.id} />
          </>
        ) : (
          <div className="inspector-body insp">
            <EmptyState title="No linked model" body="This entity has no available library model. Choose a model in Configure to inspect and edit its shared specification and sources." />
            <button className="mini" onClick={() => onSectionChange('configure')}>Open Configure</button>
          </div>
        ) : (
          <>
            <LiveStrip onOpenSettings={onOpenSettings} />
            {hasTelemetry ? (
              <DetailOverviewContext.Provider value={onOverview}>
                <DetailPane entityId={entity.id} />
              </DetailOverviewContext.Provider>
            ) : (
              <div className="inspector-body insp">
                <EmptyState title="No telemetry for this entity" body="This entity has no dedicated telemetry view. Its configuration and linked model remain available above." />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
