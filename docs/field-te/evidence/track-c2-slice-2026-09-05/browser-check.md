# F-16 browser check, 2026-09-05

Dev server `npm run dev -- --port 5321 --strictPort`, Playwright Chromium, 1400 by 900,
right panel 320 px, script `f16-browser.cjs.txt` (run with the repo `node_modules` on
`NODE_PATH`). Real store actions: `addModel('sensor')`, `select({ libraryId })`,
`setRightTab('library')`; then the two library-editor inputs "Initiation M" and "Initiation N"
are typed into and the stored `sensor.trackInitM` / `trackInitN` are read back from
`window.__store`. Planning factors: M 3 of N 5. No page errors. Screenshot `f16-editor.png`.

| Step | Stored M | Stored N | Rule |
| --- | --- | --- | --- |
| new sensor model | PF | PF | |
| type M 5 with N at PF | 5 | PF (5) | 5 of 5 is valid; N unchanged |
| type N 3 under M 5 | 3 | 3 | M follows N down |
| type M 0 (PF) with N 3 | PF (3) | 3 | 3 of 3 is valid |
| type N 2 under PF M | 2 | 2 | M follows N down from the PF |
| type N 6 over M 2 | 2 | 6 | valid; M unchanged |
| type M 7 over N 6 | 7 | 7 | N follows M up |

The stored pair is valid after every step; the Inspector's "M of N scans" row can no longer
show M above N.
