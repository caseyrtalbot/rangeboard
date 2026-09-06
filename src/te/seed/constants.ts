/**
 * Reference constants (docs/te-compilation/MASTER-SEEDDATA.md).
 * Authority lead times seed the schedule planner; doctrine thresholds and
 * observed-practice figures seed the reference library; the refuted-claims
 * blocklist surfaces when a user cites one.
 */

/** Regulatory and scheduling lead-time constants. */
export const AUTHORITY_LEAD_TIMES: Array<{ authorityType: string; leadTime: string; note: string }> = [
  {
    authorityType: 'FAA Part 107 waiver',
    leadTime: '1 to 3 months',
    note: 'REG-FAA-107',
  },
  {
    authorityType: '49 U.S.C. section 44807 exemption plus Blanket COA (UAS over 55 lb)',
    leadTime: '4 to 9 months',
    note: 'REG-44807-COA',
  },
  {
    authorityType: 'Public-aircraft COA',
    leadTime: '60 to 90 days',
    note: 'REG-PUB-COA',
  },
  {
    authorityType: 'FCC Part 5 special temporary authority',
    leadTime: '2 to 8 weeks',
    note: 'REG-FCC-STA',
  },
  {
    authorityType: 'FCC conventional experimental license',
    leadTime: '1 to 3 months',
    note: 'REG-FCC-EXP: 5-year program license available for repeated testing',
  },
  {
    authorityType: 'Intentional GPS interference approval',
    leadTime: 'at least 60 to 90 days',
    note: 'REG-GPS-DENY: specified geographic area only; DoD-controlled',
  },
  {
    authorityType: 'Open-air RF or GPS-denial testing at a commercial range',
    leadTime: 'not time-bound',
    note: 'REG-RF-RANGE: requires a federal sponsor or a physical enclosure (cables, chamber, screened enclosure)',
  },
  {
    authorityType: 'Universal Documentation System Program Introduction',
    leadTime: 'send 6 to 12 months before the campaign',
    note: 'REG-UDS-PI',
  },
  {
    authorityType: 'MRTFB range reservation',
    leadTime: 'at least two quarters ahead (quarterly schedule boards)',
    note: 'REG-MRTFB-RES: commercial entities can buy MRTFB time at direct cost under 10 U.S.C. section 4175',
  },
  {
    authorityType: 'ATEC Safety Release inputs',
    leadTime: '60 to 90 days before Soldiers use the system',
    note: 'REG-ATEC-SR',
  },
  {
    authorityType: 'First UAS flight clearance at a government range',
    leadTime: '2 to 6 months',
    note: 'REG-UAS-CLR',
  },
  {
    authorityType: 'OT plans to DOT&E (oversight programs)',
    leadTime: 'at least 60 days before test',
    note: 'REG-DOTE-PLAN',
  },
  {
    authorityType: 'Operational test agency report of record',
    leadTime: '45 days before the decision (Major Capability Acquisition)',
    note: 'REG-OTA-ROR',
  },
  {
    authorityType: 'UCA disposition analysis',
    leadTime: 'within 1 year after sustainment entry',
    note: 'REG-UCA-DISP',
  },
  {
    authorityType: 'Quick-look report window',
    leadTime: '24 to 72 hours',
    note: 'REG-QL-WINDOW: authenticated runs only; preliminary watermark',
  },
  {
    authorityType: 'MIL-STD-882E risk acceptance',
    leadTime: 'not time-bound',
    note: 'REG-882E-RISK: Component Acquisition Executive accepts High risk; Portfolio Acquisition Executive accepts Serious risk',
  },
]

/**
 * Refuted claims blocklist (failed 3-vote verification).
 * DO NOT CITE. The app surfaces this list when a user cites one.
 */
export const REFUTED_CLAIMS: string[] = [
  'Ukrainian drones account for >65% of destroyed Russian tanks',
  'Low-cost drones have "democratized air power," replacing traditional air forces',
  'Drone effectiveness depends less on technology than organizational integration, as stated',
  'Wire/fibre-guided FPVs are EW-immune but limited to ~10 km with degraded flight performance',
  'Most brigades field a UAV company/battalion per 40-70 km of front; each battalion generates 4-6 orbits',
  'Shaheds hit <10% of targets vs 90-95% for Iskander-M/Kh-22',
  'FPV units: 50-60% targeting efficiency vs 0.5-1.5% for artillery',
  'Interceptor drones (~100k produced 2025, ~2,000/day) down ~70% of Russian Gerans',
]

