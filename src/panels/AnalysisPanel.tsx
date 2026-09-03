import { useMemo } from 'react'
import type { EmBackground, LaunchPolicy, LightLevel, Precipitation, Roe } from '../model/types'
import { effectiveDoctrine } from '../model/types'
import { formatSpeed } from '../geometry/geo'
import { LAUNCH_POLICIES, launchPolicyLabel } from '../analysis/doctrineFactors'
import { visibilityMFor } from '../analysis/sensorEnv'
import { buildAarSummary } from '../analysis/aar'
import { engagementPicture } from '../analysis/impact'
import { buildRequirementGateReport } from '../analysis/requirements'
import { assessRunValidity } from '../analysis/runValidity'
import { threatPictureAt } from '../analysis/threatAggregation'
import { scenarioDurationS, useStore } from '../state/store'
import { Info } from './analysis/Info'
import { LiveStrip } from './analysis/LiveStrip'
import { AnalysisSection } from './analysis/AnalysisSection'
import { DebriefRecord } from './analysis/DebriefRecord'
import { OperationalPicture } from './analysis/OperationalPicture'
import { OutcomeSummary } from './analysis/OutcomeSummary'
import { RequirementGates } from './analysis/RequirementGates'
import { ThreatPicture } from './analysis/ThreatPicture'
import { environmentHeadline, residualSectionHeadline } from './headlines'

/**
 * Explicit boundary around conditional full-run output. Live and completed
 * evidence remain separate so a future event never reads as observed data.
 */
