import { expect, it } from 'vitest'
import { fitCameraTo } from './camera'

it('fitCameraTo centers the points in the fallback 1000x700 viewport with a 15% margin', () => {
  expect(fitCameraTo([])).toBeNull()
  const cam = fitCameraTo([{ x: 0, y: 0 }, { x: 2000, y: 0 }])
  expect(cam).not.toBeNull()
  // Width 2000 m plus 15% is 2300 m across 1000 px; height clamps to 1 m and does not bind.
  expect(cam!.scale).toBeCloseTo(1000 / 2300, 9)
  expect(cam!.x).toBeCloseTo(500 - 1000 * cam!.scale, 9)
  expect(cam!.y).toBeCloseTo(350, 9)
  // A single point hits the 20 px/m scale cap.
  expect(fitCameraTo([{ x: 5, y: 5 }])!.scale).toBe(20)
})
