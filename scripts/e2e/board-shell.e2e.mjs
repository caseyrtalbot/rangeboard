// Board shell end-to-end spec. Drives the dev build through window.__store and
// asserts store state and the DOM. Run: node --test scripts/e2e/board-shell.e2e.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { chromium } from 'playwright'

const BASE_URL = process.env.E2E_URL || 'http://localhost:5377'
const FIXTURE = new URL(
  '../../docs/field-te/evidence/onboarding-2026-09-04/firing-scenario.json',
  import.meta.url,
)
const RAW = readFileSync(FIXTURE, 'utf8')
const ENTITY_COUNT = JSON.parse(RAW).entities.length

let browser
before(async () => {
  browser = await chromium.launch({ headless: true })
})
after(async () => {
  await browser?.close()
})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const read = (page, path) =>
  page.evaluate((p) => p.split('.').reduce((o, k) => o?.[k], window.__store.getState()), path)
const has = (page, selector) => page.evaluate((sel) => !!document.querySelector(sel), selector)
const waitFor = (page, fn, arg) => page.waitForFunction(fn, arg, { timeout: 10000 })
const PLACE_MODEL =
  '.palette-scroll .palette-section:not(:first-child) button[aria-label^="Place "]'

async function open(t) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  await ctx.addInitScript(() => localStorage.setItem('rangeboard.rightpanel.width', '320'))
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 200))
  })
  t.after(() => ctx.close())
  await page.goto(BASE_URL, { waitUntil: 'load' })
  await page.waitForFunction(
    () => document.querySelector('.konvajs-content canvas') && window.__store,
    null,
    { timeout: 60000 },
  )
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
  await waitFor(
    page,
    () =>
      document.getElementById('board-library-drawer').hidden &&
      document.querySelector('.board-placement'),
  )
}

async function openRangeSetup(page, item) {
  await page.click('button[aria-controls="range-setup-menu-panel"]')
  await page.click(`#range-setup-menu-panel button:has-text("${item}")`)
}

test('phase switching sets the phase, the analysis tab and aria-selected', async (t) => {
  const { page, errors } = await open(t)
  for (const phase of ['execute', 'analyze', 'prepare']) {
    await page.evaluate(() => window.__store.getState().setRightTab('inspect'))
    await page.click(`#board-phase-${phase}`)
    await waitFor(page, (p) => document.querySelector(`.board-app[data-board-phase="${p}"]`), phase)
    assert.equal(await read(page, 'ui.rightTab'), 'analysis', `${phase}: rightTab`)
    assert.equal(
      await page.getAttribute(`#board-phase-${phase}`, 'aria-selected'),
      'true',
      `${phase}: aria-selected`,
    )
  }
  assert.deepEqual(errors, [])
})

test('selection routing opens the entity workspace and the Overview tab returns to analysis', async (t) => {
  const { page, errors } = await open(t)
  const sensor = await page.evaluate(() => {
    const e = window.__store.getState().scenario.entities.find((x) => x.kind === 'sensor')
    return { id: e.id, name: e.name }
  })
  await page.evaluate((id) => window.__store.getState().select({ entityIds: [id] }), sensor.id)
  await waitFor(page, () => document.querySelector('.entity-workspace'))
  assert.equal(await read(page, 'ui.rightTab'), 'inspect')
  assert.ok(
    (await page.textContent('.entity-workspace')).includes(sensor.name),
    'the workspace shows the entity name',
  )
  assert.equal(await has(page, '.right-panel > .lens'), false, 'no screen navigation')
  await page.click('#insp-tab-analysis')
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
  assert.ok(
    await page.evaluate(() => !!document.activeElement?.closest('#board-library-drawer')),
    'focus is inside the drawer',
  )
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
  assert.equal(
    await has(page, '.board-placement'),
    true,
    'placement stays armed while the dialog opens',
  )
  await page.keyboard.press('Escape')
  await waitFor(page, () => window.__store.getState().ui.locationDialogOpen === false)
  assert.equal(await has(page, '.board-placement'), true, 'placement survives the first Escape')
  await page.keyboard.press('Escape')
  await waitFor(page, () => !document.querySelector('.board-placement'))
  await openRangeSetup(page, 'Calibrate scale')
  await waitFor(page, () => window.__store.getState().ui.tool === 'calibrate')
  await waitFor(page, () =>
    document.querySelector('.board-placement[role="status"]')?.textContent.includes('Calibrating'),
  )
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
  assert.equal(
    await page.evaluate(() =>
      document.querySelector('details.evidence-products').hasAttribute('open'),
    ),
    true,
  )
  assert.equal(await page.getAttribute('details.evidence-products > summary', 'role'), 'status')
  assert.deepEqual(errors, [])
})

