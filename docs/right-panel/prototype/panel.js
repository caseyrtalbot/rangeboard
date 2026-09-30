'use strict'

/* ---------- sample data: RUN-0006 trial; ensemble, sweep and placement figures are examples ---------- */
const DUR = 1473
const EXEC_T = 1110
const GROUP = 'THR-G3-OWA-01'
const ASSET_X = 500
const ASSET_Y = 170

// d detect, id hostile, tgt window, eng first salvo, arr arrival (s); pd/cum/res are forecast values
const TRACKS = [
  { n: 1, d: 197, id: 789, tgt: 960, eng: 1010, arr: 1203, slv: 2, pd: 0.82, cum: 0.97, res: 0.62, x: 120 },
  { n: 2, d: 345, id: 1051, tgt: 1100, eng: null, arr: 1462, slv: 0, pd: 0.61, cum: 0.88, res: 1, x: 880 },
  { n: 3, d: 185, id: 792, tgt: 965, eng: 1014, arr: 1203, slv: 2, pd: 0.77, cum: 0.95, res: 0.64, x: 170 },
  { n: 4, d: 240, id: 850, tgt: 1020, eng: 1071, arr: 1264, slv: 1, pd: 0.7, cum: 0.93, res: 0.78, x: 220 },
  { n: 5, d: 210, id: 853, tgt: 1025, eng: 1075, arr: 1264, slv: 1, pd: 0.8, cum: 0.96, res: 0.8, x: 700 },
  { n: 6, d: 181, id: 915, tgt: 1090, eng: 1144, arr: 1328, slv: 1, pd: 0.84, cum: 0.91, res: 0.81, x: 260 },
  { n: 7, d: 271, id: 917, tgt: 1095, eng: 1148, arr: 1328, slv: 1, pd: 0.66, cum: 0.94, res: 0.83, x: 740 },
  { n: 8, d: 411, id: 981, tgt: null, eng: null, arr: 1394, slv: 0, pd: 0.52, cum: 0.85, res: 1, x: 300 },
  { n: 9, d: 412, id: 983, tgt: null, eng: null, arr: 1394, slv: 0, pd: 0.55, cum: 0.92, res: 1, x: 780 },
  { n: 10, d: 313, id: 1049, tgt: 1098, eng: null, arr: 1462, slv: 0, pd: 0.63, cum: 0.89, res: 1, x: 830 },
]
const HELD = { 1: ['KuRFS', 'Ranger HDC'], 2: ['LSTAR'], 3: ['KuRFS'], 4: ['LSTAR'], 5: ['LSTAR'], 6: ['KuRFS'], 7: ['KuRFS'], 8: ['LSTAR'], 9: [], 10: ['LSTAR'] }
const SALVOS = [
  { t: 1010, eff: 'Coyote 1', n: 1, k: 1 }, { t: 1014, eff: 'Coyote 2', n: 3, k: 1 },
  { t: 1042, eff: 'Coyote 1', n: 1, k: 2 }, { t: 1046, eff: 'Coyote 2', n: 3, k: 2 },
  { t: 1071, eff: 'Coyote 1', n: 4, k: 1 }, { t: 1075, eff: 'Coyote 2', n: 5, k: 1 },
  { t: 1144, eff: 'Coyote 1', n: 6, k: 1 }, { t: 1148, eff: 'Coyote 2', n: 7, k: 1 },
]
const SYS = [
  { id: 'kurfs', kind: 'S', short: 'KuRFS', full: 'KuRFS fire-control radar (Raytheon)', dx: -40, dy: -70 },
  { id: 'lstar', kind: 'S', short: 'LSTAR', full: 'AN/TPQ-50 LSTAR air-surveillance radar (SRC)', dx: 60, dy: -30 },
  { id: 'cuaews', kind: 'S', short: 'CUAEWS DF', full: 'CUAEWS DF passive RF sensor (SRC)', dx: -70, dy: 10 },
  { id: 'ranger', kind: 'S', short: 'Ranger HDC', full: 'Ranger HDC MR EO/IR (FLIR)', dx: 30, dy: 40 },
  { id: 'faad', kind: 'C2', short: 'FAAD C2', full: 'FAAD C2 (Northrop Grumman)', dx: 0, dy: -110 },
  { id: 'lids', kind: 'E', short: 'CUAEWS EW', full: 'CUAEWS DF (SRC, LIDS EW)', dx: -60, dy: 50 },
  { id: 'coy1', kind: 'E', short: 'Coyote 1', full: 'Coyote Block 2 interceptor 1', dx: -30, dy: 25 },
  { id: 'coy2', kind: 'E', short: 'Coyote 2', full: 'Coyote Block 2 interceptor 2', dx: 35, dy: 25 },
]
const LIVE = {
  kurfs: ['TRACK', 'ok', '4 held · 12:40'], lstar: ['TRACK', 'ok', '5 held · 5:10'],
  cuaews: ['SEARCH', '', '0 held'], ranger: ['TRACK', 'ok', '1 held · 2:05'],
  faad: ['ROUTING', 'ok', '10 routed'], lids: ['READY', '', 'cont.'],
  coy1: ['TARGET', 'ok', [1, 4]], coy2: ['COOLDOWN', 'warn', [1, 4]],
}
const FINAL = {
  kurfs: ['TRACK', 'ok', '2 held · 17:06'], lstar: ['TRACK', 'ok', '2 held · 6:59'],
  cuaews: ['SEARCH', '', '0 held'], ranger: ['TRACK', 'ok', '2 held · 6:06'],
  faad: ['ROUTING', 'ok', '10 routed'], lids: ['READY', '', 'cont.'],
  coy1: ['EMPTY', 'crit', [0, 4]], coy2: ['EMPTY', 'crit', [0, 4]],
}
const MEASURES = {
  leakers: { label: 'Leakers', unit: 'members', u: 'mem', asset: true, dir: 'Minimize', mean: 8.1, lo: 8.03, hi: 8.17, scale: 1, dp: 1, range: [0, 10], trial: 10, base: 8.6 },
  kills: { label: 'Kills', unit: 'members', u: 'mem', asset: false, dir: 'Maximize', mean: 1.9, lo: 1.83, hi: 1.97, scale: 0.9, dp: 1, range: [0, 10], trial: 0, base: 1.4 },
  firstDetect: { label: 'First detect', unit: 's', u: 's', asset: false, dir: 'Minimize', mean: 183, lo: 178, hi: 188, scale: 9, dp: 0, range: [150, 220], trial: 181, base: 190 },
  minWarning: { label: 'Min warning', unit: 's', u: 's', asset: true, dir: 'Maximize', mean: 975, lo: 962, hi: 988, scale: 28, dp: 0, range: [900, 1050], trial: 982, base: 941 },
  salvos: { label: 'Salvos', unit: 'salvos', u: 'slv', asset: false, dir: 'Maximize', mean: 7.9, lo: 7.7, hi: 8.1, scale: 0.6, dp: 1, range: [0, 10], trial: 8, base: 7.2 },
}
const SENS = [
  { who: 'Coyote Block 2', f: 'pk', sw: 1.62, se: 0.08 },
  { who: 'OWA-01 (Group 3)', f: 'rcsM2', sw: 1.1, se: 0.07 },
  { who: 'KuRFS', f: 'detectRangeM', sw: 0.94, se: 0.06 },
  { who: 'Doctrine', f: 'declareHostileS', sw: 0.61, se: 0.05 },
  { who: 'Coyote Block 2', f: 'engageTimeS', sw: 0.42, se: 0.05 },
  { who: 'LSTAR', f: 'trackInitS', sw: 0.31, se: 0.04 },
  { who: 'Coyote Block 2', f: 'targetS', sw: 0.18, se: 0.04 },
  { who: 'Coyote Block 2', f: 'bdaS', sw: 0.07, se: 0.03 },
]
const FACTORS = {
  alt: { label: 'Threat altitude', unit: 'ft AGL', sug: [50, 100, 200, 400, 800, 1200], def: [100, 200, 400] },
  spd: { label: 'Threat speed', unit: 'm/s', sug: [15, 20, 25, 35, 50, 65], def: [20, 35, 50] },
  az: { label: 'Approach azimuth', unit: '° true', sug: [0, 45, 90, 135, 180, 225, 270, 315], def: [0, 90, 180, 270] },
  raid: { label: 'Raid size', unit: 'entities', sug: [1, 2, 4, 6, 8, 10], def: [2, 4, 8] },
  env: { label: 'Environment preset', unit: '', presets: ['Clear day', 'Rain', 'Fog', 'Clear night', 'Urban night'], def: ['Clear day', 'Fog', 'Clear night'] },
}
const CANDS = [
  { rk: 0, m: 8.1, lo: 7.8, hi: 8.4, pos: { kurfs: [-220, -390], lstar: [330, -160], coy1: [-170, 140], coy2: [190, 140] } },
  { rk: 1, m: 5.2, lo: 4.8, hi: 5.6, pos: { kurfs: [-60, -1480], lstar: [820, -900], coy1: [-420, -760], coy2: [380, -820] } },
  { rk: 2, m: 5.6, lo: 5.2, hi: 6.0, pos: { kurfs: [140, -1320], lstar: [-760, -840], coy1: [-300, -640], coy2: [460, -700] } },
  { rk: 3, m: 6.3, lo: 5.9, hi: 6.7, pos: { kurfs: [-20, -1050], lstar: [640, -520], coy1: [-260, -410], coy2: [300, -450] } },
]
const RUNS = [
  { id: 'RUN-0006', name: 'Current laydown', saved: '29 Sep 18:02', reps: 2000, m: { kills: [1.9, 1.83, 1.97], leakers: [8.1, 8.03, 8.17], firstDetect: [183, 178, 188], minWarning: [975, 962, 988], salvos: [7.9, 7.7, 8.1] } },
  { id: 'RUN-0005', name: 'LSTAR moved north', saved: '29 Sep 17:48', reps: 2000, m: { kills: [1.6, 1.54, 1.66], leakers: [8.4, 8.33, 8.47], firstDetect: [171, 166, 176], minWarning: [1003, 990, 1016], salvos: [7.5, 7.3, 7.7] } },
  { id: 'RUN-0004', name: 'Pre-move laydown', saved: '29 Sep 17:40', reps: 2000, m: { kills: [1.4, 1.34, 1.46], leakers: [8.6, 8.54, 8.66], firstDetect: [190, 185, 195], minWarning: [941, 928, 954], salvos: [7.2, 7.0, 7.4] } },
]
const LAUNCH = [
  ['max', 'Max range', 'Release at the first in-envelope opportunity. Pk pays the full range falloff.'],
  ['frac', 'Fraction', 'Release once the intercept point is inside the set fraction of max range.'],
  ['pk', 'Pk commit', 'Release once predicted per-shot Pk reaches the effector commit Pk. The deadline still forces the shot.'],
  ['late', 'Latest', 'Hold to the last launch that keeps the re-engagement depth.'],
]
const SCREENS = {
  prepare: [['inputs', 'Inputs'], ['fragility', 'Fragility'], ['placement', 'Placement']],
  execute: [['monitor', 'Monitor']],
  analyze: [['outcome', 'Outcome'], ['compare', 'Compare']],
}

/* ---------- state ---------- */
const S = {
  phase: 'prepare',
  screen: { prepare: 'inputs', execute: 'monitor', analyze: 'outcome' },
  data: 'results',
  notes: true,
  help: false,
  vopen: false,
  inspect: false,
  sel: null,
  dirty: false,
  playing: true,
  open: { env: false, fire: false, req: true, ents: false },
  run: { mode: 'mc', reps: 2000, seed: 4821 },
  env: { apply: true, sky: 'clear', light: 'day', em: 'rural', vis: '', wind: 0, from: 270, temp: 15, elev: 1000 },
  fire: { roe: 'tight', doctrine: true, launch: 'pk', frac: 67, depth: 2, dwell: 10 },
  req: { pd: 0.5, cum: 0.9, resid: 0.1, warn: '' },
  gateOpen: null,
  measure: 'leakers',
  sweep: { a: { f: 'alt', v: [100, 200, 400, 800] }, b: { f: 'spd', v: [20, 35, 50] } },
  sweepRan: null,
  sweepRunning: false,
  sensAll: false,
  sensOpen: null,
  sensRan: true,
  place: { goal: 'leakers', move: [], evals: 60, reps: 40, open: null, preview: null, ran: true },
  exec: { sort: 'tta', desc: false },
  out: { view: 'strip' },
  cmp: { a: 'RUN-0006', b: 'RUN-0004', baseline: true },
  drawer: { open: true, w: 408 },
}
// The app's drawer contract: 280 px minimum, 408 px default, 560 px maximum, capped at
// 44 % of the viewport; a drag 60 px past the minimum closes it.
const DRAWER = { min: 280, def: 408, max: 560, cap: 0.44, closeSlack: 60 }

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s)
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const fmt = (s) => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)
const kt = (mps) => Math.round(mps * 1.944)
const num = (n, dp = 0) => Number(n).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })
const clamp = (x, a, b) => Math.min(b, Math.max(a, x))
const CARD = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
const card = (deg) => CARD[Math.round(deg / 45) % 8]
const hasAsset = () => S.data === 'results'
const hasEns = () => S.data === 'results'
const hasTrial = () => S.data === 'results'
const hasBound = () => S.data === 'results'
const mc = () => S.run.mode === 'mc'
const measure = () => (MEASURES[S.measure].asset && !hasAsset() ? 'kills' : S.measure)
const ciDp = (m) => (m.dp === 1 ? 2 : m.dp)
const getPath = (key) => key.split('.').reduce((o, k) => o[k], S)
const setPath = (key, v) => { const ks = key.split('.'); const last = ks.pop(); ks.reduce((o, k) => o[k], S)[last] = v }

