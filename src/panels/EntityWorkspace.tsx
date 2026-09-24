import { modelsForEntity } from '../analysis/fidelity'
import type { SpecModel } from '../model/types'
import { useStore } from '../state/store'
import { nextTabIndex } from '../ui/rovingTabs'
import { DetailPane } from './analysis/detail/DetailPane'
import { DetailOverviewContext } from './analysis/detail/DetailNavigation'
import { Inspector } from './Inspector'
import { LibraryEditor } from './LibraryEditor'
import { EmptyState, Section } from './inspector/kit'

export type EntityWorkspaceSection = 'telemetry' | 'configure' | 'model'

const SECTIONS: Array<{ id: EntityWorkspaceSection; label: string }> = [
  { id: 'telemetry', label: 'Telemetry' },
  { id: 'configure', label: 'Configure' },
  { id: 'model', label: 'Model basis' },
]

/**
 * The Model basis section. It lists the linked instances, so it is the one part of
 * the workspace that subscribes to the entity list.
 */
function ModelBasis({ entityId, model }: { entityId: string; model: SpecModel }) {
  const scenario = useStore((s) => s.scenario)
  const linked = scenario.entities.filter((item) => item.specId === model.id)
  const tags = modelsForEntity(scenario, entityId)
  return (
    <>
      <div className="inspector-body insp entity-model-scope">
        {linked.length > 1 && (
          <Section label="Linked instances" note={linked.length}>
            <p>Edits to this model affect all {linked.length} linked instances.</p>
            <ul aria-label="Linked instances">
              {linked.map((item) => (
                <li key={item.id}>{item.name || 'Unnamed entity'}</li>
              ))}
            </ul>
          </Section>
        )}
        <Section label="Model fidelity">
          {tags.length > 0 ? (
            <div className="fid-tags">
              {tags.map((tag) => (
                <span
                  key={tag.id}
                  className="fid-tag"
                  data-tier={tag.tier}
                  data-validation={tag.validation}
                  title={tag.note}
                >
                  {tag.label} · {tag.tier} · {tag.validation}
                </span>
              ))}
            </div>
          ) : (
            <p>No engine model applies to this entity.</p>
          )}
        </Section>
      </div>
      <LibraryEditor key={model.id} modelId={model.id} />
    </>
  )
}

/**
 * One selected Board entity, with navigation outside its shared scroll region. Each
 * section draws its own object header with the state mark, so the shell draws none.
 */
export function EntityWorkspace({
  entityId,
  section,
  onSectionChange,
  onOverview,
}: {
  entityId: string
  section: EntityWorkspaceSection
  onSectionChange: (section: EntityWorkspaceSection) => void
  onOverview: () => void
  /** Unused since the status bar carries the run state; kept for the shell's call. */
  onOpenSettings?: () => void
}) {
  // Both are stable references between edits, so an edit elsewhere on the board
  // leaves this shell alone.
  const entity = useStore((s) => s.scenario.entities.find((item) => item.id === entityId))
  const library = useStore((s) => s.scenario.library)
  const model = entity?.specId != null ? library.find((m) => m.id === entity.specId) : undefined
  const hasTelemetry = entity && ['sensor', 'effector', 'uas', 'c2'].includes(entity.kind)

  return (
    <div className="entity-workspace">
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
              const next = nextTabIndex(event.key, index, SECTIONS.length)
              if (next < 0) return
              event.preventDefault()
              onSectionChange(SECTIONS[next].id)
              document.getElementById(`entity-section-${SECTIONS[next].id}`)?.focus()
            }}
          >
            {item.label}
          </button>
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
            <EmptyState
              title="Entity unavailable"
              body="This entity is no longer on the board. Return to Overview to choose another entity."
            />
          </div>
        ) : section === 'configure' ? (
          <Inspector entityId={entity.id} />
        ) : section === 'model' ? (
          model ? (
            <ModelBasis entityId={entity.id} model={model} />
          ) : (
            <div className="inspector-body insp">
              <EmptyState
                title="No linked model"
                body="This entity has no available library model. Choose a model in Configure to inspect and edit its shared specification and sources."
              />
              <button className="mini" onClick={() => onSectionChange('configure')}>
                Open Configure
              </button>
            </div>
          )
        ) : hasTelemetry ? (
          <DetailOverviewContext.Provider value={onOverview}>
            <DetailPane entityId={entity.id} />
          </DetailOverviewContext.Provider>
        ) : (
          <div className="inspector-body insp">
            <EmptyState
              title="No telemetry for this entity"
              body="This entity has no dedicated telemetry view. Its configuration and linked model remain available above."
            />
          </div>
        )}
      </div>
    </div>
  )
}
