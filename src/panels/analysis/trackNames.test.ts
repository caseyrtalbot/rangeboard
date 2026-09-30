import { describe, expect, it } from 'vitest'
import { splitCommonPrefix } from './trackNames'

describe('splitCommonPrefix', () => {
  it('cuts a shared prefix at its last hyphen', () => {
    expect(splitCommonPrefix(['THR-G3-A', 'THR-G3-B', 'THR-G3-C'])).toEqual({
      prefix: 'THR-G3-',
      rest: ['A', 'B', 'C'],
    })
  })

  it('cuts at a space and keeps a numbered suffix whole', () => {
    expect(splitCommonPrefix(['OWA-01 10', 'OWA-01 11', 'OWA-01 9'])).toEqual({
      prefix: 'OWA-01 ',
      rest: ['10', '11', '9'],
    })
    // The shared "1" of 10 and 11 is not a break, so it stays in each row.
    expect(splitCommonPrefix(['UAS 10', 'UAS 11'])).toEqual({ prefix: 'UAS ', rest: ['10', '11'] })
  })

  it('returns no prefix when the names share none', () => {
    expect(splitCommonPrefix(['Alpha-1', 'Bravo-1'])).toEqual({
      prefix: '',
      rest: ['Alpha-1', 'Bravo-1'],
    })
    expect(splitCommonPrefix(['THR1', 'THR2'])).toEqual({ prefix: '', rest: ['THR1', 'THR2'] })
  })

  it('returns no prefix for one name or none', () => {
    expect(splitCommonPrefix(['THR-G3-A'])).toEqual({ prefix: '', rest: ['THR-G3-A'] })
    expect(splitCommonPrefix([])).toEqual({ prefix: '', rest: [] })
  })

  it('keeps the whole names when a cut would empty a row', () => {
    expect(splitCommonPrefix(['THR-', 'THR-A'])).toEqual({ prefix: '', rest: ['THR-', 'THR-A'] })
  })
})
