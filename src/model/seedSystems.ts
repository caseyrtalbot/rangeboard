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
    name: 'FS-LIDS fixed site',
    description:
      'US Army fixed-site layered defence: one KuMRFS-T 360 deg multi-mission radar for surveillance and fire control, an EO/IR camera for visual identification, SRC CUAEWS direction finding and non-kinetic defeat, and 4-pack palletized Coyote launchers, all under FAAD C2. Component list follows CRS R48477 and the SRC LIDS Family of Systems brochure; neither names an RPS-42 or a Modi jammer in FS-LIDS. Laydown geometry is representative.',
    builtin: true,
    components: [
      { specId: 'lib-kurfs', offsetM: { x: 0, y: -30 }, headingDeg: 0, purpose: 'KuMRFS-T: 360 deg surveillance and precision fire-control track; uplinks Coyote' },
      { specId: 'lib-lstar', offsetM: { x: -120, y: -60 }, headingDeg: 0, purpose: 'Optional AN/TPQ-50 long-range search layer that cues the fire-control radar' },
      { specId: 'lib-cuaews-df', offsetM: { x: 60, y: -20 }, headingDeg: 0, purpose: 'CUAEWS DF: passive RF lines of bearing to the UAS and its operator' },
      { specId: 'lib-hdcmr', offsetM: { x: -50, y: -20 }, headingDeg: 0, purpose: 'EO/IR camera: visual identification on C2 cue (library stand-in; the brochure names an SRC camera)' },
      { specId: 'lib-cuaews', offsetM: { x: -60, y: 30 }, headingDeg: 0, purpose: 'CUAEWS: non-kinetic defeat, control-link and navigation denial' },
      { specId: 'lib-coyote', offsetM: { x: 80, y: 50 }, headingDeg: 0, purpose: 'Palletized 4-pack Coyote launcher 1' },
      { specId: 'lib-coyote', offsetM: { x: 130, y: 50 }, headingDeg: 0, purpose: 'Palletized 4-pack Coyote launcher 2' },
      { specId: 'lib-faadc2', offsetM: { x: 0, y: 90 }, headingDeg: 0, purpose: 'Track fusion and engagement management' },
    ],
    links: [
      [0, 7], [1, 7], [2, 7],
      [7, 4], [7, 5], [7, 6],
      [0, 5], [0, 6],
    ],
  },
  {
    id: 'sys-merops',
    name: 'MEROPS counter-OWA site',
    description:
      'REPRESENTATIVE LAYDOWN - NOT A VERIFIED FIELD CONFIGURATION. Counter-one-way-attack site built around Merops. A documented Merops unit is a command station, launch platforms and a fleet of interceptors; the forward acoustic picket and the radar shown here are a representative cueing layer, not published Merops components.',
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
    name: 'Acoustic picket IADS (representative)',
    description:
      'REPRESENTATIVE LAYDOWN - NOT A VERIFIED FIELD CONFIGURATION. Acoustic-led layered defense: a wide forward picket of cheap omni microphone nodes gives minutes of warning, and a fusion node cues a short-range tracking radar and mobile fire groups. The 3000 m node spacing assumes an engine-noise target in the one-way-attack class; reported acoustic ranges against small electric quadcopters are on the order of 100 to 200 m, so this geometry gives no Group 1 coverage.',
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
      [5, 7], [5, 8],
    ],
  },
  {
    id: 'sys-mesh',
    name: 'Distributed sensor mesh (representative)',
    description:
      'REPRESENTATIVE LAYDOWN - NOT A VERIFIED FIELD CONFIGURATION. Expeditionary mesh of mixed small sensors feeding edge C2 nodes, drawn to show graceful degradation when a node drops out. Picogrid edge nodes under an Anduril Lattice gateway is not a documented integration. The acoustic and tower nodes are placed without a link because no published data path to the edge C2 exists.',
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
      [0, 7], [1, 7],
      [2, 8], [3, 8],
      [7, 9], [8, 9],
      [9, 10],
    ],
  },
  {
    id: 'sys-mlids-section',
    name: 'M-LIDS Increment 2 section (two-vehicle M-ATV)',
    description:
      'US Army mobile LIDS section: a kinetic vehicle carrying the masted KuMRFS-M radar, the RIwP turret with 30 mm and Coyote, and an EW vehicle carrying CUAEWS direction finding and jamming, both on FAAD C2. Component list follows the SRC LIDS Family of Systems brochure. Offsets inside a vehicle are drawing separation, not real geometry.',
    builtin: true,
    components: [
      { specId: 'lib-kumrfs-m', offsetM: { x: 0, y: 0 }, headingDeg: 0, purpose: 'Masted KuMRFS-M: 360 deg surveillance and fire control at the short halt' },
      { specId: 'lib-drs-s3', offsetM: { x: 0, y: 20 }, headingDeg: 0, purpose: 'RIwP stabilised sight: identification and auto-track through the engagement' },
      { specId: 'lib-xm914', offsetM: { x: 20, y: 30 }, headingDeg: 0, purpose: 'RIwP XM914E1 30 mm: close-in kinetic defeat, final protective fire' },
      { specId: 'lib-coyote', offsetM: { x: -20, y: 30 }, headingDeg: 0, purpose: 'RIwP Coyote launcher: longer-range kinetic defeat' },
      { specId: 'lib-faadc2', offsetM: { x: -40, y: 50 }, headingDeg: 0, purpose: 'FAAD C2, kinetic vehicle: engagement operations and fratricide prevention' },
      { specId: 'lib-cuaews-df', offsetM: { x: -150, y: 0 }, headingDeg: 0, purpose: 'EW vehicle: passive RF lines of bearing to the UAS and its operator' },
      { specId: 'lib-cuaews', offsetM: { x: -150, y: 30 }, headingDeg: 0, purpose: 'EW vehicle: non-kinetic defeat, control-link and navigation denial' },
      { specId: 'lib-faadc2', offsetM: { x: -190, y: 50 }, headingDeg: 0, purpose: 'FAAD C2, EW vehicle: same air picture over the section network' },
    ],
    links: [
      [0, 4], [5, 4], [4, 2], [4, 3], [4, 6], [4, 7],
    ],
  },
  {
    id: 'sys-mlids-stryker',
    name: 'M-LIDS Increment 2.1 (single Stryker)',
    description:
      'US Army single-vehicle LIDS: CRS records Increment 2.1 consolidating sensors and weapons on one Stryker with the Raytheon XBAEU radar rather than KuRFS. No public range figure exists for XBAEU, so its ring is a planning figure. Offsets are drawing separation, not real geometry.',
    builtin: true,
    components: [
      { specId: 'lib-xbaeu', offsetM: { x: 0, y: 0 }, headingDeg: 0, purpose: 'Masted XBAEU Ku-band AESA: 360 deg surveillance and fire control' },
      { specId: 'lib-drs-s3', offsetM: { x: 0, y: 20 }, headingDeg: 0, purpose: 'RIwP stabilised sight: identification and auto-track' },
      { specId: 'lib-xm914', offsetM: { x: 20, y: 30 }, headingDeg: 0, purpose: 'RIwP XM914E1 30 mm: close-in kinetic defeat' },
      { specId: 'lib-coyote', offsetM: { x: -20, y: 30 }, headingDeg: 0, purpose: 'RIwP Coyote launcher: longer-range kinetic defeat' },
      { specId: 'lib-faadc2', offsetM: { x: -40, y: 50 }, headingDeg: 0, purpose: 'FAAD C2 on the vehicle: engagement operations and fratricide prevention' },
    ],
    links: [
      [0, 4], [4, 2], [4, 3],
    ],
  },
  {
    id: 'sys-madis',
    name: 'MADIS Increment 1 section (Mk1 + Mk2)',
    description:
      'REPRESENTATIVE LAYDOWN - NOT A VERIFIED FIELD CONFIGURATION. USMC ground-based air defense section: a Mk2 sensor and non-kinetic vehicle paired with a Mk1 kinetic vehicle. CRS states only that the Mk2 carries radar plus kinetic and non-kinetic counter-UAS capability; the specific radar, jammer and C2 shown here are the nearest library equivalents, not sourced attributions.',
    builtin: true,
    components: [
      { specId: 'lib-rps42', offsetM: { x: 0, y: -20 }, headingDeg: 0, purpose: 'Mk2 radar face, north sector (representative)' },
      { specId: 'lib-rps42', offsetM: { x: 20, y: 0 }, headingDeg: 90, purpose: 'Mk2 radar face, east sector (representative)' },
      { specId: 'lib-rps42', offsetM: { x: 0, y: 20 }, headingDeg: 180, purpose: 'Mk2 radar face, south sector (representative)' },
      { specId: 'lib-rps42', offsetM: { x: -20, y: 0 }, headingDeg: 270, purpose: 'Mk2 radar face, west sector (representative)' },
      { specId: 'lib-hdcmr', offsetM: { x: 0, y: 40 }, headingDeg: 0, purpose: 'Mk2 EO/IR: visual identification on radar cue' },
      { specId: 'lib-modi', offsetM: { x: -50, y: 0 }, headingDeg: 0, purpose: 'Mk2 non-kinetic defeat (representative)' },
      { specId: 'lib-cac2s', offsetM: { x: 0, y: 70 }, headingDeg: 0, purpose: 'Marine aviation C2 node: air picture for the section' },
      { specId: 'lib-xm914', offsetM: { x: 120, y: 0 }, headingDeg: 0, purpose: 'Mk1 XM914E1 30 mm on the remote weapon station' },
      { specId: 'lib-stinger', offsetM: { x: 120, y: 30 }, headingDeg: 0, purpose: 'Mk1 Stinger: missile layer of the kinetic vehicle' },
    ],
    links: [
      [0, 5], [1, 5], [2, 5], [3, 5],
      [0, 7], [1, 7], [2, 7], [3, 7],
      [0, 8], [1, 8], [2, 8], [3, 8],
    ],
  },
  {
    id: 'sys-lmadis',
    name: 'L-MADIS section (two ULTV, non-kinetic)',
    description:
      'USMC light MADIS: a sensor ULTV carrying four RPS-42 faces and an EO/IR camera, paired with a second ULTV carrying the Modi jammer. Components follow CRS. The RPS-42 detects and cues the operator, who engages with Modi on the section; no networked C2 node is placed because no source names one on an L-MADIS vehicle.',
    builtin: true,
    components: [
      { specId: 'lib-rps42', offsetM: { x: 0, y: -20 }, headingDeg: 0, purpose: 'RPS-42 face, north sector' },
      { specId: 'lib-rps42', offsetM: { x: 20, y: 0 }, headingDeg: 90, purpose: 'RPS-42 face, east sector' },
      { specId: 'lib-rps42', offsetM: { x: 0, y: 20 }, headingDeg: 180, purpose: 'RPS-42 face, south sector' },
      { specId: 'lib-rps42', offsetM: { x: -20, y: 0 }, headingDeg: 270, purpose: 'RPS-42 face, west sector' },
      { specId: 'lib-cm262', offsetM: { x: 0, y: 40 }, headingDeg: 0, purpose: 'CM262 EO/IR: visual identification on radar cue' },
      { specId: 'lib-modi', offsetM: { x: -60, y: 0 }, headingDeg: 0, purpose: 'Modi on the second ULTV: control-link denial, dismountable' },
    ],
    links: [
      [0, 5], [1, 5], [2, 5], [3, 5],
    ],
  },
  {
    id: 'sys-sgtstout',
    name: 'SGT STOUT (M-SHORAD Increment 1) section',
    description:
      'US Army Stryker SHORAD section: two vehicles, each with four MHR radar faces and a RIwP turret carrying 30 mm and Stinger, under platoon FAAD C2. Vehicle spacing is a representative tactical interval.',
    builtin: true,
    components: [
      { specId: 'lib-rps42', offsetM: { x: -20, y: -20 }, headingDeg: 0, purpose: 'Vehicle A MHR face, north sector' },
      { specId: 'lib-rps42', offsetM: { x: 20, y: -20 }, headingDeg: 90, purpose: 'Vehicle A MHR face, east sector' },
      { specId: 'lib-rps42', offsetM: { x: 20, y: 20 }, headingDeg: 180, purpose: 'Vehicle A MHR face, south sector' },
      { specId: 'lib-rps42', offsetM: { x: -20, y: 20 }, headingDeg: 270, purpose: 'Vehicle A MHR face, west sector' },
      { specId: 'lib-xm914', offsetM: { x: 0, y: 0 }, headingDeg: 0, purpose: 'Vehicle A RIwP XM914 30 mm' },
      { specId: 'lib-stinger', offsetM: { x: 0, y: 40 }, headingDeg: 0, purpose: 'Vehicle A RIwP Stinger pod' },
      { specId: 'lib-rps42', offsetM: { x: 380, y: -20 }, headingDeg: 0, purpose: 'Vehicle B MHR face, north sector' },
      { specId: 'lib-rps42', offsetM: { x: 420, y: -20 }, headingDeg: 90, purpose: 'Vehicle B MHR face, east sector' },
      { specId: 'lib-rps42', offsetM: { x: 420, y: 20 }, headingDeg: 180, purpose: 'Vehicle B MHR face, south sector' },
      { specId: 'lib-rps42', offsetM: { x: 380, y: 20 }, headingDeg: 270, purpose: 'Vehicle B MHR face, west sector' },
      { specId: 'lib-xm914', offsetM: { x: 400, y: 0 }, headingDeg: 0, purpose: 'Vehicle B RIwP XM914 30 mm' },
      { specId: 'lib-stinger', offsetM: { x: 400, y: 40 }, headingDeg: 0, purpose: 'Vehicle B RIwP Stinger pod' },
      { specId: 'lib-faadc2', offsetM: { x: 200, y: 250 }, headingDeg: 0, purpose: 'Platoon FAAD C2: air picture, aircraft avoidance, fratricide prevention' },
    ],
    links: [
      [0, 12], [1, 12], [2, 12], [3, 12], [6, 12], [7, 12], [8, 12], [9, 12],
      [12, 4], [12, 10], [12, 5], [12, 11],
    ],
  },
  {
    id: 'sys-demshorad',
    name: 'DE M-SHORAD platoon (50 kW laser prototype)',
    description:
      'REPRESENTATIVE LAYDOWN - NOT A VERIFIED FIELD CONFIGURATION. Four 50 kW laser prototypes shown cued by an accompanying SGT STOUT vehicle over FAAD C2. The DE vehicle own sensor fit is not public and this cueing chain is a planning arrangement. GAO found the prototype not mature enough to transition; it remains a prototype.',
    builtin: true,
    components: [
      { specId: 'lib-rps42', offsetM: { x: -20, y: -20 }, headingDeg: 0, purpose: 'Cueing vehicle MHR face, north sector' },
      { specId: 'lib-rps42', offsetM: { x: 20, y: -20 }, headingDeg: 90, purpose: 'Cueing vehicle MHR face, east sector' },
      { specId: 'lib-rps42', offsetM: { x: 20, y: 20 }, headingDeg: 180, purpose: 'Cueing vehicle MHR face, south sector' },
      { specId: 'lib-rps42', offsetM: { x: -20, y: 20 }, headingDeg: 270, purpose: 'Cueing vehicle MHR face, west sector' },
      { specId: 'lib-xm914', offsetM: { x: 0, y: 0 }, headingDeg: 0, purpose: 'Cueing SGT STOUT vehicle: gun half of the mixed battery' },
      { specId: 'lib-demshorad', offsetM: { x: -450, y: -150 }, headingDeg: 0, purpose: 'DE M-SHORAD prototype 1' },
      { specId: 'lib-demshorad', offsetM: { x: -150, y: -250 }, headingDeg: 0, purpose: 'DE M-SHORAD prototype 2' },
      { specId: 'lib-demshorad', offsetM: { x: 150, y: -250 }, headingDeg: 0, purpose: 'DE M-SHORAD prototype 3' },
      { specId: 'lib-demshorad', offsetM: { x: 450, y: -150 }, headingDeg: 0, purpose: 'DE M-SHORAD prototype 4' },
      { specId: 'lib-faadc2', offsetM: { x: 0, y: 250 }, headingDeg: 0, purpose: 'Platoon FAAD C2: air picture, cueing, fratricide prevention' },
    ],
    links: [
      [0, 9], [1, 9], [2, 9], [3, 9],
      [9, 4], [9, 5], [9, 6], [9, 7], [9, 8],
    ],
  },
  {
    id: 'sys-doctrine-point-defense',
    name: 'Point defense, balanced fires (doctrinal)',
    description:
      'REPRESENTATIVE LAYDOWN - NOT A VERIFIED FIELD CONFIGURATION. Doctrinal point defense of a single asset: a search radar hands to a fire-control radar, passive RF and EO/IR confirm, and FAAD C2 offers a soft-kill and two kinetic layers. Ranges and spacings are planning figures, not doctrinal distances: no public C-UAS doctrine publishes a laydown geometry.',
    builtin: true,
    components: [
      { specId: 'lib-asset', offsetM: { x: 0, y: 0 }, headingDeg: 0, purpose: 'Defended asset' },
      { specId: 'lib-lstar', offsetM: { x: 0, y: -600 }, headingDeg: 0, purpose: 'Search layer: early warning on the threat axis' },
      { specId: 'lib-kurfs', offsetM: { x: 200, y: -250 }, headingDeg: 0, purpose: 'Fire-control track; uplinks the interceptor' },
      { specId: 'lib-corian', offsetM: { x: -350, y: -200 }, headingDeg: 0, purpose: 'Passive RF: non-emitting detection and operator location' },
      { specId: 'lib-mxgcs', offsetM: { x: -200, y: 150 }, headingDeg: 0, purpose: 'EO/IR: visual identification before the engagement decision' },
      { specId: 'lib-faadc2', offsetM: { x: 0, y: 300 }, headingDeg: 0, purpose: 'Track fusion, identification and engagement management' },
      { specId: 'lib-cuaews', offsetM: { x: -450, y: 100 }, headingDeg: 0, purpose: 'Soft-kill layer: attempted first where the rules of engagement allow' },
      { specId: 'lib-coyote', offsetM: { x: 400, y: -100 }, headingDeg: 0, purpose: 'Outer kinetic layer' },
      { specId: 'lib-xm914', offsetM: { x: 150, y: 200 }, headingDeg: 0, purpose: 'Inner kinetic layer: final protective fire' },
    ],
    links: [
      [1, 5], [2, 5], [3, 5], [4, 5],
      [5, 6], [5, 7], [5, 8],
      [2, 7],
    ],
  },
  {
    id: 'sys-doctrine-base-defense',
    name: 'Layered base defense, weighted coverage (doctrinal)',
    description:
      'REPRESENTATIVE LAYDOWN - NOT A VERIFIED FIELD CONFIGURATION. Doctrinal layered defense of a base: coverage is weighted toward the threat axis rather than spread evenly, longer-range search hands to local acquisition, and the defense keeps a non-kinetic and a kinetic option on every track. Geometry is a planning figure.',
    builtin: true,
    components: [
      { specId: 'lib-asset', offsetM: { x: 0, y: 0 }, headingDeg: 0, purpose: 'Defended base' },
      { specId: 'lib-sentinela4', offsetM: { x: 0, y: -1500 }, headingDeg: 0, purpose: 'Long-range air surveillance on the threat axis' },
      { specId: 'lib-rps42', offsetM: { x: -700, y: -900 }, headingDeg: 315, purpose: 'Local acquisition face, weighted north-west' },
      { specId: 'lib-rps42', offsetM: { x: 700, y: -900 }, headingDeg: 45, purpose: 'Local acquisition face, weighted north-east' },
      { specId: 'lib-titan', offsetM: { x: 0, y: -700 }, headingDeg: 0, purpose: 'Passive RF: detection without emitting' },
      { specId: 'lib-wisp', offsetM: { x: -300, y: 400 }, headingDeg: 0, purpose: 'Wide-area IR: rear-sector fill and visual confirmation' },
      { specId: 'lib-faadc2', offsetM: { x: 0, y: 600 }, headingDeg: 0, purpose: 'Base defense air picture and engagement management' },
      { specId: 'lib-cuaews', offsetM: { x: -500, y: -300 }, headingDeg: 0, purpose: 'Non-kinetic defeat layer' },
      { specId: 'lib-leonidas', offsetM: { x: 500, y: -300 }, headingDeg: 0, purpose: 'High-power microwave: counter-swarm layer' },
      { specId: 'lib-coyote', offsetM: { x: -250, y: -500 }, headingDeg: 0, purpose: 'Kinetic layer, west' },
      { specId: 'lib-lpws', offsetM: { x: 250, y: 250 }, headingDeg: 0, purpose: 'Inner gun layer: final protective fire over the base' },
    ],
    links: [
      [1, 6], [2, 6], [3, 6], [4, 6], [5, 6],
      [6, 7], [6, 8], [6, 9], [6, 10],
    ],
  },
  {
    id: 'sys-doctrine-maneuver-protection',
    name: 'Maneuver protection on the move (doctrinal)',
    description:
      'REPRESENTATIVE LAYDOWN - NOT A VERIFIED FIELD CONFIGURATION. Doctrinal protection of a moving element: sensors and effectors travel with the formation, the air picture is thinner than at a fixed site, and the defense trades coverage for mobility. Spacings are a representative march interval, not a doctrinal distance.',
    builtin: true,
    components: [
      { specId: 'lib-asset', offsetM: { x: 0, y: 0 }, headingDeg: 0, purpose: 'Protected element' },
      { specId: 'lib-echoshield', offsetM: { x: -150, y: -300 }, headingDeg: 0, purpose: 'Mobile acquisition radar, forward of the element' },
      { specId: 'lib-cuaews-df', offsetM: { x: 150, y: -250 }, headingDeg: 0, purpose: 'Mobile passive RF: bearings to the UAS and its operator' },
      { specId: 'lib-faadc2', offsetM: { x: 0, y: 200 }, headingDeg: 0, purpose: 'Mobile C2: air picture and fratricide prevention on the move' },
      { specId: 'lib-xm914', offsetM: { x: -200, y: -100 }, headingDeg: 0, purpose: 'Gun truck, west flank' },
      { specId: 'lib-stinger', offsetM: { x: 200, y: -100 }, headingDeg: 0, purpose: 'Missile layer travelling with the column' },
      { specId: 'lib-ninja', offsetM: { x: 0, y: 350 }, headingDeg: 0, purpose: 'Non-kinetic defeat travelling with the column' },
    ],
    links: [
      [1, 3], [2, 3],
      [3, 4], [3, 5], [3, 6],
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
