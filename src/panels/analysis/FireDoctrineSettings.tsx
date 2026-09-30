import type { LaunchPolicy, Roe } from '../../model/types'
import { effectiveDoctrine } from '../../model/types'
import { LAUNCH_POLICIES } from '../../analysis/doctrineFactors'
import { useStore } from '../../state/store'
import { Info } from './Info'
import { Field } from '../../ui/kit'
import { RoleSeg } from './controls'
import { PrepSwitch, TitledSeg } from './EnvironmentSettings'

const DOCTRINE_TITLE =
  'Doctrinal fire control (default): stable track, hostile declaration, target dwell, launch-point policy, shoot-look-shoot with BDA. Off = ROE gating; preparation and travel times still apply.'

/** The fire-control method note behind the (i) in the section head. */
export function FireControlInfo() {
  return (
    <Info label="About the fire-control sequence">
      <p>
        Detect, track, identify, target, engage, assess. A shot needs a stable radar or EO/IR track
        from a sensor routed to the shooter, hostile identification, the declaration dwell, the
        kill-chain hop latency, and the shooter's own target dwell. Only then is the effector
        release-ready.
      </p>
      <p>
        The launch point decides where in the envelope the authorized shot is released. Every policy
        fires no later than the deadline that keeps the set re-engagement depth before arrival, and
        every shot carries its predicted Pk at the effect point.
      </p>
      <p>
        With doctrine off, the ROE gate opens the engagement window and every ready effector
        volleys. Effector preparation and travel times still apply.
      </p>
      <p>
        Track initiation, target dwell, BDA dwell and commit Pk are set per system by sensor role
        and effector type, or by the model's own override.
      </p>
      <p>All timing values are planning factors, not measured system performance.</p>
    </Info>
  )
}

/**
 * The Fire control section body: ROE and the Doctrine switch, then the doctrine
 * factors while doctrine is on, else the one ROE gating line.
 */
export function FireDoctrineSettings({
  launchLabels,
}: {
  /** The short segment labels; the full hint is each segment's title and the help. */
  launchLabels: Record<LaunchPolicy, string>
}) {
  const scenario = useStore((state) => state.scenario)
  const patchScenario = useStore((state) => state.patchScenario)
  const doctrine = effectiveDoctrine(scenario)
  const enabled = scenario.doctrine?.enabled ?? false
  const patch = (next: Partial<typeof doctrine>) =>
    patchScenario({ doctrine: { ...doctrine, ...next } })
  const policy = LAUNCH_POLICIES.find((p) => p.v === doctrine.launchPolicy)
  const fractionPct = Math.round(doctrine.launchRangeFraction * 100)
  return (
    <div className="pgrid">
      <div className="pg-2">
        <Field label="ROE">
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
        </Field>
      </div>
      <div className="pg-2">
        <Field label="Doctrine">
          <PrepSwitch
            checked={enabled}
            label={enabled ? 'On' : 'Off'}
            title={DOCTRINE_TITLE}
            onChange={(next) => patchScenario({ doctrine: { ...doctrine, enabled: next } })}
          />
        </Field>
      </div>
      {enabled ? (
        <>
          <div className="pg-4">
            <Field label="Launch point" help={policy?.hint}>
              <TitledSeg
                label="Launch point"
                cls="pg-seg4"
                value={doctrine.launchPolicy}
                options={LAUNCH_POLICIES.map((p) => ({
                  v: p.v,
                  label: launchLabels[p.v],
                  title: p.hint,
                }))}
                onChange={(launchPolicy) => patch({ launchPolicy })}
              />
            </Field>
          </div>
          {doctrine.launchPolicy === 'range-fraction' && (
            <div className="pg-4">
              <Field
                label="Release range"
                unit={`${fractionPct}%`}
                help="Release inside this share of max range"
              >
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={fractionPct}
                  onChange={(event) =>
                    patch({ launchRangeFraction: Number(event.target.value) / 100 })
                  }
                />
              </Field>
            </div>
          )}
          <div className="pg-2">
            <Field label="Re-engagement depth" unit="cycles" help="Cycles kept before arrival">
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
          <div className="pg-2">
            <Field label="Declaration dwell" unit="s" help="Hostile declaration dwell">
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
      ) : (
        <p className="pg-4 prep-note">
          ROE gating only. Every ready effector fires when the window opens. Preparation and travel
          times still apply.
        </p>
      )}
    </div>
  )
}
