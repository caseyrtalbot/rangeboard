import { useMemo } from 'react'
import { Circle, Group, Line, Text } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { Scenario, Vec2 } from '../../model/types'
import { useStore } from '../../state/store'
import type { MeasureEnd } from '../../state/store'
import type { LiveTrack } from '../../playback/tracks'
import { threatAltitudeFt } from '../../playback/tracks'
import { measureLines, measureReadout } from '../../geometry/measure'
import type { MeasureTarget } from '../../geometry/measure'
import { LABEL_FONT_PX, LABEL_HALO_PX, LABEL_LINE_H } from '../labelLayout'
import { hoverCursor, releaseHover } from '../hoverCursor'
import { useBoardInk } from '../useBoardInk'

/** Fixed dash array: an inline literal is re-set on every render. */
const DRAFT_DASH = [6, 4]

/** One measurement with both ends at the rendered frame's positions. */
export interface MeasureGeometry {
  /** The pinned measurement id, or null for the rubber band to the cursor. */
  id: string | null
  a: Vec2
  b: Vec2
  /** Point ends draw a dot; an entity end is its own glyph. */
  aPoint: boolean
  bPoint: boolean
  lines: string[]
}

interface Resolved {
  pos: Vec2
  target?: MeasureTarget
}

/** An entity end reads its rendered track; a missing entity drops the measurement. */
function resolveEnd(
  scenario: Scenario,
  tracks: Map<string, LiveTrack>,
  end: MeasureEnd,
): Resolved | null {
  if ('point' in end) return { pos: end.point }
  const entity = scenario.entities.find((e) => e.id === end.entityId)
  if (!entity) return null
  const track = tracks.get(entity.id)
  const pos = track?.pos ?? entity.pos
  if (entity.kind !== 'uas') return { pos }
  return {
    pos,
    target: {
      headingDeg: track?.headingDeg ?? entity.headingDeg,
      altitudeFt: threatAltitudeFt(scenario, entity),
      moving: track?.flying ?? false,
    },
  }
}

/**
 * Pinned measurements and the rubber band, at this frame's positions, so a line on a
 * flying track follows it through playback. The second end is the BRAA target.
 */
export function useMeasureGeometry(
  tracks: Map<string, LiveTrack>,
  mouseWorld: Vec2 | null,
): MeasureGeometry[] {
  const scenario = useStore((s) => s.scenario)
  const measures = useStore((s) => s.ui.measures)
  const measureFrom = useStore((s) => s.ui.measureFrom)
  const tool = useStore((s) => s.ui.tool)
  const units = useStore((s) => s.ui.units)
  return useMemo(() => {
    const out: MeasureGeometry[] = []
    for (const m of measures) {
      const a = resolveEnd(scenario, tracks, m.a)
      const b = resolveEnd(scenario, tracks, m.b)
      if (!a || !b) continue
      out.push({
        id: m.id,
        a: a.pos,
        b: b.pos,
        aPoint: 'point' in m.a,
        bPoint: 'point' in m.b,
        lines: measureLines(measureReadout(a.pos, b.pos, b.target), units),
      })
    }
    if (tool === 'measure' && measureFrom) {
      const a = resolveEnd(scenario, tracks, measureFrom)
      if (a) {
        const b = mouseWorld ?? a.pos
        out.push({
          id: null,
          a: a.pos,
          b,
          aPoint: 'point' in measureFrom,
          bPoint: false,
          lines: measureLines(measureReadout(a.pos, b), units),
        })
      }
    }
    return out
  }, [scenario, tracks, measures, measureFrom, tool, mouseWorld, units])
}

/** The measurement lines, under the glyphs, so a frame's knockout covers each end. */
export function MeasureLineLayer({ geometry }: { geometry: MeasureGeometry[] }) {
  const ink = useBoardInk()
  const k = useStore((s) => s.camera.scale)
  if (geometry.length === 0) return null
  return (
    <Group listening={false}>
      {geometry.map((g) => (
        <Group key={g.id ?? 'draft'}>
          <Line
            points={[g.a.x, g.a.y, g.b.x, g.b.y]}
            stroke={ink.tool}
            strokeWidth={1.5}
            dash={g.id ? undefined : DRAFT_DASH}
            strokeScaleEnabled={false}
          />
          {g.aPoint && <Circle x={g.a.x} y={g.a.y} radius={3 / k} fill={ink.tool} />}
          {g.bPoint && <Circle x={g.b.x} y={g.b.y} radius={3 / k} fill={ink.tool} />}
        </Group>
      ))}
    </Group>
  )
}

function readoutHover(e: KonvaEventObject<MouseEvent>, id: string) {
  const on = e.type === 'mouseenter' && useStore.getState().ui.tool === 'measure'
  hoverCursor(id, e.target.getStage()!.container(), on)
}

/**
 * The readouts, over the data blocks: a pinned one at its line's midpoint, the rubber
 * band's beside the cursor. Under the Measure tool a click on a pinned readout removes it.
 */
export function MeasureReadoutLayer({ geometry }: { geometry: MeasureGeometry[] }) {
  const ink = useBoardInk()
  const k = useStore((s) => s.camera.scale)
  const removable = useStore((s) => s.ui.tool === 'measure')
  if (geometry.length === 0) return null
  return (
    <>
      {geometry.map((g) => {
        const at = g.id ? { x: (g.a.x + g.b.x) / 2, y: (g.a.y + g.b.y) / 2 } : g.b
        const listening = removable && g.id != null
        return (
          <Group
            key={g.id ?? 'draft'}
            x={at.x}
            y={at.y}
            scaleX={1 / k}
            scaleY={1 / k}
            listening={listening}
            onMouseEnter={g.id ? (e) => readoutHover(e, g.id!) : undefined}
            onMouseLeave={g.id ? (e) => readoutHover(e, g.id!) : undefined}
            onClick={
              g.id
                ? (e) => {
                    e.cancelBubble = true
                    releaseHover(g.id!)
                    useStore.getState().removeMeasure(g.id!)
                  }
                : undefined
            }
          >
            {g.lines.map((line, i) => (
              <Text
                key={i}
                fontFamily="JetBrains Mono"
                x={10}
                y={-6 - (g.lines.length - i) * LABEL_LINE_H}
                text={line}
                fontSize={LABEL_FONT_PX}
                fill={ink.tool}
                // The same glyph halo as a data block, so the line under it stays legible.
                stroke={ink.board}
                strokeWidth={LABEL_HALO_PX}
                lineJoin="round"
                fillAfterStrokeEnabled
                wrap="none"
              />
            ))}
          </Group>
        )
      })}
    </>
  )
}
