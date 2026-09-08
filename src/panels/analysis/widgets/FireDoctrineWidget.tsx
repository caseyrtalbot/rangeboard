import type { LaunchPolicy, Roe } from '../../../model/types'
import { effectiveDoctrine } from '../../../model/types'
import { LAUNCH_POLICIES, launchPolicyLabel } from '../../../analysis/doctrineFactors'
import { MODEL_TAGS } from '../../../analysis/fidelity'
import { useStore } from '../../../state/store'
import { Rows } from '../detail/detailRows'
import { Info } from '../Info'
import { Field, Seg } from '../../../ui/kit'
import { RoleSeg } from './controls'
import type { WidgetProps } from './registry'
import { WidgetFrame } from './WidgetFrame'

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
        With doctrine off, the ROE gate opens the engagement window and every ready effector
        volleys. Effector preparation and travel times still apply.
      </p>
      <p>All timing values are planning factors, not measured system performance.</p>
    </Info>
  )
}

function doctrineHeadline(scenario: { doctrine?: ReturnType<typeof effectiveDoctrine> }): string {
  const d = effectiveDoctrine(scenario)
  if (!d.enabled) return 'off · ROE gating'
  const policy =
    d.launchPolicy === 'range-fraction'
      ? `${launchPolicyLabel(d.launchPolicy)} ${Math.round(d.launchRangeFraction * 100)}%`
      : launchPolicyLabel(d.launchPolicy)
  return `${policy} · declare ${d.declareHostileS} s · depth ${d.opportunities}`
}

/** The ROE control and the doctrine toggle in the header; the doctrine factors in the body. */
function DoctrineControls() {
  const scenario = useStore((state) => state.scenario)
  const patchScenario = useStore((state) => state.patchScenario)
  return (
    <>
      <span className="roe-label">ROE</span>
      <RoleSeg
        value={scenario.roe ?? 'tight'}
        options={[
          { v: 'hold' as Roe, label: 'Hold' },
          { v: 'tight' as Roe, label: 'Tight' },
          { v: 'free' as Roe, label: 'Free' },
        ]}
        onChange={(roe) => patchScenario({ roe })}
        dataRole="roe"
      />
      <label
        className="adv-toggle"
        title="Doctrinal fire control (default): stable track, hostile declaration, target dwell, launch-point policy, shoot-look-shoot with BDA. Off = ROE gating; preparation and travel times still apply."
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
      <DoctrineInfo />
    </>
  )
}

/** ROE, doctrine header controls, and doctrine fields for scenario preparation. */
export function FireDoctrineSettings() {
  return (
    <>
      <div className="prepare-setting-controls">
        <DoctrineControls />
      </div>
      <DoctrineBody />
    </>
  )
}

function defaulted(value: string, isDefault: boolean): string {
  return `${value}${isDefault ? ' · default' : ''}`
}

function unitDefault(unit: string, isDefault: boolean): string {
  return ` ${unit}${isDefault ? ' · default' : ''}`
}

function FireDoctrineReadout({ onEdit }: { onEdit: () => void }) {
  const scenario = useStore((state) => state.scenario)
  const doctrine = effectiveDoctrine(scenario)
  const stored = scenario.doctrine
  const model = MODEL_TAGS.doctrine
  return (
    <div className="analysis-settings-readout" data-settings-scope="doctrine">
      <div className="analysis-settings-context">
        <span>Scenario inputs · edit in Prepare</span>
        <span
          className="fid-tag"
          data-tier={model.tier}
          data-validation={model.validation}
          title={model.note}
        >
          {model.label} · {model.tier} · {model.validation}
        </span>
      </div>
      <Rows
        rows={[
          {
            label: 'ROE',
            value: defaulted(
              (scenario.roe ?? 'tight').replace(/^./, (letter) => letter.toUpperCase()),
              scenario.roe == null,
            ),
          },
          {
            label: 'Doctrine',
            value: defaulted(doctrine.enabled ? 'On' : 'Off', stored?.enabled == null),
          },
          {
            label: 'Launch point',
            value: defaulted(
              launchPolicyLabel(doctrine.launchPolicy),
              stored?.launchPolicy == null,
            ),
          },
          {
            label: 'Release inside max range',
            value: String(Math.round(doctrine.launchRangeFraction * 100)),
            unit: unitDefault('%', stored?.launchRangeFraction == null),
          },
          {
            label: 'Re-engagement depth',
            value: String(doctrine.opportunities),
            unit: unitDefault('cycles', stored?.opportunities == null),
          },
          {
            label: 'Hostile declaration dwell',
            value: String(doctrine.declareHostileS),
            unit: unitDefault('s', stored?.declareHostileS == null),
          },
          {
            label: 'Track initiation fallback',
            value: String(doctrine.trackFirmS),
            unit: unitDefault('s', stored?.trackFirmS == null),
          },
          {
            label: 'Target dwell fallback',
            value: String(doctrine.targetS),
            unit: unitDefault('s', stored?.targetS == null),
          },
          {
            label: 'BDA dwell fallback',
            value: String(doctrine.bdaS),
            unit: unitDefault('s', stored?.bdaS == null),
          },
          {
            label: 'Commit Pk fallback',
            value: defaulted(String(doctrine.pkCommit), stored?.pkCommit == null),
          },
        ]}
      />
      <p className="muted analysis-empty">
        Track initiation, target dwell, BDA dwell and commit Pk are per system: the sensor role
        and effector type tables in doctrineFactors, or the model's own override.
      </p>
      <button
        className="mini analysis-settings-edit"
        type="button"
        data-preparation-section="doctrine"
        onClick={onEdit}
      >
        Edit fire doctrine in Prepare
      </button>
    </div>
  )
}

/** Fire doctrine: ROE, the doctrine switch, launch policy, depth and the declaration dwell. */
export function FireDoctrineWidget({
  id,
  params,
  collapsed,
  customize,
  index,
  count,
  onOpenPreparation,
}: WidgetProps) {
  void params
  const scenario = useStore((state) => state.scenario)
  return (
    <WidgetFrame
      id={id}
      type="fire-doctrine"
      title="Fire doctrine"
      meta={doctrineHeadline(scenario)}
      headerExtra={onOpenPreparation ? <DoctrineInfo /> : <DoctrineControls />}
      collapsed={collapsed}
      customize={customize}
      index={index}
      count={count}
    >
      {onOpenPreparation ? (
        <FireDoctrineReadout onEdit={() => onOpenPreparation('doctrine')} />
      ) : (
        <DoctrineBody />
      )}
    </WidgetFrame>
  )
}
