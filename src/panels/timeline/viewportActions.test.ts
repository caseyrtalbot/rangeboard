import { describe, expect, it } from 'vitest'
import type { RunTimelineModel, RunTimelineRow } from '../../analysis/runTimeline'
import { MIN_WINDOW_S, ZOOM_STEP } from '../../charts/timeViewport'
import {
  anchorTime,
  canZoomIn,
  canZoomOut,
  expandAllKeys,
  fitViewport,
  overviewGrab,
  overviewPlace,
  overviewTime,
  panBy,
  wheelPx,
  wheelZoom,
  windowReadout,
  zoomStep,
} from './viewportActions'

const DUR = 600
const frac = (v: { t0S: number; winS: number }, tS: number) => (tS - v.t0S) / v.winS

describe('zoom', () => {
  it('steps by ZOOM_STEP about the window center', () => {
    const v = { t0S: 100, winS: 120 }
    const zin = zoomStep(v, 'in', DUR)
    expect(zin.winS).toBeCloseTo(120 / ZOOM_STEP)
    expect(zin.t0S + zin.winS / 2).toBeCloseTo(160)
    const zout = zoomStep(v, 'out', DUR)
    expect(zout.winS).toBeCloseTo(120 * ZOOM_STEP)
    expect(zout.t0S + zout.winS / 2).toBeCloseTo(160)
  })

  it('keeps the wheel anchor at its fraction of the width', () => {
    const v = { t0S: 100, winS: 120 }
    const anchor = anchorTime(v, 250, 1000)
    expect(anchor).toBeCloseTo(130)
    const z = wheelZoom(v, 100, anchor, DUR)
    expect(z.winS).toBeCloseTo(120 * Math.exp(0.4))
    expect(frac(z, anchor)).toBeCloseTo(0.25)
  })

  it('clamps at the minimum window and at the run duration', () => {
    expect(wheelZoom({ t0S: 100, winS: 12 }, -2000, 106, DUR).winS).toBe(MIN_WINDOW_S)
    expect(wheelZoom({ t0S: 100, winS: 500 }, 2000, 300, DUR)).toEqual({ t0S: 0, winS: DUR })
    expect(canZoomIn({ t0S: 0, winS: MIN_WINDOW_S }, DUR)).toBe(false)
    expect(canZoomIn({ t0S: 0, winS: 20 }, DUR)).toBe(true)
    expect(canZoomOut({ t0S: 0, winS: DUR }, DUR)).toBe(false)
    expect(canZoomOut({ t0S: 0, winS: 120 }, DUR)).toBe(true)
  })

  it('holds the anchor inside the plot for a pointer past either edge', () => {
    const v = { t0S: 100, winS: 120 }
    expect(anchorTime(v, -40, 1000)).toBe(100)
    expect(anchorTime(v, 1400, 1000)).toBe(220)
  })
})

describe('pan', () => {
  it('moves by the pixel share of the window and clamps at both ends', () => {
    expect(panBy({ t0S: 100, winS: 120 }, 500, 1000, DUR)).toEqual({ t0S: 160, winS: 120 })
    expect(panBy({ t0S: 10, winS: 120 }, -500, 1000, DUR)).toEqual({ t0S: 0, winS: 120 })
    expect(panBy({ t0S: 470, winS: 120 }, 500, 1000, DUR)).toEqual({ t0S: 480, winS: 120 })
  })

  it('scales line and page wheel deltas to pixels', () => {
    expect(wheelPx(3, 0, 800)).toBe(3)
    expect(wheelPx(3, 1, 800)).toBe(48)
    expect(wheelPx(1, 2, 800)).toBe(800)
  })
})

describe('overview drag', () => {
  const v = { t0S: 100, winS: 120 }

  it('maps the pointer across the whole run, held inside it', () => {
    expect(overviewTime(250, 1000, DUR)).toBe(150)
    expect(overviewTime(-5, 1000, DUR)).toBe(0)
    expect(overviewTime(1200, 1000, DUR)).toBe(DUR)
  })

  it('centers the window at a press outside it', () => {
    const grab = overviewGrab(v, 400)
    expect(grab).toBe(60)
    expect(overviewPlace(v, 400, grab, DUR)).toEqual({ t0S: 340, winS: 120 })
  })

  it('keeps the grab offset of a press inside the window', () => {
    const grab = overviewGrab(v, 130)
    expect(grab).toBe(30)
    expect(overviewPlace(v, 330, grab, DUR)).toEqual({ t0S: 300, winS: 120 })
  })

  it('clamps the placed window at both run ends', () => {
    expect(overviewPlace(v, 20, 60, DUR)).toEqual({ t0S: 0, winS: 120 })
    expect(overviewPlace(v, 590, 60, DUR)).toEqual({ t0S: 480, winS: 120 })
  })
})

describe('fit and readout', () => {
  it('fits the whole run and reads fit there', () => {
    expect(fitViewport(DUR)).toEqual({ t0S: 0, winS: DUR })
    expect(windowReadout(fitViewport(DUR), DUR)).toBe('fit')
    expect(windowReadout({ t0S: 0, winS: 120 }, DUR)).toBe('120 s')
    expect(windowReadout({ t0S: 0, winS: 53.4 }, DUR)).toBe('53 s')
  })
})

describe('expandAllKeys', () => {
  const row = (key: string, subLanes?: RunTimelineRow[]): RunTimelineRow => ({
    key,
    kind: 'sensor',
    label: key,
    meta: '',
    entityId: key,
    spans: [],
    marks: [],
    ...(subLanes ? { subLanes } : {}),
  })

  it('opens every group and every sensor row with sub-lanes', () => {
    const model: RunTimelineModel = {
      durationS: DUR,
      horizonS: 200,
      groups: [
        {
          key: 'sensor',
          side: 'blue',
          label: 'Sensors',
          rows: [row('sensor:a', [row('sub:a')]), row('sensor:b', []), row('sensor:c')],
        },
        { key: 'threat', side: 'red', label: 'Threats', rows: [] },
      ],
    }
    expect(expandAllKeys(model)).toEqual({ groups: ['sensor', 'threat'], sensorRows: ['sensor:a'] })
  })
})