/** Data delivery standard constants. Seed export presets. */
export const DATA_STANDARDS: Array<{ name: string; value: string }> = [
  {
    name: 'Telemetry',
    value: 'IRIG 106 Chapter 10 or Chapter 11 files with IRIG-B time stamps',
  },
  {
    name: 'Time base',
    value:
      'GPS-disciplined station clock distributing IRIG-B and Precision Time Protocol; all truth sources on one time base',
  },
  {
    name: 'Government-integrated events',
    value: 'Publish ground truth and tracks as TENA objects',
  },
  {
    name: 'Post-test pipelines',
    value:
      'Align with VAULTIS (visible, accessible, understandable, linked, trustworthy, interoperable, secure) and CHEETAS-receivable formats',
  },
  {
    name: 'Classification floor',
    value: 'Treat test data as CUI at a minimum',
  },
  {
    name: 'Closeout submissions',
    value:
      'Final technical report to DTIC with Standard Form 298 and distribution statement; lessons to the Joint Lessons Learned Information System (JLLIS)',
  },
  {
    name: 'Report sequence',
    value:
      'Quick-look report, test report, analysis report, evaluation report. DOT&E Annual Report entry structure: description, mission, adequacy and limits, effectiveness, suitability, survivability, recommendations',
  },
]

/**
 * Standard campaign schedule milestones, in working days before the
 * first live run (negative counts after start). Seed defaults; edit per campaign.
 */
export const SCHEDULE_MILESTONES: Array<{ name: string; tMinusDays: number }> = [
  { name: 'Qualification gate passed', tMinusDays: 45 },
  { name: 'Design approved and thresholds frozen', tMinusDays: 30 },
  { name: 'Authorities in hand (range, airspace, spectrum)', tMinusDays: 20 },
  { name: 'Integration rehearsal complete', tMinusDays: 15 },
  { name: 'Instrumentation and time sync verified', tMinusDays: 10 },
  { name: 'Test readiness review', tMinusDays: 5 },
  { name: 'Cards issued, cold reads and dry runs done', tMinusDays: 2 },
  { name: 'First live run', tMinusDays: 0 },
  { name: 'Analysis complete', tMinusDays: -10 },
  { name: 'Decision evidence package delivered', tMinusDays: -20 },
  { name: 'Campaign closeout', tMinusDays: -30 },
]

/** Generic run event-mark vocabulary offered on every run console. */
export const GENERIC_MARKS: string[] = [
  'start recording',
  'start run',
  'mark event',
  'mark phase transition',
  'record operator action',
  'record system response',
  'add observation',
  'mark deviation',
  'mark anomaly',
  'pause',
  'stop',
  'complete run',
]

/** Expenditure marks offered when the board holds a kinetic effector. */
export const KINETIC_MARKS: string[] = [
  'effector fired',
  'rounds expended',
  'intercept',
]

// Selection vocabularies behind chips and selects. Every consumer prepends an
// unknown stored value to its option list so legacy free text stays valid.

/** Release classes. CUI is the doctrine floor; default on create. */
export const SECURITY_CLASSES = ['Unclassified', 'CUI', 'Secret']

/** Threat navigation modes (matches the board UasSpec vocabulary). */
export const NAV_MODES = ['gps', 'inertial', 'rf-manual', 'optical', 'fiber', 'mixed']

/** Threat airframe classes (matches the board UasSpec vocabulary). */
export const AIRFRAMES = ['quad', 'fixed-wing', 'vtol', 'one-way-attack', 'fpv']

/** Matrix cell methods. A baseline row anchors every comparison. */
export const MATRIX_METHODS = [
  'baseline comparison',
  'characterization sweep',
  'comparison',
  'stress',
  'diagnostic',
]

/** Standard covariate factor names (src/model/seedCards.ts standardCovariates). */
export const STANDARD_COVARIATE_FACTORS = [
  'Surface wind',
  'Visibility and cloud base',
  'Air temperature and dew point',
  'Pressure QNH/QFE',
  'Illuminance',
  'EM background',
  'Acoustic background',
]

/** Evidence available today for a question, before this campaign runs. */
export const CURRENT_EVIDENCE_STATES = [
  'none',
  'vendor claim only',
  'prior test',
  'model only',
  'operational report',
]

/** What one trial is for a measure. */
export const EXPERIMENTAL_UNITS = ['engagement', 'run', 'track', 'sortie', 'day']

/** How far the truth source stands from the tested system. */
export const TRUTH_INDEPENDENCE = [
  'fully independent',
  'shares components',
  'derived from tested system',
]

/** Threat emissions bands. */
export const EMISSIONS_BANDS = ['2.4 GHz', '5.8 GHz', 'silent']

/** Who is blind to the plan during a run. */
export const BLINDING_OPTIONS = ['none', 'red blind', 'blue blind', 'both']

/** Fidelity grid feature rows for non-actual threat representations. */
export const FIDELITY_FEATURES = ['emissions', 'speed', 'payload', 'nav']

/** Terrain and clutter classes for conditions. */
export const TERRAIN_CLASSES = ['open', 'rolling', 'urban', 'coastal', 'mountain']

/** EM spectrum states. Contested or worse promotes degraded-mode questions. */
export const SPECTRUM_STATES = ['benign', 'representative', 'congested', 'contested', 'denied']

/** Network states for conditions. */
export const NETWORK_STATES = ['nominal', 'degraded', 'denied']

/** Operator workload levels. */
export const WORKLOAD_LEVELS = ['low', 'moderate', 'high', 'saturated']

/** Degraded modes offered on conditions; promoted when the spectrum is contested. */
export const DEGRADED_MODES = ['GPS denied', 'comms out', 'sensor down']

