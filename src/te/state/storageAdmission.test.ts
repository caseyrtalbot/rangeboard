import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_IMAGE_CODE_UNITS } from '../../io/runtimeValidation'
import { emptyCampaign, emptyConfig } from '../model/empty'
import { useTeStore } from './teStore'

const frame = { id: 'frame-test', name: 'Frame', pngDataUrl: 'data:image/png;base64,AAAA',
  capturedAt: '2026-09-07', simTimeS: 0, note: '' }
const oversized = 'x'.repeat(MAX_IMAGE_CODE_UNITS + 1)
function campaign() { return useTeStore.getState().campaigns[0] }

beforeEach(() => {
  const c = emptyCampaign('Storage test', 'STO')
  useTeStore.setState({ campaigns: [c], activeCampaignId: c.id })
})

describe('new T&E storage payload admission', () => {
  it('refuses new oversized frames and snapshots before publishing a mutation', () => {
    const previous = useTeStore.getState()
    const notify = vi.fn()
    const stop = useTeStore.subscribe(notify)
    expect(() => previous.addItem('frames', { ...frame, pngDataUrl: oversized })).toThrow('5 MiB')
    expect(() => previous.addItem('configs', { ...emptyConfig('config-test'), scenarioSnapshot: oversized })).toThrow('5 MiB')
    expect(useTeStore.getState()).toBe(previous)
    expect(notify).not.toHaveBeenCalled()
    stop()
  })

  it('refuses an oversized config patch atomically, preserving its existing snapshot and drift log', () => {
    const store = useTeStore.getState()
    const id = store.addConfig()
    store.patchItem('configs', id, { scenarioSnapshot: '{"before":true}' })
    const previous = useTeStore.getState()
    expect(() => store.patchItem('configs', id, { scenarioSnapshot: oversized,
      driftLog: [{ time: 'now', note: 'Must not persist' }] })).toThrow('5 MiB')
    expect(useTeStore.getState()).toBe(previous)
    expect(campaign().configs[0].scenarioSnapshot).toBe('{"before":true}')
    expect(campaign().configs[0].driftLog).toEqual([])
  })

  it('accepts the snapshot limit and rejects replacing a frame with an oversized payload', () => {
    const store = useTeStore.getState()
    const id = store.addConfig()
    const atLimit = 'x'.repeat(MAX_IMAGE_CODE_UNITS)
    store.patchItem('configs', id, { scenarioSnapshot: atLimit })
    expect(campaign().configs[0].scenarioSnapshot).toBe(atLimit)
    store.addItem('frames', frame)
    expect(() => store.patchItem('frames', frame.id, { pngDataUrl: oversized })).toThrow('5 MiB')
    expect(campaign().frames[0].pngDataUrl).toBe(frame.pngDataUrl)
  })

  it('preserves imported oversized payloads and allows metadata edits with their unchanged values', () => {
    const c = campaign()
    const pngDataUrl = `data:image/png;base64,${'A'.repeat(MAX_IMAGE_CODE_UNITS)}`
    const imported = { ...c, configs: [{ ...emptyConfig('config-test'), scenarioSnapshot: oversized }],
      frames: [{ ...frame, pngDataUrl }] }
    useTeStore.getState().replaceState({ schemaVersion: 1, campaigns: [imported], activeCampaignId: c.id })
    const store = useTeStore.getState()
    store.patchItem('configs', 'config-test', { scenarioSnapshot: oversized, name: 'Renamed' })
    store.patchItem('frames', frame.id, { pngDataUrl, note: 'Retained' })
    expect(campaign().configs[0].name).toBe('Renamed')
    expect(campaign().frames[0].note).toBe('Retained')
  })
})