const I = {
  chev: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 4l4 4-4 4"/></svg>',
  down: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4"/></svg>',
  info: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2"/><path d="M8 7.2v4M8 4.9v.1"/></svg>',
  x: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/></svg>',
  pin: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 2.5h5M6.5 2.5v4L4 9h8L9.5 6.5v-4M8 9v4.5"/></svg>',
  eye: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="1.8"/></svg>',
  dl: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5v8M4.5 7L8 10.5 11.5 7M3 13.5h10"/></svg>',
  dots: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><circle cx="3.5" cy="8" r=".9"/><circle cx="8" cy="8" r=".9"/><circle cx="12.5" cy="8" r=".9"/></svg>',
  refresh: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M13 8a5 5 0 1 1-1.5-3.6M13 2.5v3h-3"/></svg>',
  play: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.5l7 4.5-7 4.5z"/></svg>',
  pause: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 3.5v9M10.5 3.5v9"/></svg>',
  reset: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8a5 5 0 1 0 1.5-3.6M3 2.5v3h3"/></svg>',
}

function info(title, note) {
  return `<button type="button" class="info" aria-label="About ${esc(title.toLowerCase())}" title="${esc(note)}">${I.info}</button>`
}
function help(text) {
  return `<p class="help">${text}</p>`
}
function seg(key, value, opts, aria, full = false, disabled = [], cls = '') {
  return `<span class="seg${full ? ' full' : ''}${cls ? ` ${cls}` : ''}" role="group" aria-label="${esc(aria)}">${opts
    .map(([v, l, t]) => `<button type="button" data-act="set" data-key="${key}" data-v="${esc(v)}" aria-pressed="${String(value) === String(v)}"${t ? ` title="${esc(t)}"` : ''}${disabled.includes(v) ? ' disabled' : ''}>${l}</button>`)
    .join('')}</span>`
}
function sw(key, on, label, id) {
  return `<button type="button" class="switch" id="${id}" role="switch" data-act="toggle" data-key="${key}" aria-checked="${on}"><span class="trk"></span>${label}</button>`
}
function numInput(id, key, value, a = {}) {
  return `<input id="${id}" type="number" data-key="${key}" value="${esc(value)}"${a.min != null ? ` min="${a.min}"` : ''}${a.max != null ? ` max="${a.max}"` : ''}${a.step != null ? ` step="${a.step}"` : ''}${a.ph ? ` placeholder="${a.ph}"` : ''}${a.label ? ` aria-label="${esc(a.label)}"` : ''}>`
}
function numField(id, label, key, value, unit = '', a = {}, extra = '', helpText = '') {
  return `<div class="field"><label for="${id}"><span>${label}</span></label><div class="num">${numInput(id, key, value, a)}${unit ? `<span class="u">${unit}</span>` : ''}${extra}</div>${helpText ? help(helpText) : ''}</div>`
}
function rangeField(id, label, key, value, min, max, step, out, helpText = '') {
  return `<div class="field"><label for="${id}"><span>${label}</span><span class="val" id="${id}-out">${out}</span></label><input id="${id}" type="range" data-key="${key}" min="${min}" max="${max}" step="${step}" value="${value}">${helpText ? help(helpText) : ''}</div>`
}
function segField(label, inner, helpText = '') {
  return `<div class="field"><span class="lbl">${label}</span>${inner}${helpText ? help(helpText) : ''}</div>`
}
const OUTS = {
  'env.wind': (v) => `${kt(v)} kt`,
  'env.from': (v) => `${v}° ${card(v)}`,
  'env.temp': (v) => `${v} °C`,
  'fire.frac': (v) => `${v}%`,
}
function sec({ id, title, sum = '', readout = '', end = '', body, collapsible = false }) {
  const open = collapsible ? S.open[id] : true
  const head = collapsible
    ? `<button type="button" class="sec-toggle" id="sec-${id}" data-act="sec" data-v="${id}" aria-expanded="${open}"><span class="chev">${I.chev}</span><span class="h3">${title}</span>${!open && sum ? `<span class="sum" title="${esc(sum)}">${sum}</span>` : ''}</button>`
    : `<h3>${title}</h3>${readout ? `<span class="readout">${readout}</span>` : ''}`
  const domId = { run: 'prepare-run', env: 'prepare-environment', fire: 'prepare-doctrine', req: 'prepare-requirements', ents: 'prepare-entities' }[id]
  return `<section class="sec${open ? '' : ' closed'}"${domId ? ` id="${domId}"` : ''} data-n="${id}"><div class="sec-head">${head}${end ? `<span class="end">${end}</span>` : ''}</div>${open ? `<div class="sec-body">${body}</div>` : ''}</section>`
}
function st(word, tone = '', hollow = false) {
  return `<span class="st ${tone}" title="${esc(word)}"><span class="sq${hollow ? ' hollow' : ''}${tone ? ` ${tone}` : ''}"></span><span class="w">${word}</span></span>`
}
function empty(text, action = '') {
  return `<div class="empty"><span class="grow">${text}</span>${action}</div>`
}
function toast(msg) {
  const t = document.createElement('div')
  t.className = 'toast'
  t.setAttribute('role', 'status')
  t.textContent = msg
  document.body.appendChild(t)
  setTimeout(() => t.remove(), 2600)
}

/* ---------- tab row and validity line ---------- */
function renderTabs() {
  const cur = S.screen[S.phase]
  let h = SCREENS[S.phase]
    .map(([v, l]) => `<button type="button" role="tab" class="tab" id="tab-${v}" data-act="screen" data-v="${v}" aria-selected="${!S.inspect && cur === v}">${l}</button>`)
    .join('')
  if (S.sel != null)
    h += `<button type="button" role="tab" class="tab sel-tab" id="tab-sel" data-act="inspect" aria-selected="${S.inspect}" title="${GROUP} ${S.sel}">OWA-01 ${S.sel}</button>`
  h += `<span class="spacer"></span><button type="button" class="icon-btn" id="panel-menu" data-act="menu" aria-label="Panel options" title="Panel options">${I.dots}</button>`
  $('#tabrow').innerHTML = h
}

function findings() {
  const f = []
  if (!hasAsset())
    f.push({
      msg: 'No defended asset is placed.',
      sub: 'Warning time, arrival and leakage are not measurable.',
      gates: 'Gates: DETECT · TRACK',
      act: ['Place asset', 'The Library opens at Assets. Place the defended asset on the board.'],
    })
  f.push({
    msg: 'These models are not validated: Environment, Doctrine, Parameter spread, Classification.',
    sub: 'Their outputs are planning factors.',
    gates: 'Scenario-wide',
  })
  return f
}

function renderValidity() {
  const el = $('#validity')
  if ((S.phase === 'execute' && !S.vopen) || S.inspect || !S.drawer.open) { el.innerHTML = ''; return }
  if (S.phase === 'analyze' && !hasTrial()) {
    el.innerHTML = `<div class="vline" data-n="validity"><span class="lbl">Trial validity</span>${st('PENDING')}<span class="cnt">No trial yet</span></div>`
    return
  }
  const f = findings()
  const lbl = S.phase === 'analyze' ? 'Trial validity' : 'Forecast validity'
  let h = `<button type="button" class="vline" id="vline" data-act="validity" data-n="validity" aria-expanded="${S.vopen}"><span class="lbl">${lbl}</span>${st('VALID, LIMITED', 'warn')}<span class="cnt">${f.length} ${f.length === 1 ? 'finding' : 'findings'}</span><span class="chev">${S.vopen ? I.down : I.chev}</span></button>`
  if (S.vopen)
    h += `<div class="vbody">${f
      .map((x) => `<div class="finding"><span class="sq lim" title="LIMITS"></span><span class="msg">${x.msg}</span>${x.act ? `<span class="act"><button type="button" class="btn mini" data-act="toast" data-msg="${esc(x.act[1])}">${x.act[0]}</button></span>` : ''}<span class="sub">${x.sub}</span><span class="gates">${x.gates}</span></div>`)
      .join('')}</div>`
  el.innerHTML = h
}

/* ---------- Prepare: Inputs ---------- */
function gates() {
  const q = S.req
  const asset = hasAsset()
  const warn = q.warn === '' ? null : Number(q.warn)
  const detFail = TRACKS.filter((t) => t.pd < q.pd || (asset && warn != null && t.arr - t.d < warn))
  const trkFail = TRACKS.filter((t) => t.cum < q.cum)
  const effFail = TRACKS.filter((t) => t.res > q.resid)
  const defeat = (1 - TRACKS.reduce((s, t) => s + t.res, 0) / TRACKS.length) * 100
  const tag = (t, why) => [t.n, why]
  const box = (id, key, val, a, unit = '') => `<span class="num">${numInput(id, key, val, a)}${unit ? `<span class="u">${unit}</span>` : ''}</span>`
  return [
    {
      id: 'detect', name: 'DETECT', sub: 'first T+3:01', met: 10 - detFail.length, fc: 'First detection T+3:01',
      thr: [
        ['Pd ≥', box('req-pd', 'req.pd', q.pd.toFixed(2), { min: 0.05, max: 0.99, step: 0.05, label: 'Detect single-scan Pd threshold' })],
        ['warn ≥', box('req-warn', 'req.warn', q.warn, { min: 0, step: 5, ph: 'None', label: 'Minimum warning, seconds' }, 's')],
      ],
      fails: detFail.map((t) => tag(t, t.pd < q.pd ? `Pd ${t.pd.toFixed(2)}` : `warning ${fmt(t.arr - t.d)}`)),
    },
    {
      id: 'track', name: 'TRACK', met: 10 - trkFail.length, fc: `${10 - trkFail.length}/10 held at decision`,
      thr: [['cum. Pd ≥', box('req-cum', 'req.cum', q.cum.toFixed(2), { min: 0.05, max: 0.99, step: 0.05, label: 'Track cumulative Pd threshold' })]],
      fails: trkFail.map((t) => tag(t, `cum. Pd ${t.cum.toFixed(2)}`)),
    },
    { id: 'identify', name: 'IDENTIFY', met: 10, fc: '10/10 identified hostile', thr: [], fails: [] },
    { id: 'target', name: 'TARGET', met: 8, fc: '8/10 with a usable window', thr: [], fails: TRACKS.filter((t) => t.tgt == null).map((t) => tag(t, 'no firing window')) },
    {
      id: 'engage', name: 'ENGAGE', met: 6, fc: '6/10 engaged', thr: [],
      fails: TRACKS.filter((t) => t.eng == null).map((t) => tag(t, t.tgt == null ? 'never targeted' : 'window after last launch')),
    },
    {
      id: 'effect', name: 'EFFECT', sub: asset ? `${defeat.toFixed(1)}% defeat` : 'needs asset', met: asset ? 10 - effFail.length : null,
      fc: asset ? `${defeat.toFixed(1)}% forecast defeat` : 'Not evaluated: no defended asset',
      thr: [['residual ≤', box('req-resid', 'req.resid', q.resid.toFixed(2), { min: 0, max: 1, step: 0.05, label: 'Maximum residual per track' })]],
      fails: asset ? effFail.map((t) => tag(t, `residual ${t.res.toFixed(2)}`)) : [],
    },
  ]
}
function gateSummary() {
  const g = gates()
  const ev = g.filter((x) => x.met != null)
  const met = ev.filter((x) => x.met === 10).length
  return { g, met, total: g.length, ne: g.length - ev.length }
}
const c = (span, html) => `<div class="s${span}">${html}</div>`

