/**
 * The chrome icon set. Each icon is a 16 px inline SVG with a 1.5 px stroke in
 * `currentColor`, so it takes the button's text ink in both themes. The icon is
 * decoration: the button that holds it carries the label or title.
 */
function Stroke({ d }: { d: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} />
    </svg>
  )
}

/** The Library drawer: two upright volumes and one leaning volume. */
export function IconLibrary() {
  return <Stroke d="M3 2.5v11M6.5 2.5v11M9.5 3.25l3 10" />
}

/** The command palette: the command key. */
export function IconCommands() {
  return <Stroke d="M10 4v8a2 2 0 1 0 2-2H4a2 2 0 1 0 2 2V4a2 2 0 1 0-2 2h8a2 2 0 1 0-2-2" />
}

export function IconUndo() {
  return <Stroke d="M5.5 3.5 2.5 6.5l3 3M2.5 6.5h7a3.25 3.25 0 0 1 0 6.5H7" />
}

export function IconRedo() {
  return <Stroke d="M10.5 3.5l3 3-3 3M13.5 6.5h-7a3.25 3.25 0 0 0 0 6.5H9" />
}

export function IconClose() {
  return <Stroke d="M4 4l8 8M12 4l-8 8" />
}

/** A disclosure caret, pointing down. Rotate it for a closed state. */
export function IconCaret() {
  return <Stroke d="M4.5 6.25 8 9.75l3.5-3.5" />
}

/** Settings: a gear, a hub ring and eight teeth. */
export function IconSettings() {
  return (
    <Stroke d="M8 5.75a2.25 2.25 0 1 1 0 4.5 2.25 2.25 0 0 1 0-4.5zM8 1.75v1.5M8 12.75v1.5M1.75 8h1.5M12.75 8h1.5M3.6 3.6l1.05 1.05M11.35 11.35l1.05 1.05M3.6 12.4l1.05-1.05M11.35 4.65l1.05-1.05" />
  )
}

/** More actions: three dots in a row. */
export function IconMore() {
  return <Stroke d="M3.5 8h.01M8 8h.01M12.5 8h.01" />
}

/** A side drawer: a frame with a divided left pane. */
export function IconDrawer() {
  return <Stroke d="M2.5 3h11v10h-11zM6.5 3v10" />
}

/** The entities list: three bullets and three rows. */
export function IconEntities() {
  return <Stroke d="M3 4h.01M3 8h.01M3 12h.01M6 4h7M6 8h7M6 12h7" />
}

/** Layers: two stacked sheets seen in plan. */
export function IconLayers() {
  return <Stroke d="M8 2.5 14 5.5 8 8.5 2 5.5zM2 8.5l6 3 6-3M2 11l6 3 6-3" />
}

/** Frames: a film strip of two frames. */
export function IconFrames() {
  return <Stroke d="M2.5 3.5h11v9h-11zM8 3.5v9M2.5 6h11M2.5 10h11" />
}

/** Play: a right-pointing triangle. */
export function IconPlay() {
  return <Stroke d="M5 3.5v9l7-4.5z" />
}

/** Pause: two upright bars. */
export function IconPause() {
  return <Stroke d="M5.5 3.5v9M10.5 3.5v9" />
}

/** Reset: a counter-clockwise arrow back to the start. */
export function IconReset() {
  return <Stroke d="M3 3v3.5h3.5M3.4 6.5A5 5 0 1 1 3.5 10" />
}

/** Info: a circle with an i, the method note of a field. */
export function IconInfo() {
  return <Stroke d="M8 2a6 6 0 1 1 0 12A6 6 0 0 1 8 2zM8 7.25V11M8 5h.01" />
}

/** A chevron pointing down: an open section or a menu trigger. */
export function IconChevronDown() {
  return <Stroke d="M4 6l4 4 4-4" />
}

/** A chevron pointing right: a closed section or a drill-in row. */
export function IconChevronRight() {
  return <Stroke d="M6 4l4 4-4 4" />
}

/** Add: a plus sign. */
export function IconPlus() {
  return <Stroke d="M8 3v10M3 8h10" />
}

/** Search: a lens and a handle. */
export function IconSearch() {
  return <Stroke d="M7 2.75a4.25 4.25 0 1 1 0 8.5 4.25 4.25 0 0 1 0-8.5zM10.25 10.25 13.5 13.5" />
}

/** Edit: a pencil on a slant. */
export function IconPencil() {
  return <Stroke d="M11 2.5 13.5 5 5.5 13H3v-2.5zM9.5 4l2.5 2.5" />
}
