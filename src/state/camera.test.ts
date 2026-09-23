import { expect, it } from 'vitest'
import { fitCameraTo } from './camera'

it('fitCameraTo fits the points and their mark boxes inside a 64 px pad of the fallback viewport', () => {
  expect(fitCameraTo([])).toBeNull()
  const cam = fitCameraTo([
    { x: 0, y: 0 },
    { x: 2000, y: 0 },
  ])
  expect(cam).not.toBeNull()
  // 1000 px less two 64 px pads and a 120 px label box leaves 752 px for 2000 m.
  expect(cam!.scale).toBeCloseTo(752 / 2000, 9)
  expect(cam!.x).toBeCloseTo(500 - 1000 * cam!.scale, 9)
  // The 44 px label below and the 20 px brackets above centre the marks 12 px high.
  expect(cam!.y).toBeCloseTo(338, 9)
  // A single point hits the 20 px/m scale cap.
  expect(fitCameraTo([{ x: 5, y: 5 }])!.scale).toBe(20)
})

it('fitCameraTo keeps every mark box 64 px inside the viewport edge', () => {
  const points = [
    { x: -600, y: 0 },
    { x: 1700, y: -1700 },
    { x: 0, y: -6000 },
  ]
  const cam = fitCameraTo(points)!
  for (const p of points) {
    const sx = p.x * cam.scale + cam.x
    const sy = p.y * cam.scale + cam.y
    expect(sx - 60).toBeGreaterThanOrEqual(64 - 1e-9)
    expect(sx + 60).toBeLessThanOrEqual(1000 - 64 + 1e-9)
    expect(sy - 20).toBeGreaterThanOrEqual(64 - 1e-9)
    expect(sy + 44).toBeLessThanOrEqual(700 - 64 + 1e-9)
  }
})
