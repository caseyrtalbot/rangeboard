// Board shell end-to-end spec. Drives the dev build through window.__store and
// asserts store state and the DOM. Run: node --test scripts/e2e/board-shell.e2e.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { chromium } from 'playwright'

const BASE_URL = process.env.E2E_URL || 'http://localhost:5377'
const FIXTURE = new URL('../../docs/field-te/evidence/onboarding-2026-09-04/firing-scenario.json', import.meta.url)
const RAW = readFileSync(FIXTURE, 'utf8')
const ENTITY_COUNT = JSON.parse(RAW).entities.length

let browser
before(async () => { browser = await chromium.launch({ headless: true }) })
after(async () => { await browser?.close() })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const read = (page, path) => page.evaluate((p) => p.split('.').reduce((o, k) => o?.[k], window.__store.getState()), path)
const has = (page, selector) => page.evaluate((sel) => !!document.querySelector(sel), selector)
const waitFor = (page, fn, arg) => page.waitForFunction(fn, arg, { timeout: 10000 })
const PLACE_MODEL = '.palette-scroll .palette-section:not(:first-child) button[aria-label^="Place "]'

async function open(t) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  await ctx.addInitScript(() => localStorage.setItem('rangeboard.rightpanel.width', '320'))
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)) })
  t.after(() => ctx.close())
  await page.goto(BASE_URL, { waitUntil: 'load' })
  await page.waitForFunction(() => document.querySelector('.konvajs-content canvas') && window.__store, null, { timeout: 60000 })
  await page.evaluate(async (raw) => {
    const { parseAutosave } = await import('/src/io/persist.ts')
    window.__store.getState().loadScenario(parseAutosave(raw))
  }, RAW)
  assert.equal(await read(page, 'scenario.entities.length'), ENTITY_COUNT)
  return { page, errors }
}

async function focusCanvas(page) {
  const host = await page.locator('.canvas-host').boundingBox()
  await page.mouse.click(host.x + host.width - 30, host.y + host.height - 30)
}

async function armPlacement(page) {
  await focusCanvas(page)
  await page.keyboard.press('l')
  await waitFor(page, () => !document.getElementById('board-library-drawer').hidden)
  await page.click(PLACE_MODEL)
  await waitFor(page, () => document.getElementById('board-library-drawer').hidden && document.querySelector('.board-placement'))
}

async function openRangeSetup(page, item) {
  await page.click('button[aria-controls="range-setup-menu-panel"]')
  await page.click(`#range-setup-menu-panel button:has-text("${item}")`)
}

test('phase switching sets the phase, the analysis tab and aria-selected', async (t) => {
  const { page, errors } = await open(t)
  for (const phase of ['execute', 'analyze', 'prepare']) {
    await page.evaluate(() => window.__store.getState().setRightTab('cards'))
    await page.click(`#board-phase-${phase}`)
    await waitFor(page, (p) => document.querySelector(`.board-app[data-board-phase="${p}"]`), phase)
    assert.equal(await read(page, 'ui.rightTab'), 'analysis', `${phase}: rightTab`)
    assert.equal(await page.getAttribute(`#board-phase-${phase}`, 'aria-selected'), 'true', `${phase}: aria-selected`)
  }
  assert.deepEqual(errors, [])
})

test('selection routing opens the entity workspace and Overview returns to analysis', async (t) => {
  const { page, errors } = await open(t)
  const sensor = await page.evaluate(() => {
    const e = window.__store.getState().scenario.entities.find((x) => x.kind === 'sensor')
    return { id: e.id, name: e.name }
  })
  await page.evaluate((id) => window.__store.getState().select({ entityIds: [id] }), sensor.id)
  await waitFor(page, () => document.querySelector('.entity-workspace'))
  assert.equal(await read(page, 'ui.rightTab'), 'inspect')
  assert.ok((await page.textContent('.entity-workspace-header')).includes(sensor.name), 'header shows the entity name')
  await page.click('.entity-workspace-header button:has-text("Overview")')
  await waitFor(page, () => window.__store.getState().ui.rightTab === 'analysis')
  assert.deepEqual(await read(page, 'selection.entityIds'), [sensor.id])
  await page.evaluate(() => window.__store.getState().clearSelection())
  await sleep(150)
  assert.equal(await read(page, 'ui.rightTab'), 'analysis')
  assert.deepEqual(errors, [])
})

