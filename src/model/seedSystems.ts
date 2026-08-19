import type { FormationSpec, SystemPreset } from './types'

/**
 * Seed integrated C-UAS / IADS system templates, researched from open
 * reporting. Offsets are a representative laydown in meters (world frame:
 * +x east, +y south). Links are kill-chain connections: sensor -> C2 ->
 * effector, by component index.
 */
export const SEED_SYSTEMS: SystemPreset[] = [
  {
    id: 'sys-fslids',
    name: 'FS-LIDS fixed site (LIDS class)',
    description:
      'US Army fixed-site layered defense: four RPS-42 faces for 360 deg acquisition, KuRFS fire control, EO/IR identification, EW defeat, and Coyote interceptors under FAAD C2.',
    builtin: true,
    components: [
      { specId: 'lib-rps42', offsetM: { x: 0, y: -50 }, headingDeg: 0, purpose: 'Acquisition face, north sector' },
      { specId: 'lib-rps42', offsetM: { x: 50, y: 0 }, headingDeg: 90, purpose: 'Acquisition face, east sector' },
      { specId: 'lib-rps42', offsetM: { x: 0, y: 50 }, headingDeg: 180, purpose: 'Acquisition face, south sector' },
      { specId: 'lib-rps42', offsetM: { x: -50, y: 0 }, headingDeg: 270, purpose: 'Acquisition face, west sector' },
      { specId: 'lib-kurfs', offsetM: { x: 30, y: -20 }, headingDeg: 0, purpose: 'Precision fire-control track; uplinks Coyote' },
      { specId: 'lib-teleidoscope', offsetM: { x: -20, y: -15 }, headingDeg: 0, purpose: 'Visual identification on C2 cue' },
      { specId: 'lib-modi', offsetM: { x: -40, y: 20 }, headingDeg: 0, purpose: 'Non-kinetic EW defeat for small targets' },
      { specId: 'lib-coyote', offsetM: { x: 80, y: 50 }, headingDeg: 0, purpose: 'Kinetic defeat launcher 1' },
      { specId: 'lib-coyote', offsetM: { x: 120, y: 50 }, headingDeg: 0, purpose: 'Kinetic defeat launcher 2' },
      { specId: 'lib-faadc2', offsetM: { x: 0, y: 80 }, headingDeg: 0, purpose: 'Track fusion and engagement management' },
    ],
    links: [
      [0, 9], [1, 9], [2, 9], [3, 9], [4, 9], [5, 9],
      [9, 6], [9, 7], [9, 8],
    ],
  },
  {
    id: 'sys-merops',
    name: 'MEROPS counter-OWA site',
    description:
      'Counter-Shahed package: early-warning radar plus a forward acoustic line cue fixed-wing MEROPS interceptors through an expeditionary C2 node.',
    builtin: true,
    components: [
      { specId: 'lib-lstar', offsetM: { x: 0, y: 0 }, headingDeg: 0, purpose: 'Early warning and track initiation' },
      { specId: 'lib-acoustic-picket', offsetM: { x: -4500, y: -3000 }, headingDeg: 0, purpose: 'Forward low-altitude acoustic cue' },
      { specId: 'lib-acoustic-picket', offsetM: { x: -1500, y: -3000 }, headingDeg: 0, purpose: 'Forward low-altitude acoustic cue' },
      { specId: 'lib-acoustic-picket', offsetM: { x: 1500, y: -3000 }, headingDeg: 0, purpose: 'Forward low-altitude acoustic cue' },
      { specId: 'lib-acoustic-picket', offsetM: { x: 4500, y: -3000 }, headingDeg: 0, purpose: 'Forward low-altitude acoustic cue' },
      { specId: 'lib-picogrid', offsetM: { x: -100, y: 100 }, headingDeg: 0, purpose: 'Fuses radar and acoustic tracks; vectors interceptors' },
      { specId: 'lib-merops', offsetM: { x: 300, y: 0 }, headingDeg: 0, purpose: 'Interceptor rail 1' },
      { specId: 'lib-merops', offsetM: { x: 450, y: 80 }, headingDeg: 0, purpose: 'Interceptor rail 2' },
      { specId: 'lib-merops', offsetM: { x: 600, y: 160 }, headingDeg: 0, purpose: 'Interceptor rail 3' },
    ],
    links: [
      [0, 5], [1, 5], [2, 5], [3, 5], [4, 5],
      [5, 6], [5, 7], [5, 8],
    ],
  },
  {
    id: 'sys-acoustic-iads',
    name: 'Acoustic picket IADS (Sky Fortress class)',
    description:
      'Acoustic-led layered defense with its own geometry: a wide forward picket line of cheap omni microphone nodes gives minutes of warning; a fusion node cues a short-range tracking radar and mobile gun trucks plus a jammer.',
    builtin: true,
    components: [
      { specId: 'lib-acoustic-picket', offsetM: { x: -6000, y: -8000 }, headingDeg: 0, purpose: 'Picket line, west end' },
      { specId: 'lib-acoustic-picket', offsetM: { x: -3000, y: -8000 }, headingDeg: 0, purpose: 'Picket line' },
      { specId: 'lib-acoustic-picket', offsetM: { x: 0, y: -8000 }, headingDeg: 0, purpose: 'Picket line, threat axis center' },
      { specId: 'lib-acoustic-picket', offsetM: { x: 3000, y: -8000 }, headingDeg: 0, purpose: 'Picket line' },
      { specId: 'lib-acoustic-picket', offsetM: { x: 6000, y: -8000 }, headingDeg: 0, purpose: 'Picket line, east end' },
      { specId: 'lib-picogrid', offsetM: { x: 0, y: 0 }, headingDeg: 0, purpose: 'Acoustic fusion and fire-team alerting' },
      { specId: 'lib-echoshield', offsetM: { x: 200, y: -500 }, headingDeg: 0, purpose: 'Fire-control track on acoustic cue' },
      { specId: 'lib-xm914', offsetM: { x: -500, y: -2000 }, headingDeg: 0, purpose: 'Mobile gun truck, west lane' },
      { specId: 'lib-xm914', offsetM: { x: 1500, y: -2200 }, headingDeg: 0, purpose: 'Mobile gun truck, east lane' },
      { specId: 'lib-modi', offsetM: { x: 500, y: -2000 }, headingDeg: 0, purpose: 'Terminal-phase GNSS and link denial' },
    ],
    links: [
      [0, 5], [1, 5], [2, 5], [3, 5], [4, 5], [6, 5],
      [5, 7], [5, 8], [5, 9],
    ],
  },
  {
    id: 'sys-mesh',
    name: 'Distributed sensor mesh (Legion/Lattice class)',
    description:
      'Expeditionary mesh of mixed small sensors (passive RF, compact radar, acoustic, sensor tower) feeding edge C2 nodes; graceful degradation when any node drops out.',
    builtin: true,
    components: [
      { specId: 'lib-rfone', offsetM: { x: -2500, y: -2000 }, headingDeg: 315, purpose: 'Passive RF early warning, northwest' },
      { specId: 'lib-rfone', offsetM: { x: -3500, y: -500 }, headingDeg: 270, purpose: 'Passive RF early warning, west' },
      { specId: 'lib-echoshield', offsetM: { x: 2500, y: -2000 }, headingDeg: 45, purpose: 'Compact radar acquisition, northeast' },
      { specId: 'lib-echoshield', offsetM: { x: 3500, y: -500 }, headingDeg: 90, purpose: 'Compact radar acquisition, east' },
      { specId: 'lib-discovair', offsetM: { x: -800, y: -3200 }, headingDeg: 0, purpose: 'Acoustic fill for RF-silent and low threats' },
      { specId: 'lib-discovair', offsetM: { x: 800, y: -3200 }, headingDeg: 0, purpose: 'Acoustic fill for RF-silent and low threats' },
      { specId: 'lib-r8ss', offsetM: { x: 0, y: 1500 }, headingDeg: 180, purpose: 'Autonomous tower watching the rear sector' },
      { specId: 'lib-picogrid', offsetM: { x: 0, y: 0 }, headingDeg: 0, purpose: 'Edge fusion node, west cell' },
      { specId: 'lib-picogrid', offsetM: { x: 900, y: 300 }, headingDeg: 0, purpose: 'Edge fusion node, east cell' },
      { specId: 'lib-lattice', offsetM: { x: -400, y: 500 }, headingDeg: 0, purpose: 'Gateway into the theater air picture' },
      { specId: 'lib-anvil', offsetM: { x: 600, y: -300 }, headingDeg: 0, purpose: 'Kinetic defeat cued by the edge nodes' },
    ],
    links: [
      [0, 7], [1, 7], [4, 7],
      [2, 8], [3, 8], [5, 8], [6, 8],
      [7, 9], [8, 9],
      [7, 10], [8, 10],
    ],
  },
]