/** Named environment presets. One pick writes weather, spectrum, and network. */
export const ENVIRONMENT_PRESETS: Array<{
  key: string
  label: string
  hint: string
  weatherAndIllumination: string
  emEnvironment: string
  networkState: string
}> = [
  {
    key: 'benign-day',
    label: 'benign day',
    hint: 'Clear day, quiet spectrum, nominal network.',
    weatherAndIllumination: 'Wind 5 kt from 270 deg true; 20 C; clear; day light',
    emEnvironment: 'benign',
    networkState: 'nominal',
  },
  {
    key: 'contested-ew-range',
    label: 'contested EW range',
    hint: 'Clear day, contested spectrum, nominal network.',
    weatherAndIllumination: 'Wind 10 kt from 270 deg true; 20 C; clear; day light',
    emEnvironment: 'contested',
    networkState: 'nominal',
  },
  {
    key: 'degraded-network',
    label: 'degraded network',
    hint: 'Clear day, representative spectrum, degraded network.',
    weatherAndIllumination: 'Wind 10 kt from 270 deg true; 20 C; clear; day light',
    emEnvironment: 'representative',
    networkState: 'degraded',
  },
]

/** Why-this-run-next reason chips (writes whyHighestValueNext and priorityReason). */
export const WHY_NEXT_REASONS = [
  'closes largest gap',
  'unblocks runs',
  'decision deadline',
  'cheapest discriminator',
  'perishable access',
]

/** Standard reset actions between repetitions on one card. */
export const RESET_ACTIONS = [
  'threat back to start point',
  'clear track picture',
  'restart recorders',
  'reload effector',
  'confirm truth source lock',
  'confirm time sync',
]

/** Data-stop taxonomy: instrumentation failures that stop a run. */
export const STOP_TAXONOMY = ['truth loss', 'recorder failure', 'time-sync loss']

/** First-look data quality after a run. */
export const INITIAL_DATA_QUALITY = ['complete', 'gaps noted', 'truth dropout']

/** Immediate actions when a deviation appears. */
export const IMMEDIATE_ACTIONS = ['continue', 'pause', 'safe state', 'stop', 'resume after fix']

/** Protect-the-data actions when an anomaly appears. */
export const PRESERVATION_ACTIONS = [
  'freeze files',
  'screenshot',
  'keep hardware state',
  'copy logs',
]

/** Mission effect of an anomaly. */
export const MISSION_EFFECTS = ['none', 'degraded', 'data loss', 'safety']

/** Standard missing-data rules for measures. */
export const MISSING_DATA_RULES = [
  'exclude the opportunity',
  'count as failure',
  'repeat the run',
  'note and analyze with limits',
]

/** Standard invalid-data rules for measures. */
export const INVALID_DATA_RULES = [
  'exclude the opportunity',
  'repeat the run',
  'use backup truth source',
]

/** Standard censoring rules for latency and time-to-event measures. */
export const CENSORING_RULES = [
  'censor at run end',
  'censor at truth loss',
  'exclude censored opportunities',
]

/** Known-limit categories. Filled chips seed feasibility rows. */
export const KNOWN_LIMIT_CATEGORIES = [
  'range and site access',
  'airspace',
  'spectrum',
  'threat articles',
  'instrumentation',
  'schedule and funding',
]

/**
 * Campaign start presets. A preset seeds structure and
 * recommended records only. It never fabricates factual test data;
 * text placeholders use [placeholder] so the card gate catches them.
 * `previous-campaign` routes through startFromCampaign, not applyPreset.
 */
export const CAMPAIGN_PRESETS: Array<{ key: string; label: string; hint: string }> = [
  { key: 'blank', label: 'Blank', hint: 'Start with nothing seeded.' },
  { key: 'previous-campaign', label: 'Previous campaign', hint: 'Copy structure from an existing campaign. Evidence never copies.' },
  { key: 'sensor-characterization', label: 'Sensor characterization', hint: 'Detect and track measures, one question, one card draft.' },
  { key: 'radar-comparison', label: 'Radar comparison', hint: 'Two config skeletons, baseline plus delta matrix rows.' },
  { key: 'sensor-c2-integration', label: 'Sensor-to-C2 integration', hint: 'Handoff measures and a handoff card draft.' },
  { key: 'c2-track-fusion', label: 'C2 track fusion', hint: 'Fusion measures and two threat skeletons.' },
  { key: 'ew-resilience', label: 'EW resilience', hint: 'Contested spectrum condition, EW measures, adaptive threat skeleton.' },
  { key: 'interceptor-evaluation', label: 'Interceptor evaluation', hint: 'Defeat measures and an intercept card draft.' },
  { key: 'detect-to-defeat', label: 'Detect to defeat', hint: 'Kill-chain questions, raid threat skeleton, two card drafts.' },
  { key: 'regression-test', label: 'Regression test', hint: 'Copy a previous campaign, then re-run its baseline.' },
  { key: 'custom-template', label: 'Custom template', hint: 'Reserved. Behaves as Blank until a template store exists.' },
]
