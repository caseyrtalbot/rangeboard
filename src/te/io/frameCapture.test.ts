import type Konva from 'konva'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_IMAGE_CODE_UNITS } from '../../io/runtimeValidation'
import { useTeStore } from '../state/teStore'
import { emptyCampaign } from '../model/empty'
import { restoreTeAutosave } from './persistTe'
import { captureFrameToCampaign, registerStage } from './frameCapture'

vi.mock('./persistTe', () => ({ restoreTeAutosave: vi.fn() }))
beforeEach(() => {
  useTeStore.setState({ campaigns: [], activeCampaignId: null })
  vi.mocked(restoreTeAutosave).mockImplementation(() => {
    const c = emptyCampaign('Saved campaign', 'SAVED')
    useTeStore.setState({ campaigns: [c], activeCampaignId: c.id })
  })
})
afterEach(() => { registerStage(null); vi.clearAllMocks() })

describe('Board campaign frame capture', () => {
  it('restores T&E before capture and inserts an admitted image into the restored campaign', () => {
    const toDataURL = vi.fn(() => 'data:image/png;base64,AAAA')
    registerStage({ width: () => 1400, toDataURL } as unknown as Konva.Stage)
    const id = captureFrameToCampaign('Frame')
    expect(id).not.toBeNull()
    expect(restoreTeAutosave).toHaveBeenCalledOnce()
    expect(useTeStore.getState().campaigns[0].frames[0]).toMatchObject({ id, name: 'Frame' })
  })

  it('refuses an oversized canvas result before calling the T&E add action', () => {
    registerStage({ width: () => 1400,
      toDataURL: () => `data:image/png;base64,${'A'.repeat(MAX_IMAGE_CODE_UNITS)}` } as unknown as Konva.Stage)
    const add = vi.spyOn(useTeStore.getState(), 'addItem')
    expect(() => captureFrameToCampaign('Too large')).toThrow('5 MiB')
    expect(add).not.toHaveBeenCalled()
    expect(useTeStore.getState().campaigns[0].frames).toEqual([])
    add.mockRestore()
  })

  it('returns null without a stage and propagates canvas errors for the State notice', () => {
    expect(captureFrameToCampaign('Missing')).toBeNull()
    registerStage({ width: () => 1400, toDataURL: () => { throw new Error('Canvas unavailable') } } as unknown as Konva.Stage)
    expect(() => captureFrameToCampaign('Failed')).toThrow('Canvas unavailable')
  })
})
