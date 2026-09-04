import type { EntityKind } from '../../../model/types'

export { DetailPane } from './DetailPane'

/** True for the four kinds that have a pane: sensor, effector, uas, c2. */
export function hasDetailPane(kind: EntityKind): boolean {
  return kind === 'sensor' || kind === 'effector' || kind === 'uas' || kind === 'c2'
}