function renderInputs() {
  const r = S.run
  const e = S.env
  const f = S.fire
  const stale = S.dirty && hasEns() && mc()
  const runBody = `<div class="grid4">
      ${c(2, segField('Mode', seg('run.mode', r.mode, [['mc', 'Monte Carlo'], ['det', 'Deterministic']], 'Run mode', true)))}
      ${mc()
        ? `${c(1, numField('run-reps', 'Runs', 'run.reps', r.reps, '', { min: 10, step: 100 }))}${c(1, numField('run-seed', 'Seed', 'run.seed', r.seed, '', { min: 0, step: 1 }, `<button type="button" class="info" data-act="reseed" aria-label="New seed" title="New seed">${I.refresh}</button>`))}`
        : '<p class="s2 small muted ctl-end">One expected-value pass. Fragility and Placement need Monte Carlo.</p>'}
    </div>
    ${help('Stop rule, what varies and sensitivity depth stay in Settings, Run.')}`
  const run = sec({
    id: 'run', title: 'Run', body: runBody,
    end: `${stale ? st('ENSEMBLE STALE', 'warn') : ''}<button type="button" class="link" data-act="toast" data-msg="Settings opens at Run: stop rule, what varies, sensitivity depth.">Settings</button>`,
  })

  const envSum = e.apply
    ? [cap(e.sky), cap(e.light), e.em === 'rural' ? 'Rural' : 'Urban', `wind ${kt(e.wind)} kt`, `${e.temp} °C`, `${num(e.elev)} ft`].join(' · ')
    : 'Effects off'
  const envBody = `
    ${e.apply ? '' : '<p class="small muted" style="margin:0">Effects are off. Sensors and threats ignore these values.</p>'}
    <div class="grid4">
      ${c(2, segField('Sky', seg('env.sky', e.sky, [['clear', 'Clear'], ['rain', 'Rain'], ['fog', 'Fog']], 'Sky', true)))}
      ${c(2, segField('Light', seg('env.light', e.light, [['day', 'Day'], ['night', 'Night']], 'Light', true)))}
      ${c(2, segField('EM clutter', seg('env.em', e.em, [['rural', 'Rural', 'Rural: quiet RF background'], ['urban', 'Urban', 'Urban: dense RF background']], 'EM clutter', true)))}
      ${c(2, numField('env-vis', 'Visibility', 'env.vis', e.vis, 'm', { min: 0, step: 500, ph: 'Auto' }, '', 'Blank = 10,000 m from the sky setting.'))}
      ${c(2, rangeField('env-wind', 'Wind', 'env.wind', e.wind, 0, 25, 1, OUTS['env.wind'](e.wind)))}
      ${c(2, rangeField('env-from', 'Wind from', 'env.from', e.from, 0, 355, 5, OUTS['env.from'](e.from)))}
      ${c(2, rangeField('env-temp', 'Temperature', 'env.temp', e.temp, -30, 50, 1, OUTS['env.temp'](e.temp)))}
      ${c(2, numField('env-elev', 'Field elevation', 'env.elev', e.elev, 'ft', { step: 500 }))}
    </div>
    ${help('Rain, fog, night and EM clutter change sensor performance by technology. Cold, altitude and wind change UAS reach. Factors follow the COURAGEOUS C-UAS study.')}`
  const env = sec({
    id: 'env', title: 'Environment', collapsible: true, sum: envSum, body: envBody,
    end: sw('env.apply', e.apply, 'Effects', 'env-apply'),
  })

  const lp = LAUNCH.find((x) => x[0] === f.launch)
  const fireSum = `ROE ${cap(f.roe)} · ${f.doctrine ? `${lp[1]} · ${f.depth} cycles · ${f.dwell} s dwell` : 'doctrine off'}`
  const fireBody = `<div class="grid4">
      ${c(2, segField('ROE', seg('fire.roe', f.roe, [['hold', 'Hold'], ['tight', 'Tight'], ['free', 'Free']], 'ROE', true)))}
      ${c(2, `<div class="field"><span class="lbl">Doctrine</span><span class="ctl-h" title="Doctrinal fire control: stable track, hostile declaration, target dwell, launch-point policy, shoot-look-shoot with BDA">${sw('fire.doctrine', f.doctrine, f.doctrine ? 'On' : 'Off', 'fire-doctrine')}</span></div>`)}
      ${f.doctrine
        ? `${c(4, segField('Launch point', seg('fire.launch', f.launch, LAUNCH, 'Launch point', true, [], 'g2'), lp[2]))}
          ${f.launch === 'frac' ? c(4, rangeField('fire-frac', 'Release range', 'fire.frac', f.frac, 10, 100, 5, OUTS['fire.frac'](f.frac), 'Release inside this share of max range.')) : ''}
          ${c(2, numField('fire-depth', 'Re-engagement depth', 'fire.depth', f.depth, 'cycles', { min: 0, max: 5, step: 1 }, '', 'Cycles kept before arrival.'))}
          ${c(2, numField('fire-dwell', 'Declaration dwell', 'fire.dwell', f.dwell, 's', { min: 0, step: 1 }, '', 'Hostile declaration dwell.'))}`
        : '<p class="s4 small muted" style="margin:0">ROE gating only. Every ready effector fires when the window opens. Preparation and travel times still apply.</p>'}
    </div>`
  const fire = sec({
    id: 'fire', title: 'Fire control', collapsible: true, sum: fireSum, body: fireBody,
    end: info('Fire control', 'Detect, track, identify, target, engage, assess. A shot needs a stable track routed to the shooter, hostile identification, the declaration dwell, the kill-chain hop latency and the shooter target dwell. All timing values are planning factors, not measured performance.'),
  })

  const gs = gateSummary()
  const reqSum = `${gs.met} of ${gs.total} gates met${gs.ne ? ` · ${gs.ne} not evaluated` : ''} · forecast`
  const rows = gs.g
    .map((g) => {
      const status = g.met == null ? st('N/E', '', true) : g.met === 10 ? st('10/10', 'ok') : st(`${g.met}/10`, 'crit')
      const click = g.fails.length > 0
      const open = click && S.gateOpen === g.id
      const thr = g.thr.length
        ? g.thr.map(([q, b]) => `<span class="tl"><span class="q" title="${esc(q)}">${q}</span>${b}</span>`).join('')
        : '<span class="tl"><span class="q"></span><span class="none" title="No pass line for this gate">—</span></span>'
      const fail = open
        ? `<div class="gfail fl"><span class="dim xs">Blocking</span>${g.fails
            .map(([n, why]) => `<button type="button" class="btn mini" data-act="select-track" data-v="${n}" title="${esc(why)}">OWA-01 ${n} <span class="dim mono xs">${why}</span></button>`)
            .join('')}</div>`
        : ''
      return `<div class="gr${click ? ' click' : ''}" role="row"${click ? ` data-act="gate" data-v="${g.id}" aria-expanded="${open}" title="Show blocking tracks"` : ''}><span class="g" role="cell">${g.name}${g.sub ? `<small>${g.sub}</small>` : ''}</span><span class="thr" role="cell">${thr}</span><span class="met" role="cell" title="${esc(g.fc)}">${status}</span></div>${fail}`
    })
    .join('')
  const reqBody = `<div class="gtable" role="table" aria-label="Requirement gates"><div class="gh" role="row"><span role="columnheader">Gate</span><span class="thr" role="columnheader">Pass line</span><span class="r" role="columnheader">Met</span></div>${rows}</div>
      ${help('Pass lines are inputs the test defines. The forecast is the deterministic planning envelope; it does not score a trial. Click a failed gate to see its blocking tracks.')}`
  const req = sec({
    id: 'req', title: 'Requirements', collapsible: true, sum: reqSum, body: reqBody,
    end: info('Requirements', 'Pass lines the test defines, beside the forecast result of each gate. The forecast is the deterministic planning envelope. It does not adjudicate the simulated trial.'),
  })
  const groups = [
    ['Threats', TRACKS.map((t) => ({ kind: 'T', name: `${GROUP} ${t.n}`, short: `${t.n}`, state: t.tgt == null ? 'no window' : 'engageable', warn: t.tgt == null, sel: t.n }))],
    ...[['S', 'Sensors'], ['C2', 'C2'], ['E', 'Effectors']].map(([k, label]) => [label, SYS.filter((s) => s.kind === k).map((s) => ({ kind: s.kind, name: s.full, short: s.short, state: 'enabled' }))]),
    ...(hasAsset() ? [['Assets', [{ kind: 'A', name: 'Defended asset 1', short: 'Defended asset 1', state: 'enabled' }]]] : []),
  ]
  const count = groups.reduce((n, [, rows]) => n + rows.length, 0)
  const entBody = groups
    .map(([label, rows]) => `<div class="sys-group">${label} <span class="mono xs">${rows.length}</span></div>${rows
      .map((r) => `<button type="button" class="ent" ${r.sel ? `data-act="select-track" data-v="${r.sel}"` : `data-act="toast" data-msg="${esc(`${r.name} opens in the Selected object tab.`)}"`} title="${esc(r.name)}"><span class="kind">${r.kind}</span><span class="nm">${r.kind === 'T' ? `<span class="dim">${GROUP}</span> ${r.short}` : esc(r.short)}</span><span class="state${r.warn ? ' warn' : ''}">${r.state}</span></button>`)
      .join('')}`)
    .join('')
  const ents = sec({
    id: 'ents', title: 'Entities', collapsible: true, sum: `${count} placed · 10 threats`, body: `<div>${entBody}</div>`,
    end: info('Entities', 'Every placed entity with its forecast state. Click a row to open it in the Selected object tab. The Entities button in the board rail opens this section.'),
  })
  return run + env + fire + req + ents
}

