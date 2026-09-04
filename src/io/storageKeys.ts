/**
 * Every localStorage key the app reads or writes. Keys are the on-disk
 * contract with existing users: never rename one, add a new key instead.
 */

/** Board scenario autosave (`Scenario`, schemaVersion 1). */
export const SCENARIO_KEY = 'rangeboard.scenario.v1'
/** Copy of an unreadable scenario save; suffix is the epoch ms of the rescue. */
export const SCENARIO_RECOVERY_PREFIX = 'rangeboard.scenario.recovered.'
/** T&E campaign store (`TeState`, schemaVersion 1). */
export const TE_KEY = 'rangeboard.te.v1'
/** Copy of an unreadable T&E save; suffix is the epoch ms of the rescue. */
export const TE_RECOVERY_PREFIX = 'rangeboard.te.recovered.'
/** Canvas layer visibility (`LayerVisibility`). */
export const LAYERS_KEY = 'rangeboard.layers.v1'
/** Per-entity ring overrides (`RingOverrides`). */
export const RINGS_KEY = 'rangeboard.rings.v1'
/** Display units, `metric` or `aviation`. */
export const UNITS_KEY = 'rangeboard.units.v1'
/** Camera, basemap, right tab and workspace (`SavedView`). */
export const VIEW_KEY = 'rangeboard.view.v1'
/** Run sequence the next startup issues (integer). */
export const RUNSEQ_KEY = 'rangeboard.runseq.v1'
/** Right panel width, px. */
export const RIGHT_PANEL_WIDTH_KEY = 'rangeboard.rightpanel.width'
/** Palette width, px. */
export const PALETTE_WIDTH_KEY = 'rangeboard.palette.width'
/** Palette collapsed groups, JSON record. */
export const PALETTE_COLLAPSED_KEY = 'rangeboard.palette.collapsed'
/** Engagement strip open flag, '1' or '0'. */
export const ENGSTRIP_OPEN_KEY = 'rangeboard.engstrip.open'
/** Analysis lens layout and user presets (`AnalysisViewState`). */
export const ANALYSIS_KEY = 'rangeboard.analysis.v1'
