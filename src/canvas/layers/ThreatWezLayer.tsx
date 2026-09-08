import { memo, useEffect, useMemo, useRef } from 'react'
import { Circle, Group, Line, RegularPolygon, Text } from 'react-konva'
import { useStore } from '../../state/store'
import { selectEffectiveLayers } from '../../state/selectors'
import type { TrialResultView } from '../../analysis/trialResult'
import { trialTrackStatesAt } from '../../playback/trialTrackState'
import { entityActive } from '../../model/types'
import type { LiveTrack } from '../../playback/tracks'
import type { ImpactSeverity, ThreatWez } from '../../analysis/impact'
import { SEVERITY_LABEL, severityFor, threatWezList, wezKindFor, wezRadiusM } from '../../analysis/impact'
import type { DisplayUnits } from '../../geometry/geo'
import { formatDistance } from '../../geometry/geo'
import { DANGER_INK } from '../../ui/ink'

const MONO = 'JetBrains Mono'

/** Fixed dash and point arrays: an inline literal is re-set on every render. */
const WEZ_DASH = [3, 3]
const IMPACT_X_DOWN = [-5, -5, 5, 5]
const IMPACT_X_UP = [-5, 5, 5, -5]

export interface TrialArrival {
  uasId: string
  assetId: string
  arrivalS: number
  ships: number
  warheadKg: number | null
  severity: ImpactSeverity
}

/** Realized leakage credit survives later hard or mission kills. */
// oxlint-disable-next-line react/only-export-components
export function visibleImpactArrivals(trial: TrialResultView | null, horizonS: number | null): TrialArrival[] {
  if (!trial || horizonS == null || !trial.hasActiveAsset) return []
  const arrivals: TrialArrival[] = []
  for (const track of trialTrackStatesAt(trial, horizonS)) {
    const ships = track.members.filter(member => member.leakageCredit).length
    if (!ships) continue
    const assessment = trial.assessments.find(a => a.uasId === track.entity.id)
    const assetId = assessment?.assetId
    if (!assetId || assessment.arrivalS == null) continue
    const asset = trial.scenario.entities.find(e => e.id === assetId && e.kind === 'asset' && entityActive(e))
    if (!asset) continue
    const model = trial.scenario.library.find(m => m.id === track.entity.specId)
    if (wezKindFor(model) === 'none') continue
    const radius = wezRadiusM(model)
    const inside = assessment.cpaAssetId === assetId && (radius == null || (assessment.cpaDistanceM != null && assessment.cpaDistanceM <= radius))
    const kg = model?.uas?.warheadKg
    const warheadKg = kg == null ? null : kg * ships
    const severity = severityFor(inside, ships, warheadKg ?? 0)
    if (severity) arrivals.push({ uasId: track.entity.id, assetId, arrivalS: assessment.arrivalS, ships, warheadKg, severity })
  }
  return arrivals.sort((a, b) => a.arrivalS - b.arrivalS)
}

function badgeText(severity: ImpactSeverity, ships: number, kg: number, unknown = false): string {
  const parts = [`I&W ${SEVERITY_LABEL[severity]}`, `${ships} members`]
  if (kg > 0) parts.push(unknown ? `>= ${Math.round(kg)} kg` : `${Math.round(kg)} kg`)
  else parts.push('warhead unknown')
  return parts.join(' · ')
}

function sameWez(a: ThreatWez, b: ThreatWez): boolean {
  return (
    a.uasId === b.uasId &&
    a.kind === b.kind &&
    a.radiusM === b.radiusM &&
    a.hasPath === b.hasPath &&
    a.count === b.count &&
    a.planCenter.x === b.planCenter.x &&
    a.planCenter.y === b.planCenter.y
  )
}

