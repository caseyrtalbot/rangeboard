import { expect, it } from 'vitest'
import { formatRunLabel, KIND_NAMES } from './labels'

it('formatRunLabel pads the sequence to four digits', () => {
  expect(formatRunLabel(1)).toBe('RUN-0001')
  expect(formatRunLabel(12345)).toBe('RUN-12345')
  expect(KIND_NAMES.c2).toBe('C2')
})