/* ---------- Prepare: Fragility ---------- */
const sig = () => JSON.stringify([S.sweep.a, S.sweep.b])
function cellValue(fa, va, fb, vb) {
  const eff = (f, v) =>
    f === 'alt' ? Math.log2(Math.max(v, 25) / 100) * 0.55
      : f === 'spd' ? (v - 25) * 0.045
        : f === 'az' ? Math.cos(((v - 180) * Math.PI) / 180) * -0.6
          : f === 'raid' ? (v - 4) * 0.35
            : ({ 'Clear day': -0.4, Rain: 0.5, Fog: 0.9, 'Clear night': 0.3, 'Urban night': 1.1 })[v] ?? 0
  const x = clamp(7.4 + eff(fa, va) + (fb ? eff(fb, vb) : 0), 0, 10)
  const m = measure()
  if (m === 'leakers') return x
  if (m === 'kills') return 10 - x
  if (m === 'firstDetect') return 183 + (x - 8.1) * 9
  if (m === 'minWarning') return 975 - (x - 8.1) * 28
  return 7.9 - (x - 8.1) * 0.6
}
function sweepCheck() {
  const fs = [S.sweep.a, S.sweep.b].filter(Boolean)
  if (fs.some((f) => f.v.length < 2 || f.v.length > 6)) return 'Give each factor 2 to 6 values.'
  if (fs.length === 2 && fs[0].f === fs[1].f) return 'Choose two different factors.'
  return null
}
function factorBlock(ax, fc) {
  const F = FACTORS[fc.f]
  const opts = Object.entries(FACTORS)
    .map(([k, x]) => `<option value="${k}"${k === fc.f ? ' selected' : ''}>${x.label}${x.unit ? ` (${x.unit})` : ''}</option>`)
    .join('')
  const chips = fc.v
    .map((v) => `<span class="chip">${esc(v)}<button type="button" data-act="chip-del" data-ax="${ax}" data-v="${esc(v)}" aria-label="Remove ${esc(v)}">${I.x}</button></span>`)
    .join('')
  const add = F.presets || fc.v.length >= 6 ? '' : `<span class="chip add"><input id="add-${ax}" data-add="${ax}" inputmode="decimal" placeholder="Value" aria-label="Add a ${esc(F.label.toLowerCase())} value"></span>`
  const pool = (F.presets || F.sug).filter((v) => !fc.v.includes(v))
  const sug = pool.length && fc.v.length < 6
    ? `<div class="suggest"><span>Add</span>${pool.map((v) => `<button type="button" data-act="chip-sug" data-ax="${ax}" data-v="${esc(v)}">${esc(v)}</button>`).join('')}</div>`
    : ''
  return `<div class="factor" data-n="factor-${ax}">
    <div class="field"><div class="lbl-row"><label for="factor-${ax}">Factor ${ax.toUpperCase()}</label>${ax === 'b' ? '<button type="button" class="link" data-act="factor-del">Remove</button>' : ''}</div><select class="sel" id="factor-${ax}" data-key="sweep.${ax}.f">${opts}</select></div>
    <div class="chips">${chips}${add}</div>${sug}</div>`
}
function heatGrid() {
  const A = S.sweep.a
  const B = S.sweep.b
  const filled = S.sweepRan === sig() && !S.sweepRunning
  const rowsV = B ? B.v : [null]
  const vals = []
  rowsV.forEach((vb) => A.v.forEach((va) => vals.push(cellValue(A.f, va, B && B.f, vb))))
  const lo = Math.min(...vals)
  const hi = Math.max(...vals)
  const worseHigh = ['leakers', 'firstDetect'].includes(measure())
  const tint = (v) => {
    const t = hi === lo ? 0.5 : (v - lo) / (hi - lo)
    const bad = worseHigh ? t : 1 - t
    return `color-mix(in srgb, var(--crit) ${Math.round(8 + bad * 52)}%, var(--sunken))`
  }
  const m = MEASURES[measure()]
  let h = `<div class="heat" style="grid-template-columns:44px repeat(${A.v.length}, minmax(0, 1fr))"><span></span>${A.v.map((v) => `<span class="h">${esc(v)}</span>`).join('')}`
  let i = 0
  rowsV.forEach((vb) => {
    h += `<span class="h rowh">${vb == null ? '' : esc(vb)}</span>`
    A.v.forEach(() => {
      const v = vals[i++]
      h += filled
        ? `<span class="c" style="background:${tint(v)}" title="${esc(m.label)} ${num(v, m.dp)} ${m.unit}">${num(v, m.dp)}</span>`
        : `<span class="c blank">${S.sweepRunning ? '…' : ''}</span>`
    })
  })
  h += '</div>'
  const ramp = [0, 0.25, 0.5, 0.75, 1].map((t) => `<i style="background:color-mix(in srgb, var(--crit) ${Math.round(8 + t * 52)}%, var(--sunken))"></i>`).join('')
  h += `<div class="heat-cap"><span>Columns: ${FACTORS[A.f].label}${FACTORS[A.f].unit ? ` (${FACTORS[A.f].unit})` : ''}${B ? ` · Rows: ${FACTORS[B.f].label}${FACTORS[B.f].unit ? ` (${FACTORS[B.f].unit})` : ''}` : ''}</span>${filled ? `<span>better <span class="ramp">${ramp}</span> worse</span>` : `<span>${S.sweepRunning ? 'Running…' : 'Run sweep to fill'}</span>`}</div>`
  return h
}
function renderFragility() {
  const asset = hasAsset()
  const key = measure()
  const M = MEASURES[key]
  const opts = Object.entries(MEASURES)
    .map(([k, m]) => {
      const na = m.asset && !asset
      return `<option value="${k}"${key === k ? ' selected' : ''}${na ? ' disabled' : ''}>${m.label} (${m.unit})${na ? ' · needs asset' : ''}</option>`
    })
    .join('')
  let h = `<div class="grid4 top" data-n="measure">${c(4, `<div class="field"><label for="measure">Measure</label><select class="sel" id="measure" data-key="measure">${opts}</select>${help('One measure drives the ensemble focus, the sweep map and the sensitivity ranking.')}</div>`)}</div>`
  if (!mc())
    h += empty('Fragility needs Monte Carlo mode.', `<button type="button" class="btn mini" data-act="set" data-key="run.mode" data-v="mc">Use Monte Carlo</button>`)

  // Ensemble
  const ens = hasEns() && mc()
  const ensRows = Object.entries(MEASURES)
    .map(([k, m]) => {
      const na = m.asset && !asset
      const on = k === key
      return `<tr${on ? ' class="on"' : ''}><td>${m.label}</td><td class="m r">${na ? '—' : `${num(m.mean, m.dp)} <span class="dim">${m.unit === 'members' ? '/10' : m.unit}</span>`}</td><td class="m r dim">${na ? 'needs asset' : `${num(m.lo, ciDp(m))}–${num(m.hi, ciDp(m))}`}</td></tr>`
    })
    .join('')
  const ensBody = ens
    ? `<table class="tb" aria-label="Ensemble means"><colgroup><col><col style="width:100px"><col style="width:110px"></colgroup><thead><tr><th>Quantity</th><th class="r">Mean</th><th class="r">95 % CI of mean</th></tr></thead><tbody>${ensRows}</tbody></table>`
    : empty(`No ensemble for this setup. Press <b>Run</b> <span class="mono xs">⌘↵</span> in the top bar to run ${num(S.run.reps)} replicates.`)
  h += sec({
    id: 'ensemble', title: 'Ensemble', readout: ens ? `${num(S.run.reps)} runs · seed ${S.run.seed} · T+${fmt(DUR)}` : '', body: ensBody,
    end: `<button type="button" class="btn mini" data-act="toast" data-msg="Pinned RUN-0006 as the baseline for Compare."${ens ? '' : ' disabled title="Run the ensemble first"'}>${I.pin}Pin</button>`,
  })

  // Sweep
  const A = S.sweep.a
  const B = S.sweep.b
  const err = sweepCheck()
  const cells = A.v.length * (B ? B.v.length : 1)
  const secs = Math.max(1, Math.ceil((cells * 40) / 150))
  const sweepBody = `${factorBlock('a', A)}${B ? factorBlock('b', B) : `<button type="button" class="link" data-act="factor-add" style="align-self:flex-start">Add second factor</button>`}
    ${err ? `<p class="err">${err}</p>` : heatGrid()}
    ${help('Values are planning factors. Each cell is a 40-replicate run of the full scenario. Up to two factors and 36 cells.')}`
  h += sec({
    id: 'sweep', title: 'Sweep', readout: err ? '' : `${cells} cells · 40 runs each · ~${secs} s`, body: sweepBody,
    end: `<button type="button" class="btn mini" data-act="run-sweep"${err || !mc() || S.sweepRunning ? ' disabled' : ''}${err ? ` title="${esc(err)}"` : ''}>${S.sweepRunning ? 'Running' : 'Run sweep'}</button>`,
  })

  // Sensitivity
  const ranked = [...SENS].sort((a, b) => b.sw - a.sw)
  const shown = S.sensAll ? ranked : ranked.slice(0, 5)
  const max = ranked[0].sw * M.scale
  const sensRows = shown
    .map((r, i) => {
      const swv = r.sw * M.scale
      const open = S.sensOpen === i
      const lo = M.mean - swv / 2
      const hi = M.mean + swv / 2
      return `<div class="srow"><button type="button" data-act="sens-row" data-v="${i}" aria-expanded="${open}"><span class="nm">${esc(r.who)} <span class="f">${r.f}</span><span class="pf" title="Planning-factor spread">PF</span></span><span class="bar"><i style="width:${(swv / max) * 100}%"></i></span><span class="sv">${num(swv, M.dp === 0 ? 0 : 2)} ${M.u}</span></button>${open ? `<div class="more">p10 ${num(lo, M.dp)} → p90 ${num(hi, M.dp)} · SE ${(r.se * M.scale).toFixed(2)} · paired runs</div>` : ''}</div>`
    })
    .join('')
  const sensBody = hasEns() && mc() && S.sensRan
    ? `<div class="sens">${sensRows}</div>${ranked.length > 5 ? `<button type="button" class="link" data-act="sens-all" style="align-self:flex-start">${S.sensAll ? 'Show top 5' : `Show all ${ranked.length}`}</button>` : ''}`
    : empty(`Rank the inputs that move <b>${M.label.toLowerCase()}</b> most. ${SENS.length} fields carry a spread.`)
  h += sec({
    id: 'sens', title: 'Sensitivity', readout: hasEns() && mc() ? `Morris · ${SENS.length} fields` : '', body: sensBody,
    end: `<button type="button" class="btn mini" data-act="run-sens"${mc() ? '' : ' disabled'}>${hasEns() ? 'Run again' : 'Run sensitivity'}</button>${info('Sensitivity', 'Method: Morris screening, then Sobol indices on the fields it keeps (depth is set in Settings, Run). Swing is the MC mean at parameter p10 against p90, not an uncertainty interval. SE is paired.')}`,
  })
  return h
}