/** Fresh zones keep the previous object where nothing changed, so a ring memo holds across a swap. */
function stableWez(next: ThreatWez[], prev: ThreatWez[]): ThreatWez[] {
  if (prev.length === 0) return next
  const byId = new Map(prev.map((w) => [w.uasId, w]))
  let reused = 0
  const out = next.map((w) => {
    const old = byId.get(w.uasId)
    if (!old || !sameWez(w, old)) return w
    reused++
    return old
  })
  return reused === next.length && prev.length === next.length ? prev : out
}

/**
 * WEZ caption. 'PF' = planning factor (expanded in the Analysis panel's About
 * section): both the impact radii and the stored standoff ranges are planning
 * factors, not study-derived lethality data.
 */
function wezLabel(
  wez: ThreatWez,
  warheadKg: number | null | undefined,
  units: DisplayUnits,
): string {
  if (wez.kind === 'standoff') return `WEZ · standoff ${formatDistance(wez.radiusM, units)} · PF`
  const parts = [`WEZ · r ${formatDistance(wez.radiusM, units)}`]
  if (warheadKg != null) parts.push(`${warheadKg} kg`)
  parts.push('PF')
  if (wez.count > 1) parts.push(`×${wez.count}`)
  return parts.join(' · ')
}

/**
 * Constant-px red warning triangle with '!', optional leaker count and label.
 * Memoized on primitives: only a SEVERE badge takes a pulse, so the other
 * badges re-render on no frame once their fade-in is complete.
 */
const Badge = memo(function Badge({
  k,
  x,
  y,
  xOffPx,
  opacity,
  severity,
  count,
  label,
  pulse,
}: {
  k: number
  x: number
  y: number
  xOffPx: number
  opacity: number
  severity: ImpactSeverity
  count: number
  label: string
  pulse: number | null
}) {
  return (
    <Group x={x} y={y} scaleX={1 / k} scaleY={1 / k} opacity={opacity}>
      <Group x={xOffPx} y={-26}>
        {severity === 'severe' && pulse != null && (
          <Circle radius={15 + 4 * pulse} stroke={DANGER_INK} strokeWidth={2} opacity={0.8 - 0.5 * pulse} />
        )}
        <RegularPolygon sides={3} radius={11} fill={DANGER_INK} />
        <Text
          text="!"
          fontFamily={MONO}
          fontStyle="bold"
          fontSize={12}
          fill="#f4ede2"
          x={-11}
          y={-6}
          width={22}
          align="center"
        />
        {count > 1 && <Text text={`×${count}`} fontFamily={MONO} fontSize={10} fill={DANGER_INK} x={13} y={-9} />}
        <Text
          text={label}
          fontFamily={MONO}
          fontSize={10}
          fill={DANGER_INK}
          x={-100}
          y={14}
          width={200}
          align="center"
        />
      </Group>
    </Group>
  )
})

/**
 * One WEZ: the faint fill, the dashed ring, the impact mark and the caption.
 * Memoized on the zone, its live centre and its caption, so a frame re-renders
 * only the standoff rings that ride a moving track.
 */
const WezRing = memo(function WezRing({ wez, cx, cy, label, k }: {
  wez: ThreatWez
  cx: number
  cy: number
  label: string
  k: number
}) {
  return (
    <Group opacity={wez.hasPath ? 1 : 0.5}>
      <Circle x={cx} y={cy} radius={wez.radiusM} fill={DANGER_INK} opacity={0.07} />
      <Circle
        x={cx}
        y={cy}
        radius={wez.radiusM}
        stroke={DANGER_INK}
        strokeWidth={1.5}
        dash={WEZ_DASH}
        strokeScaleEnabled={false}
        opacity={0.85}
      />
      {wez.kind === 'impact' && (
        <Group x={wez.planCenter.x} y={wez.planCenter.y} scaleX={1 / k} scaleY={1 / k}>
          <Line points={IMPACT_X_DOWN} stroke={DANGER_INK} strokeWidth={1.5} />
          <Line points={IMPACT_X_UP} stroke={DANGER_INK} strokeWidth={1.5} />
        </Group>
      )}
      <Group x={cx} y={cy + wez.radiusM} scaleX={1 / k} scaleY={1 / k}>
        <Text
          text={label}
          fontFamily={MONO}
          fontSize={10}
          fill={DANGER_INK}
          x={-110}
          y={6}
          width={220}
          align="center"
          opacity={0.9}
        />
      </Group>
    </Group>
  )
})

