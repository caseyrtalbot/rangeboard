# R-F-20 Engage row browser check, 2026-09-05

Dev server `npm run dev -- --port 5322 --strictPort`, Playwright Chromium, 1400 by 900,
right panel 320 px, script `rf20-browser.cjs.txt` (repo `node_modules` on `NODE_PATH`). Real
store actions: `addEntityFromModel` for Giraffe 1X, Coyote Block 2, FAAD C2 and Mavic 3, a
path drawn with `beginPath`, `addDraftPoint`, `finishPath`, connections through
`patchScenario`, `select({ entityIds: [uas] })`, `setRightTab('analysis')`. The Threat detail
Track file section is read from the page HTML. No page errors. Screenshot
`rf20-threat-detail.png`.

| Connections | Engage row |
| --- | --- |
| hand-drawn, untyped (no confidence) | `engageable` |
| the same two links with `confidence: 'documented'` (typed) | `no fire-control source on the route · Coyote Block 2 interceptor 1 needs a fire-control track from KuRFS fire-control radar (Raytheon) or AN/TPQ-53 multi-mission radar` |

The engine rule is unchanged: a fully typed route to a command-guided effector with no
fire-control sensor blocks that effector (`sim.ts` fcBlocked). The row names the effector and
the sensors its integration profile accepts. The static-markup test
`Detail.test.tsx` "names the missing fire-control source" covers the same two states.
