/**
 * Every localStorage key the app reads or writes. Keys are the on-disk
 * contract with existing users: never rename one, add a new key instead.
 */

/** Board scenario autosave (`Scenario`, schemaVersion 1). */
export const SCENARIO_KEY = 'rangeboard.scenario.v1'
/** Copy of an unreadable scenario save; suffix is the epoch ms of the rescue. */
export const SCENARIO_RECOVERY_PREFIX = 'rangeboard.scenario.recovered.'
/** Canvas layer visibility (`LayerVisibility`). */
export const LAYERS_KEY = 'rangeboard.layers.v1'
/** Per-entity ring overrides (`RingOverrides`). */
export const RINGS_KEY = 'rangeboard.rings.v1'
/** Display units, `metric` or `aviation`. */
export const UNITS_KEY = 'rangeboard.units.v1'
/** Camera, basemap, right tab, workspace and theme (`SavedView`). */
export const VIEW_KEY = 'rangeboard.view.v1'
/** Run sequence the next startup issues (integer). */
export const RUNSEQ_KEY = 'rangeboard.runseq.v1'
/** Right panel width, px. */
export const RIGHT_PANEL_WIDTH_KEY = 'rangeboard.rightpanel.width'
/** Right panel open flag, '1' or '0'. A missing flag reads as open. */
export const RIGHT_PANEL_OPEN_KEY = 'rangeboard.rightpanel.open'
/** Palette width, px. */
export const PALETTE_WIDTH_KEY = 'rangeboard.palette.width'
/** Palette collapsed groups, JSON record. */
export const PALETTE_COLLAPSED_KEY = 'rangeboard.palette.collapsed'
/** Run timeline open flag, '1' or '0'. It keeps the engagement strip's key value. */
export const ENGSTRIP_OPEN_KEY = 'rangeboard.engstrip.open'
/** Run timeline strip height, px. */
export const RUN_TIMELINE_HEIGHT_KEY = 'rangeboard.runtimeline.height'
/** Retired analysis lens layout. Nothing reads it. */
export const ANALYSIS_KEY = 'rangeboard.analysis.v1'
/** Pinned baseline save (`BaselineSave`): one laydown and its ensemble kept for Compare. */
export const BOARD_BASELINE = 'rangeboard.baseline.v1'
/** Copy of an unreadable baseline save; suffix is the epoch ms of the rescue. */
export const BASELINE_RECOVERY_PREFIX = 'rangeboard.baseline.recovered.'
/** Library field overrides (`OverrideSet`): every user replacement of a library value, with its reason. */
export const OVERRIDES_KEY = 'rangeboard.overrides.v1'
/** Copy of an unreadable overrides save; suffix is the epoch ms of the rescue. */
export const OVERRIDES_RECOVERY_PREFIX = 'rangeboard.overrides.recovered.'
/** IndexedDB database name for the run store (`RunRecord` records). Not a localStorage key. */
export const RUNS_DB_NAME = 'rangeboard.runs.v1'