/** Configured WEZ geometry plus horizon-bounded, realized arrival badges. */
export function ThreatWezLayer({
  tracks,
  trial,
  horizonS,
  displayTimeS,
}: {
  tracks: Map<string, LiveTrack>
  trial: TrialResultView | null
  horizonS: number | null
  /** The canvas frame clock's display time. Drives the badge gate, fade and pulse. */
  displayTimeS: number
}) {
  const scenario = useStore((s) => s.scenario)
  // Only the scale is read; the stage transform carries the pan.
  const k = useStore((s) => s.camera.scale)
  const show = useStore((s) => selectEffectiveLayers(s).threatWez)
  const units = useStore((s) => s.ui.units)

  // A scenario swap rebuilds the zones; a zone whose fields did not change
  // keeps its previous object, so its memoized ring re-renders only on a zoom.
  const prevWez = useRef<ThreatWez[]>([])
  const wezList = useMemo(
    // eslint-disable-next-line react/refs -- the previous zones lend identities; one render stale by design
    () => stableWez(threatWezList(scenario), prevWez.current),
    [scenario],
  )
  useEffect(() => {
    prevWez.current = wezList
  }, [wezList])
  const entityById = (id: string | null) =>
    id == null ? undefined : scenario.entities.find((e) => e.id === id)

  // Captions are scenario and unit work, so they are built once per zone list
  // and never on a frame.
  const wezLabels = useMemo(() => {
    const out = new Map<string, string>()
    for (const wez of wezList) {
      const owner = scenario.entities.find((e) => e.id === wez.uasId)
      const uas = scenario.library.find((m) => m.id === owner?.specId)?.uas
      out.set(wez.uasId, wezLabel(wez, uas?.warheadKg, units))
    }
    return out
  }, [wezList, scenario, units])

  // Playback: a badge per arrived leaker, stacked per asset in arrival order.
  const liveBadges = useMemo(() => {
    const arrived = visibleImpactArrivals(trial, horizonS == null ? null : Math.min(displayTimeS, horizonS))
    const stackIndex = new Map<string, number>()
    return arrived.map((i) => {
      const idx = stackIndex.get(i.assetId!) ?? 0
      stackIndex.set(i.assetId!, idx + 1)
      return { impact: i, stack: idx }
    })
  }, [trial, displayTimeS, horizonS])

  const pulse = 0.5 + 0.5 * Math.sin(displayTimeS * Math.PI)

  return (
    <Group listening={false}>
      {show &&
        wezList.map((wez) => {
          const center =
            wez.kind === 'standoff'
              ? (tracks.get(wez.uasId)?.pos ?? wez.planCenter)
              : wez.planCenter
          return (
            <WezRing
              key={wez.uasId}
              wez={wez}
              cx={center.x}
              cy={center.y}
              label={wezLabels.get(wez.uasId) ?? ''}
              k={k}
            />
          )
        })}
      {liveBadges.map(({ impact: i, stack }) => {
        const asset = entityById(i.assetId)
        if (!asset) return null
        // Fade the badge in over the first second after arrival.
        const fade = Math.min(1, Math.max(0.15, (horizonS ?? 0) - i.arrivalS))
        return (
          <Badge
            key={i.uasId}
            k={k}
            x={asset.pos.x}
            y={asset.pos.y}
            xOffPx={stack * 30}
            opacity={fade}
            severity={i.severity!}
            count={i.ships}
            label={badgeText(i.severity, i.ships, i.warheadKg ?? 0, i.warheadKg == null)}
            // Only a SEVERE badge draws the pulse ring, so only it takes the phase.
            pulse={i.severity === 'severe' ? pulse : null}
          />
        )
      })}
    </Group>
  )
}
