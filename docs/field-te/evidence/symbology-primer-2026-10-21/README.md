# Symbology primer browser check, 2026-10-21

Captured on branch `symbology/primer` as an uncommitted working tree on top of `cc695df`,
after every lane of the primer refactor landed (inks, Glyph.tsx library, lines and rings,
pairing lines and outcome marks, EntityLayer frames and amplifiers, velocity leader and
data block). The Vite dev server ran the source on port 5181. Playwright drove the
installed Google Chrome (`channel: 'chrome'`, headless, its own profile) at a 1265 by 900
viewport, dark theme unless a row says paper. The fixture is the 54-entity performance
board "Layered (Acoustic + MEROPS)",
[perf-2026-09-06/scenario.json](../perf-2026-09-06/scenario.json), loaded through
`parseAutosave` and `loadScenario`. Execute started one trial, played at 30x until the
observed horizon passed the first kinetic effect, then paused and scrubbed.

The script is preserved as `symbology-capture.mjs.txt` (dev server, through
`window.__store`); the close-up pass appended a 10x camera section to the same file and
wrote `findings-zoom.json`. They are evidence of a dated run, not tests. The PNGs passed
through `oxipng -o 4 --strip safe` (lossless, 34 percent saved).

## Shots

| File | State |
| --- | --- |
| `prepare-dark.png` | Prepare, whole board fitted. Grey no-track diamonds with leaders, blue line frames with 2525 icons, white dashed rings at rest, data blocks right of the frames |
| `prepare-light.png` | The same state in the paper theme |
| `execute-overview-dark.png` | Execute, paused at T+1:45 after 30x play, whole board. Red diamonds with ENG-M bars, blue ASN-M bars on the launchers, solid blue sensor rings while held, white MAX RG label on the active MIR ring |
| `execute-overview-light.png` | The same state in the paper theme |
| `zoom-threat-flight-dark.png` | T+1:00, 10x on the engaged raid: six hostile diamonds with the UAV icon, board knockout, red ENG-M bars with board-tone text, white corner brackets, spoke callouts for the six names |
| `zoom-threat-flight-light.png` | The same state in the paper theme (hostile `#d43725`, friend `#2862b0`) |
| `zoom-threat-after-dark.png` | T+1:44, same camera, after the first effect: an open-circle miss mark with its `1:41` time beside the raid; the frames keep their identity |
| `zoom-effector-dark.png` | T+1:00, 10x on the firing launcher cluster: circle frames with the launcher icon, blue ASN-M bars, C2 unit rectangles, the DA installation frame with its top bar, dashed white rings at rest |
| `zoom-effector-light.png` | The same state in the paper theme |
| `zoom-radar-dark.png` | 10x on a radar sensor: circle frame, radar icon, boresight tick from the frame edge |
| `zoom-radar-selected-dark.png` | The same radar selected: white hook ring over the board halo, heading knob in the friend hue, callouts for the clustered names |
| `zoom-eo-dark.png` | 10x on a non-radar sensor: circle frame, four-point sensor icon |
| `zoom-jam-dark.png` | 10x on the jammer: circle frame with EW text among the C2 and launcher frames |
| `zoom-c2-dark.png` | 10x on a C2 node: unit rectangle with C2 text |
| `zoom-asset-dark.png` | 10x on the defended asset: installation frame with the top bar and DA text |

## Findings

`findings.json` and `findings-zoom.json` hold the captured state. Both runs: 0 page
errors, 0 console errors. Trial status `ready`; the first kinetic shot released at T+20 s
with its effect at T+101.6 s; the observed horizon reached 107.0 s.

Verdicts from the shots:

- Line frames, knockout fill, identity hues, bars, brackets, the J amplifier position, the
  selection hook and the knob all draw as the primer draws them, in both themes.
- Konva hinting: the radar and sensor icons are legible at the 24 px frame. The launcher
  icon reads as a rounded pill at that size; the letter fallback (`E`) is the primer's
  stated alternative if that is judged too fine. Recorded as a follow-up, not changed.
- A leader on a north-bound track sits under the engagement bar, because both occupy the
  top of the frame. The primer draws its examples at 40 degrees. Recorded as a follow-up.
- The six-ship raid and the 43 systems of this fixture put most names into spoke callouts,
  which is the existing label layout and not a symbology change. A callout shows line one
  of the data block only, by design.
- The MAX RG label and the white active effector ring are visible on the overview; MIN RG
  did not draw because the firing launcher has no minimum range in the library.
- Nothing on the board pulses: the engaged frame, the beam and the badge are steady across
  the paused shots.

## Not checked here

- The paper theme at 280 and 408 px widths (the pre-R3 cleanup widths).
- A hard kill mark (`K m:ss`) and the ghost frame: the first effect in this fixture was a
  miss, and the run was not played further. The unit tests cover the kill path.
- A jammed track (cyan J, ENG-EA bar) and the jammer footprint wedge during a dwell.
- A degraded sensor condition bar.
