/**
 * Package text precedence and one-step delivery on the seed campaign.
 */

import { describe, expect, it } from 'vitest'
import type { TeCampaign } from '../model/types'
import { buildJiatf401 } from '../seed/jiatf401'
import { deliverPackage, generatedSection, previewPackage, resolveSection, resolvedPackage } from './package'

/** Seed campaign with closeout done; manual sections and the empty generated section 10 written. */
function deliverable(): TeCampaign {
  const c = buildJiatf401()
  return {
    ...c,
    questions: c.questions.map((q) => ({ ...q, disposition: 'answered' as const })),
    registers: c.registers.map((r) => (r.kind === 'claim' ? { ...r, disposition: 'untested' as const } : r)),
    actions: c.actions.map((a) => ({ ...a, status: 'transferred' as const })),
    evidencePackage: {
      ...c.evidencePackage,
      methodAcceptance: 'Accepted for this illustrative walkthrough',
      evidenceAcceptance: 'Accepted for software verification only',
      finalAuthorityAndDate: 'Illustrative reviewer, 2026-09-05',
      sections: c.evidencePackage.sections.map((s) =>
        [10, 11, 14, 16, 17, 18].includes(s.n) ? { ...s, content: `Manual text ${s.n}`, edited: true } : s,
      ),
    },
  }
}

describe('section text precedence', () => {
  it('prefers edited, then generated, then stored text, and freezes on delivery', () => {
    const c = deliverable()
    const gen = c.evidencePackage.sections[0]
    expect(resolveSection(c, gen)).toMatchObject({ source: 'generated', text: generatedSection(c, gen), manual: false })
    expect(resolveSection(c, { ...gen, content: 'stale', edited: false }).text).toBe(generatedSection(c, gen))
    expect(resolveSection(c, { ...gen, content: 'My words', edited: true })).toMatchObject({ source: 'edited', text: 'My words' })
    const manual = c.evidencePackage.sections.find((s) => s.n === 11)!
    expect(resolveSection(c, manual)).toMatchObject({ source: 'edited', text: 'Manual text 11', manual: true })
    expect(resolveSection(c, { ...manual, edited: false })).toMatchObject({ source: 'stored', text: 'Manual text 11' })
    const delivered = { ...c, evidencePackage: { ...c.evidencePackage, deliveredAt: '2026-09-05' } }
    expect(resolveSection(delivered, { ...gen, content: 'frozen', edited: false })).toMatchObject({ source: 'delivered', text: 'frozen' })
  })

  it('writes resolved text into unedited sections only', () => {
    const c = deliverable()
    const pkg = resolvedPackage(c)
    expect(pkg.sections.find((s) => s.n === 1)?.content).toBe(generatedSection(c, c.evidencePackage.sections[0]))
    expect(pkg.sections.find((s) => s.n === 11)).toEqual(c.evidencePackage.sections.find((s) => s.n === 11))
    expect(pkg.sections.every((s, i) => s.edited === c.evidencePackage.sections[i].edited)).toBe(true)
    expect(previewPackage(c).map((p) => p.text)).toEqual(pkg.sections.map((s) => s.content))
  })
})

describe('deliverPackage', () => {
  it('freezes edited, manual and generated text in one proposal', () => {
    const c = deliverable()
    c.evidencePackage.sections[1] = { ...c.evidencePackage.sections[1], content: 'Edited uncertainty', edited: true }
    const proposal = deliverPackage(c, '2026-09-05T00:00:00Z')
    expect(proposal.blockers).toEqual([])
    const pkg = proposal.campaign!.evidencePackage
    expect(pkg.deliveredAt).toBe('2026-09-05T00:00:00Z')
    expect(pkg.sections[1].content).toBe('Edited uncertainty')
    expect(pkg.sections.find((s) => s.n === 14)?.content).toBe('Manual text 14')
    expect(pkg.sections[0].content).toBe(generatedSection(c, c.evidencePackage.sections[0]))
    expect(pkg.sections.every((s) => s.content.trim() !== '')).toBe(true)
    expect(proposal.campaign!.findings).toEqual(c.findings)
    expect(c.evidencePackage.deliveredAt).toBeNull()
  })

  it('validates the resolved text, not the stale stored text', () => {
    const c = deliverable()
    c.evidencePackage.sections[0] = { ...c.evidencePackage.sections[0], content: '[stale placeholder]', edited: false }
    expect(deliverPackage(c, '2026-09-05').blockers).toEqual([])
    c.evidencePackage.sections[0] = { ...c.evidencePackage.sections[0], content: '[kept placeholder]', edited: true }
    const rejected = deliverPackage(c, '2026-09-05')
    expect(rejected.campaign).toBeNull()
    expect(rejected.blockers).toContain('Complete the package sections and resolve their placeholders.')
  })

  it('returns blockers and no update for an incomplete or delivered package', () => {
    const c = deliverable()
    const open = { ...c, actions: c.actions.map((a) => ({ ...a, status: 'open' as const })) }
    const rejected = deliverPackage(open, '2026-09-05')
    expect(rejected.campaign).toBeNull()
    expect(rejected.blockers.some((b) => b.includes('remain open'))).toBe(true)
    const delivered = deliverPackage(c, '2026-09-05').campaign!
    expect(deliverPackage(delivered, '2026-09-06')).toEqual({ blockers: ['The package is already delivered.'], campaign: null })
  })
})