test('analysis screens follow the phase and no lens bar renders', async (t) => {
  const { page, errors } = await open(t)
  const labels = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('.insp-tab-group [role="tab"]')].map((b) => b.textContent),
    )
  await page.click('#board-phase-analyze')
  await waitFor(page, () => document.querySelector('.insp-tab-group'))
  assert.deepEqual(await labels(), ['Outcome', 'Compare'])
  await page.click('#board-phase-execute')
  // Execute has one screen, so it draws one Run monitor tab and no segmented control.
  await waitFor(page, () => document.querySelector('.board-app[data-board-phase="execute"]'))
  assert.deepEqual(await labels(), ['Run monitor'])
  assert.equal(await has(page, '.lens-builtins'), false)
  assert.equal(await has(page, '.lens-layout'), false)
  assert.deepEqual(errors, [])
})

test('drawer: the header toggle and ] close and reopen the right panel and hold the board center', async (t) => {
  const { page, errors } = await open(t)
  const hostWidth = () => page.evaluate(() => document.querySelector('.canvas-host').clientWidth)
  const w0 = await hostWidth()
  const x0 = await read(page, 'camera.x')
  await page.click('#drawer-toggle')
  await waitFor(page, () => document.getElementById('board-workspace-panel').hidden)
  assert.equal(await page.getAttribute('#drawer-toggle', 'aria-expanded'), 'false')
  assert.equal(await page.evaluate(() => localStorage.getItem('rangeboard.rightpanel.open')), '0')
  const w1 = await hostWidth()
  assert.ok(w1 > w0, 'the canvas takes the drawer width')
  const near = (actual, expected, label) =>
    assert.ok(Math.abs(actual - expected) < 1e-6, `${label}: ${actual} vs ${expected}`)
  near(await read(page, 'camera.x'), x0 + (w1 - w0) / 2, 'closed camera.x')
  await focusCanvas(page)
  await page.keyboard.press(']')
  await waitFor(page, () => !document.getElementById('board-workspace-panel').hidden)
  assert.equal(await hostWidth(), w0)
  near(await read(page, 'camera.x'), x0, 'reopened camera.x')
  assert.deepEqual(errors, [])
})

test('drawer: a selection keeps it closed and a resize drag past the minimum closes it', async (t) => {
  const { page, errors } = await open(t)
  await page.click('#drawer-toggle')
  await waitFor(page, () => document.getElementById('board-workspace-panel').hidden)
  const id = await page.evaluate(() => window.__store.getState().scenario.entities[0].id)
  await page.evaluate((entityId) => window.__store.getState().select({ entityIds: [entityId] }), id)
  await sleep(150)
  assert.equal(await read(page, 'ui.rightTab'), 'inspect')
  assert.equal(
    await page.evaluate(() => document.getElementById('board-workspace-panel').hidden),
    true,
  )
  await page.click('#drawer-toggle')
  await waitFor(page, () => !document.getElementById('board-workspace-panel').hidden)
  const bar = await page.locator('.right-resizer').boundingBox()
  await page.mouse.move(bar.x + bar.width / 2, bar.y + 200)
  await page.mouse.down()
  await page.mouse.move(bar.x + 220, bar.y + 200, { steps: 10 })
  await page.mouse.up()
  await waitFor(page, () => document.getElementById('board-workspace-panel').hidden)
  assert.deepEqual(errors, [])
})

