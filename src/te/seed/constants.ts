/**
 * Reference constants (MASTER-SEEDDATA sections 3.7, 3.8, 5.1, 5.3, 5.4, 5.6).
 * Authority lead times seed the schedule planner; doctrine thresholds and
 * observed-practice figures seed the reference library; the refuted-claims
 * blocklist surfaces when a user cites one.
 */

/** Regulatory and scheduling lead-time constants (section 5.1). */
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

/** Numeric doctrine thresholds (sections 3.8 and 5.3). Default reference values. */
export const DOCTRINE_THRESHOLDS: Array<{ name: string; value: string; source: string }> = [
  {
    name: 'Detect-to-engage design threshold (DOC-D2E-4MIN)',
    value: '<= 4 minutes',
    source: 'FAAD C2 construct',
  },
  {
    name: 'Planning detection range (DOC-PLAN-50PCT)',
    value: 'approximately 50% of a system\'s maximum range',
    source:
      'Planning rule; radar max-range figures do not equal detect ranges for Group 1-3 sUAS (size, RCS, radar location determine picture fidelity)',
  },
  {
    name: 'Fixed-site engagement volume (DOC-FIXED-VOL)',
    value: '~30 km radius / 20,000 ft AGL from bullseye center',
    source:
      'Fixed-site doctrine; Base Defense Zone holds the BDOC, which holds Target Engagement Authority on all entering aircraft',
  },
]

/**
 * Observed-practice figures (section 3.7, OSINT compendium, verified by
 * 3-vote adversarial verification, confidence high). Label on every use:
 * observed practice, never doctrine. Caveats: RUSI single analytical lineage
 * (6 of 10 findings); Ukrainian government claims unverified; Shahed cost
 * figures sensitive to unit-cost assumption; findings describe 2024-2025
 * conditions and are time-sensitive.
 */