export function FullRunProjection({ children }: { children: React.ReactNode }) {
  return (
    <AnalysisSection
      title="Full-run projection"
      headline="not live · conditional"
      headerExtra={<AboutProjection />}
    >
      {children}
    </AnalysisSection>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

/** Segmented control: one active option, no typing. */
function Seg<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: Array<{ v: T; label: string }>
  onChange: (v: T) => void
}) {
  return (
    <div className="seg">
      {options.map((option) => (
        <button
          key={option.v}
          className={value === option.v ? 'active' : ''}
          onClick={() => onChange(option.v)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

function ApplyEffectsCheck() {
  const apply = useStore((state) => state.scenario.environment.apply)
  const updateEnvironment = useStore((state) => state.updateEnvironment)
  return (
    <label className="apply-check" title="Apply environment effects to sensors and threats">
      <input
        type="checkbox"
        checked={apply}
        onChange={(event) => updateEnvironment({ apply: event.target.checked })}
      />
      apply
    </label>
  )
}

function EnvironmentBody() {
  const environment = useStore((state) => state.scenario.environment)
  const units = useStore((state) => state.ui.units)
  const updateEnvironment = useStore((state) => state.updateEnvironment)
  const cardinal = CARDINALS[Math.round(environment.windFromDeg / 45) % 8]
  return (
    <>
      <div className="field-row">
        <Field label="Sky">
          <Seg
            value={environment.precipitation ?? 'clear'}
            options={[
              { v: 'clear' as Precipitation, label: 'Clear' },
              { v: 'rain' as Precipitation, label: 'Rain' },
              { v: 'fog' as Precipitation, label: 'Fog' },
            ]}
            onChange={(precipitation) => updateEnvironment({ precipitation })}
          />
        </Field>
        <Field label="Light">
          <Seg
            value={environment.light ?? 'day'}
            options={[
              { v: 'day' as LightLevel, label: 'Day' },
              { v: 'night' as LightLevel, label: 'Night' },
            ]}
            onChange={(light) => updateEnvironment({ light })}
          />
        </Field>
      </div>
      <div className="field-row">
        <Field label="EM clutter">
          <Seg
            value={environment.emBackground ?? 'rural'}
            options={[
              { v: 'rural' as EmBackground, label: 'Rural (quiet)' },
              { v: 'urban' as EmBackground, label: 'Urban (dense)' },
            ]}
            onChange={(emBackground) => updateEnvironment({ emBackground })}
          />
        </Field>
        <Field label={`Visibility (m, blank = ${visibilityMFor({ ...environment, visibilityM: null })} from sky)`}>
          <input
            type="number"
            min={0}
            step={500}
            placeholder={String(visibilityMFor({ ...environment, visibilityM: null }))}
            value={environment.visibilityM ?? ''}
            onChange={(event) =>
              updateEnvironment({
                visibilityM:
                  event.target.value === '' ? null : Math.max(0, Number(event.target.value)),
              })
            }
          />
        </Field>
      </div>
      <div className="field-row">
        <Field label={`Wind ${formatSpeed(environment.windSpeedMps, units)}`}>
          <input
            type="range"
            min={0}
            max={25}
            value={environment.windSpeedMps}
            onChange={(event) => updateEnvironment({ windSpeedMps: Number(event.target.value) })}
          />
        </Field>
        <Field label={`From ${environment.windFromDeg} deg (${cardinal})`}>
          <input
            type="range"
            min={0}
            max={355}
            step={5}
            value={environment.windFromDeg}
            onChange={(event) => updateEnvironment({ windFromDeg: Number(event.target.value) })}
          />
        </Field>
      </div>
      <div className="field-row">
        <Field label={`Temperature ${environment.temperatureC} C`}>
          <input
            type="range"
            min={-30}
            max={50}
            value={environment.temperatureC}
            onChange={(event) => updateEnvironment({ temperatureC: Number(event.target.value) })}
          />
        </Field>
        <Field label="Field elevation (ft)">
          <input
            type="number"
            step={500}
            value={environment.fieldElevationFt}
            onChange={(event) =>
              updateEnvironment({ fieldElevationFt: Number(event.target.value) })
            }
          />
        </Field>
      </div>
    </>
  )
}

function EnvironmentInfo() {
  return (
    <Info label="About environment effects">
      <p>Rain, fog, night, and EM clutter modify sensor performance by technology.</p>
      <p>Cold, altitude, and wind modify UAS reach.</p>
      <p>Factors follow the COURAGEOUS C-UAS study.</p>
    </Info>
  )
}

/** Doctrine section body: the scenario-level planning factors that bind. */
function DoctrineBody() {
  const scenario = useStore((state) => state.scenario)
  const patchScenario = useStore((state) => state.patchScenario)
  const doctrine = effectiveDoctrine(scenario)
  const patch = (next: Partial<typeof doctrine>) =>
    patchScenario({ doctrine: { ...doctrine, ...next } })
  const policy = LAUNCH_POLICIES.find((p) => p.v === doctrine.launchPolicy)
  const fractionPct = Math.round(doctrine.launchRangeFraction * 100)
  return (
    <>
      <Field label="Launch point">
        <Seg
          value={doctrine.launchPolicy}
          options={LAUNCH_POLICIES.map((p) => ({ v: p.v as LaunchPolicy, label: p.label }))}
          onChange={(launchPolicy) => patch({ launchPolicy })}
        />
      </Field>
      {policy ? <p className="muted analysis-empty">{policy.hint}</p> : null}
      <div className="field-row">
        <Field label={`Release inside ${fractionPct}% of max range`}>
          <input
            type="range"
            min={10}
            max={100}
            step={5}
            disabled={doctrine.launchPolicy !== 'range-fraction'}
            value={fractionPct}
            onChange={(event) => patch({ launchRangeFraction: Number(event.target.value) / 100 })}
          />
        </Field>
        <Field label="Re-engagement depth (cycles before arrival)">
          <input
            type="number"
            min={0}
            max={5}
            step={1}
            value={doctrine.opportunities}
            onChange={(event) =>
              patch({ opportunities: Math.max(0, Math.round(Number(event.target.value))) })
            }
          />
        </Field>
      </div>
      <div className="field-row">
        <Field label="Hostile declaration dwell (s)">
          <input
            type="number"
            min={0}
            step={1}
            value={doctrine.declareHostileS}
            onChange={(event) =>
              patch({ declareHostileS: Math.max(0, Number(event.target.value)) })
            }
          />
        </Field>
      </div>
      <p className="muted analysis-empty">
        Track initiation, target dwell, BDA dwell and commit Pk are per system: the sensor role
        and effector type tables in doctrineFactors, or the model's own override.
      </p>
    </>
  )
}

function DoctrineInfo() {
  return (
    <Info label="About the fire-control sequence">
      <p>
        Detect, track, identify, target, engage, assess. A shot needs a stable radar or EO/IR
        track from a sensor routed to the shooter, hostile identification, the declaration
        dwell, the kill-chain hop latency, and the shooter's own target dwell. Only then is
        the effector release-ready.
      </p>
      <p>
        The launch point decides where in the envelope the authorized shot is released. Every
        policy fires no later than the deadline that keeps the set re-engagement depth before
        arrival, and every shot carries its predicted Pk at the effect point.
      </p>
      <p>
        Doctrine off is the legacy instant-release engine: the ROE gate alone opens the window
        and every ready effector volleys. Keep it for regression comparison.
      </p>
      <p>All timing values are planning factors, not measured system performance.</p>
    </Info>
  )
}

function doctrineHeadline(scenario: { doctrine?: ReturnType<typeof effectiveDoctrine> }): string {
  const d = effectiveDoctrine(scenario)
  if (!d.enabled) return 'off · instant release'
  const policy =
    d.launchPolicy === 'range-fraction'
      ? `${launchPolicyLabel(d.launchPolicy)} ${Math.round(d.launchRangeFraction * 100)}%`
      : launchPolicyLabel(d.launchPolicy)
  return `${policy} · declare ${d.declareHostileS} s · depth ${d.opportunities}`
}

function AboutProjection() {
  return (
    <Info label="About the projection">
      <p>
        This section computes the entire configured run. Live systems and threat data above use
        only the current playback horizon.
      </p>
      <p>
        Hold analyzes without engagement. With doctrine on, tight and free both require a stable
        track, hostile declaration and a release-ready shooter. With doctrine off, tight requires
        hostile classification and free engages on first detection.
      </p>
      <p>
        Track is evaluated at the first shot, target-window opening, or asset arrival. Effect
        requires no more than 5% expected residual on every track.
      </p>
      <p>Detection and track state are sampled at 0.5-second intervals.</p>
    </Info>
  )
}

/**
 * Real-time kill-chain data before completion; sealed run evidence after
 * completion. Full-run projection stays available as a distinct forecast.
 */
export function AnalysisPanel() {
  const scenario = useStore((state) => state.scenario)
  const runId = useStore((state) => state.playback.runId)
  const completedAtMs = useStore((state) => state.playback.completedAtMs)
  const observedThroughS = useStore((state) => state.playback.observedThroughS)
  const patchScenario = useStore((state) => state.patchScenario)
  const threatWez = useStore((state) => state.ui.layers.threatWez)
  const setLayer = useStore((state) => state.setLayer)
  const displayUnits = useStore((state) => state.ui.units)
  const durationS = useMemo(() => scenarioDurationS(scenario), [scenario])
  const { assessments, report, impacts } = useMemo(() => {
    void runId
    return engagementPicture(scenario)
  }, [scenario, runId])
  const aar = useMemo(
    () => buildAarSummary(scenario, assessments, report, impacts),
    [scenario, assessments, report, impacts],
  )
  // One validity sweep feeds the gates here and, through DebriefRecord, the
  // evidence record: the spawn-in-ring scan runs once per run, not once per
  // consumer.
  const validity = useMemo(
    () => assessRunValidity(scenario, assessments),
    [scenario, assessments],
  )
  const requirements = useMemo(
    () => buildRequirementGateReport(scenario, assessments, report, validity),
    [scenario, assessments, report, validity],
  )
  const projectionGroups = useMemo(
    () => threatPictureAt(scenario, assessments, report, Number.POSITIVE_INFINITY, new Map()),
    [scenario, assessments, report],
  )
  const threats = assessments.filter((assessment) => assessment.status !== 'no-path')
  const noPath = assessments.length - threats.length
  const complete = completedAtMs != null && durationS > 0 && observedThroughS >= durationS

  return (
    <div className="inspector-body">
      <div className="analysis-header">
        <span className="roe-label">ROE</span>
        <Seg
          value={scenario.roe ?? 'tight'}
          options={[
            { v: 'hold' as Roe, label: 'Hold' },
            { v: 'tight' as Roe, label: 'Tight' },
            { v: 'free' as Roe, label: 'Free' },
          ]}
          onChange={(roe) => patchScenario({ roe })}
        />
        <label
          className="adv-toggle"
          title="Doctrinal fire control (default): stable track, hostile declaration, target dwell, launch-point policy, shoot-look-shoot with BDA. Off = legacy instant release."
        >
          <input
            type="checkbox"
            checked={scenario.doctrine?.enabled ?? false}
            onChange={(event) =>
              patchScenario({
                doctrine: { ...effectiveDoctrine(scenario), enabled: event.target.checked },
              })
            }
          />
          Doctrine
        </label>
        <label className="adv-toggle" title="Draw threat weapon engagement zones on the canvas">
          <input
            type="checkbox"
            checked={threatWez}
            onChange={(event) => setLayer('threatWez', event.target.checked)}
          />
          WEZ
        </label>
      </div>

      <LiveStrip />

      {assessments.length === 0 && (
        <p className="muted analysis-empty">Place a UAS threat on the canvas to analyze it.</p>
      )}
      {noPath > 0 && (
        <p className="muted analysis-empty">
          {noPath} UAS without a flight path. Draw a path to include it in run data.
        </p>
      )}

      {threats.length > 0 && !complete && (
        <OperationalPicture assessments={assessments} report={report} />
      )}

      {complete && (
        <DebriefRecord
          scenario={scenario}
          assessments={assessments}
          report={report}
          aar={aar}
          durationS={durationS}
        />
      )}

      <AnalysisSection
        title="Environment"
        headline={environmentHeadline(scenario.environment, displayUnits)}
        headerExtra={
          <>
            <ApplyEffectsCheck />
            <EnvironmentInfo />
          </>
        }
      >
        <EnvironmentBody />
      </AnalysisSection>

      <AnalysisSection
        title="Fire doctrine"
        headline={doctrineHeadline(scenario)}
        headerExtra={<DoctrineInfo />}
      >
        <DoctrineBody />
      </AnalysisSection>

      {threats.length > 0 && !complete && (
        <FullRunProjection>
          <OutcomeSummary scenario={scenario} assessments={assessments} report={report} />
          <AnalysisSection
            title="Requirement gates"
            headline={`${requirements.met}/${requirements.required} met`}
            defaultOpen
          >
            <RequirementGates report={requirements} />
          </AnalysisSection>
          <AnalysisSection
            title="Projected threat outcome"
            headline={residualSectionHeadline(report.totals)}
            defaultOpen
          >
            <ThreatPicture groups={projectionGroups} mode="projected" />
          </AnalysisSection>
        </FullRunProjection>
      )}
    </div>
  )
}