export interface FormationConstruct {
  name: string
  formation: FormationSpec
  description: string
}

/** Publicly reported swarm and formation employment constructs. */
export const SEED_FORMATIONS: FormationConstruct[] = [
  {
    name: 'Shahed stream raid (single axis)',
    formation: { count: 12, shape: 'column', spacingM: 3000 },
    description: 'One route corridor in trail, minutes apart, to probe and saturate.',
  },
  {
    name: 'Shahed multi-axis raid',
    formation: { count: 12, shape: 'echelon', spacingM: 3000 },
    description: 'Corridors converging on one target from different bearings.',
  },
  {
    name: 'Decoy-mixed OWA package',
    formation: { count: 10, shape: 'column', spacingM: 2000 },
    description: 'Gerbera decoys interleaved in the OWA stream to soak interceptors.',
  },
  {
    name: 'FPV swarm wave (Group 1)',
    formation: { count: 8, shape: 'line', spacingM: 75 },
    description: 'Wave of 5-10 FPV quads attacking a position in short succession.',
  },
  {
    name: 'FPV multi-axis simultaneous attack',
    formation: { count: 5, shape: 'cluster', spacingM: 300 },
    description: 'Simultaneous strikes from different bearings to beat directional jamming.',
  },
  {
    name: 'Recon-cued strike pair (Group 1/2)',
    formation: { count: 3, shape: 'column', spacingM: 1000 },
    description: 'One ISR ship orbits as spotter and relay; trailing strike ships follow.',
  },
]