test('playback bar: the Timeline toggle opens the run timeline above the bar and pushes the canvas up', async (t) => {
  const { page, errors } = await open(t)
  // D9: the transport renders in Execute and Analyze only.
  assert.equal(await has(page, '.timeline'), false, 'no transport in Prepare')
  await page.click('#board-phase-execute')
  await waitFor(page, () => document.querySelector('.board-app[data-board-phase="execute"]'))
  const hostHeight = () => page.evaluate(() => document.querySelector('.canvas-host').clientHeight)
  const barBox = () => page.locator('.timeline').boundingBox()
  const openFlag = () => page.evaluate(() => localStorage.getItem('rangeboard.engstrip.open'))
  const h0 = await hostHeight()
  const bar0 = await barBox()
  assert.equal(Math.round(bar0.height), 28, 'the transport is 28 px high')
  assert.equal(await has(page, '#run-timeline'), false, 'the run timeline starts closed')
  assert.equal(await has(page, '.runtl-dock'), false, 'no dock mounts while closed')
  assert.equal(await page.getAttribute('#run-timeline-toggle', 'aria-expanded'), 'false')
  await page.click('#run-timeline-toggle')
  await waitFor(page, () => document.querySelector('#run-timeline'))
  assert.equal(await page.getAttribute('#run-timeline-toggle', 'aria-expanded'), 'true')
  assert.equal(await openFlag(), '1')
  const dock = await page.locator('.runtl-dock').boundingBox()
  const bar1 = await barBox()
  const gap = Math.abs(dock.y + dock.height - bar1.y)
  assert.ok(gap <= 1, `the dock bottom meets the bar top: ${gap}`)
  const h1 = await hostHeight()
  assert.ok(h0 - h1 >= dock.height - 1, `the canvas gives the dock its height: ${h1} vs ${h0}`)
  assert.equal(Math.round(bar1.height), 28, 'the bar keeps its height')
  await page.click('#run-timeline-toggle')
  await waitFor(page, () => !document.querySelector('#run-timeline'))
  assert.equal(await has(page, '.runtl-dock'), false, 'the dock unmounts on close')
  assert.equal(await openFlag(), '0')
  assert.equal(await hostHeight(), h0, 'the canvas takes the dock height back')
  assert.deepEqual(errors, [])
})

test('status bar: 24 px, run id first, extra chips fold into a counted ROE chip', async (t) => {
  const { page, errors } = await open(t)
  const bar = await page.locator('.status-bar').boundingBox()
  assert.equal(Math.round(bar.height), 24, 'the status bar is 24 px high')
  const runText = (await page.textContent('.status-bar')).trim()
  assert.ok(runText.startsWith('RUN-'), `the status bar starts with the run id: ${runText}`)
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.evaluate(() => {
    const inline = document.querySelector('.status-bar .status-inline')
    for (const n of [1, 2, 3]) {
      const chip = document.createElement('span')
      chip.textContent = `Injected chip ${n} with a long label`
      inline.append(chip)
    }
    // A re-render re-measures the row, as a real chip change does.
    window.__store.setState((s) => ({ save: { ...s.save } }))
  })
  await sleep(100)
  const row = await page.evaluate(() => {
    const box = document.querySelector('.status-bar .status-inline').getBoundingClientRect()
    const chips = [...document.querySelectorAll('.status-bar .status-inline > *')].map((c) =>
      c.getBoundingClientRect(),
    )
    const el = document.querySelector('.status-bar')
    return {
      partial: chips.filter((c) => c.top < box.bottom && c.right > box.right + 0.5).length,
      hidden: chips.filter((c) => c.top >= box.bottom).length,
      count: document.querySelector('.status-bar .status-fold-count')?.textContent,
      overflow: el.scrollWidth - el.clientWidth,
      scroll: document.documentElement.scrollWidth - innerWidth,
    }
  })
  assert.equal(row.partial, 0, 'no chip is clipped mid-chip')
  assert.ok(row.hidden > 0, 'the full row hides whole chips')
  assert.equal(row.count, `+${row.hidden}`, 'the ROE button counts the hidden chips')
  assert.equal(row.overflow, 0, 'the status bar does not scroll sideways')
  assert.equal(row.scroll, 0, 'the page does not scroll sideways')
  assert.deepEqual(errors, [])
})

