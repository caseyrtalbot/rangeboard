/**
 * Nine seeded threat vignettes (MASTER-SEEDDATA).
 * Each instantiates the 22-item mission-thread package. Kinematics, nav modes,
 * raid notes, representation guidance, and fidelity-relevant notes are mapped
 * onto TeThreatProfile fields; fields the source does not provide stay unset.
 */

import type { TeThreatProfile } from '../model/types'

interface ThreatVignette {
  key: string
  name: string
  summary: string
  patch: Partial<TeThreatProfile>
}

export const THREAT_VIGNETTES: ThreatVignette[] = [
  {
    key: 'V-01',
    name: 'Fixed-site defense',
    summary:
      'Whether the configured architecture provides sufficient warning, identification, engagement opportunity, defeat, and assessment to protect a defined fixed asset under the tested threat and background conditions.',
    patch: {
      name: 'V-01 Fixed-site defense',
      missions: [
        'reconnaissance',
        'one-way-attack',
        'combined-recon-attack',
        'decoy-stimulation',
        'saturation',
      ],
      raidNote:
        'Threat presentations: single reconnaissance aircraft; single attack aircraft; reconnaissance followed by attack; decoy followed by attack; mixed low- and higher-altitude approaches; multi-axis raid; repeated waves; reduced-emission or RF-silent segment; threat adaptation after blue emission or engagement.',
      emissionsSummary: 'Includes a reduced-emission or RF-silent segment presentation.',
      adaptationRules: [
        {
          trigger: 'Blue emission or engagement observed',
          allowedResponse: 'Threat adaptation per the approved menu',
        },
      ],
      opforMode: 'scripted',
      prohibitedGeneralization:
        'Do not generalize fixed placement, stable power, centralized infrastructure, or persistent connectivity to maneuver operations.',
      notes:
        'Test factors: sensor placement; active and passive sensing mix; early-warning sensor included or excluded; C2 and network path; friendly-air and background-track density; day, night, weather, and clutter; effector type and assignment sequence; passive-defense state; operator workload; one component degraded or unavailable; magazine, duty-cycle, or recovery state. Priority measures: first-detection and first-stable-track range; warning margin; track continuity; identification accuracy and time; sensor-to-C2 latency; decision and assignment latency; probability of intercept and mission defeat; raid leakage; effect-assessment time; false-action rate; simultaneous-target capacity; mission continuity. Minimum sequence: 1. Positive and negative controls. 2. Single-threat scripted baseline. 3. Geometry and condition characterization. 4. Partial-chain isolation. 5. Integrated single-threat run. 6. Mixed-threat or repeated-wave stress. 7. Degraded-component run. 8. Bounded-adaptive run. 9. Scripted confirmation. 10. End-to-end mission-thread event.',
    },
  },
  {
    key: 'V-02',
    name: 'Maneuver formation',
    summary:
      'Whether the formation retains usable warning and defensive action while moving, halting, displacing, changing geometry, and operating with variable connectivity.',
    patch: {
      name: 'V-02 Maneuver formation',
      missions: ['route-site-recon', 'fpv-attack', 'one-way-attack', 'combined-recon-attack'],
      raidNote:
        'Threat presentations: route reconnaissance; flank or rear approach; pop-up from terrain masking; FPV or one-way attack during movement; attack during halt or transition; repeated contact after displacement; threat cued by blue emissions; mixed reconnaissance and attack.',
      adaptationRules: [
        {
          trigger: 'Blue emissions observed',
          allowedResponse: 'Threat cues on the emission per the approved menu',
        },
      ],
      prohibitedGeneralization:
        'A static emplacement demonstration does not support a maneuver conclusion. Test a mobile platform through transition states, not only while halted.',
      notes:
        'Test factors: movement speed and formation spacing; sensor and effector on-the-move state; setup and teardown time; displacement interval; terrain and masking; network handoff; local versus shared track; loss of one node; communications delay or disconnection; operator task loading; friendly UAS activity; passive-signature state. Priority measures: coverage continuity during movement; time without usable detection; time to restore the chain after displacement; track handoff success; alert dissemination time; local decision latency; engagement opportunity lost to movement; setup and re-emplacement time; mission continuity after component loss; workload and intervention.',
    },
  },
  {
    key: 'V-03',
    name: 'Convoy and logistics node',
    summary:
      'Whether the defensive approach protects a moving convoy, temporary halt, transfer point, or logistics node without unacceptable disruption to the supported mission.',
    patch: {
      name: 'V-03 Convoy and logistics node',
      missions: ['route-site-recon', 'fpv-attack', 'decoy-stimulation', 'saturation'],
      raidNote:
        'Threat presentations: route reconnaissance; single-axis FPV attack; multi-axis attack; attack during halt or congestion; decoy before attack; repeated attacks intended to exhaust attention or effectors; attack after the convoy disperses; threat using terrain, structures, or background traffic.',
      prohibitedGeneralization:
        'One instrumented vehicle does not establish convoy-wide coverage. Represent the geometry and dissemination path of the supported formation.',
      notes:
        'Test factors: convoy length and spacing; sensor placement within the convoy; lead, middle, and trail coverage; speed, halt, and restart; route clutter; friendly emissions; network coverage; local alerting; effector field of fire; civil or friendly-air background; operator workload and competing duties; protected-asset substitution or decoy. Priority measures: coverage gaps by convoy position; detection and warning by approach axis; time for alert to reach affected vehicles; track continuity during turns and terrain masking; correct threat association; time to protective action; mission delay; engagement opportunity; threat leakage to the protected element; recovery and convoy restart time.',
    },
  },
  {
    key: 'V-04',
    name: 'Airfield or port defense',
    summary:
      'Whether the defensive system protects a large, complex site containing friendly aircraft, vehicles, infrastructure, electromagnetic activity, and multiple critical functions.',
    patch: {
      name: 'V-04 Airfield or port defense',
      missions: [
        'reconnaissance',
        'one-way-attack',
        'decoy-stimulation',
        'saturation',
        'post-strike-assessment',
      ],
      raidNote:
        'Threat presentations: low-altitude perimeter approach; approach mixed with friendly-air activity; reconnaissance of critical nodes; decoy or nuisance traffic; one-way attack against a stated function; multi-axis raid; repeated waves; reduced-emission or autonomous segment; post-strike assessment aircraft.',
      emissionsSummary: 'Includes a reduced-emission or autonomous segment presentation.',
      prohibitedGeneralization:
        'A result for one sector or one protected function does not establish whole-site defense.',
      notes:
        'Test factors: large-area coverage; buildings, ships, cranes, aircraft, and ground clutter; friendly transponders and identification data; air-operations tempo; spectrum congestion; multiple defended assets; centralized and local alerting; effector sectors and restricted directions; shift turnover; component loss; passive protection of critical functions. Priority measures: detection coverage by sector and altitude; false and nuisance tracks; friendly-versus-hostile identification; handoff across coverage sectors; time to protect each critical function; simultaneous-target capacity; raid leakage; false engagement; mission interruption; recovery after attack or component loss.',
    },
  },
  {
    key: 'V-05',
    name: 'Urban defense',
    summary:
      'Whether the defensive chain can distinguish, track, and respond to a threat in cluttered terrain with occlusion, multipath, constrained engagement geometry, and dense neutral activity.',
    patch: {
      name: 'V-05 Urban defense',
      missions: ['persistent-observation', 'one-way-attack', 'fpv-attack'],
      raidNote:
        'Threat presentations: low-altitude street or rooftop approach; short exposure after occlusion; hover or loiter near structures; route changes around buildings; threat mixed with neutral UAS; multi-axis approach; reduced-emission aircraft; attack from short range.',
      emissionsSummary: 'Includes a reduced-emission aircraft presentation.',
      prohibitedGeneralization:
        'Urban results are geometry-specific. Record the structures, sight lines, RF environment, background activity, and engagement constraints needed to reproduce the condition.',
      notes:
        'Test factors: building density and height; sensor placement; occlusion and multipath; EO/IR and acoustic background; neutral UAS; civil communications; constrained effector sectors; alternate sensor cueing; local observer reporting; network delay; day, night, and illumination transition. Priority measures: probability of detection by exposure duration; time to reacquire after occlusion; track swaps and false tracks; identification accuracy; warning margin; correct response selection; engagement opportunity; collateral or restricted-sector effects; mission defeat; operator workload.',
    },
  },
  {
    key: 'V-06',
    name: 'Coalition',
    summary:
      'Whether a combined defensive chain can exchange usable warning and track information, interpret it consistently, and complete the tested mission thread across heterogeneous systems and procedures.',
    patch: {
      name: 'V-06 Coalition',
      raidNote:
        'Threat presentations: use the same threat profiles employed in a national baseline when possible so the effect of coalition integration can be isolated.',
      prohibitedGeneralization:
        'Record the exact systems, interfaces, procedures, data made available, and exercised relationships. Do not infer interoperability outside the tested configuration.',
      notes:
        'Test factors: data format and interface; track identifiers; coordinate and time reference; classification markings or releasability constraints represented in the event; voice versus digital exchange; translation and terminology; shared versus separate pictures; sensor-to-partner handoff; partner-to-effector handoff; different procedures; network delay, loss, and fallback; friendly-air identification. Priority measures: message delivery; data completeness; track association; coordinate and time error; handoff success; duplicate or conflicting tracks; time to common understanding; decision latency; correct assignment; mission-thread completion after network degradation.',
    },
  },
  {
    key: 'V-07',
    name: 'Degraded or disconnected C2',
    summary:
      'Which portions of the defensive mission thread remain effective after loss, delay, corruption, or partition of the normal information path.',
    patch: {
      name: 'V-07 Degraded or disconnected C2',
      prohibitedGeneralization:
        'Do not introduce an unrecorded network failure and treat it only as realism. The degradation must be measurable and tied to the affected transitions and conclusions.',
      notes:
        'Degradation states (12): increased latency; packet loss; intermittent link; loss of central picture; loss of one sensor feed; loss of one effector connection; local-only operation; stale track data; conflicting tracks; clock misalignment; manual voice fallback; complete partition followed by restoration. Degradation test factors: time and phase at which degradation begins; duration; nodes affected; information retained locally; fallback procedure; local decision state; operator awareness of degradation; recovery sequence; track and message reconciliation after restoration. Priority measures: time to detect the degradation; data age; track continuity; local warning and action time; handoff loss; expired opportunities; correct local response; mission success during partition; time to restore; duplicate, stale, or conflicting actions after restoration.',
    },
  },
  {
    key: 'V-08',
    name: 'Contested spectrum',
    summary:
      'How the complete mission thread changes when sensing, communications, navigation, or effects operate in a defined congested or contested electromagnetic environment.',
    patch: {
      name: 'V-08 Contested spectrum',
      emissionsSummary:
        'Required condition definition: baseline spectrum state; applied emissions or interference; time and location; band, power, waveform, and duty cycle when available and relevant; systems intended to be affected; systems that must remain unaffected; threat control and navigation dependencies; friendly-system dependencies; monitoring source; stop limits; actual measured environment. Rule: "EW on" is not a reproducible test condition.',
      prohibitedGeneralization:
        'Measure the environment and state what was actually applied.',
      notes:
        'Priority measures: detection and track degradation; communications loss or delay; navigation error; threat behavior change; blue-system behavior change; friendly-system effect; soft-kill effect; recovery time; handoff success; end-to-end mission success.',
    },
  },
  {
    key: 'V-09',
    name: 'Mass, saturation, decoy, and mixed threat',
    summary:
      'Where the defensive architecture loses track quality, decision capacity, engagement capacity, magazine depth, or mission protection as simultaneous demand increases.',
    patch: {
      name: 'V-09 Mass, saturation, decoy, and mixed threat',
      missions: [
        'saturation',
        'decoy-stimulation',
        'combined-recon-attack',
        'one-way-attack',
        'reconnaissance',
      ],
      raidNote:
        'Threat presentations: increasing raid size; increasing arrival rate; multiple approach axes; mixed airframes; decoys mixed with attack aircraft; reconnaissance preceding attack; repeated waves; threats with different emissions or control modes; bounded adaptation after the first defensive effect.',
      opforMode: 'bounded-adaptive',
      adaptationRules: [
        {
          trigger: 'First defensive effect observed',
          allowedResponse: 'Bounded adaptation per the approved menu',
        },
      ],
      prohibitedGeneralization:
        'Do not describe constructive or simulated raid members as live aircraft. State which objects were live, virtual, or constructive and which mission-thread transitions each could stimulate.',
      notes:
        'Test factors: number of simultaneous objects; track density; arrival spacing; classification mix; operator-to-track ratio; sensor and C2 processing load; effector inventory; reload, reset, thermal, or duty-cycle limits; assignment policy exercised; network load; background traffic. Priority measures: probability of detection per threat and per raid; track initiation and continuity under load; track swaps and duplicate tracks; identification accuracy; time to decision; assignment conflicts; simultaneous engagements; raid leakage; defeated threats by type; protected-asset outcome; resource expenditure; operator workload; recovery before the next wave.',
    },
  },
]