export const OBSERVED_PRACTICE: Array<{ claim: string; value: string; source: string }> = [
  {
    claim:
      'Ukrainian seven-phase combined-arms framework: survey, isolation, degradation, fixing, suppression, close combat/destroy, consolidation; UAVs in every phase',
    value: 'Emergent practice, not codified doctrine',
    source: 'observed practice; OSINT compendium',
  },
  {
    claim: 'FPV kill zone: majority of Ukrainian FPV kills fall either side of the forward line of troops',
    value: 'within ~3 km',
    source: 'observed practice; OSINT compendium',
  },
  {
    claim: 'Fiber-optic FPV outliers',
    value: '10-20 km',
    source: 'observed practice; OSINT compendium',
  },
  {
    claim: 'Ukrainian FPVs that fail to reach their targets',
    value: '60-80%',
    source: 'observed practice; OSINT compendium',
  },
  {
    claim: 'Tactical UAVs share of damaged/destroyed Russian systems as of early 2025',
    value: '60-70%',
    source: 'observed practice; OSINT compendium',
  },
  {
    claim: 'March 2026: share of 35,351 claimed monthly Russian casualties attributed to tactical drones',
    value: '96%',
    source: 'observed practice; unverified Ukrainian General Staff claim',
  },
  {
    claim:
      'Operator video-feed control markedly more effective than AI/pixel-lock terminal guidance, except against regular-outline targets (air-defense systems, enemy UAVs, EW antennas)',
    value: 'qualitative finding',
    source: 'observed practice; OSINT compendium',
  },
  {
    claim: 'Manufacturer claim: AI hit rate vs manual, applies under jamming',
    value: '~80% AI vs ~40% manual',
    source: 'observed practice; manufacturer claim',
  },
  {
    claim: 'Battlefield transparency near the line of contact',
    value: 'near-total within 3 km',
    source: 'observed practice; OSINT compendium',
  },
  {
    claim: 'Diminishing surveillance density',
    value: 'to 15 km',
    source: 'observed practice; OSINT compendium',
  },
  {
    claim: 'Taskable reconnaissance',
    value: 'to ~40 km',
    source: 'observed practice; OSINT compendium',
  },
  {
    claim: 'Russian Orlan-10/Zala ISR daily overflights by Aug 2023',
    value: '1,000-1,300',
    source: 'observed practice; OSINT compendium',
  },
  {
    claim: 'Daily orbits by Aug 2024',
    value: '1,000-1,500 (possible airframe double-counting)',
    source: 'observed practice; OSINT compendium',
  },
  {
    claim: 'Ukrainian response: networked radar/EO-cued interceptor UAVs',
    value: 'Brave1 ELF-P, VB140',
    source: 'observed practice; OSINT compendium',
  },
  {
    claim:
      'FPVs most efficient against slow low reconnaissance drones; radar-guided interceptors handle higher-flying targets',
    value: 'qualitative finding',
    source: 'observed practice; OSINT compendium',
  },
  {
    claim: 'GPS jamming as counter-UAS measure against GNSS-dependent systems',
    value: 'dominant measure',
    source: 'observed practice; OSINT compendium',
  },
  {
    claim:
      'Adaptations to GPS jamming: fiber-optic tethered drones, machine-vision terminal guidance, CRPA antennas',
    value: '~15 Ukrainian fiber-optic drone firms by early 2025',
    source: 'observed practice; OSINT compendium',
  },
  {
    claim: 'Manually piloted FPVs are defeated by control-link/video jamming instead',
    value: 'qualitative finding',
    source: 'observed practice; OSINT compendium',
  },
  {
    claim: 'Shahed campaign: missiles and drones Sep 2022 - Dec 2024',
    value: 'over 19,000',
    source: 'observed practice; OSINT compendium',
  },
  {
    claim: 'Including Shahed/Geran one-way attack drones',
    value: '14,700+',
    source: 'observed practice; OSINT compendium',
  },
  {
    claim: 'Sep-Dec 2024 launches vs the preceding 23 months combined',
    value: 'exceeded them',
    source: 'observed practice; OSINT compendium',
  },
  {
    claim: 'Shahed production by end-2024',
    value: '~2,000/month',
    source: 'observed practice; OSINT compendium',
  },
  {
    claim: 'Shahed unit cost',
    value: '$35k-$80k',
    source: 'observed practice; cost figures sensitive to unit-cost assumption',
  },
  {
    claim: 'Cost per target actually struck',
    value: '~$350,000',
    source: 'observed practice; CSIS estimate',
  },
  {
    claim: 'Ukraine industrial base growth in drone manufacturers',
    value: '7 (2022) to 500+ (2026)',
    source: 'observed practice; OSINT compendium',
  },
  {
    claim: 'Annual capacity growth',
    value: '~5,000 to projected 7 million (government projection, not realized output)',
    source: 'observed practice; OSINT compendium',
  },
  {
    claim: 'NATO C-UAS readiness gap: structured C-UAS capability absent from most NATO land forces',
    value: 'Oct 2024 assessment',
    source: 'observed practice; RUSI assessment',
  },
  {
    claim: 'NATO readiness aiming mark',
    value: '2028',
    source: 'observed practice; OSINT compendium',
  },
  {
    claim: 'Ukraine component mix targeting drone production in 2024',
    value: '1M drones',
    source: 'observed practice; doctrine-page context line',
  },
]

/**
 * Refuted claims blocklist (section 3.7; failed 3-vote verification).
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

/** Data delivery standard constants (section 5.6). Seed export presets. */
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
 * Decision-ready-track criteria (section 5.4). Illustrative default,
 * customer-configurable. A C2 track is decision-ready only when ALL hold.
 */
export const DECISION_READY_TRACK: string[] = [
  'Correct truth-object association.',
  'Required position and velocity fields present.',
  'Track age within 1.0 second.',
  'Position-quality state within the customer criterion.',
  'C2 track persistence for at least three consecutive updates.',
]