test('playback bar: the run timeline open state and height are restored from storage', async (t) => {
  const { page, errors } = await open(t)
  await page.evaluate(() => {
    localStorage.setItem('rangeboard.engstrip.open', '1')
    localStorage.setItem('rangeboard.runtimeline.height', '300')
  })
  // The reload loads the autosaved scenario, not the fixture; only the strip is asserted.
  await page.reload({ waitUntil: 'load' })
  await page.waitForFunction(
    () => document.querySelector('.konvajs-content canvas') && window.__store,
    null,
    { timeout: 60000 },
  )
  // The board boots in Prepare, where no transport renders (D9).
  assert.equal(await has(page, '.runtl-dock'), false, 'no dock in Prepare')
  await page.click('#board-phase-execute')
  await waitFor(page, () => document.querySelector('.board-app[data-board-phase="execute"]'))
  await waitFor(page, () => document.querySelector('#run-timeline'))
  assert.equal(await page.getAttribute('#run-timeline-toggle', 'aria-expanded'), 'true')
  const dock = await page.locator('.runtl-dock').boundingBox()
  assert.equal(Math.round(dock.height), 300, 'the dock is 300 px high')
  assert.deepEqual(errors, [])
})

test('header: the lifecycle tabs sit in the 36 px header and no phase row renders', async (t) => {
  const { page, errors } = await open(t)
  const bar = await page.locator('.toolbar').boundingBox()
  assert.equal(Math.round(bar.height), 36, 'the header is 36 px high')
  const overflow = await page.evaluate(() => {
    const el = document.querySelector('.toolbar')
    return el.scrollWidth - el.clientWidth
  })
  assert.equal(overflow, 0, `the header does not scroll sideways: ${overflow}`)
  assert.equal(
    await has(page, '.toolbar [role="tablist"][aria-label="Lifecycle views"]'),
    true,
    'the tablist is in the header',
  )
  assert.equal(
    await has(page, '.toolbar .mc-run.primary'),
    true,
    'the primary action is in the header',
  )
  assert.equal(await has(page, '.board-lifecycle'), false, 'no phase row renders')
  await page.click('.toolbar #board-phase-execute')
  await waitFor(page, () => document.querySelector('.board-app[data-board-phase="execute"]'))
  assert.deepEqual(errors, [])
})

test('header: the tabs hold the center, the groups fit, and Storage opens from the ⋯ menu', async (t) => {
  const { page, errors } = await open(t)
  await page.setViewportSize({ width: 1600, height: 900 })
  const bar = await page.evaluate(() => {
    const box = (sel) => document.querySelector(sel).getBoundingClientRect()
    const tabs = box('.board-phases')
    const right = document.querySelector('.toolbar-right')
    return {
      offset: tabs.left + tabs.width / 2 - innerWidth / 2,
      gapL: tabs.left - box('.toolbar-left > :last-child').right,
      rightOverflow: right.scrollWidth - right.clientWidth,
      scroll: document.documentElement.scrollWidth - innerWidth,
    }
  })
  assert.ok(Math.abs(bar.offset) < 1, `the tabs sit at the viewport center: ${bar.offset}`)
  assert.ok(bar.gapL >= 0, `the left group does not cover the tabs: ${bar.gapL}`)
  assert.equal(bar.rightOverflow, 0, 'the right group fits its track')
  assert.equal(bar.scroll, 0, 'the page does not scroll sideways')
  // Storage is the last item of the ⋯ menu; its panel replaces the menu.
  const storage = async () => {
    await page.click('.toolbar [aria-label="More actions"]')
    await page.click('.toolbar [aria-controls="storage-panel"]')
    await waitFor(page, () => document.querySelector('#storage-panel'))
    const box = await page.evaluate(() => {
      const p = document.querySelector('#storage-panel').getBoundingClientRect()
      return {
        left: p.left,
        right: p.right,
        top: p.top,
        bottom: document.querySelector('.toolbar').getBoundingClientRect().bottom,
      }
    })
    await page.keyboard.press('Escape')
    return box
  }
  const wide = await storage()
  assert.ok(Math.abs(1600 - wide.right - 14) < 1, `a 14 px right margin at 1600 px: ${wide.right}`)
  assert.ok(wide.top >= wide.bottom, 'the Storage panel opens below the bar')
  await page.setViewportSize({ width: 800, height: 900 })
  const narrow = await storage()
  assert.ok(narrow.left >= 0, `the Storage panel starts inside: ${narrow.left}`)
  assert.ok(
    Math.abs(800 - narrow.right - 14) < 1,
    `a 14 px right margin at 800 px: ${narrow.right}`,
  )
  assert.deepEqual(errors, [])
})
