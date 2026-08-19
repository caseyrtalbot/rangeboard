import { describe, expect, it } from 'vitest'
import { buildJiatf401 } from './jiatf401'

describe('buildJiatf401', () => {
  const c = buildJiatf401()

  it('builds the campaign', () => {
    expect(c.name).toBe('JIATF-401 Early-Warning Architecture Evaluation')
    expect(c.code).toBe('J401')
  })

  it('is marked illustrative', () => {
    expect(c.illustrative).toBe(true)
  })

  it('has 5 questions', () => {
    expect(c.questions).toHaveLength(5)
  })

  it('has 10 measures', () => {
    expect(c.measures).toHaveLength(10)
  })

  it('has 12 matrix cells', () => {
    expect(c.matrix).toHaveLength(12)
  })

  it('has an issued card with 15 procedure steps and 10 event marks', () => {
    expect(c.cards).toHaveLength(1)
    const card = c.cards[0]
    expect(card.status).toBe('issued')
    expect(card.procedure).toHaveLength(15)
    expect(card.eventMarks).toHaveLength(10)
    expect(card.coldReaderAt).not.toBeNull()
    expect(card.dryRunAt).not.toBeNull()
  })

  it('has at least 12 runs, all with grammar ids', () => {
    expect(c.runs.length).toBeGreaterThanOrEqual(12)
    for (const run of c.runs) {
      expect(run.id).toMatch(/^VLK-J401-RUN-\d{4}$/)
    }
  })
})
