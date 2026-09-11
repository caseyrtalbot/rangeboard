// Render comparison.md from the before, after and after-estimate timelines: node compare-timelines.mjs <evidence dir>
import { readFileSync } from 'node:fs'
const [dir] = process.argv.slice(2)
const L = (n) => JSON.parse(readFileSync(`${dir}/${n}/timeline.json`, 'utf8'))
const before = L('before'), after = L('after'), est = L('after-estimate')
const fx = ['detection-outside-rings', 'layered-acoustic-merops']
const r3 = (v) => v == null ? 'null' : Number.isInteger(v) ? String(v) : v.toFixed(3)
const out = []
const p = (s = '') => out.push(s)
p('# Phase 2 timeline comparison, 2026-09-10\n')
p('`before` is main at the contract commit 6e33ef2 (truth tracks, no false tracks, no operator queue).')
p('`after` is the gate tree with the golden fixtures pinned to the three physics switches.')
p('`after-estimate` is the same tree with the switches removed: Kalman estimate, fusion, false tracks and the operator queue on.')
p('Monte Carlo rows: 200 replicates, seed 4821, aleatory, 4 workers. Trial rows: seed 4821, one replicate.')
p('Rendered by `compare-timelines.mjs`; the timelines come from `capture-timeline.mjs`.\n')
p('## Monte Carlo end-of-run means\n')
p('| Fixture | Measure | before | after (pinned) | after-estimate |')
p('| --- | --- | --- | --- | --- |')
const cell = (s) => s && typeof s === 'object' ? `${r3(s.mean)} [${r3(s.lo)}, ${r3(s.hi)}]` : r3(s)
for (const f of fx) for (const k of ['kills', 'leakers', 'detected', 'tracked', 'engaged', 'firstDetectS', 'firmTrackS', 'minWarningS']) {
  p(`| ${f} | ${k} | ${cell(before.mc[f][k])} | ${cell(after.mc[f][k])} | ${cell(est.mc[f][k])} |`)
}
p('\n## Trial timeline per threat, fields that differ in any column\n')
p('| Fixture | Threat | Field | before | after (pinned) | after-estimate |')
p('| --- | --- | --- | --- | --- | --- |')
let pinnedDiffs = 0
let rows = 0
for (const f of fx) {
  const A = before.trial[f].assessments, B = after.trial[f].assessments, C = est.trial[f].assessments
  for (let i = 0; i < A.length; i++) for (const k of ['status', 'firstDetectS', 'firstConfirmS', 'stableTrackAtS', 'declaredHostileAtS', 'engageGateS', 'warningS', 'arrivalS']) {
    const a = A[i]?.[k], b = B[i]?.[k], c = C[i]?.[k]
    if (JSON.stringify(a) !== JSON.stringify(b)) pinnedDiffs++
    if (JSON.stringify(a) !== JSON.stringify(c) || JSON.stringify(a) !== JSON.stringify(b)) { rows++; p(`| ${f} | ${A[i].uasId} | ${k} | ${r3(a)} | ${r3(b)} | ${r3(c)} |`) }
  }
}
if (rows === 0) p('| (none) | | | | | |')
p('\n## Engagement events\n')
p('| Fixture | before | after (pinned) | after-estimate |')
p('| --- | --- | --- | --- |')
for (const f of fx) {
  const n = (t) => t.trial[f].engagements.length
  const k = (t) => t.trial[f].engagements.reduce((s, e) => s + (e.killDelta ?? 0), 0)
  p(`| ${f} | ${n(before)} events, kill mass ${r3(k(before))} | ${n(after)} events, kill mass ${r3(k(after))} | ${n(est)} events, kill mass ${r3(k(est))} |`)
}
const sig = (e) => e.map((x) => [x.effectorId, x.uasId, x.tS, x.tReleaseS, x.tEffectS, x.pk, x.killDelta].join(':')).join('|')
const evDiff = fx.filter((f) => sig(before.trial[f].engagements) !== sig(after.trial[f].engagements))
const mcDiff = fx.filter((f) => JSON.stringify(before.mc[f]) !== JSON.stringify(after.mc[f]))
p(`\nPinned path against before: ${pinnedDiffs} assessment field differences, ${evDiff.length} fixtures with a different engagement ledger, ${mcDiff.length} fixtures with a different Monte Carlo summary.`)
p(`Track estimates emitted in the trial: ${fx.map((f) => `${f} ${est.trial[f].trackCount} (estimate path), ${after.trial[f].trackCount} (pinned)`).join('; ')}.`)
process.stdout.write(out.join('\n') + '\n')
