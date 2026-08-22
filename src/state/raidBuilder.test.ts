import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from './store'
import { emptyScenario } from '../model/seed'
import { fanAxes } from '../playback/tactics'
import { bearingDeg, dist } from '../geometry/geo'

function reset() {
  useStore.getState().replaceScenario(emptyScenario())
}

/** Place the seed asset model at the given point, return its entity id. */
function placeAsset(x = 0, y = 0): string {
  useStore.getState().addEntityFromModel('lib-asset', { x, y })
  return useStore.getState().scenario.entities.at(-1)!.id
}

describe('tactic raid builder: draft lifecycle', () => {
  beforeEach(reset)

  it('armRaidDraft prefills platform, sole asset target, and ship count', () => {
    const assetId = placeAsset()
    useStore.getState().armRaidDraft('RUS-TAC-02')
    const draft = useStore.getState().ui.raidDraft!
    expect(draft.tacticId).toBe('RUS-TAC-02')
    expect(draft.platformSpecId).toBe('lib-fpv7')
    expect(draft.targetEntityId).toBe(assetId)
    expect(draft.shipCount).toBe(8)
  })

  it('with two assets the target stays unset', () => {
    placeAsset(0, 0)
    placeAsset(5000, 0)
    useStore.getState().armRaidDraft('RUS-TAC-02')
    expect(useStore.getState().ui.raidDraft!.targetEntityId).toBeNull()
  })

  it('a generic tactic defaults to the last-placed UAS model', () => {
    placeAsset()
    useStore.getState().addEntityFromModel('lib-fpv7', { x: 1000, y: 0 })
    useStore.getState().addEntityFromModel('lib-mavic3', { x: 2000, y: 0 })
    useStore.getState().armRaidDraft('GEN-WAVE')
    expect(useStore.getState().ui.raidDraft!.platformSpecId).toBe('lib-mavic3')
  })

  it('cancelRaidDraft clears the draft without touching the scenario or history', () => {
    placeAsset()
    const before = useStore.getState()
    useStore.getState().armRaidDraft('RUS-TAC-02')
    useStore.getState().patchRaidDraft({ shipCount: 4 })
    useStore.getState().cancelRaidDraft()
    const after = useStore.getState()
    expect(after.ui.raidDraft).toBeNull()
    expect(after.scenario).toBe(before.scenario)
    expect(after.past).toHaveLength(before.past.length)
  })

  it('Esc (cancelDraft) and a tool change both disarm the draft', () => {
    placeAsset()
    useStore.getState().armRaidDraft('RUS-TAC-02')
    useStore.getState().cancelDraft()
    expect(useStore.getState().ui.raidDraft).toBeNull()

    useStore.getState().armRaidDraft('RUS-TAC-02')
    useStore.getState().setTool('boundary')
    expect(useStore.getState().ui.raidDraft).toBeNull()
  })
})

