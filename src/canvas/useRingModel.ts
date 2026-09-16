import { useEffect, useMemo, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useStore } from '../state/store'
import { selectEffectiveLayers } from '../state/selectors'
import type { EntityRings, RingModel } from './ringModel'
import { prepareRingModel } from './ringModel'

/**
 * The store-bound ring model. The footprint layer draws its records; the HUD
 * hit-tests it. Each caller memoizes its own model over the same five store
 * fields, so the two stay in step on every scenario, view or selection change.
 */
export function useRingModel(): RingModel {
  const scenario = useStore((s) => s.scenario)
  // Field subscriptions, not the whole `ui`: an unrelated ui action must not
  // rebuild the rings, which run the Pd bisection per radar.
  const units = useStore((s) => s.ui.units)
  const layers = useStore(useShallow(selectEffectiveLayers))
  const ringOverrides = useStore(useShallow((s) => s.ui.ringOverrides))
  const selectedUasId = useStore((s) => {
    const hit = s.scenario.entities.find(
      (e) => e.kind === 'uas' && s.selection.entityIds.includes(e.id),
    )
    return hit?.id ?? null
  })
  const view = useMemo(() => ({ units, layers, ringOverrides }), [units, layers, ringOverrides])
  // Ring geometry is scenario work, so it must not run on a playback frame.
  // The sweep reaches the footprint layer as a sensor-id set, which changes at
  // the 10 Hz publication and is not a key here. A scenario swap (an edit, an
  // undo) rebuilds the records, and every record whose fields did not change
  // keeps its previous object, so the memoized nodes re-render only for the
  // entity that changed.
  const prevRings = useRef<EntityRings[]>([])
  const model = useMemo(
    // oxlint-disable-next-line react/refs -- the previous records lend identities; one render stale by design
    () => prepareRingModel(scenario, view, selectedUasId, prevRings.current),
    [scenario, view, selectedUasId],
  )
  useEffect(() => {
    prevRings.current = model.rings
  }, [model])

  return model
}
