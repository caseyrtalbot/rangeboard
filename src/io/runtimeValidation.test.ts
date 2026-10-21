import { describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import { sampleSpread } from '../analysis/uncertainty'
import type { Scenario } from '../model/types'
import { parseAutosave, parseScenarioData } from './persist'
import { MAX_ARRAY_LENGTH, MAX_IMAGE_CODE_UNITS, validateImage } from './runtimeValidation'
import { parseLibraryData } from './validateScenario'

function laydown(): Scenario {
  const s = emptyScenario()
  const uas = s.library.find((m) => m.kind === 'uas')!
  s.entities = [
    {
      id: 'u',
      name: 'U',
      kind: 'uas',
      specId: uas.id,
      pos: { x: 0, y: 0 },
      headingDeg: 0,
      color: null,
      notes: '',
    },
  ]
  s.paths = [
    {
      id: 'p',
      entityId: 'u',
      points: [
        { x: 0, y: -1000 },
        { x: 0, y: 0 },
      ],
      speedMps: 10,
      startDelayS: 0,
    },
  ]
  return s
}

describe('Board runtime acceptance', () => {
  it.each([
    'entities',
    'connections',
    'boundaries',
    'paths',
    'frames',
    'testCards',
    'library',
    'systemPresets',
    'environment',
    'underlay',
    'requirements',
    'doctrine',
    'raid',
  ])('rejects present null %s', (key) => {
    expect(() => parseScenarioData({ ...emptyScenario(), [key]: null })).toThrow(key)
  })
  it.each(['entities', 'paths', 'connections', 'testCards'])(
    'rejects missing required %s',
    (key) => {
      const s = { ...emptyScenario() } as Record<string, unknown>
      delete s[key]
      expect(() => parseScenarioData(s)).toThrow(`${key}: required`)
    },
  )
  it('rejects malformed nested model/provenance/geometry data', () => {
    const s = laydown()
    s.entities[0].pos = null as never
    expect(() => parseScenarioData(s)).toThrow('entities[0].pos')
    s.entities[0].pos = { x: Infinity, y: 0 }
    expect(() => parseScenarioData(s)).toThrow('entities[0].pos.x')
    s.entities[0].pos = { x: 0, y: 0 }
    s.library[0] = { ...s.library[0], provenance: [null as never] }
    expect(() => parseScenarioData(s)).toThrow('provenance[0]')
  })

  it.each([
    [-0.2, 0.3],
    [-0.5, 1],
    [-1, 0.5],
    [0, 0.3],
    [-0.3, 0],
    [0, 0],
  ])('round-trips triangular offsets [%s, %s] and retains the sampler support', (lo, hi) => {
    const s = emptyScenario()
    const model = s.library.find((m) => m.kind === 'effector')!
    const spread = { kind: 'triangular', lo, hi } as const
    model.effector = { ...model.effector!, engageTimeS: 10 }
    model.provenance = [
      {
        field: 'engageTimeS',
        value: '10 s',
        source: 'user planning factor',
        date: '2026-09-05',
        basis: 'pf',
        spread,
      },
    ]
    const loaded = parseScenarioData(JSON.parse(JSON.stringify(s)))
    const restored = loaded.library.find((m) => m.id === model.id)!.provenance![0].spread!
    expect(restored).toEqual(spread)
    expect(
      parseLibraryData({ rangeboardLibrary: 1, models: [model] })[0].provenance![0].spread,
    ).toEqual(spread)
    // Source contract: -0.2/+0.3 offsets about a 10 s mode mean 8..13 s,
    // not multipliers -0.2..0.3. The sampler clamps endpoint uniforms by 2^-32.
    expect(sampleSpread(10, restored, 0)).toBeCloseTo(10 * (1 + lo), 3)
    expect(sampleSpread(10, restored, 1)).toBeCloseTo(10 * (1 + hi), 3)
    expect(Number.isFinite(sampleSpread(10, restored, 0.5))).toBe(true)
  })
  it.each([
    [0.3, -0.2, 'lower offset exceeds'],
    [0.1, 0.3, '.lo'],
    [-0.3, -0.1, '.hi'],
    [-1.1, 0.3, '.lo'],
  ])('rejects triangular offsets [%s, %s] with invalid ordering/mode/support', (lo, hi, reason) => {
    const model = emptyScenario().library.find((m) => m.kind === 'effector')!
    model.provenance = [
      {
        field: 'engageTimeS',
        value: '10 s',
        source: 'PF',
        date: '2026-09-05',
        basis: 'pf',
        spread: { kind: 'triangular', lo: Number(lo), hi: Number(hi) },
      },
    ]
    expect(() => parseLibraryData({ rangeboardLibrary: 1, models: [model] })).toThrow(
      String(reason),
    )
  })
  it('rejects wrong enums, unsafe run settings and invalid probability ranges', () => {
    expect(() => parseScenarioData({ ...emptyScenario(), runMode: 'wrong' })).toThrow('runMode')
    expect(() => parseScenarioData({ ...emptyScenario(), seed: 4294967296 })).toThrow('seed')
    expect(() =>
      parseScenarioData({ ...emptyScenario(), replicates: MAX_ARRAY_LENGTH + 1 }),
    ).toThrow('replicates')
    expect(() => parseScenarioData({ ...emptyScenario(), requirements: { pdDetect: 2 } })).toThrow(
      'pdDetect',
    )
  })
  it.each(['__proto__', 'constructor', 'toString', 'hasOwnProperty'])(
    'rejects reserved record ID %s before engine adoption',
    (id) => {
      const s = laydown()
      s.entities[0].id = id
      s.paths[0].entityId = id
      expect(() => parseScenarioData(JSON.parse(JSON.stringify(s)))).toThrow(
        'reserved ID conflicts with an object-backed engine map',
      )
      const model = { ...emptyScenario().library[0], id }
      expect(() => parseLibraryData({ rangeboardLibrary: 1, models: [model] })).toThrow(
        'rename this ID and its references',
      )
    },
  )
  it.each(['uas-1', 'custom:alpha/2', 'constructor-1', '__proto__-safe'])(
    'retains ordinary record ID %s',
    (id) => {
      const s = laydown()
      s.entities[0].id = id
      s.paths[0].entityId = id
      expect(parseScenarioData(JSON.parse(JSON.stringify(s))).entities[0].id).toBe(id)
    },
  )
  it.each(['A=', 'AA=', 'AAA==', 'AAAA==', '=AAA', 'AA=A', 'A', 'AA==='])(
    'rejects base64 padding/length %s that the native decoder rejects',
    (payload) => {
      expect(() => atob(payload)).toThrow()
      expect(() => validateImage(`data:image/png;base64,${payload}`, 'image')).toThrow(
        'invalid base64 image payload',
      )
      expect(() => validateImage(`data:image/png;BASE64,${payload}`, 'image')).toThrow(
        'invalid base64 image payload',
      )
    },
  )
  it.each(['AA==', 'AAA=', 'AAAA', 'AA', 'AAA', ' A A ==\n'])(
    'preserves native-decodable padded/unpadded base64 %s',
    (payload) => {
      expect(() => atob(payload)).not.toThrow()
      expect(() => validateImage(`data:image/png;base64,${payload}`, 'image')).not.toThrow()
    },
  )
  it('rejects duplicate IDs, missing references and incompatible model kinds', () => {
    const s = laydown()
    s.entities.push(s.entities[0])
    expect(() => parseScenarioData(s)).toThrow('duplicate ID')
    s.entities.pop()
    s.paths[0].entityId = 'missing'
    expect(() => parseScenarioData(s)).toThrow('entityId')
    s.paths[0].entityId = 'u'
    s.entities[0].specId = s.library.find((m) => m.kind === 'sensor')!.id
    expect(() => parseScenarioData(s)).toThrow('model kind')
  })
  it('rejects nonfinite derived duration and unrepresentable sample arrays before engine use', () => {
    const s = laydown()
    s.paths[0].speedMps = Number.MIN_VALUE
    expect(() => parseScenarioData(s)).toThrow('duration')
    s.paths[0].speedMps = 1
    s.paths[0].startDelayS = MAX_ARRAY_LENGTH
    expect(() => parseScenarioData(s)).toThrow('sample-array limit')
    s.paths[0].startDelayS = 0
    s.paths[0].points[0].x = Number.MAX_VALUE
    expect(() => parseScenarioData(s)).toThrow('points[0].x')
  })
  it('rejects a flight path with fewer than two points', () => {
    const s = laydown()
    s.paths[0].points = []
    expect(() => parseScenarioData(s)).toThrow('paths[0].points: expected at least two points')
    s.paths[0].points = [{ x: 0, y: 0 }]
    expect(() => parseScenarioData(s)).toThrow('paths[0].points: expected at least two points')
  })
  it('checks an ISR CAP orbit radius and laps and loads a valid one', () => {
    const s = laydown()
    s.paths[0].cap = { center: { x: 0, y: -2000 }, radiusM: 0, laps: 3 }
    expect(() => parseScenarioData(s)).toThrow('paths[0].cap.radiusM')
    s.paths[0].cap.radiusM = 500
    s.paths[0].cap.laps = 0
    expect(() => parseScenarioData(s)).toThrow('paths[0].cap.laps')
    s.paths[0].cap.laps = 1.5
    expect(() => parseScenarioData(s)).toThrow('paths[0].cap.laps')
    s.paths[0].cap.laps = 2
    expect(parseScenarioData(s).paths[0].cap).toEqual({
      center: { x: 0, y: -2000 },
      radiusM: 500,
      laps: 2,
    })
  })
  it('rejects a boundary with fewer than two points and still loads two', () => {
    const s = laydown()
    s.boundaries = [
      { id: 'b', name: 'B', type: 'range', points: [], closed: false, altBandFt: null },
    ]
    expect(() => parseScenarioData(s)).toThrow('boundaries[0].points: expected at least two points')
    s.boundaries[0].points = [{ x: 0, y: 0 }]
    expect(() => parseScenarioData(s)).toThrow('boundaries[0].points: expected at least two points')
    s.boundaries[0].points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]
    expect(parseScenarioData(s).boundaries[0].points).toHaveLength(2)
  })
  it('validates libraries through the same model contract and duplicate checks', () => {
    const model = emptyScenario().library[0]
    expect(parseLibraryData({ rangeboardLibrary: 1, models: [model] })).toEqual([model])
    expect(() => parseLibraryData({ rangeboardLibrary: 1, models: [model, model] })).toThrow(
      'duplicate ID',
    )
    expect(() =>
      parseLibraryData({ rangeboardLibrary: 1, models: [{ ...model, sensor: null }] }),
    ).toThrow('sensor')
  })
  it('preserves seed deletion, model-less entities, custom edits, and unknown extension data', () => {
    const s = laydown()
    const deleted = s.entities[0].specId!
    s.library = s.library.filter((m) => m.id !== deleted)
    s.deletedSeedIds = [deleted]
    s.entities[0].specId = null
    s.library[0] = { ...s.library[0], name: 'User edit' }
    const raw = { ...s, extension: { custom: [1, 'two'] } }
    const loaded = parseScenarioData(raw)
    expect(loaded.entities[0].specId).toBeNull()
    expect(loaded.library.some((m) => m.id === deleted)).toBe(false)
    expect(loaded.library[0].name).toBe('User edit')
    expect(loaded).toHaveProperty('extension', raw.extension)
  })
  it('fills legitimate legacy defaults and keeps valid saved image payloads over the new-image admission budget', () => {
    const s = laydown() as unknown as Record<string, unknown>
    for (const key of [
      'library',
      'systemPresets',
      'environment',
      'requirements',
      'underlay',
      'geoRef',
      'roe',
      'runMode',
      'seed',
      'replicates',
      'uncertainty',
    ])
      delete s[key]
    s.doctrine = { enabled: false }
    s.raid = {}
    s.mcdaWeights = { warning: 4 }
    expect(parseAutosave(JSON.stringify(s))?.entities).toHaveLength(1)
    const large = `data:image/png;base64,${'A'.repeat(MAX_IMAGE_CODE_UNITS)}`
    const old = emptyScenario()
    old.underlay = { ...old.underlay, dataUrl: large, naturalW: 1, naturalH: 1 }
    expect(parseScenarioData(old).underlay.dataUrl).toBe(large)
    expect(() => validateImage(large, 'newImage', true)).toThrow('5 MiB')
    expect(() => validateImage('https://example.com/image.png', 'image')).toThrow('data URL')
  })
})
