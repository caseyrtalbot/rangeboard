// Compact timeline capture for the Phase 2 gate: MC summary means and one deterministic-seed trial per fixture.
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
const root = process.cwd()
const dir = process.argv[2]
// Optional third argument: a directory of fixture copies to run the trial on (the CLI records in `dir` came from the same copies).
const fixtureDir = process.argv[3] ?? `${root}/src/playback/__fixtures__`
const engine = await import(pathToFileURL(`${root}/dist-engine/engine.js`).href)
const fixtures = ['detection-outside-rings', 'layered-acoustic-merops']
const prim = (o) => Object.fromEntries(Object.entries(o ?? {}).filter(([, v]) => v == null || ['number', 'string', 'boolean'].includes(typeof v)))
const last = (v) => Array.isArray(v) ? v.at(-1) : v
const stat = (s) => s && typeof s === 'object' && 'mean' in s ? { mean: last(s.mean), lo: last(s.lo), hi: last(s.hi), n: last(s.n) } : s
const out = { mc: {}, trial: {} }
for (const f of fixtures) {
  const recPath = `${dir}/${f}.json`
  const rec = JSON.parse(readFileSync(recPath, 'utf8'))
  const s = rec.mc
  out.mc[f] = {
    seed: s.seed, replicates: s.replicates, durationS: s.durationS,
    ...Object.fromEntries(['kills', 'leakers', 'detected', 'tracked', 'engaged', 'firstDetectS', 'firmTrackS', 'minWarningS'].map((k) => [k, stat(s[k])])),
    perThreat: Object.fromEntries(Object.entries(s.perThreat).map(([id, t]) => [id, Object.fromEntries(Object.entries(t).map(([k, v]) => [k, stat(v)]))])),
    perEffector: Object.fromEntries(Object.entries(s.perEffector).map(([id, t]) => [id, Object.fromEntries(Object.entries(t).map(([k, v]) => [k, stat(v)]))])),
  }
  const scenario = engine.parseScenarioJson(readFileSync(`${fixtureDir}/${f}.json`, 'utf8'))
  const manifest = engine.createTrialManifest(scenario, `p2-gate-${f}`, 'p2-gate')
  const r = engine.runTrial(scenario, manifest)
  out.trial[f] = {
    manifest: prim(manifest),
    assessments: r.assessments.map((a) => ({
      ...prim(a),
      sensorObservations: (a.sensorObservations ?? a.sweep?.sensorObservations ?? []).map((o) => ({ ...prim(o), intervals: o.intervals })),
    })),
    engagements: (r.report.events ?? []).map(prim),
    reportKeys: Object.keys(r.report),
    trackCount: r.tracks?.length ?? null,
  }
  unlinkSync(recPath)
}
writeFileSync(`${dir}/timeline.json`, JSON.stringify(out, null, 1) + '\n')
console.log('wrote', `${dir}/timeline.json`, 'trial threats', Object.values(out.trial).map((t) => t.assessments.length), 'engagements', Object.values(out.trial).map((t) => t.engagements.length), 'reportKeys', out.trial[fixtures[0]].reportKeys)