describe('tactic raid builder: commitRaid', () => {
  beforeEach(reset)

  it('a single-axis tactic builds ships, paths, and waves in one undo step', () => {
    const assetId = placeAsset()
    const target = useStore.getState().scenario.entities.find((e) => e.id === assetId)!
    useStore.getState().armRaidDraft('RUS-TAC-02')
    const pastBefore = useStore.getState().past.length

    useStore.getState().commitRaid(null)

    const st = useStore.getState()
    const ships = st.scenario.entities.filter((e) => e.kind === 'uas')
    expect(ships).toHaveLength(8)
    expect(st.scenario.entities).toHaveLength(9)
    expect(st.scenario.paths).toHaveLength(8)
    // Names: "<designator> <n>" with the raid ship number.
    expect(ships[0].name).toBe('THR-G1-FPV-01 1')
    expect(ships[7].name).toBe('THR-G1-FPV-01 8')
    // Two-point paths from origin to the target.
    for (const p of st.scenario.paths) {
      expect(p.points).toHaveLength(2)
      expect(p.points[1]).toEqual(target.pos)
    }
    // 8 ships in waves of 2 at 120 s spacing.
    const waves = st.scenario.raid!.waves
    expect(waves).toHaveLength(4)
    expect(waves.map((w) => w.startDelayS)).toEqual([0, 120, 240, 360])
    expect(waves.every((w) => w.entityIds.length === 2)).toBe(true)
    // Ships spawn at or beyond the tactic standoff (no sensors placed).
    for (const s of ships) {
      expect(dist(target.pos, s.pos)).toBeGreaterThanOrEqual(8000 - 1e-6)
    }
    // One mutate: exactly one history step, cleared draft.
    expect(st.past).toHaveLength(pastBefore + 1)
    expect(st.ui.raidDraft).toBeNull()

    useStore.getState().undo()
    const undone = useStore.getState().scenario
    expect(undone.entities).toHaveLength(1)
    expect(undone.paths).toHaveLength(0)
    expect(undone.raid?.waves ?? []).toHaveLength(0)
  })

  it('formation spacing separates ships inside a wave', () => {
    placeAsset()
    useStore.getState().armRaidDraft('RUS-TAC-02')
    useStore.getState().commitRaid(null)
    const ships = useStore.getState().scenario.entities.filter((e) => e.kind === 'uas')
    const waves = useStore.getState().scenario.raid!.waves
    for (const w of waves) {
      const [a, b] = w.entityIds.map((id) => ships.find((s) => s.id === id)!)
      // RUS-TAC-02 flies FPV pairs in line at 75 m.
      expect(dist(a.pos, b.pos)).toBeCloseTo(75, 5)
    }
  })

  it('a multi-axis tactic fans origins around the clicked bearing', () => {
    const assetId = placeAsset(0, 0)
    const target = useStore.getState().scenario.entities.find((e) => e.id === assetId)!
    useStore.getState().addEntityFromModel('lib-fpv7', { x: 500, y: 500 })
    useStore.getState().armRaidDraft('GEN-MULTI-AXIS')
    useStore.getState().patchRaidDraft({ platformSpecId: 'lib-fpv7', targetEntityId: assetId })

    // Click south of the target: ingress bearing 0 (north-bound).
    useStore.getState().commitRaid({ x: 0, y: 10000 })

    const st = useStore.getState().scenario
    const ships = st.entities.filter((e) => e.kind === 'uas' && e.name.startsWith('THR-G1-FPV-01'))
    expect(ships).toHaveLength(6)
    // One simultaneous wave of six.
    const newWaves = st.raid!.waves
    expect(newWaves).toHaveLength(1)
    expect(newWaves[0].entityIds).toHaveLength(6)
    expect(newWaves[0].startDelayS).toBe(0)
    // Origins sit on the reciprocals of fanAxes(0, 3, 120) = [300, 0, 60].
    const expected = fanAxes(0, 3, 120).map((b) => (b + 180) % 360)
    const seen = ships.map((s) => Math.round(bearingDeg(target.pos, s.pos)) % 360)
    for (const b of expected) {
      expect(seen.filter((x) => x === b)).toHaveLength(2)
    }
    // Ships without a tactic formation trail in column, never stacked.
    const byBearing = new Map<number, number[]>()
    ships.forEach((s) => {
      const b = Math.round(bearingDeg(target.pos, s.pos)) % 360
      byBearing.set(b, [...(byBearing.get(b) ?? []), dist(target.pos, s.pos)])
    })
    for (const dists of byBearing.values()) {
      const [d1, d2] = dists.sort((a, b) => a - b)
      expect(d2 - d1).toBeCloseTo(300, 3)
    }
  })

  it('interleaves the decoy platform as every Nth ship', () => {
    placeAsset()
    useStore.getState().armRaidDraft('RUS-LR-04')
    // The tactic lists the strike platform first, so the armed default is the
    // Shahed; the Gerbera enters only through the decoy interleave.
    expect(useStore.getState().ui.raidDraft?.platformSpecId).toBe('lib-shahed136')
    useStore.getState().commitRaid(null)
    const ships = useStore.getState().scenario.entities.filter((e) => e.kind === 'uas')
    expect(ships).toHaveLength(10)
    ships.forEach((s, i) => {
      const n = i + 1
      if (n % 3 === 0) {
        expect(s.specId, s.name).toBe('lib-gerbera')
        expect(s.name).toBe(`THR-G2-DEC-01 ${n}`)
      } else {
        expect(s.specId, s.name).toBe('lib-shahed136')
        expect(s.name).toBe(`THR-G3-OWA-01 ${n}`)
      }
    })
  })

  it('clamps the standoff beyond the longest enabled sensor detection ring', () => {
    const assetId = placeAsset()
    const target = useStore.getState().scenario.entities.find((e) => e.id === assetId)!
    // A long-range early-warning radar close to the target.
    const radarId = useStore.getState().addModel('sensor')
    useStore.getState().updateModel(radarId, {
      sensor: { sensorType: 'radar', detectRangeM: 100000, classifyRangeM: 50000, sectorDeg: 360 },
    })
    useStore.getState().addEntityFromModel(radarId, { x: 0, y: 0 })
    useStore.getState().armRaidDraft('RUS-TAC-02')
    useStore.getState().commitRaid(null)
    const ships = useStore.getState().scenario.entities.filter((e) => e.kind === 'uas')
    expect(ships).toHaveLength(8)
    // Tactic standoff is 8 km; every origin must clear the 100 km ring.
    for (const s of ships) {
      expect(dist(target.pos, s.pos)).toBeGreaterThan(100000)
    }
  })

  it('clamps the standoff against a forward-deployed sensor along the ingress axis', () => {
    placeAsset()
    // The same 100 km radar displaced 50 km north of the target, toward the
    // default (northern) ingress axis: origins must clear the ring measured
    // from the SENSOR, not the target.
    const radarId = useStore.getState().addModel('sensor')
    useStore.getState().updateModel(radarId, {
      sensor: { sensorType: 'radar', detectRangeM: 100000, classifyRangeM: 50000, sectorDeg: 360 },
    })
    useStore.getState().addEntityFromModel(radarId, { x: 0, y: -50000 })
    const sensor = useStore
      .getState()
      .scenario.entities.find((e) => e.kind === 'sensor')!
    useStore.getState().armRaidDraft('RUS-TAC-02')
    useStore.getState().commitRaid(null)
    const ships = useStore.getState().scenario.entities.filter((e) => e.kind === 'uas')
    expect(ships).toHaveLength(8)
    for (const s of ships) {
      expect(dist(sensor.pos, s.pos)).toBeGreaterThan(100000)
    }
  })

  it('a generic tactic with no platform is blocked until one is chosen', () => {
    const assetId = placeAsset()
    useStore.getState().armRaidDraft('GEN-WAVE')
    expect(useStore.getState().ui.raidDraft!.platformSpecId).toBeNull()

    const before = useStore.getState()
    useStore.getState().commitRaid({ x: 0, y: 5000 })
    const blocked = useStore.getState()
    // Blocked: no scenario change, no history step, draft still armed.
    expect(blocked.scenario).toBe(before.scenario)
    expect(blocked.past).toHaveLength(before.past.length)
    expect(blocked.ui.raidDraft).not.toBeNull()

    useStore.getState().patchRaidDraft({ platformSpecId: 'lib-fpv7', targetEntityId: assetId })
    useStore.getState().commitRaid({ x: 0, y: 5000 })
    const done = useStore.getState()
    expect(done.scenario.entities.filter((e) => e.kind === 'uas')).toHaveLength(8)
    expect(done.ui.raidDraft).toBeNull()
  })

  it('waves append after existing waves instead of replacing them', () => {
    const assetId = placeAsset()
    useStore.getState().addEntityFromModel('lib-mavic3', { x: 1000, y: 0 })
    const uasId = useStore.getState().scenario.entities.at(-1)!.id
    useStore.getState().assignToWave(uasId, 0)
    expect(useStore.getState().scenario.raid!.waves).toHaveLength(1)

    useStore.getState().armRaidDraft('RUS-TAC-02')
    useStore.getState().patchRaidDraft({ targetEntityId: assetId })
    useStore.getState().commitRaid(null)
    const waves = useStore.getState().scenario.raid!.waves
    expect(waves).toHaveLength(5)
    expect(waves[0].entityIds).toEqual([uasId])
  })

  it('commit pans the camera so the raid origin and target are visible', () => {
    const assetId = placeAsset(0, 0)
    const target = useStore.getState().scenario.entities.find((e) => e.id === assetId)!
    useStore.getState().armRaidDraft('RUS-TAC-02')
    useStore.getState().commitRaid(null)
    const { camera, scenario } = useStore.getState()
    const ships = scenario.entities.filter((e) => e.kind === 'uas')
    // Fallback viewport is 1000x700 when no canvas host is mounted.
    for (const p of [target.pos, ...ships.map((s) => s.pos)]) {
      const sx = p.x * camera.scale + camera.x
      const sy = p.y * camera.scale + camera.y
      expect(sx).toBeGreaterThanOrEqual(0)
      expect(sx).toBeLessThanOrEqual(1000)
      expect(sy).toBeGreaterThanOrEqual(0)
      expect(sy).toBeLessThanOrEqual(700)
    }
  })
})
