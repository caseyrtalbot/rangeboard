import { memo, useMemo } from 'react'
import { Group, Line } from 'react-konva'
import type { Laydown } from '../../playback/optimizeTypes'
import { analysisBasisSignature } from '../../state/analysisBasis'
import { currentOptimize } from '../../state/runState'
import { useStore } from '../../state/store'
import { modelFor } from '../../model/scenario'
import { anchoredBlockPos, boardDesignator } from '../labelLayout'
import { useBoardInk } from '../useBoardInk'
import { groundFrameFor } from '../../panels/Glyph'
import { DataBlock, GroundFrame } from './symbols'

/** Screen px; a module constant because Konva compares dash arrays by identity. */
const LEADER_DASH = [4, 4]
/** A candidate this close to the current position draws its marker only, meters. */
const LEADER_MIN_M = 0.5
const MARKER_OPACITY = 0.7

/**
 * The previewed placement candidate: an outline ground frame in the tool ink at each
 * candidate position, a dashed leader from the current position and the short name as
 * a one-line data block where the entity's own block draws.
 * It draws only while the candidate's result is still the current placement result,
 * so a rerun, a new run or a basis change hides it with no clear call. It reads the
 * scenario and never writes to it. Memoized with no props, so a playback frame does not
 * re-render it.
 */
export const PlacementPreviewLayer = memo(function PlacementPreviewLayer() {
  const preview = useStore((s) => s.ui.placementPreview)
  const optimize = useStore((s) => s.mc.optimize)
  const runId = useStore((s) => s.playback.runId)
  const scenario = useStore((s) => s.scenario)
  const k = useStore((s) => s.camera.scale)
  const ink = useBoardInk()
  // The signature hashes the scenario; only a shown preview pays for it.
  const basis = useMemo(
    () => (preview ? analysisBasisSignature(scenario) : null),
    [preview, scenario],
  )
  if (!preview || basis == null) return null
  if (currentOptimize(optimize, runId, basis) !== preview.source) return null
  const positions: Laydown = preview.positions
  return (
    <Group listening={false}>
      {scenario.entities.map((e) => {
        const to = positions[e.id]
        if (!to) return null
        const far = Math.hypot(to.x - e.pos.x, to.y - e.pos.y) >= LEADER_MIN_M
        const lines = [boardDesignator(e.name)]
        return (
          <Group key={e.id}>
            {far && (
              <Line
                points={[e.pos.x, e.pos.y, to.x, to.y]}
                stroke={ink.tool}
                strokeWidth={1}
                strokeScaleEnabled={false}
                dash={LEADER_DASH}
              />
            )}
            <Group x={to.x} y={to.y} scaleX={1 / k} scaleY={1 / k}>
              <Group opacity={MARKER_OPACITY}>
                <GroundFrame
                  frame={groundFrameFor(e.kind, modelFor(scenario, e))}
                  color={ink.tool}
                  board={ink.board}
                  outline
                />
              </Group>
              <DataBlock
                lines={lines}
                pos={anchoredBlockPos(lines, e.kind)}
                color={ink.label}
                board={ink.board}
              />
            </Group>
          </Group>
        )
      })}
    </Group>
  )
})
