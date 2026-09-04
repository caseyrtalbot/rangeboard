import { useStore } from '../../../state/store'
import { EffectorDetail } from './EffectorDetail'
import { SensorDetail } from './SensorDetail'
import { SystemDetail } from './SystemDetail'
import { ThreatDetail } from './ThreatDetail'

/** The detail pane of one selected entity; null for a kind with no pane or an unknown id. */
export function DetailPane({ entityId }: { entityId: string }) {
  const entity = useStore((s) => s.scenario.entities.find((e) => e.id === entityId))
  if (!entity) return null
  switch (entity.kind) {
    case 'sensor':
      return <SensorDetail entity={entity} />
    case 'effector':
      return <EffectorDetail entity={entity} />
    case 'uas':
      return <ThreatDetail entity={entity} />
    case 'c2':
      return <SystemDetail entity={entity} />
    default:
      return null
  }
}
