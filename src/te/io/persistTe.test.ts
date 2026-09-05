import { describe, expect, it } from 'vitest'
import { emptyCampaign, emptyCard, emptyConfig, emptyMeasure, emptyQuestion, emptyRun } from '../model/empty'
import { buildJiatf401 } from '../seed/jiatf401'
import { emptyScenario } from '../../model/seed'
import { fillCampaign, parseCampaignData, parseTeAutosave, parseTeStateData } from './persistTe'

function fixture() {
  const c = emptyCampaign('Research', 'R')
  c.questions = [emptyQuestion('Q1')]
  c.measures = [emptyMeasure('M1', 'Q1')]
  const card = emptyCard('C1', 'TC-1')
  card.questionIds = ['Q1']; card.measureIds = ['M1']
  c.cards = [card]; c.runs = [emptyRun('R1', card)]
  return c
}

describe('T&E runtime import acceptance', () => {
  it('round-trips the illustrative campaign and a populated draft exactly', () => {
    for (const c of [fixture(), buildJiatf401()]) {
      expect(parseCampaignData(JSON.parse(JSON.stringify({ rangeboardCampaign: 1, campaign: c })))).toEqual(c)
      expect(parseTeAutosave(JSON.stringify({ schemaVersion: 1, campaigns: [c], activeCampaignId: c.id }))?.campaigns).toEqual([c])
    }
  })
  it.each(['cards', 'runs', 'measures', 'configs', 'frames', 'charter', 'decision', 'evidencePackage'])('rejects present null %s before adoption', key => {
    expect(() => parseCampaignData({ rangeboardCampaign: 1, campaign: { ...fixture(), [key]: null } })).toThrow(key)
  })
  it('rejects partial required records and arrays', () => {
    expect(() => parseCampaignData({ rangeboardCampaign: 1, campaign: { id: 'c', name: 'x', code: 'X' } })).toThrow('phase')
    const c = fixture(); c.runs[0].observations = [null as never]
    expect(() => fillCampaign(c)).toThrow('observations[0]')
  })
  it('rejects nested invalid enums and nonfinite observations', () => {
    const c = fixture(); c.runs[0].observations[0].status = 'made-up' as never
    expect(() => fillCampaign(c)).toThrow('observations[0].status')
    c.runs[0].observations[0].status = 'observed'; c.runs[0].observations[0].value = Infinity
    expect(() => fillCampaign(c)).toThrow('observations[0].value')
  })
  it('rejects duplicate IDs, dangling references, and mismatched card versions', () => {
    const c = fixture(); c.cards.push(c.cards[0])
    expect(() => fillCampaign(c)).toThrow('duplicate ID')
    c.cards.pop(); c.runs[0].observations[0].measureId = 'missing'
    expect(() => fillCampaign(c)).toThrow('measureId')
    c.runs[0].observations[0].measureId = 'M1'; c.runs[0].cardVersion = 'v2.0'
    expect(() => fillCampaign(c)).toThrow('cardVersion')
  })
  it('allows unresolved draft blanks and external provenance references', () => {
    const c = fixture(); c.measures[0].questionId = ''; c.sourceCampaignId = 'archived-elsewhere'
    c.cards[0].linkedEntityIds = ['board-entity-no-longer-present']
    expect(fillCampaign(c)).toEqual(c)
  })
  it('keeps intentionally empty evidence sections and fills only legitimate missing defaults', () => {
    const c = fixture(); c.evidencePackage.sections = []
    expect(fillCampaign(c).evidencePackage.sections).toEqual([])
    const old = { ...c } as Record<string, unknown>
    delete old.frames; delete old.illustrative; delete old.presetKey; delete old.sourceCampaignId
    old.charter = { sponsor: 'Preserved' }; old.decision = { boundedChoice: 'Preserved' }
    const loaded = parseCampaignData({ rangeboardCampaign: 1, campaign: old })
    expect(loaded.charter.sponsor).toBe('Preserved'); expect(loaded.charter.commitments).toEqual([])
    expect(loaded.frames).toEqual([]); expect(loaded.decision.boundedChoice).toBe('Preserved')
  })
  it('validates nested serialized Board snapshots', () => {
    const c = fixture(); const config = emptyConfig('CFG1'); c.configs = [config]
    config.scenarioSnapshot = JSON.stringify(emptyScenario())
    expect(fillCampaign(c).configs[0].scenarioSnapshot).toBe(config.scenarioSnapshot)
    config.scenarioSnapshot = JSON.stringify({ ...emptyScenario(), entities: null })
    expect(() => fillCampaign(c)).toThrow('scenarioSnapshot')
  })
  it('rejects missing active campaign and duplicate campaigns but supports missing legacy selection', () => {
    const c = fixture()
    expect(() => parseTeStateData({ schemaVersion: 1, campaigns: [c], activeCampaignId: 'missing' })).toThrow('activeCampaignId')
    expect(() => parseTeStateData({ schemaVersion: 1, campaigns: [c, c], activeCampaignId: null })).toThrow('duplicate ID')
    expect(parseTeStateData({ schemaVersion: 1, campaigns: [c] }).activeCampaignId).toBeNull()
  })
  it('rejects malformed sequence counters without limiting campaign counts', () => {
    const c = fixture(); c.seq = { RUN: -1 }
    expect(() => fillCampaign(c)).toThrow('seq.RUN')
  })
})
