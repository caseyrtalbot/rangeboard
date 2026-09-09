import type { LaunchPolicy, Roe } from '../../model/types'
import { effectiveDoctrine } from '../../model/types'
import { LAUNCH_POLICIES } from '../../analysis/doctrineFactors'
import { useStore } from '../../state/store'
import { Info } from './Info'
import { Field, Seg } from '../../ui/kit'
import { RoleSeg } from './controls'

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
      <p>
        Track initiation, target dwell, BDA dwell and commit Pk are set per system by sensor
        role and effector type, or by the model's own override.
      </p>
      <p>All timing values are planning factors, not measured system performance.</p>
    </Info>
  )
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
