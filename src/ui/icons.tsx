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

/** The board objects list: four tiles. */
export function IconObjects() {
  return <Stroke d="M2.75 2.75h4v4h-4zM9.25 2.75h4v4h-4zM2.75 9.25h4v4h-4zM9.25 9.25h4v4h-4z" />
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
