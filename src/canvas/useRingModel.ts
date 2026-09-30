import { useEffect, useMemo, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { Store } from '../state/store'
import { useStore } from '../state/store'
import { selectEffectiveLayers } from '../state/selectors'
import type { EntityRings, RingModel } from './ringModel'
import { prepareRingModel } from './ringModel'

/**
 * The store-bound ring model. The footprint layer draws its records; the HUD
 * hit-tests it. Each caller memoizes its own model over the same store fields.
 */
export function useRingModel(): RingModel {
  const scenario = useStore((s) => s.scenario)
  // Field subscriptions, not the whole `ui`: a rebuild runs the Pd bisection per radar.
  const units = useStore((s) => s.ui.units)
  const layers = useStore(useShallow(selectEffectiveLayers))
  const ringOverrides = useStore(useShallow((s) => s.ui.ringOverrides))
  const selectedUasId = useStore(selectedUasIdOf)
  const view = useMemo(() => ({ units, layers, ringOverrides }), [units, layers, ringOverrides])
  // Ring geometry is scenario work, so the 10 Hz sweep is not a key here. A scenario
  // swap rebuilds the records, and a record whose fields did not change keeps its
  // previous object.
  const prevRings = useRef<EntityRings[]>([])
  const model = useMemo(
    // oxlint-disable-next-line react/refs -- the previous records lend their identities
    () => prepareRingModel(scenario, view, selectedUasId, prevRings.current),
    [scenario, view, selectedUasId],
  )
  useEffect(() => {
    prevRings.current = model.rings
  }, [model])

  return model
}

/** The first selected UAS: the threat every ring is computed against. */
function selectedUasIdOf(s: Store): string | null {
  const hit = s.scenario.entities.find(
    (e) => e.kind === 'uas' && s.selection.entityIds.includes(e.id),
  )
  return hit?.id ?? null
}

/**
 * The ring model for one store snapshot, outside React. The stage click asks it
 * whether a ring lies under the pointer; the records come from the shared cache.
 */
export function ringModelOf(s: Store): RingModel {
  const view = {
    units: s.ui.units,
    layers: selectEffectiveLayers(s),
    ringOverrides: s.ui.ringOverrides,
  }
  return prepareRingModel(s.scenario, view, selectedUasIdOf(s))
}