test('placement: L opens the drawer, Place arms, Place at center adds one entity', async (t) => {
  const { page, errors } = await open(t)
  const entities = await read(page, 'scenario.entities.length')
  const past = await read(page, 'past.length')
  await focusCanvas(page)
  await page.keyboard.press('l')
  await waitFor(page, () => !document.getElementById('board-library-drawer').hidden)
  assert.ok(await page.evaluate(() => !!document.activeElement?.closest('#board-library-drawer')), 'focus is inside the drawer')
  // The first section is the system presets; a preset places several entities.
  await page.click(PLACE_MODEL)
  await waitFor(page, () => document.getElementById('board-library-drawer').hidden)
  await waitFor(page, () => document.querySelector('.board-placement #place-at-center'))
  await page.click('#place-at-center')
  await waitFor(page, (n) => window.__store.getState().scenario.entities.length === n + 1, entities)
  assert.equal(await read(page, 'past.length'), past + 1)
  assert.equal(await has(page, '.board-placement'), false)
  assert.equal(await read(page, 'ui.tool'), 'select')
  assert.deepEqual(errors, [])
})

test('Escape chain: the Location dialog closes first, then the placement, then calibrate', async (t) => {
  const { page, errors } = await open(t)
  await armPlacement(page)
  await openRangeSetup(page, 'Location…')
  await waitFor(page, () => window.__store.getState().ui.locationDialogOpen === true)
  assert.equal(await has(page, '.board-placement'), true, 'placement stays armed while the dialog opens')
  await page.keyboard.press('Escape')
  await waitFor(page, () => window.__store.getState().ui.locationDialogOpen === false)
  assert.equal(await has(page, '.board-placement'), true, 'placement survives the first Escape')
  await page.keyboard.press('Escape')
  await waitFor(page, () => !document.querySelector('.board-placement'))
  await openRangeSetup(page, 'Calibrate scale')
  await waitFor(page, () => window.__store.getState().ui.tool === 'calibrate')
  await waitFor(page, () => document.querySelector('.board-placement[role="status"]')?.textContent.includes('Calibrating'))
  await page.keyboard.press('Escape')
  await waitFor(page, () => window.__store.getState().ui.tool === 'select')
  assert.equal(await has(page, '.board-placement[role="status"]'), false)
  assert.deepEqual(errors, [])
})

test('debrief record opens on run completion with a status summary', async (t) => {
  const { page, errors } = await open(t)
  await page.click('#board-phase-analyze')
  // Sampled Play prepares a trial first; completion needs the matching ready trial.
  await page.evaluate(() => window.__store.getState().startRun())
  await waitFor(page, () => ['ready', 'error'].includes(window.__store.getState().trial.status))
  await page.evaluate(async () => {
    const s = window.__store.getState()
    const { durationOf } = await import('/src/state/selectors.ts')
    s.completeRun(durationOf(s.scenario))
  })
  await waitFor(page, () => document.querySelector('details.evidence-products'))
  assert.equal(await page.evaluate(() => document.querySelector('details.evidence-products').hasAttribute('open')), true)
  assert.equal(await page.getAttribute('details.evidence-products > summary', 'role'), 'status')
  assert.deepEqual(errors, [])
})

test('analysis screens follow the phase and no lens bar renders', async (t) => {
  const { page, errors } = await open(t)
  const labels = () => page.evaluate(() => [...document.querySelectorAll('[aria-label="Analysis screens"] button')].map((b) => b.textContent))
  await page.click('#board-phase-analyze')
  await waitFor(page, () => document.querySelector('[aria-label="Analysis screens"]'))
  assert.deepEqual(await labels(), ['Outcome', 'Compare'])
  await page.click('#board-phase-execute')
  await waitFor(page, () => document.querySelectorAll('[aria-label="Analysis screens"] button').length === 1)
  assert.deepEqual(await labels(), ['Now'])
  assert.equal(await has(page, '.lens-builtins'), false)
  assert.equal(await has(page, '.lens-layout'), false)
  assert.deepEqual(errors, [])
})
