/**
 * The header legend, as the mockup draws it: a swatch and a word for each
 * span and effect a reader meets first. Swatches draw with the strip's ink
 * tokens (the .runtl rules), so the daylight theme darkens them as it does
 * the marks. Items that do not fit the header drop whole, never cut.
 */
const ITEMS = [
  ['hold', 'hold'],
  ['coast', 'coast'],
  ['classify', 'classify'],
  ['window', 'window'],
  ['prep', 'prep'],
  ['flight', 'flight'],
  ['dwell', 'dwell'],
  ['hard-kill', 'hard kill'],
  ['mission-kill', 'mission kill'],
  ['miss', 'miss'],
] as const

export function Legend() {
  return (
    <ul className="runtl-legend" aria-label="Legend">
      {ITEMS.map(([kind, label]) => (
        <li key={kind}>
          <i className={`runtl-sw runtl-sw-${kind}`} aria-hidden="true" />
          {label}
        </li>
      ))}
    </ul>
  )
}