/* ---------- Prepare: Placement ---------- */
function renderPlacement() {
  const asset = hasAsset()
  const P = S.place
  const goalOpts = Object.entries(MEASURES)
    .map(([k, m]) => {
      const na = m.asset && !asset
      return `<option value="${k}"${P.goal === k ? ' selected' : ''}${na ? ' disabled' : ''}>${m.dir} ${m.label.toLowerCase()}${na ? ' · needs asset' : ''}</option>`
    })
    .join('')
  let h = `<div class="grid4 top" data-n="goal">${c(4, `<div class="field"><label for="place-goal">Goal</label><select class="sel" id="place-goal" data-key="place.goal">${goalOpts}</select></div>`)}</div>`

  const groups = [['S', 'Sensors'], ['C2', 'C2'], ['E', 'Effectors']]
  const moveBody = groups
    .map(([k, label]) => `<div class="sys-group">${label}</div>${SYS.filter((s) => s.kind === k)
      .map((s) => `<label class="mv" for="mv-${s.id}"><input type="checkbox" id="mv-${s.id}" data-mv="${s.id}"${P.move.includes(s.id) ? ' checked' : ''}><span class="kind">${s.kind}</span><span class="nm">${s.short} <span class="full">${esc(s.full)}</span></span></label>`)
      .join('')}`)
    .join('')
  h += sec({
    id: 'move', title: 'Systems to move', readout: `${P.move.length} of ${SYS.length}`, body: `<div>${moveBody}</div>`,
    end: `<button type="button" class="link" data-act="mv-all">All</button><button type="button" class="link" data-act="mv-none">None</button>${info('Systems to move', 'Every other entity, every threat and every asset stays put.')}`,
  })

  const boundBody = hasBound()
    ? `<div class="field"><label for="bound">Range boundary</label><select class="sel" id="bound"><option>Range A · 6 points</option></select></div>`
    : empty('No range boundary on the board.', `<button type="button" class="btn mini" data-act="toast" data-msg="Boundary tool is active. Click the board to add points; double-click to close the polygon.">Draw boundary</button>`)
  h += sec({ id: 'bounds', title: 'Bounds', body: boundBody, end: info('Bounds', 'A proposal stays inside the range polygon, in the meters world frame.') })

  const evals = Number(P.evals)
  const reps = Number(P.reps)
  const budgetOk = Number.isInteger(evals) && evals >= 2 && Number.isInteger(reps) && reps >= 1
  const needs = []
  if (!mc()) needs.push('Monte Carlo mode')
  if (P.move.length === 0) needs.push('a system to move')
  if (!hasBound()) needs.push('a range boundary')
  if (!budgetOk) needs.push('whole-number budget')
  const total = budgetOk ? evals * reps : 0
  const budgetBody = `<div class="grid4">
      ${c(1, numField('pl-evals', 'Evaluations', 'place.evals', P.evals, '', { min: 2, step: 1 }))}
      ${c(1, numField('pl-reps', 'Runs each', 'place.reps', P.reps, '', { min: 1, step: 1 }))}
      ${c(2, `<div class="field"><span class="lbl">Total</span><span class="ctl-h mono small">${budgetOk ? `${num(total)} runs <span class="dim">· ~${Math.ceil(total / 150)} s</span>` : '—'}</span></div>`)}
    </div>
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <button type="button" class="btn" data-act="run-place"${needs.length ? ' disabled' : ''}>Run placement</button>
      ${needs.length ? `<span class="needs"><span class="dim">Needs</span>${needs.map((n) => `<span><span class="sq hollow warn"></span>${n}</span>`).join('')}</span>` : ''}
    </div>`
  h += sec({
    id: 'budget', title: 'Budget', body: budgetBody,
    end: info('Budget', `Gaussian process with expected improvement over the movable positions. Each evaluation is a replicate run under common random numbers at seed ${S.run.seed}. Modeled, not observed.`),
  })

  if (P.ran && hasEns()) {
    const start = CANDS[0]
    const pct = (v) => (v / 10) * 100
    const list = CANDS.map((c) => {
      const open = P.open === c.rk
      const delta = c.m - start.m
      const pos = open
        ? `<div class="cand-pos">${Object.entries(c.pos).map(([id, [x, y]]) => `<span>${SYS.find((s) => s.id === id).short}</span><span>${x}, ${y} m</span>`).join('')}</div>`
        : ''
      return `<div class="cand${c.rk === 0 ? ' start' : ''}"><div class="cand-row" data-act="cand" data-v="${c.rk}" style="cursor:pointer" title="Show positions">
          <span class="rk">${c.rk === 0 ? 'Start' : `#${c.rk}`}</span>
          <span class="iv"><span class="track"></span><span class="ref" style="left:${pct(start.m)}%"></span><span class="band" style="left:${pct(c.lo)}%;width:${pct(c.hi - c.lo)}%"></span><span class="mean" style="left:${pct(c.m)}%"></span></span>
          <span class="d${delta < 0 ? ' good' : ''}">${c.rk === 0 ? `${num(c.m, 1)}` : `${delta > 0 ? '+' : '−'}${num(Math.abs(delta), 1)}`}</span>
          <span class="acts">${c.rk === 0 ? '' : `<button type="button" class="icon-btn" data-act="preview" data-v="${c.rk}" aria-pressed="${P.preview === c.rk}" aria-label="Preview candidate ${c.rk} on the board" title="Preview on the board" style="width:24px;height:24px">${I.eye}</button><button type="button" class="btn mini" data-act="toast" data-msg="Installed a copy: Untitled scenario (placement ${c.rk}). The run is cleared; the original scenario is unchanged.">Apply</button>`}</span>
        </div>${pos}</div>`
    }).join('')
    const goalNote = P.goal !== 'leakers' ? `<p class="small muted" style="margin:0">This result is for Minimize leakers. Run placement again for the new goal.</p>` : ''
    h += sec({
      id: 'cands', title: 'Candidates', readout: 'leakers, members · 60 evaluations',
      body: `${goalNote}<div class="strip-axis" style="grid-template-columns:40px minmax(0,1fr) 48px 80px"><span></span><span class="ax">${[0, 5, 10].map((v, i) => `<span style="position:absolute;left:${v * 10}%;transform:translateX(${i === 0 ? '0' : i === 2 ? '-100%' : '-50%'})">${v}</span>`).join('')}</span><span style="text-align:right" title="Change against the start laydown">Change</span><span></span></div><div>${list}</div>`,
      end: info('Candidates', 'Best first by the objective mean. The bar is the 95 % interval on each mean; the dashed line is the start laydown. Apply installs a copy of this scenario with the candidate positions and clears the run. The current scenario is never edited in place.'),
    })
  } else {
    h += sec({ id: 'cands', title: 'Candidates', body: empty('No placement result yet.') })
  }
  return h
}

/* ---------- Execute: Monitor ---------- */
function trackState(t, T) {
  if (T >= t.arr) return 'leaked'
  if (t.eng != null && T >= t.eng) return 'engaged'
  if (t.tgt != null && T >= t.tgt) return 'targeted'
  if (T >= t.id) return 'identified'
  if (T >= t.d && HELD[t.n].length) return 'tracked'
  if (T >= t.d) return 'detected'
  return 'undetected'
}
const STAGE = { undetected: 0, detected: 1, tracked: 2, identified: 3, targeted: 4, engaged: 5, defeated: 6, leaked: 6 }
function pips(state) {
  const n = STAGE[state]
  const cls = state === 'leaked' ? ' leak' : state === 'defeated' ? ' dead' : ''
  const names = ['detect', 'track', 'identify', 'target', 'engage', 'defeat']
  return `<span class="pips${cls}" title="${names.slice(0, Math.min(n, 6)).join(' › ') || 'not detected'}">${names.map((_, i) => `<i class="${i < n - 1 ? 'on' : i === n - 1 ? 'now' : ''}"></i>`).join('')}</span>`
}
function stateTone(s) {
  return s === 'engaged' || s === 'leaked' ? ['crit', false] : s === 'targeted' ? ['warn', false] : s === 'identified' ? ['', true] : s === 'defeated' ? ['ghost', false] : ['', false]
}
function systemRows(snapshot) {
  const groups = [['S', 'Sensors'], ['C2', 'C2'], ['E', 'Effectors']]
  return groups
    .map(([k, label]) => `<div class="sys-group">${label}</div>${SYS.filter((s) => s.kind === k)
      .map((s) => {
        const [word, tone, rd] = snapshot[s.id]
        const read = Array.isArray(rd)
          ? `<span class="mag" title="${rd[0]} of ${rd[1]} remaining">${Array.from({ length: rd[1] }, (_, i) => `<i class="${i < rd[0] ? 'full' : ''}"></i>`).join('')}</span> ${rd[0]}/${rd[1]}`
          : rd
        return `<div class="sys" title="${esc(s.full)}"><span class="kind">${s.kind}</span><span class="nm">${s.short}</span>${st(word, tone)}<span class="rd">${read}</span></div>`
      })
      .join('')}`)
    .join('')
}
function renderMonitor() {
  if (!hasTrial()) return `<div style="padding-top:14px">${empty('No trial yet. Press <b>Play</b> <span class="mono xs">⌘↵</span> to run one draw.')}</div>`
  const T = EXEC_T
  const reached = (x) => x != null && x <= T
  const f = [
    ['DET', 'Detected', TRACKS.filter((t) => reached(t.d)).length],
    ['ID', 'Identified hostile', TRACKS.filter((t) => reached(t.id)).length],
    ['TGT', 'Targeted: firing window open', TRACKS.filter((t) => reached(t.tgt)).length],
    ['ENG', 'Engaged: salvo assigned', TRACKS.filter((t) => reached(t.eng)).length],
    ['DEF', 'Defeated before arrival', 0],
    ['LEAK', 'Leaked: arrived undefeated', TRACKS.filter((t) => reached(t.arr)).length],
  ]
  const funnel = `<div class="funnel" data-n="funnel" aria-label="Kill-chain funnel">${f
    .map(([k, t, v]) => `<div class="${k === 'LEAK' ? 'leak' : ''}${v === 0 ? ' zero' : ''}" title="${t}: ${v} of 10"><div class="k">${k}</div><div class="v">${v}<small>/10</small></div><div class="bar"><i style="width:${v * 10}%"></i></div></div>`)
    .join('')}</div>`

  const rows = TRACKS.map((t) => ({ t, state: trackState(t, T), tta: t.arr - T, held: HELD[t.n] }))
  const key = S.exec.sort
  const dir = S.exec.desc ? -1 : 1
  rows.sort((a, b) => {
    const v = key === 'track' ? a.t.n - b.t.n : key === 'state' ? STAGE[b.state] - STAGE[a.state] : key === 'held' ? a.held.length - b.held.length : a.tta - b.tta
    return v * dir || a.t.n - b.t.n
  })
  const th = (k, l, cls = '', w = '') => `<th class="${cls}"${w ? ` style="width:${w}"` : ''}><button type="button" data-act="sort" data-v="${k}"${S.exec.sort === k ? ` aria-sort="${S.exec.desc ? 'descending' : 'ascending'}"` : ''}>${l}${S.exec.sort === k ? (S.exec.desc ? ' ↓' : ' ↑') : ''}</button></th>`
  const body = rows
    .map(({ t, state, tta, held }) => {
      const [tone, hollow] = stateTone(state)
      const ttaCls = tta < 60 ? 'tta-crit' : tta < 120 ? 'tta-warn' : ''
      return `<tr class="click${S.sel === t.n ? ' on' : ''}" data-act="select-track" data-v="${t.n}" title="${GROUP} ${t.n} · held by ${esc(held.join(', ') || 'none')}"><td class="m">${t.n}</td><td>${pips(state)}</td><td>${st(state, tone, hollow)}</td><td class="c-held" title="${esc(held.join(', ') || 'not held')}">${held.length ? held.join(', ') : '<span class="dim">—</span>'}</td><td class="m r ${ttaCls}">${tta <= 0 ? 'arrived' : fmt(tta)}</td></tr>`
    })
    .join('')
  const table = `<table class="tb" aria-label="Tracks">
    <thead><tr>${th('track', 'Track', '', '38px')}<th style="width:48px">Chain</th>${th('state', 'State', '', '96px')}${th('held', 'Held by', 'c-held')}${th('tta', 'TTA', 'r', '50px')}</tr></thead><tbody>${body}</tbody></table>
    ${help('TTA is time to arrival at the defended asset. Click a row to select the track on the board.')}`

  const events = [
    ...SALVOS.filter((s) => s.t <= T).map((s) => ({ t: s.t, h: `<b>${s.eff}</b> → OWA-01 ${s.n} · salvo ${s.k} · no effect` })),
    ...TRACKS.filter((t) => t.id <= T).map((t) => ({ t: t.id, h: `<b>OWA-01 ${t.n}</b> identified hostile` })),
  ]
    .sort((a, b) => b.t - a.t)
    .slice(0, 5)
    .map((e) => `<div class="ev"><span class="t">${fmt(e.t)}</span><span class="d">${e.h}</span></div>`)
    .join('')

  return `<div style="padding-top:12px">${funnel}</div>
    ${sec({ id: 'tracks', title: 'Tracks', readout: `${GROUP} · 10`, body: table })}
    ${sec({ id: 'systems', title: 'Systems', readout: '8 online', body: `<div>${systemRows(LIVE)}</div>` })}
    ${sec({ id: 'events', title: 'Recent events', readout: 'last 5', body: `<div class="feed">${events}</div>` })}`
}

/* ---------- Analyze: Outcome ---------- */
function renderOutcome() {
  if (!hasTrial()) return `<div style="padding-top:14px">${empty('No trial yet. Play one in Execute <span class="mono xs">⌘↵</span>.')}</div>`
  const prov = `<div class="prov" data-n="prov"><span title="One simulated draw">Trial · seed ${S.run.seed} · T+${fmt(DUR)}</span><span class="end"><button type="button" class="btn mini" data-act="toast" data-msg="Saved RUN-0006 to Saved runs in Compare.">Save run</button><button type="button" class="btn mini" id="export-btn" data-act="export">${I.dl}Export</button></span></div>`
  const bar = `<div data-n="result" style="display:flex;flex-direction:column;gap:6px"><div class="resbar" style="grid-template-columns:repeat(10,1fr)" aria-label="0 defeated, 0 late kills, 10 leaked of 10 members">${Array.from({ length: 10 }, () => '<i class="leak"></i>').join('')}</div>
    <div class="legend"><span><span class="sq ok"></span><b>0</b> defeated before arrival</span><span><span class="sq warn"></span><b>0</b> late kills</span><span><span class="sq crit"></span><b>10</b> leaked</span><span class="dim">of 10 members</span></div></div>`
  const gs = gateSummary()
  const stats = `<div class="kpis c4" data-n="stats" style="margin-top:12px">
    <div class="kpi"><div class="k">First detect</div><div class="v">T+3:01</div></div>
    <div class="kpi na"><div class="k">First effect</div><div class="v">—</div></div>
    <div class="kpi"><div class="k">Salvos</div><div class="v">8</div><div class="ci" title="8 kinetic · 0 EW">all kinetic</div></div>
    <div class="kpi" style="cursor:pointer" data-act="goto-req" title="Open Prepare, Requirements"><div class="k">Gates met</div><div class="v">${gs.met}<small>/${gs.total}</small></div><div class="ci">forecast ›</div></div>
  </div>`

  let tracks
  if (S.out.view === 'strip') {
    const pct = (s) => `${((s / DUR) * 100).toFixed(2)}%`
    const ticks = [0, 360, 720, 1080, DUR]
    const axis = `<div class="strip-axis"><span></span><span class="ax" style="position:relative">${ticks.map((s, i) => `<span style="position:absolute;left:${pct(s)};transform:translateX(${i === 0 ? '0' : i === ticks.length - 1 ? '-100%' : '-50%'})">${fmt(s)}</span>`).join('')}</span><span></span></div>`
    const rows = TRACKS.map((t) => {
      const salvos = SALVOS.filter((s) => s.n === t.n).map((s) => `<i class="mk eng" style="left:${pct(s.t)}" title="${s.eff} salvo ${s.k} · T+${fmt(s.t)}"></i>`).join('')
      return `<div class="strip"><span class="nm">${t.n}</span><span class="lane"><i class="ln" style="left:${pct(t.d)};width:${(((t.arr - t.d) / DUR) * 100).toFixed(2)}%"></i><i class="mk det" style="left:${pct(t.d)}" title="Detect T+${fmt(t.d)}"></i><i class="mk id" style="left:${pct(t.id)}" title="Identified T+${fmt(t.id)}"></i>${salvos}<i class="mk arr" style="left:${pct(t.arr)}" title="Arrived T+${fmt(t.arr)}"></i></span>${st('leaked', 'crit')}</div>`
    }).join('')
    const key = `<div class="strip-key"><span><i class="mk-k det"></i>detect</span><span><i class="mk-k id"></i>identify</span><span><i class="mk-k eng"></i>salvo</span><span><i class="mk-k arr"></i>arrival</span></div>`
    tracks = `${axis}<div class="strips">${rows}</div>${key}`
  } else {
    const rows = TRACKS.map((t) => `<tr title="${GROUP} ${t.n} · effect — · ${t.slv} salvos"><td class="m">${t.n}</td><td class="m">${fmt(t.d)}</td><td class="m">${fmt(t.id)}</td><td class="m">${t.eng ? fmt(t.eng) : '—'}</td><td class="m c-fx">—</td><td class="m r c-slv">${t.slv}</td><td>${st('leaked', 'crit')}</td></tr>`).join('')
    tracks = `<table class="tb" aria-label="Per-track outcomes, times in minutes:seconds">
      <thead><tr><th style="width:38px">Track</th><th title="First detection">Detect</th><th title="Hostile identification">ID</th><th title="First salvo">Engage</th><th class="c-fx" title="First defeat effect">Effect</th><th class="r c-slv" style="width:34px" title="Salvos">Slv</th><th style="width:74px">Result</th></tr></thead><tbody>${rows}</tbody></table>`
  }
  const trackSec = sec({
    id: 'otracks', title: 'Tracks', readout: `${GROUP} · 10`,
    end: seg('out.view', S.out.view, [['strip', 'Strip'], ['table', 'Table']], 'Track view').replace('class="seg"', 'class="seg seg-sm"'),
    body: tracks,
  })
  const ledger = SALVOS.map((s) => `<div class="ev"><span class="t">${fmt(s.t)}</span><span class="d"><b>${s.eff}</b> → OWA-01 ${s.n} · salvo ${s.k} · no effect</span></div>`).join('')
  const records = `<div data-n="records" style="margin-top:4px">
    <details class="rec"><summary><span class="chev">${I.chev}</span>Event ledger<span class="c">8 events</span></summary><div class="rec-body feed">${ledger}</div></details>
    <details class="rec"><summary><span class="chev">${I.chev}</span>Systems at end of run<span class="c">8 components</span></summary><div class="rec-body">${systemRows(FINAL)}</div></details>
    <details class="rec"><summary><span class="chev">${I.chev}</span>Manifest<span class="c">RUN-0006</span></summary><div class="rec-body"><dl class="kv">
      <dt>Run</dt><dd>RUN-0006</dd><dt>Seed</dt><dd>${S.run.seed}</dd><dt>Replicate index</dt><dd>1334652694</dd><dt>Horizon</dt><dd>T+${fmt(DUR)}</dd><dt>ROE</dt><dd>${cap(S.fire.roe)}</dd><dt>Doctrine</dt><dd>${S.fire.doctrine ? 'on · Pk commit' : 'off'}</dd><dt>Units</dt><dd>nm · kt · ft AGL</dd>
    </dl></div></details></div>`
  return `${prov}${bar}${stats}${trackSec}${records}`
}

/* ---------- Analyze: Compare ---------- */
function compareChart() {
  const W = 380
  const H = 150
  const x0 = 30
  const x1 = 372
  const y0 = 12
  const y1 = 122
  const X = (s) => x0 + (s / DUR) * (x1 - x0)
  const Y = (v) => y1 - (v / 3) * (y1 - y0)
  const curve = (end, start) => (s) => (s < start ? 0 : end * (1 - Math.exp(-(s - start) / 140)))
  const mean = curve(1.9, 990)
  const base = curve(1.4, 1030)
  const pts = []
  for (let s = 0; s <= DUR; s += 20) pts.push(s)
  pts.push(DUR)
  const line = (fn) => pts.map((s, i) => `${i ? 'L' : 'M'}${X(s).toFixed(1)},${Y(fn(s)).toFixed(1)}`).join('')
  const band = `${pts.map((s, i) => `${i ? 'L' : 'M'}${X(s).toFixed(1)},${Y(mean(s) * 1.04).toFixed(1)}`).join('')}${[...pts].reverse().map((s) => `L${X(s).toFixed(1)},${Y(mean(s) * 0.96).toFixed(1)}`).join('')}Z`
  const grid = [0, 1, 2, 3].map((v) => `<line x1="${x0}" x2="${x1}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--rule)" stroke-width="1"/><text x="${x0 - 6}" y="${Y(v) + 3}" text-anchor="end">${v}</text>`).join('')
  const xt = [0, 480, 960, DUR].map((s, i, a) => `<text x="${X(s)}" y="${H - 14}" text-anchor="${i === 0 ? 'start' : i === a.length - 1 ? 'end' : 'middle'}">${fmt(s)}</text>`).join('')
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Kills over time: ensemble mean with 95 % band, trial and baseline">
    ${grid}${xt}
    <text x="${x0}" y="${H - 1}" style="fill:var(--t3)">Kills, members of 10 · T+</text>
    <path d="${band}" fill="color-mix(in srgb, var(--accent) 22%, var(--panel))" stroke="none"/>
    ${S.cmp.baseline ? `<path d="${line(base)}" fill="none" stroke="var(--t3)" stroke-width="1.25" stroke-dasharray="4 3"/>` : ''}
    <path d="${line(mean)}" fill="none" stroke="var(--accent)" stroke-width="1.5"/>
    <path d="M${X(0)},${Y(0)}L${X(DUR)},${Y(0)}" fill="none" stroke="var(--t1)" stroke-width="2"/>
    <circle cx="${X(DUR)}" cy="${Y(0)}" r="3" fill="var(--t1)"/>
    <circle cx="${X(DUR)}" cy="${Y(mean(DUR))}" r="3" fill="var(--accent)"/>
  </svg>`
}
function renderCompare() {
  let h = ''
  if (hasTrial()) {
    const rows = Object.entries(MEASURES)
      .map(([, m]) => {
        const [a, b] = m.range
        const p = (v) => `${(((v - a) / (b - a)) * 100).toFixed(2)}%`
        const inside = m.trial >= m.lo && m.trial <= m.hi
        return `<div class="dp"><span class="q">${m.label}<small>${a}–${b} ${m.u}</small></span>
          <span class="plot" title="Mean ${num(m.mean, m.dp)} · 95 % ${num(m.lo, m.dp)}–${num(m.hi, m.dp)} · trial ${num(m.trial, m.dp)}${S.cmp.baseline ? ` · baseline ${num(m.base, m.dp)}` : ''}"><span class="ax"></span><span class="band" style="left:${p(m.lo)};width:calc(${p(m.hi)} - ${p(m.lo)} + 2px)"></span><span class="mean" style="left:${p(m.mean)}"></span>${S.cmp.baseline ? `<span class="base" style="left:${p(m.base)}"></span>` : ''}<span class="trial" style="left:${p(m.trial)}"></span></span>
          <span class="tv">${num(m.trial, m.dp)}</span><span>${inside ? st('inside', 'ok') : st('outside', 'warn')}</span></div>`
      })
      .join('')
    const baseRow = S.cmp.baseline
      ? `<div class="empty" style="border-style:solid"><span class="grow">Baseline · <b>RUN-0004</b> Pre-move laydown <span class="dim mono xs">pinned 17:40</span></span><button type="button" class="btn mini" data-act="baseline-clear">Clear</button></div>`
      : `<div class="empty"><span class="grow">No baseline.</span><button type="button" class="btn mini" data-act="baseline-pin">${I.pin}Pin current</button></div>`
    h += sec({
      id: 'cmp', title: 'Trial against ensemble', readout: `${num(S.run.reps)} runs · seed ${S.run.seed}`,
      body: `${compareChart()}<div class="dp-key"><span><i class="k-band" style="background:color-mix(in srgb, var(--accent) 22%, var(--panel))"></i>ensemble 95 % band</span><span><i class="k-mean" style="background:var(--accent)"></i>ensemble mean</span><span><i class="k-trial"></i>trial</span>${S.cmp.baseline ? '<span><i class="k-base"></i>baseline mean</span>' : ''}</div>
        <div data-n="dots"><div class="dp-head"><span>Quantity</span><span>End of run, 95 % CI of mean</span><span style="text-align:right">Trial</span><span>Flag</span></div>${rows}</div>${baseRow}`,
      end: `<button type="button" class="icon-btn" data-act="toast" data-msg="Chart exported as PNG." aria-label="Export chart as PNG" title="Export chart as PNG" style="width:24px;height:24px">${I.dl}</button>${info('Trial against ensemble', 'One simulated draw against the ensemble. Bands are 95 % intervals on the ensemble mean, not replicate ranges; count bounds may use Wilson or the rule of three. Kills exclude late effects. Baseline deltas are current mean minus baseline mean.')}`,
    })
  } else {
    h += sec({ id: 'cmp', title: 'Trial against ensemble', body: empty('No trial yet. Play one in Execute to compare it with the ensemble.') })
  }

  const A = RUNS.find((r) => r.id === S.cmp.a)
  const B = RUNS.find((r) => r.id === S.cmp.b)
  const runRows = RUNS.map((r) => `<tr><td><button type="button" class="pick" data-act="pick" data-side="a" data-v="${r.id}" aria-pressed="${S.cmp.a === r.id}" aria-label="Set ${r.id} as A">A</button></td><td><button type="button" class="pick" data-act="pick" data-side="b" data-v="${r.id}" aria-pressed="${S.cmp.b === r.id}" aria-label="Set ${r.id} as B">B</button></td><td title="${esc(r.name)}"><span class="mono xs">${r.id}</span> ${esc(r.name)}</td><td class="m dim" title="${r.saved}">${r.saved.slice(7)}</td><td><button type="button" class="icon-btn" data-act="run-menu" data-v="${r.id}" aria-label="${r.id} actions" title="Open, export or delete" style="width:24px;height:24px">${I.dots}</button></td></tr>`).join('')
  let delta = ''
  if (A && B && A !== B) {
    const dr = Object.entries(MEASURES)
      .map(([k, m]) => {
        const [am, alo, ahi] = A.m[k]
        const [bm, blo, bhi] = B.m[k]
        const d = am - bm
        return `<tr><td>${m.label}</td><td class="m r delta-cell">${num(am, m.dp)}<small>${num(alo, ciDp(m))}–${num(ahi, ciDp(m))}</small></td><td class="m r delta-cell">${num(bm, m.dp)}<small>${num(blo, ciDp(m))}–${num(bhi, ciDp(m))}</small></td><td class="m r">${d > 0 ? '+' : d < 0 ? '−' : ''}${num(Math.abs(d), m.dp)} ${m.u}</td></tr>`
      })
      .join('')
    delta = `<table class="tb" aria-label="Saved run A against B" style="margin-top:4px"><colgroup><col><col style="width:84px"><col style="width:84px"><col style="width:80px"></colgroup><thead><tr><th>Quantity</th><th class="r">A · ${A.id.slice(4)}</th><th class="r">B · ${B.id.slice(4)}</th><th class="r">A − B</th></tr></thead><tbody>${dr}</tbody></table>
      ${help('Each cell is the ensemble mean with the 95 % interval on that mean under it. No interval is claimed on the difference of two independent runs.')}`
  } else {
    delta = '<p class="small muted" style="margin:0">Pick A and B to see the difference.</p>'
  }
  h += sec({
    id: 'runs', title: 'Saved runs', readout: `${RUNS.length}`,
    body: `<table class="tb runs" aria-label="Saved runs"><colgroup><col style="width:26px"><col style="width:30px"><col><col style="width:44px"><col style="width:34px"></colgroup><thead><tr><th>A</th><th>B</th><th>Run</th><th>Saved</th><th></th></tr></thead><tbody>${runRows}</tbody></table>${delta}`,
    end: `<button type="button" class="btn mini" data-act="toast" data-msg="${hasEns() ? 'Saved the current ensemble as RUN-0007.' : 'No finished ensemble to save.'}"${hasEns() ? '' : ' disabled title="No finished ensemble to save"'}>Save current</button><button type="button" class="icon-btn" id="runs-menu" data-act="runs-menu" aria-label="Saved run options" title="Import or export" style="width:24px;height:24px">${I.dots}</button>`,
  })
  return h
}

/* ---------- inspector stub ---------- */
function renderInspector() {
  const t = TRACKS.find((x) => x.n === S.sel)
  return `<div class="stub">${empty(`Inspector for <b>${GROUP} ${t.n}</b>. The inspector is outside this redesign and keeps its current layout.`)}</div>`
}

/* ---------- board, transport, status bar ---------- */
function renderBoard() {
  const T = S.phase === 'execute' ? EXEC_T : S.phase === 'analyze' ? DUR : 0
  const rings = [90, 170, 250, 340, 440]
    .map((r, i) => `<circle cx="${ASSET_X}" cy="${ASSET_Y}" r="${r}" fill="none" stroke="var(--ring)" stroke-width="1.2" stroke-dasharray="${i % 2 ? '6 5' : '3 5'}"/>`)
    .join('')
  let grid = ''
  for (let x = 0; x <= 1000; x += 100) grid += `<line x1="${x}" y1="0" x2="${x}" y2="700" stroke="var(--grid)"/>`
  for (let y = 0; y <= 700; y += 100) grid += `<line x1="0" y1="${y}" x2="1000" y2="${y}" stroke="var(--grid)"/>`
  const tracks = TRACKS.map((t) => {
    const f = S.phase === 'prepare' ? 0 : Math.min(1, T / t.arr)
    const px = t.x + (ASSET_X - t.x) * f
    const py = 700 + (ASSET_Y - 700) * f
    const sel = S.sel === t.n
    return `<line x1="${t.x}" y1="700" x2="${ASSET_X}" y2="${ASSET_Y}" stroke="var(--ch-threat)" stroke-opacity=".55" stroke-dasharray="5 5"/>
      ${f < 1 ? `<rect x="${px - 6}" y="${py - 6}" width="12" height="12" transform="rotate(45 ${px} ${py})" fill="var(--ch-threat)"/>` : ''}
      ${sel ? `<circle cx="${px}" cy="${py}" r="14" fill="none" stroke="var(--t1)" stroke-width="1.5"/>` : ''}`
  }).join('')
  const sys = SYS.map((s) => {
    const x = ASSET_X + s.dx
    const y = ASSET_Y + s.dy
    const ink = s.kind === 'S' ? 'var(--ch-sensor)' : s.kind === 'E' ? 'var(--ch-effector)' : 'var(--t2)'
    return s.kind === 'E'
      ? `<path d="M${x},${y - 6}L${x + 6},${y + 5}L${x - 6},${y + 5}Z" fill="${ink}"/>`
      : `<rect x="${x - 5}" y="${y - 5}" width="10" height="10" fill="${ink}"/>`
  }).join('')
  let ghosts = ''
  if (S.phase === 'prepare' && S.place.preview != null) {
    const c = CANDS.find((x) => x.rk === S.place.preview)
    ghosts = Object.entries(c.pos)
      .map(([id, [mx, my]]) => {
        const s = SYS.find((z) => z.id === id)
        const x = ASSET_X + mx * 0.16
        const y = ASSET_Y + 60 + my * 0.16
        return `<line x1="${ASSET_X + s.dx}" y1="${ASSET_Y + s.dy}" x2="${x}" y2="${y}" stroke="var(--accent)" stroke-dasharray="2 3"/><rect x="${x - 7}" y="${y - 7}" width="14" height="14" fill="none" stroke="var(--accent)" stroke-width="1.5"/><text x="${x + 10}" y="${y + 4}" style="font:400 11px var(--font-mono);fill:var(--accent)">${s.short}</text>`
      })
      .join('')
  }
  const asset = hasAsset() ? `<rect x="${ASSET_X - 8}" y="${ASSET_Y - 8}" width="16" height="16" transform="rotate(45 ${ASSET_X} ${ASSET_Y})" fill="none" stroke="var(--t1)" stroke-width="1.5"/>` : ''
  $('#board-canvas').innerHTML = `<svg viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${grid}${rings}${tracks}${asset}${sys}${ghosts}</svg><span class="board-tag">${S.place.preview != null && S.phase === 'prepare' ? `Preview: candidate ${S.place.preview}` : 'Board (context only)'}</span>`

  const tr = $('#transport')
  tr.hidden = S.phase === 'prepare'
  if (!tr.hidden) {
    const t = S.phase === 'execute' ? EXEC_T : DUR
    const pct = hasTrial() ? (t / DUR) * 100 : 0
    tr.innerHTML = `<button type="button" class="icon-btn" style="width:24px;height:24px" aria-label="${S.playing && S.phase === 'execute' ? 'Pause' : 'Play'}" data-act="play">${S.playing && S.phase === 'execute' ? I.pause : I.play}</button><button type="button" class="icon-btn" style="width:24px;height:24px" aria-label="Reset run" title="Reset run">${I.reset}</button><span class="scrub"><i style="width:${pct}%"></i><b style="left:${pct}%"></b></span><span class="mono">30x</span>`
  }

  const sb = $('#statusbar')
  const f = findings().length
  const phaseWord = S.phase === 'prepare' ? 'ready' : !hasTrial() ? 'idle' : S.phase === 'execute' ? (S.playing ? 'running' : 'paused') : 'complete'
  const t = !hasTrial() || S.phase === 'prepare' ? 0 : S.phase === 'execute' ? EXEC_T : DUR
  sb.innerHTML = `<span class="hi">RUN-0006</span><span>${phaseWord}</span><span>T+${fmt(t)} / ${fmt(DUR)}</span><span>seed ${S.run.seed}</span><span>MC ${hasEns() ? num(S.run.reps) : 0} / ${num(S.run.reps)}</span><span class="grow"></span><span>ROE ${cap(S.fire.roe)}</span><span>nm · kt · ft AGL</span><button type="button" class="sb-btn" data-act="sb-validity" title="Open the validity findings">Validity ${f} <span class="lim">LIMITS</span></button>`

  const rp = $('#run-primary')
  const label = S.phase === 'prepare' ? 'Run' : S.phase === 'execute' ? (!hasTrial() ? 'Play' : S.playing ? 'Pause' : 'Resume') : 'Run again'
  rp.innerHTML = `${label} <kbd>⌘↵</kbd>`
  rp.disabled = S.phase === 'prepare' && !mc()
  $('#run-progress').textContent = S.phase === 'prepare' && hasEns() && mc() ? `MC ${num(S.run.reps)} / ${num(S.run.reps)}` : ''
}

/* ---------- change notes ---------- */
const NOTES = {
  shell: [
    ['cut', 'Removed the phase header row (“Prepare ⋯”). The top bar already names the phase. The ⋯ panel menu moves to the end of the tab row. The panel gets 32 px back.', '#panel-menu'],
    ['merge', 'Validity findings showed in five places: Inputs, Fragility, Outcome, Compare and the evidence record. One Validity line under the tabs now shows them. It opens in place, and a finding with a fix carries its action.', '[data-n="validity"]'],
    ['cut', 'Removed screen titles that repeat the tab name: Fragility, Placement, Outcome, Compare.'],
    ['edit', 'Method notes stay behind (i). Panel options, Show field help shows every note as a line.', '#panel-menu'],
    ['edit', 'Every box snaps to one four-column grid with 12 px gutters. A control spans one, two or four columns, so boxes in different sections share left edges.', '#panel-body'],
    ['edit', 'Disclosure chevrons hang in the left margin, so every section title starts on the same edge.', '#panel-body'],
    ['edit', 'Drawer: the panel holds its layout from 280 to 560 px. Under 360 px the grid folds to two columns, the launch point becomes 2 × 2, and low-value columns drop; their values stay in row titles. Try Drawer 280 in the bar above.', '#panel'],
    ['new', 'With the drawer closed, the status-bar Validity cell opens it at the Validity line.', '#statusbar'],
    ['edit', 'A selection made from a panel row keeps the current tab and adds the selection tab. Today every selection switches the panel to the inspector.', '#tabrow'],
  ],
  inputs: [
    ['cut', 'Removed the scenario block: name, “Board scenario · RUN-0006” and PENDING. The top bar shows the name. The status bar shows the run id and validity.'],
    ['edit', '“Forecast and analysis” is now Run. Set the run mode, runs and seed here. Before, runs and seed were in Settings only. The MC progress line is removed: the top bar and the status bar show it.', '[data-n="run"]'],
    ['new', 'When an input changes after a run, the Run head shows ENSEMBLE STALE. Change any value to see it.', '[data-n="run"]'],
    ['edit', 'Removed the “Scenario inputs” wrapper. Each group is a section. A closed section shows its current values on one line.', '[data-n="env"]'],
    ['edit', 'Apply effects is the Effects switch in the section head. EM clutter reads Rural or Urban.', '[data-n="env"]'],
    ['edit', 'Fire doctrine is now Fire control. Doctrine off hides the doctrine fields. Release range shows only for the Fraction launch point.', '[data-n="fire"]'],
    ['merge', 'Requirement inputs and the forecast requirement record (before: Analyze, Evidence products) are one gate table. Each pass line sits beside the forecast value it tests, in kill-chain order. Click a failed gate to see its blocking tracks.', '[data-n="req"]'],
    ['edit', 'The Entity register is now the Entities section, closed by default with a count. The Entities button in the board rail opens it, as it opens the register today.', '[data-n="ents"]'],
  ],
  fragility: [
    ['cut', 'Removed Run Monte Carlo. In Prepare, the top-bar Run (⌘↵) runs the same ensemble.'],
    ['merge', 'Three response selects are one Measure select. It drives the ensemble focus, the sweep map and the sensitivity ranking. Options that need a defended asset say so.', '[data-n="measure"]'],
    ['edit', 'Ensemble shows all five quantities with the 95 % interval on each mean. The horizon shows once in the head, not in each tile. Pin baseline moves into the head.', '[data-n="ensemble"]'],
    ['edit', 'Sweep values are chips with suggested values. Before, values were comma-separated text. The Two factors checkbox is now Add second factor. Cells, runs and a time estimate show in the head.', '[data-n="sweep"]'],
    ['new', 'Before a run, the map shows its empty grid, so the cell layout is visible first.', '[data-n="sweep"]'],
    ['edit', 'Sensitivity: the run action is in the head. The top five fields show; the rest are behind Show all. p10, p90 and SE show when you open a row.', '[data-n="sens"]'],
    ['cut', 'Removed the repeated “No defended asset · Place asset” rows and the Validity section. The Validity line carries both.'],
  ],
  placement: [
    ['cut', 'Removed the method paragraph, the Objective heading and the “Systems the optimizer may move” legend. The method is behind (i) in Budget.'],
    ['edit', 'Goal is one select that includes the direction, for example Minimize leakers.', '[data-n="goal"]'],
    ['edit', 'Movable systems are compact rows with a kind tag and a short name. The head shows the count, All and None.', '[data-n="move"]'],
    ['new', 'With no range boundary, Draw boundary starts the Boundary tool.', '[data-n="bounds"]'],
    ['edit', 'Budget reads as one line: evaluations × runs = total runs, with a time estimate. The seed moves to the (i) note.', '[data-n="budget"]'],
    ['new', 'When Run placement cannot run, it lists what is missing.', '[data-n="budget"]'],
    ['edit', 'Candidates show each interval against the start laydown and the change in the measure. Click a row to see its coordinates.', '[data-n="cands"]'],
    ['new', 'Preview (eye) draws the candidate laydown as ghosts on the board before Apply.', '[data-n="cands"]'],
  ],
  monitor: [
    ['edit', 'The single “Run monitor” tab is now Monitor. The row stays because a board selection adds its tab here.', '#tabrow'],
    ['cut', 'Removed the clock, progress bar, replicate index, seed and speed. The status bar and the transport show them. The replicate index is a 10-digit draw id that the operator does not use; it stays in the Outcome manifest.'],
    ['new', 'Kill-chain funnel: how many tracks reached each milestone.', '[data-n="funnel"]'],
    ['edit', 'Tracks: the shared name prefix shows once in the head. Chain pips show the stage. TTA (time to arrival) replaces the arrival clock time. The default sort is most urgent first.', '[data-n="tracks"]'],
    ['new', 'Click a track row to select the track on the board. Its tab appears in the tab row.', '[data-n="tracks"]'],
    ['merge', 'Effectors and Sensors are one Systems list with C2 added; C2 was missing. Magazine pips replace the full-width bars.', '[data-n="systems"]'],
    ['new', 'Recent events: the last five engagement events.', '[data-n="events"]'],
    ['cut', 'Removed New run (the transport has Reset) and Forecast and analysis (Settings has it).'],
  ],
  outcome: [
    ['cut', 'Removed the scope sentence and the six repeated “by T+24:33” lines. One provenance line states the draw, seed and horizon once.', '[data-n="prov"]'],
    ['new', 'Result bar: each member shows as defeated, late kill or leaked.', '[data-n="result"]'],
    ['new', 'Gates met shows the forecast gate count. Click it to open Prepare, Requirements.', '[data-n="stats"]'],
    ['edit', 'The per-track table is now kill-chain strips on one time axis. Table view keeps the exact times, and the names now fit.', '[data-n="otracks"]'],
    ['merge', 'Export debrief JSON, Capture final PNG and the CSV exports are one Export menu. Removed New clean run: the transport has Reset and the top bar has Run again.', '[data-n="prov"]'],
    ['move', 'Run history moves to Compare, Saved runs. Save run stays here.', '[data-n="prov"]'],
    ['merge', 'The manifest and the system and component record are one Records group.', '[data-n="records"]'],
    ['move', 'The forecast requirement record moves to Prepare, Requirements.'],
  ],
  compare: [
    ['cut', 'Removed the interval paragraph; it is behind (i). The “Chart · Export PNG” row is an icon in the head.', '[data-n="cmp"]'],
    ['edit', 'The five-column table is now interval rows. Each row draws the 95 % band, the mean, the trial and the baseline on one scale. The flag stays.', '[data-n="dots"]'],
    ['merge', 'Run history and the two A/B dropdowns are one Saved runs table. Pick A and B in the table; the difference table shows under it.', '[data-n="runs"]'],
    ['move', 'Findings move to the Validity line.', '[data-n="validity"]'],
  ],
}
const TAG = { cut: 'CUT', merge: 'MERGE', move: 'MOVE', new: 'NEW', edit: 'EDIT' }
function renderNotes() {
  const el = $('#notes')
  el.hidden = !S.notes
  $('#proto-notes').setAttribute('aria-pressed', String(S.notes))
  if (!S.notes) return
  const scr = S.screen[S.phase]
  const name = SCREENS[S.phase].find((x) => x[0] === scr)[1]
  const list = (items) => items.map(([tag, text, target]) => `<div class="note"${target ? ` data-target="${esc(target)}"` : ''}><span class="tag ${tag}">${TAG[tag]}</span><span>${text}</span></div>`).join('')
  el.innerHTML = `<div class="notes-head"><h2>Change notes</h2><p>Point at a note to mark the element. Click to scroll to it.</p></div>
    <div class="notes-list"><div class="notes-group">${name}</div>${list(NOTES[scr])}<div class="notes-group">Whole panel</div>${list(NOTES.shell)}</div>`
}

/* ---------- render ---------- */
function render() {
  const body = $('#panel-body')
  const scroll = body.scrollTop
  const fid = document.activeElement && document.activeElement.id
  document.querySelectorAll('.phases button').forEach((b) => b.setAttribute('aria-current', b.dataset.phase === S.phase ? 'page' : 'false'))
  document.querySelectorAll('[data-proto="data"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === S.data)))
  const theme = document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
  document.querySelectorAll('[data-proto="theme"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === theme)))
  $('#panel').classList.toggle('show-help', S.help)
  applyDrawer()
  document.querySelectorAll('[data-proto="drawer"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === '0' ? !S.drawer.open : S.drawer.open && Number(b.dataset.v) === S.drawer.w)))
  renderTabs()
  renderValidity()
  const scr = S.screen[S.phase]
  body.innerHTML = S.inspect && S.sel != null
    ? renderInspector()
    : { inputs: renderInputs, fragility: renderFragility, placement: renderPlacement, monitor: renderMonitor, outcome: renderOutcome, compare: renderCompare }[scr]()
  body.scrollTop = scroll
  renderBoard()
  renderNotes()
  if (fid) {
    const el = document.getElementById(fid)
    if (el) el.focus({ preventScroll: true })
  }
}

/* ---------- popovers ---------- */
function openPopover(anchor, html) {
  const p = $('#popover')
  p.innerHTML = html
  p.hidden = false
  const r = anchor.getBoundingClientRect()
  const w = p.offsetWidth
  p.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w))}px`
  p.style.top = `${r.bottom + 4}px`
}
function closePopover() {
  $('#popover').hidden = true
}
const item = (label, msg, hint = '') => `<button type="button" data-act="toast" data-msg="${esc(msg)}">${label}${hint ? `<span class="hint">${hint}</span>` : ''}</button>`

/* ---------- events ---------- */
function markDirty() {
  if (hasEns()) S.dirty = true
}
function setData(v) {
  S.data = v
  S.dirty = false
  S.vopen = false
  S.sel = null
  S.inspect = false
  S.place.move = v === 'results' ? ['kurfs', 'lstar', 'coy1', 'coy2'] : []
  S.place.preview = null
  S.place.open = null
  S.sweepRan = v === 'results' ? sig() : null
  S.sensRan = v === 'results'
  S.place.ran = v === 'results'
}

document.addEventListener('click', (ev) => {
  const pop = $('#popover')
  if (!pop.hidden && !pop.contains(ev.target) && !ev.target.closest('[data-act="menu"],[data-act="export"],[data-act="run-menu"],[data-act="runs-menu"]')) closePopover()

  const proto = ev.target.closest('[data-proto]')
  if (proto) {
    const k = proto.dataset.proto
    if (k === 'data') setData(proto.dataset.v)
    if (k === 'theme') document.documentElement.setAttribute('data-theme', proto.dataset.v)
    if (k === 'notes') S.notes = !S.notes
    if (k === 'drawer') {
      const w = Number(proto.dataset.v)
      S.drawer.open = w > 0
      if (w > 0) S.drawer.w = w
    }
    render()
    return
  }
  const ph = ev.target.closest('[data-phase]')
  if (ph) {
    S.phase = ph.dataset.phase
    S.inspect = false
    S.vopen = false
    render()
    return
  }
  if (ev.target.closest('#run-primary')) {
    if (S.phase === 'prepare') {
      S.dirty = false
      toast(hasEns() ? `Ensemble run again: ${num(S.run.reps)} replicates at seed ${S.run.seed}.` : 'Switch the sample data to After run to see results.')
    } else if (S.phase === 'execute') {
      S.playing = !S.playing
    } else toast('A new trial starts in Execute.')
    render()
    return
  }
  const note = ev.target.closest('.note[data-target]')
  if (note) {
    const t = document.querySelector(note.dataset.target)
    if (t) t.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    return
  }

  const el = ev.target.closest('[data-act]')
  if (!el) return
  const a = el.dataset.act
  const v = el.dataset.v
  switch (a) {
    case 'set': {
      const cur = getPath(el.dataset.key)
      const next = typeof cur === 'number' ? Number(v) : v
      setPath(el.dataset.key, next)
      if (el.dataset.key !== 'out.view') markDirty()
      break
    }
    case 'toggle':
      setPath(el.dataset.key, !getPath(el.dataset.key))
      markDirty()
      break
    case 'screen':
      S.screen[S.phase] = v
      S.inspect = false
      break
    case 'inspect':
      S.inspect = true
      break
    case 'sec':
      S.open[v] = !S.open[v]
      break
    case 'validity':
      S.vopen = !S.vopen
      break
    case 'gate':
      if (ev.target.closest('input, button')) return
      S.gateOpen = S.gateOpen === v ? null : v
      break
    case 'select-track':
      S.sel = Number(v)
      if (S.phase !== 'execute') toast(`Selected ${GROUP} ${v} on the board.`)
      break
    case 'reseed':
      S.run.seed = Math.floor(1000 + Math.random() * 9000)
      markDirty()
      break
    case 'chip-del': {
      const f = S.sweep[el.dataset.ax]
      f.v = f.v.filter((x) => String(x) !== v)
      break
    }
    case 'chip-sug': {
      const f = S.sweep[el.dataset.ax]
      const val = f.f === 'env' ? v : Number(v)
      if (!f.v.includes(val) && f.v.length < 6) f.v = [...f.v, val].sort((x, y) => (typeof x === 'number' ? x - y : 0))
      break
    }
    case 'factor-add': {
      const used = S.sweep.a.f
      const f = Object.keys(FACTORS).find((k) => k !== used)
      S.sweep.b = { f, v: [...FACTORS[f].def] }
      break
    }
    case 'factor-del':
      S.sweep.b = null
      break
    case 'run-sweep':
      S.sweepRunning = true
      render()
      setTimeout(() => {
        S.sweepRunning = false
        S.sweepRan = sig()
        render()
      }, 900)
      return
    case 'run-sens':
      if (!hasEns()) {
        toast('Switch the sample data to After run to see a ranking.')
        return
      }
      S.sensRan = true
      toast('Sensitivity run again on the current basis.')
      break
    case 'sens-all':
      S.sensAll = !S.sensAll
      break
    case 'sens-row':
      S.sensOpen = S.sensOpen === Number(v) ? null : Number(v)
      break
    case 'mv-all':
      S.place.move = SYS.map((s) => s.id)
      break
    case 'mv-none':
      S.place.move = []
      break
    case 'run-place':
      S.place.ran = true
      toast('Placement run: 60 evaluations. Candidates update when it ends.')
      break
    case 'cand':
      if (ev.target.closest('button')) return
      S.place.open = S.place.open === Number(v) ? null : Number(v)
      break
    case 'preview':
      S.place.preview = S.place.preview === Number(v) ? null : Number(v)
      break
    case 'sort':
      if (S.exec.sort === v) S.exec.desc = !S.exec.desc
      else { S.exec.sort = v; S.exec.desc = false }
      break
    case 'goto-req':
      S.phase = 'prepare'
      S.screen.prepare = 'inputs'
      S.open.req = true
      break
    case 'play':
      S.playing = !S.playing
      break
    case 'drawer':
      S.drawer.open = !S.drawer.open
      break
    case 'rail-entities':
      S.phase = 'prepare'
      S.screen.prepare = 'inputs'
      S.inspect = false
      S.drawer.open = true
      S.open.ents = true
      render()
      requestAnimationFrame(() => { const t = document.getElementById('prepare-entities'); if (t) t.scrollIntoView({ block: 'start' }) })
      return
    case 'sb-validity':
      S.drawer.open = true
      S.inspect = false
      S.vopen = true
      break
    case 'pick':
      S.cmp[el.dataset.side] = v
      break
    case 'baseline-clear':
      S.cmp.baseline = false
      break
    case 'baseline-pin':
      S.cmp.baseline = true
      break
    case 'toast':
      toast(el.dataset.msg)
      closePopover()
      return
    case 'menu':
      openPopover(el, `<button type="button" data-act="help-toggle"><span>Show field help</span><span class="switch" role="switch" aria-checked="${S.help}"><span class="trk"></span></span></button><hr><button type="button" data-act="collapse" data-v="0">Collapse all</button><button type="button" data-act="collapse" data-v="1">Expand all</button>`)
      return
    case 'help-toggle':
      S.help = !S.help
      closePopover()
      break
    case 'collapse':
      Object.keys(S.open).forEach((k) => { S.open[k] = v === '1' })
      document.querySelectorAll('details.rec').forEach((d) => { d.open = v === '1' })
      closePopover()
      break
    case 'export':
      openPopover(el, `${item('Debrief record', 'Exported the debrief record as JSON.', 'JSON')}${item('Final board frame', 'Captured the final board frame as PNG.', 'PNG')}<hr>${item('Per-threat table', 'Exported the per-threat table as CSV.', 'CSV')}${item('Per-effector table', 'Exported the per-effector table as CSV.', 'CSV')}`)
      return
    case 'run-menu':
      openPopover(el, `${item('Open record', `Opened ${v}.`)}${item('Export', `Exported ${v} as JSON.`, 'JSON')}${item('Per-threat table', `Exported ${v} per-threat table.`, 'CSV')}${item('Per-effector table', `Exported ${v} per-effector table.`, 'CSV')}${item('Sensitivity rows', `Exported ${v} sensitivity rows.`, 'CSV')}<hr>${item('Delete', `Deleted ${v}. Undo is in the toast in the app.`)}`)
      return
    case 'runs-menu':
      openPopover(el, `${item('Import run', 'Choose a saved-run JSON file to add to the history.', 'JSON')}${item('Export all runs', 'Exported every saved run as one SQLite file.', 'SQLite')}`)
      return
    default:
      return
  }
  render()
})

document.addEventListener('input', (ev) => {
  const el = ev.target
  if (el.type === 'range' && el.dataset.key) {
    const val = Number(el.value)
    setPath(el.dataset.key, val)
    const out = document.getElementById(`${el.id}-out`)
    if (out && OUTS[el.dataset.key]) out.textContent = OUTS[el.dataset.key](val)
  }
})

document.addEventListener('change', (ev) => {
  const el = ev.target
  if (el.dataset.mv) {
    const id = el.dataset.mv
    S.place.move = el.checked ? [...S.place.move, id] : S.place.move.filter((x) => x !== id)
    render()
    return
  }
  if (!el.dataset.key) return
  const key = el.dataset.key
  if (el.type === 'range') {
    markDirty()
    render()
    return
  }
  if (el.tagName === 'SELECT') {
    if (/^sweep\.[ab]\.f$/.test(key)) {
      const ax = key.split('.')[1]
      S.sweep[ax] = { f: el.value, v: [...FACTORS[el.value].def] }
    } else setPath(key, el.value)
    if (key === 'measure') S.sensOpen = null
    render()
    return
  }
  if (el.type === 'number') {
    const cur = getPath(key)
    if (el.value === '') {
      if (key === 'env.vis' || key === 'req.warn') setPath(key, '')
    } else {
      let n = Number(el.value)
      if (key === 'req.pd' || key === 'req.cum') n = clamp(n, 0.05, 0.99)
      if (key === 'req.resid') n = clamp(n, 0, 1)
      if (key === 'fire.depth') n = clamp(Math.round(n), 0, 5)
      setPath(key, key === 'place.evals' || key === 'place.reps' ? el.value : typeof cur === 'number' || cur === '' ? n : n)
    }
    if (key.startsWith('env.') || key.startsWith('fire.') || key.startsWith('run.')) markDirty()
    render()
  }
})

document.addEventListener('keydown', (ev) => {
  const el = ev.target
  if (el.dataset && el.dataset.add && ev.key === 'Enter') {
    const ax = el.dataset.add
    const f = S.sweep[ax]
    const val = Number(el.value.trim())
    if (el.value.trim() !== '' && Number.isFinite(val) && !f.v.includes(val) && f.v.length < 6) {
      f.v = [...f.v, val].sort((x, y) => x - y)
      render()
      const again = document.getElementById(`add-${ax}`)
      if (again) again.focus()
    }
  }
  if (ev.key === 'Escape') closePopover()
  if (ev.key === ']' && !ev.metaKey && !ev.ctrlKey && !/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) {
    S.drawer.open = !S.drawer.open
    render()
  }
})

document.addEventListener('mouseover', (ev) => {
  const note = ev.target.closest('.note[data-target]')
  document.querySelectorAll('.hl').forEach((x) => x.classList.remove('hl'))
  if (note) document.querySelectorAll(note.dataset.target).forEach((x) => x.classList.add('hl'))
})

/* ---------- drawer ---------- */
function drawerCap() {
  return Math.min(DRAWER.max, Math.floor(window.innerWidth * DRAWER.cap))
}
function applyDrawer() {
  const open = S.drawer.open
  S.drawer.w = clamp(S.drawer.w, DRAWER.min, Math.max(DRAWER.min, drawerCap()))
  document.documentElement.style.setProperty('--panel-w', open ? `${S.drawer.w}px` : '0px')
  $('#panel').hidden = !open
  $('#main').classList.toggle('drawer-closed', !open)
  const t = $('#drawer-toggle')
  t.setAttribute('aria-expanded', String(open))
  t.setAttribute('aria-label', open ? 'Close panel' : 'Open panel')
  t.title = `${open ? 'Close' : 'Open'} panel (])`
  const h = $('#drawer-handle')
  h.setAttribute('aria-valuenow', String(S.drawer.w))
  h.setAttribute('aria-valuemax', String(drawerCap()))
}
;(() => {
  const h = $('#drawer-handle')
  let drag = false
  h.addEventListener('pointerdown', (ev) => {
    drag = true
    h.setPointerCapture(ev.pointerId)
    document.body.classList.add('resizing')
  })
  h.addEventListener('pointermove', (ev) => {
    if (!drag) return
    const raw = $('#main').getBoundingClientRect().right - ev.clientX
    if (raw < DRAWER.min - DRAWER.closeSlack) {
      drag = false
      document.body.classList.remove('resizing')
      S.drawer.open = false
      render()
      return
    }
    S.drawer.w = Math.round(raw)
    applyDrawer()
  })
  const end = () => {
    if (!drag) return
    drag = false
    document.body.classList.remove('resizing')
    render()
  }
  h.addEventListener('keydown', (ev) => {
    const step = ev.shiftKey ? 40 : 8
    const to = ev.key === 'ArrowLeft' ? S.drawer.w + step : ev.key === 'ArrowRight' ? S.drawer.w - step : ev.key === 'Home' ? DRAWER.min : ev.key === 'End' ? DRAWER.max : null
    if (to == null) return
    ev.preventDefault()
    S.drawer.w = to
    applyDrawer()
  })
  h.addEventListener('pointerup', end)
  h.addEventListener('pointercancel', end)
  window.addEventListener('resize', () => applyDrawer())
})()

setData('results')
render()
