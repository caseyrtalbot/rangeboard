import { useState } from 'react'
import type {
  Boundary,
  BoundaryType,
  Connection,
  Entity,
  EntityKind,
  FlightPath,
  FormationShape,
} from '../model/types'
import {
  DEFAULT_REQUIREMENT_THRESHOLDS,
  defaultSensorRole,
  effectiveDoctrine,
  entityActive,
  MOUNT_HEIGHT_M,
  mrirBasisOf,
  mrirBasisText,
  mrirFractionOf,
  physicsSwitches,
} from '../model/types'
import {
  Actions,
  EmptyState,
  ObjectHeader,
  Options,
  PfTag,
  pfaText,
  Row,
  Section,
} from './inspector/kit'
import { SEED_FORMATIONS } from '../model/seed'
import { Field, ProvMark, Seg } from '../ui/kit'
import type { ProvKind } from '../ui/kit'
import { useStore } from '../state/store'
import { modelFor } from '../model/scenario'
import { EFFECTOR_RING_KEYS, SENSOR_RING_KEYS } from '../state/rings'
import type { RaidDraft } from '../state/store'
import type { RingKey } from '../state/rings'
import { RING_HINTS, RING_LABELS } from './ringLabels'
import { formatDistance, formatNm, formatSpeed, pathLength } from '../geometry/geo'
import { evaluateIntegration, integrationSummary } from '../model/integration'
import type { IntegrationConfidence } from '../model/integration'
import { effectiveRadiusM, rangeBasis } from '../analysis/range'
import {
  effectiveDetectRangeM,
  radarCalibration,
  refAcousticDbFor,
  refRcsM2For,
  refSpanMFor,
  sensorHoldGate,
  targetScaled,
} from '../analysis/sensorEnv'
import {
  SCAN_S,
  scanPeriodS,
  trackDropMissesFor,
  trackInitMFor,
  trackInitNFor,
  trackInitSFor,
} from '../analysis/doctrineFactors'
import { GATE_WORD } from '../canvas/layers/footprintStyle'
import { DEFAULT_PK, EVASION_PENALTY, SIZE_PENALTY } from '../playback/pk'
import { FLYOUT_SPEED_FACTOR } from '../playback/intercept'
import type { EffectorSpec, SensorSpec, SpecModel } from '../model/types'
import { rcsM2For, swerlingFor } from '../model/rcsFactors'
import { acousticDbFor, irSignatureFor, spanMFor } from '../model/signatureFactors'
import { effectivePathDelayS, waveIndexFor } from '../playback/raid'
import { DEFAULT_DEFENDED_RADIUS_M } from '../playback/sim'
import { threatAltitudeFt } from '../playback/tracks'
import { THREAT_TACTICS } from '../playback/tactics'

const FORMATION_SHAPES: FormationShape[] = ['line', 'wedge', 'column', 'echelon', 'cluster']

/** Object type shown under the name in the Inspector header. */
const KIND_LABEL: Record<EntityKind, string> = {
  sensor: 'Sensor',
  effector: 'Effector',
  c2: 'C2 node',
  uas: 'Threat platform',
  asset: 'Defended asset',
  marker: 'Marker',
}

/** Common C-UAS airspace names offered on the boundary Name field. Typing stays free. */
const BOUNDARY_NAME_SUGGESTIONS: Record<BoundaryType, string[]> = {
  range: ['Range boundary', 'Test range', 'Danger area', 'Land range fan'],
  restricted: ['ROZ', 'Restricted area', 'NFA', 'TFR'],
  asset: ['Defended asset area', 'Base boundary', 'Critical asset zone'],
  corridor: ['Ingress corridor', 'Air corridor', 'Transit corridor'],
}

/** Standard airspace band values from the seed library boundaries, feet. */
const BOUNDARY_ALT_SUGGESTIONS_FT = [0, 100, 400, 1200, 3000, 5000]

/** Reference condition the placard detect range is quoted against, as a unit tag. */
function referenceCondition(spec: SensorSpec): string | undefined {
  switch (spec.sensorType) {
    case 'radar':
      return `at ${refRcsM2For(spec)} m²${spec.refRcsM2 == null ? ' (default)' : ''}`
    case 'eo-ir':
      return `at ${refSpanMFor(spec)} m span${spec.refSpanM == null ? ' (default)' : ''}`
    case 'acoustic':
      return `at ${refAcousticDbFor(spec)} dB${spec.refAcousticDb == null ? ' (default)' : ''}`
    default:
      return undefined
  }
}

function referenceTitle(spec: SensorSpec): string | undefined {
  switch (spec.sensorType) {
    case 'radar':
      return 'The target RCS the detection range is quoted against. Range against another threat scales with the fourth root of the RCS ratio.'
    case 'eo-ir':
      return 'The target span the detection range is quoted against. Range against another threat scales linearly with the span ratio, then the thermal class, then stops at the visibility.'
    case 'acoustic':
      return 'The source level the detection range is quoted against. Range against another threat follows spherical spreading plus atmospheric absorption.'
    default:
      return 'Passive RF hears a threat only when it emits in a covered band; the range does not scale with the target.'
  }
}

/**
 * The detection point the placard range is quoted at: the Pd, the false-alarm
 * probability and the fluctuation case, which fix the range against any other Pd.
 */
function RadarPlacard({ model, spec }: { model: SpecModel; spec: SensorSpec }) {
  // The rows show the values the engine uses. A recorded value the calibration
  // replaced (absent, or outside (0, 1)) shows as a planning factor.
  const scenario = useStore((s) => s.scenario)
  const cal = radarCalibration(spec, physicsSwitches(scenario).includes('singlePulseRadar'))
  return (
    <>
      <Row
        label="Placard Pd"
        value={cal.pd0}
        tag={<PfTag model={model} field="placardPd" absent={spec.placardPd !== cal.pd0} />}
        title="The placard range is quoted at this Pd against the reference RCS."
      />
      <Row
        label="Placard Pfa"
        value={pfaText(cal.pfa)}
        tag={<PfTag model={model} field="pfa" absent={spec.pfa !== cal.pfa} />}
        title="False-alarm probability the placard assumes."
      />
      <Row
        label="Placard case"
        value={`Swerling ${cal.swerling0}`}
        unit="PF"
        title="Fluctuation case of the reference target."
      />
    </>
  )
}

/**
 * How the sensor builds a track file. A radar with a recorded scan period, or a
 * Pd-modeled radar on the SCAN_S role period, runs the M-of-N scan model and
 * coasts through a missed scan. Every other sensor initiates on the role hold time.
 */
function ScanModel({ model, spec }: { model: SpecModel; spec: SensorSpec }) {
  const scenario = useStore((s) => s.scenario)
  if (spec.sensorType !== 'radar') return null
  const period = scanPeriodS(spec, false)
  if (period == null) {
    // A target with an RCS makes the radar Pd-modeled, so it scans on the role period.
    if (targetScaled(spec))
      return (
        <Row
          label="Scan period"
          value={`by role · ${SCAN_S[defaultSensorRole(spec)]} s`}
          tag={<PfTag model={model} field="updateRateS" absent />}
          title={
            'A target with an RCS takes the role scan period. ' +
            'A target with no RCS takes the sensor-role hold time.'
          }
        />
      )
    return (
      <Row
        label="Scan period"
        value={`role table · ${trackInitSFor(spec, effectiveDoctrine(scenario))} s`}
        title="No scan period is recorded. Initiation follows the sensor-role table: the track initiates after this much continuous hold."
      />
    )
  }
  return (
    <>
      <Row
        label="Scan period"
        value={period}
        unit="s"
        tag={<PfTag model={model} field="updateRateS" absent={spec.updateRateS == null} />}
        title={
          'One look at the full search volume. The initiation rule counts these scans. ' +
          'With no recorded period a Pd-modeled radar scans on the role planning factor.'
        }
      />
      <Row
        label="Track initiation"
        value={`${trackInitMFor(spec)} of ${trackInitNFor(spec)} scans`}
        tag={
          <PfTag
            model={model}
            field="trackInitM"
            absent={spec.trackInitM == null || spec.trackInitN == null}
          />
        }
        title="A track initiates when M of the last N scans detect and the cumulative Pd reaches the test's track threshold."
      />
      <Row
        label="Track drop"
        value={`${trackDropMissesFor(spec)} missed scans`}
        tag={<PfTag model={model} field="trackDropMisses" absent={spec.trackDropMisses == null} />}
        title="After a missed scan the track coasts. It drops after this many consecutive misses."
      />
    </>
  )
}

/** Effective detect range, or the gate word, for each distinct UAS model placed on the board. */
function AgainstThreats({ spec }: { spec: SensorSpec }) {
  const scenario = useStore((s) => s.scenario)
  const units = useStore((s) => s.ui.units)
  const seen = new Set<string>()
  const models: SpecModel[] = []
  for (const e of scenario.entities) {
    if (e.kind !== 'uas' || !e.specId || seen.has(e.specId)) continue
    seen.add(e.specId)
    const m = scenario.library.find((x) => x.id === e.specId)
    if (m?.uas) models.push(m)
  }
  if (models.length === 0) return null
  const planning = !targetScaled(spec)
  const thresholds = { ...DEFAULT_REQUIREMENT_THRESHOLDS, ...scenario.requirements }
  const physics = physicsSwitches(scenario)
  // Only a target-scaled radar runs the Pd model, so only it names the threshold.
  const atPd = spec.sensorType === 'radar' && !planning
  return (
    <>
      <p className="muted small">
        {atPd
          ? `Against threats on the board, at detect Pd ${thresholds.pdDetect}`
          : 'Against threats on the board'}
      </p>
      {models.map((m) => {
        const gate = sensorHoldGate(spec, m.uas)
        const label = m.threatProfile?.designator ?? m.name
        if (gate !== 'ok') return <Row key={m.id} label={label} value={GATE_WORD[gate]} muted />
        const r = effectiveDetectRangeM(
          spec,
          scenario.environment,
          m.uas,
          thresholds.pdDetect,
          physics,
        )
        return (
          <Row
            key={m.id}
            label={label}
            value={formatDistance(r, units)}
            unit={planning ? 'planning' : undefined}
          />
        )
      })}
    </>
  )
}

type RingChoice = 'global' | 'on' | 'off'

const RING_CHOICES: Array<{ v: RingChoice; label: string }> = [
  { v: 'global', label: 'Global' },
  { v: 'on', label: 'On' },
  { v: 'off', label: 'Off' },
]

/**
 * Ring switches for one entity. Each row is tri-state: follow the View menu, force
 * on, or force off. An override is view state, so no row here is undoable.
 */
function RingOverrideRows({ entityId, keys }: { entityId: string; keys: readonly RingKey[] }) {
  const overrides = useStore((s) => s.ui.ringOverrides[entityId])
  const { setRingOverride } = useStore.getState()
  return (
    <div className="insp-rings">
      {keys.map((k) => {
        const forced = overrides?.[k]
        const choice: RingChoice = forced == null ? 'global' : forced ? 'on' : 'off'
        return (
          <Row
            key={k}
            label={RING_LABELS[k]}
            title={RING_HINTS[k]}
            value={
              <Seg
                value={choice}
                options={RING_CHOICES}
                label={`${RING_LABELS[k]} for this entity`}
                onChange={(v) => setRingOverride(entityId, k, v === 'global' ? null : v === 'on')}
              />
            }
          />
        )
      })}
    </div>
  )
}

/**
 * Height above ground of a sensor phase centre or an effector launcher. The field
 * edits the library model, so it applies to every entity placed from it. The tag
 * names the value's basis: a provenance row, else the planning factor.
 */
function MountHeight({
  model,
  heightM,
  onChange,
  note,
}: {
  model: SpecModel
  heightM: number | null | undefined
  onChange: (raw: string) => void
  note: string
}) {
  return (
    <>
      <Field label="Mount height (m)">
        <input
          type="number"
          min={0}
          step={0.5}
          placeholder={String(MOUNT_HEIGHT_M)}
          value={heightM ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      </Field>
      <Row
        label="In use"
        value={heightM ?? MOUNT_HEIGHT_M}
        unit="m"
        tag={<PfTag model={model} field="mountHeightM" absent={heightM == null} />}
      />
      <p className="muted small">{note}</p>
    </>
  )
}

/**
 * MRIR (max recommended intercept range) as a fraction of MIR. The slider holds a
 * local draft while it moves and writes the library model once on release, so a
 * drag is one undo step. Reset clears the value back to the 2/3 planning factor.
 */
function MrirField({
  model,
  spec,
  onChange,
}: {
  model: SpecModel
  spec: EffectorSpec
  onChange: (raw: string | number) => void
}) {
  const [draft, setDraft] = useState<number | null>(null)
  const fraction = draft ?? mrirFractionOf(spec)
  // The readout basis words, so the Inspector and the board readout agree.
  const basis = draft != null ? 'edited' : mrirBasisOf(model, spec.mrirM)
  const commit = () => {
    if (draft == null) return
    setDraft(null)
    const mrirM = Math.round(draft * spec.maxRangeM)
    if (mrirM !== spec.mrirM) onChange(mrirM)
  }
  return (
    <>
      <Field label="MRIR" unit={`${fraction.toFixed(2)} × MIR`}>
        <input
          type="range"
          min={0.4}
          max={1}
          step={0.01}
          aria-label="MRIR, fraction of MIR"
          disabled={!(spec.maxRangeM > 0)}
          value={fraction}
          onChange={(e) => setDraft(Number(e.target.value))}
          onPointerUp={commit}
          onKeyUp={commit}
          onBlur={commit}
        />
      </Field>
      <Row
        label="MRIR in use"
        value={`${formatNm(spec.maxRangeM * fraction)} · ${mrirBasisText(basis, fraction)}`}
        title="Max recommended intercept range, the doctrinal range. A board ring only; the engine does not read it."
        tag={<PfTag model={model} field="mrirM" absent={spec.mrirM == null} />}
      />
      <div className="insp-inline">
        <button
          className="mini"
          disabled={spec.mrirM == null}
          title="Clear the recorded MRIR. The ring returns to 2/3 of MIR, a planning factor."
          onClick={() => onChange('')}
        >
          Reset to 2/3
        </button>
      </div>
      <p className="muted small">
        Edits the library model. Applies to every system placed from this model.
      </p>
    </>
  )
}

/** Path speed picker for a model with known cruise and max speeds. */
function PathSpeedField({ path, cruise, max }: { path: FlightPath; cruise: number; max: number }) {
  const { updatePath } = useStore.getState()
  const [customDraft, setCustomDraft] = useState(false)
  const stored =
    path.speedMps == null ? 'cruise' : path.speedMps === max && max !== cruise ? 'max' : 'custom'
  const mode = customDraft ? 'custom' : stored
  return (
    <div className="field">
      <span>Speed (m/s)</span>
      <Seg
        label="Speed basis"
        value={mode}
        options={[
          { v: 'cruise', label: `Cruise ${cruise}` },
          { v: 'max', label: `Max ${max}` },
          { v: 'custom', label: 'Custom' },
        ]}
        onChange={(v) => {
          if (v === 'cruise') {
            setCustomDraft(false)
            updatePath(path.id, { speedMps: null })
          } else if (v === 'max') {
            setCustomDraft(false)
            updatePath(path.id, { speedMps: max })
          } else {
            setCustomDraft(true)
            updatePath(path.id, { speedMps: path.speedMps ?? cruise })
          }
        }}
      />
      {mode === 'custom' && (
        <input
          type="number"
          min={1}
          value={path.speedMps ?? ''}
          onChange={(e) => {
            setCustomDraft(true)
            updatePath(path.id, {
              speedMps: e.target.value === '' ? null : Number(e.target.value),
            })
          }}
        />
      )}
    </div>
  )
}

/**
 * Tactic raid builder, shown in place of the Inspector body while a raid draft is
 * armed. Commit happens on the next canvas click or through "Use default axis".
 */
function RaidBuilderCard({ draft }: { draft: RaidDraft }) {
  const scenario = useStore((s) => s.scenario)
  const units = useStore((s) => s.ui.units)
  const { patchRaidDraft, commitRaid, cancelRaidDraft } = useStore.getState()
  const tactic = THREAT_TACTICS.find((t) => t.id === draft.tacticId)
  if (!tactic) return null

  const uasModels = scenario.library.filter((m) => m.kind === 'uas' && m.uas)
  const assets = scenario.entities.filter((e) => e.kind === 'asset')
  const platform = draft.platformSpecId
    ? scenario.library.find((m) => m.id === draft.platformSpecId)
    : undefined
  const target = draft.targetEntityId
    ? scenario.entities.find((e) => e.id === draft.targetEntityId)
    : undefined
  const shipCount = Math.max(1, Math.floor(draft.shipCount))
  const perWave = Math.max(1, Math.floor(tactic.shipsPerWave))
  const waveCount = Math.ceil(shipCount / perWave)
  const existingWaves = scenario.raid?.waves.length ?? 0
  const ready = !!platform?.uas && !!target

  return (
    <div className="inspector-body insp">
      <ObjectHeader
        name={tactic.name}
        type={`Threat tactic · ${tactic.id}`}
        status="warning"
        statusLabel="Armed"
      />

      <Section label="Tactic" note={`Study ${tactic.sourceRef}`}>
        <p className="muted small">{tactic.description}</p>
      </Section>

      <Section label="Raid">
        <Field label="Platform">
          <select
            value={draft.platformSpecId ?? ''}
            onChange={(e) => patchRaidDraft({ platformSpecId: e.target.value || null })}
          >
            <option value="">choose a platform…</option>
            {uasModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
        {!platform?.uas && (
          <p className="muted small">No platform matched in the library. Choose one to continue.</p>
        )}

        <Field label="Target asset">
          <select
            value={draft.targetEntityId ?? ''}
            onChange={(e) => patchRaidDraft({ targetEntityId: e.target.value || null })}
          >
            <option value="">choose a target…</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        {assets.length === 0 && (
          <p className="muted small">
            No asset on the canvas. Place an asset entity as the target.
          </p>
        )}

        <Field label="Ships">
          <input
            type="number"
            min={1}
            max={60}
            value={draft.shipCount}
            onChange={(e) => {
              const n = Number(e.target.value)
              if (Number.isFinite(n)) patchRaidDraft({ shipCount: Math.min(60, Math.max(1, n)) })
            }}
          />
        </Field>
      </Section>

      <Section label="Laydown">
        <Row label="Ships" value={shipCount} />
        <Row label="Waves" value={waveCount} />
        <Row label="Ships per wave" value={perWave} unit="max" />
        {waveCount > 1 && <Row label="Wave spacing" value={tactic.waveSpacingS} unit="s" />}
        <Row
          label="Ingress axes"
          value={tactic.axes}
          unit={tactic.axes > 1 ? `across ${tactic.axisSpreadDeg}°` : undefined}
        />
        <Row label="Standoff" value={formatDistance(tactic.standoffM, units)} />
        {tactic.decoy && <Row label="Decoys" value={`1 in ${tactic.decoy.everyNth}`} />}
        <p className="muted small">
          Standoff is that range or beyond every sensor detection ring, whichever is greater.
        </p>
        {existingWaves > 0 && (
          <p className="muted small">
            New waves add alongside the {existingWaves} existing{' '}
            {existingWaves === 1 ? 'wave' : 'waves'}; delays restart at 0. Adjust wave delays in the
            timeline strip to sequence them.
          </p>
        )}
      </Section>

      <Section label="Commit">
        <p className="muted small">
          {ready
            ? 'Click the canvas to place the ingress axis. The raid flies from the click point toward the target.'
            : 'Choose a platform and a target asset to enable commit.'}
        </p>
        <Actions>
          <button className="primary" disabled={!ready} onClick={() => commitRaid(null)}>
            Use default axis
          </button>
          <button onClick={cancelRaidDraft}>Cancel</button>
        </Actions>
      </Section>
    </div>
  )
}

const INTEGRATION_BADGE: Record<IntegrationConfidence, string> = {
  documented: 'DOC',
  probable: 'PROB',
  inferred: 'INF',
}

/** A documented pairing is sourced; the other two confidences keep their names. */
const INTEGRATION_MARK: Record<IntegrationConfidence, ProvKind> = {
  documented: 'sourced',
  probable: 'probable',
  inferred: 'inferred',
}

type IntegrationSummary = ReturnType<typeof integrationSummary>

const integrationCache = new WeakMap<SpecModel[], Map<string | null, IntegrationSummary>>()

/** `integrationSummary` cached by library identity and spec id, across selections. */
function cachedIntegrationSummary(specId: string | null, library: SpecModel[]): IntegrationSummary {
  let byId = integrationCache.get(library)
  if (!byId) {
    byId = new Map()
    integrationCache.set(library, byId)
  }
  let summary = byId.get(specId)
  if (summary === undefined) {
    summary = integrationSummary(specId, library)
    byId.set(specId, summary)
  }
  return summary
}

/**
 * What this system is known to integrate with, from research rows, independent of
 * what is on the canvas.
 */
function IntegrationSection({ entity }: { entity: Entity }) {
  const library = useStore((s) => s.scenario.library)
  const openConnectSuggestion = useStore((s) => s.openConnectSuggestion)
  const [showAll, setShowAll] = useState(false)
  const summary = cachedIntegrationSummary(entity.specId, library)
  if (!summary) return null
  const shown = showAll ? summary.partners : summary.partners.slice(0, 6)

  function suggest() {
    // Popup coordinates are canvas-host px; clamp so it stays in view when the
    // entity is off-screen. The camera is read here, not subscribed: it changes
    // every pan frame.
    const camera = useStore.getState().camera
    const host = document.querySelector('[data-testid="canvas-host"]')
    const w = host instanceof HTMLElement ? host.clientWidth : 800
    const h = host instanceof HTMLElement ? host.clientHeight : 600
    const x = Math.min(Math.max(entity.pos.x * camera.scale + camera.x + 16, 8), w - 280)
    const y = Math.min(
      Math.max(entity.pos.y * camera.scale + camera.y + 16, 8),
      Math.max(h - 260, 8),
    )
    openConnectSuggestion(entity.id, { x, y }, { always: true })
  }

  return (
    <Section
      label="Network"
      note={summary.partners.length > 0 ? `${summary.partners.length} known` : undefined}
    >
      {summary.program && <Row label="Program" value={summary.program} stacked />}
      {summary.guidance && <p className="muted small">{summary.guidance}</p>}
      {summary.partners.length === 0 && (
        <p className="muted small">No known network integrations.</p>
      )}
      {shown.map((p) => (
        <div
          key={p.specId}
          className="insp-row"
          title={p.source ? `${p.note} [${p.source}]` : p.note}
        >
          <span className="insp-row-label" title={p.name}>
            {p.name}
          </span>
          <span className="insp-row-value">
            <span className="unit">{p.role.replace('-', ' ')}</span>
          </span>
          <ProvMark
            kind={INTEGRATION_MARK[p.confidence]}
            title={`${INTEGRATION_BADGE[p.confidence]}${p.source ? ` · ${p.source}` : ''}`}
          />
        </div>
      ))}
      {!showAll && summary.partners.length > 6 && (
        <button className="mini insp-more" onClick={() => setShowAll(true)}>
          Show all {summary.partners.length}
        </button>
      )}
      {summary.denied.length > 0 && (
        <Row
          label="No link"
          value={summary.denied.map((d) => d.name).join(', ')}
          title={summary.denied.map((d) => `${d.name}: ${d.reason}`).join('\n')}
          stacked
          muted
        />
      )}
      <Actions>
        <button onClick={suggest}>Suggest connections</button>
      </Actions>
    </Section>
  )
}

function EntityInspector({ entity }: { entity: Entity }) {
  const scenario = useStore((s) => s.scenario)
  const units = useStore((s) => s.ui.units)
  const prepare = useStore((s) => s.ui.boardPhase === 'prepare')
  const {
    updateEntity,
    editModel,
    deleteSelection,
    setTool,
    beginPath,
    updatePath,
    deletePathForEntity,
    selectSystem,
    select,
    assignToWave,
  } = useStore.getState()
  const model = modelFor(scenario, entity)
  const sameKindModels = scenario.library.filter((m) => m.kind === entity.kind)
  const path = scenario.paths.find((p) => p.entityId === entity.id)
  const blue = entity.kind === 'sensor' || entity.kind === 'effector' || entity.kind === 'c2'
  const formation = entity.formation

  // Drop the model name when it only repeats the kind.
  const kindLabel = KIND_LABEL[entity.kind]
  const modelName = model?.name ?? 'no model'
  const typeLine =
    modelName.toLowerCase() === kindLabel.toLowerCase() ? kindLabel : `${kindLabel} · ${modelName}`

  const suggestedName = (() => {
    if (!model) return null
    const base = model.name.split(':').pop()?.trim() ?? model.name
    const peers = scenario.entities.filter((e) => e.specId === entity.specId)
    const name = `${base} ${peers.findIndex((e) => e.id === entity.id) + 1}`
    return entity.name === name ? null : name
  })()

  return (
    <div className="inspector-body insp">
      <ObjectHeader
        name={entity.name || 'Unnamed'}
        type={typeLine}
        status={blue ? (entityActive(entity) ? 'nominal' : 'inactive') : undefined}
        statusLabel={blue ? (entityActive(entity) ? 'Active' : 'Disabled') : undefined}
      />

      <Section label="Identity">
        <Field label="Name">
          <input
            list="entity-name-options"
            value={entity.name}
            onChange={(e) => updateEntity(entity.id, { name: e.target.value })}
          />
        </Field>
        <Options id="entity-name-options" values={sameKindModels.map((m) => m.name)} />
        {suggestedName && (
          <button className="mini" onClick={() => updateEntity(entity.id, { name: suggestedName })}>
            Rename to {suggestedName}
          </button>
        )}
        <Field label="Model">
          <select
            value={entity.specId ?? ''}
            onChange={(e) => updateEntity(entity.id, { specId: e.target.value || null })}
          >
            <option value="">none</option>
            {sameKindModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
        {blue && (
          <Field label="Enabled in analysis">
            <input
              type="checkbox"
              checked={entityActive(entity)}
              onChange={(e) => updateEntity(entity.id, { enabled: e.target.checked })}
            />
          </Field>
        )}
        {entity.systemId && (
          <Row
            label="System component"
            value={
              <button className="mini" onClick={() => selectSystem(entity.systemId!)}>
                Select system
              </button>
            }
          />
        )}
      </Section>

      <Section label="Position">
        <div className="field-row">
          <Field label="East (km)">
            <input
              type="number"
              step={0.1}
              value={(entity.pos.x / 1000).toFixed(2)}
              onChange={(e) =>
                updateEntity(entity.id, {
                  pos: { ...entity.pos, x: Number(e.target.value) * 1000 },
                })
              }
            />
          </Field>
          <Field label="North (km)">
            <input
              type="number"
              step={0.1}
              value={(-entity.pos.y / 1000).toFixed(2)}
              onChange={(e) =>
                updateEntity(entity.id, {
                  pos: { ...entity.pos, y: -Number(e.target.value) * 1000 },
                })
              }
            />
          </Field>
        </div>
        <div className="field">
          <span>Heading</span>
          <div className="insp-inline">
            <input
              type="range"
              min={0}
              max={359}
              aria-label="Heading, degrees (slider)"
              value={entity.headingDeg}
              onChange={(e) => updateEntity(entity.id, { headingDeg: Number(e.target.value) })}
            />
            <input
              type="number"
              className="insp-inline-num"
              min={0}
              max={359}
              aria-label="Heading, degrees (value)"
              value={Math.round(entity.headingDeg)}
              onChange={(e) =>
                updateEntity(entity.id, {
                  headingDeg: ((Number(e.target.value) % 360) + 360) % 360,
                })
              }
            />
          </div>
        </div>
        {entity.kind === 'uas' && (
          <>
            <Field label="Altitude (ft AGL)">
              <input
                type="number"
                min={0}
                step={100}
                placeholder={String(threatAltitudeFt(scenario, entity))}
                value={entity.altitudeFt ?? ''}
                onChange={(e) =>
                  updateEntity(entity.id, {
                    altitudeFt: e.target.value === '' ? null : Math.max(0, Number(e.target.value)),
                  })
                }
              />
            </Field>
            <Row
              label="In use"
              value={`${threatAltitudeFt(scenario, entity).toLocaleString()} ft AGL`}
              unit={entity.altitudeFt == null ? 'model default' : undefined}
              title="The threat flies at this one altitude along the whole path. The engine measures the slant range to it and applies the elevation, ceiling and horizon gates. Leave the field empty to take the model threat profile, else the middle of the model altitude band."
            />
          </>
        )}
      </Section>

      {model?.sensor && (
        <Section label="Performance">
          {model.sensor.role && <Row label="Role" value={model.sensor.role.replace(/-/g, ' ')} />}
          <Row
            label="Detection range"
            value={formatDistance(model.sensor.detectRangeM, units)}
            unit={referenceCondition(model.sensor)}
            title={referenceTitle(model.sensor)}
            tag={<PfTag model={model} field="detectRangeM" />}
          />
          {model.sensor.classifyRangeM != null && (
            <Row
              label="Classification range"
              value={formatDistance(model.sensor.classifyRangeM, units)}
              tag={<PfTag model={model} field="classifyRangeM" />}
            />
          )}
          <Row
            label="Range basis"
            value={targetScaled(model.sensor) ? 'sourced, target-scaled' : 'planning figure'}
            title={
              targetScaled(model.sensor)
                ? 'A datasheet figure conditioned on the reference target. Range against another threat follows the physics for this technology.'
                : 'A role-table or representative figure with no stated target. No target scaling runs on it.'
            }
          />
          {model.sensor.sensorType === 'radar' && targetScaled(model.sensor) && (
            <RadarPlacard model={model} spec={model.sensor} />
          )}
          <Row
            label="Azimuth coverage"
            value={`${model.sensor.sectorDeg}°`}
            tag={<PfTag model={model} field="sectorDeg" />}
          />
          {model.sensor.sensorType === 'eo-ir' && (
            <Row
              label="Band"
              value={model.sensor.eoBand ?? 'dual'}
              unit={model.sensor.eoBand == null ? 'default' : undefined}
              tag={<PfTag model={model} field="eoBand" />}
            />
          )}
          {model.sensor.instrumentedRangeM != null && (
            <Row
              label="Maximum reported range"
              value={formatDistance(model.sensor.instrumentedRangeM, units)}
              title="Instrumented range or the top of the vendor's detection band. Caps the target-scaled detection range."
              tag={<PfTag model={model} field="instrumentedRangeM" />}
            />
          )}
          {effectiveDetectRangeM(
            model.sensor,
            scenario.environment,
            undefined,
            undefined,
            physicsSwitches(scenario),
          ) !== model.sensor.detectRangeM && (
            <Row
              label="Detection, this environment"
              value={formatDistance(
                effectiveDetectRangeM(
                  model.sensor,
                  scenario.environment,
                  undefined,
                  undefined,
                  physicsSwitches(scenario),
                ),
                units,
              )}
            />
          )}
          <AgainstThreats spec={model.sensor} />
          <ScanModel model={model} spec={model.sensor} />
          {model.sensor.elevationDeg != null && (
            <Row
              label="Elevation coverage"
              value={`${model.sensor.elevationDeg[0]}° to ${model.sensor.elevationDeg[1]}°`}
              title="The geometry gate reads these limits. A threat above or below the coverage is not detected."
              tag={<PfTag model={model} field="elevationDeg" />}
            />
          )}
          {model.sensor.maxAltitudeFt != null && model.sensor.maxAltitudeFt > 0 && (
            <Row
              label="Altitude ceiling"
              value={`${model.sensor.maxAltitudeFt.toLocaleString()} ft`}
              title="The geometry gate reads this ceiling. A threat above it is not detected."
              tag={<PfTag model={model} field="maxAltitudeFt" />}
            />
          )}
          <MountHeight
            model={model}
            heightM={model.sensor.mountHeightM}
            onChange={(raw) => editModel(model.id, 'sensor.mountHeightM', raw)}
            note="Height of the antenna phase centre above ground. The engine measures the slant range and the radio horizon from it. The value applies to every sensor placed from this model."
          />
        </Section>
      )}
      {entity.kind === 'sensor' && (
        <Section label="Rings">
          <RingOverrideRows entityId={entity.id} keys={SENSOR_RING_KEYS} />
        </Section>
      )}
      {model?.effector && (
        <Section label="Performance">
          <Row
            label="WEZ"
            value={`${formatDistance(model.effector.minRangeM, units)} – ${formatDistance(
              model.effector.maxRangeM,
              units,
            )}`}
            tag={<PfTag model={model} field="maxRangeM" />}
          />
          <Row
            label="Engagement time"
            value={model.effector.engageTimeS}
            unit="s"
            tag={<PfTag model={model} field="engageTimeS" />}
          />
          <Row
            label="Single-shot Pk"
            value={model.effector.pk ?? DEFAULT_PK[model.effector.effectorType]}
            unit={model.effector.pk == null ? 'type PF' : undefined}
            tag={<PfTag model={model} field="pk" absent={model.effector.pk == null} />}
          />
          <Row
            label="Magazine"
            value={model.effector.magazineSize ?? 'unlimited'}
            tag={
              <PfTag
                model={model}
                field="magazineSize"
                absent={model.effector.magazineSize == null}
              />
            }
          />
          {model.effector.flyoutSpeedMps != null &&
            Number.isFinite(model.effector.flyoutSpeedMps) &&
            model.effector.flyoutSpeedMps > 0 && (
              <Row
                label="Flyout speed"
                value={`${model.effector.flyoutSpeedMps} m/s`}
                title={
                  'Average interceptor or round speed to the target. ' +
                  'The engine adds the time of flight to the engagement time.'
                }
                tag={<PfTag model={model} field="flyoutSpeedMps" />}
              />
            )}
          {model.effector.flyoutSpeedMps != null &&
            Number.isFinite(model.effector.flyoutSpeedMps) &&
            model.effector.flyoutSpeedMps > 0 && (
              <Row
                label="Average flyout speed"
                value={`${Math.round(model.effector.flyoutSpeedMps * FLYOUT_SPEED_FACTOR)} m/s`}
                title={
                  'Stated speed times the planning factor 0.7. ' +
                  'Every stated speed is a maximum or a muzzle velocity.'
                }
                tag={<PfTag model={model} field="flyoutSpeedFactor" absent />}
              />
            )}
          {(model.effector.sectorDeg ?? 360) < 360 && (
            <Row
              label="Azimuth coverage"
              value={`${model.effector.sectorDeg}°`}
              tag={<PfTag model={model} field="sectorDeg" />}
            />
          )}
          {model.effector.maxAltitudeFt != null && model.effector.maxAltitudeFt > 0 && (
            <Row
              label="Altitude ceiling"
              value={`${model.effector.maxAltitudeFt.toLocaleString()} ft`}
              title="The geometry gate reads this ceiling. A threat above it has no engagement window."
              tag={<PfTag model={model} field="maxAltitudeFt" />}
            />
          )}
          <MountHeight
            model={model}
            heightM={model.effector.mountHeightM}
            onChange={(raw) => editModel(model.id, 'effector.mountHeightM', raw)}
            note="Height of the launcher or the emitter above ground. The engine measures the slant range from it. The value applies to every effector placed from this model."
          />
        </Section>
      )}
      {entity.kind === 'effector' && (
        <Section label="Rings">
          <RingOverrideRows entityId={entity.id} keys={EFFECTOR_RING_KEYS} />
          {model?.effector && (
            <MrirField
              model={model}
              spec={model.effector}
              onChange={(raw) => editModel(model.id, 'effector.mrirM', raw)}
            />
          )}
        </Section>
      )}
      {model?.uas && (
        <Section label="Platform">
          <Row label="UAS group" value={model.uas.group} />
          <Row
            label="Radar cross section"
            value={`${rcsM2For(model.uas)} m²`}
            tag={<PfTag model={model} field="rcsM2" absent={model.uas.rcsM2 == null} />}
            title="Planning factor, not measured signature data. Sets each radar's detection range against this threat by the fourth-root law."
          />
          <Row
            label="Fluctuation model"
            value={`Swerling ${swerlingFor(model.uas)}`}
            tag={<PfTag model={model} field="swerling" absent={model.uas.swerling == null} />}
            title="Fluctuation case for radar. Multirotor, FPV and one-way attack airframes are Swerling 1. Fixed wing is Swerling 3. An unrecorded case is the airframe planning factor."
          />
          <Row
            label="Span"
            value={`${spanMFor(model.uas)} m`}
            tag={<PfTag model={model} field="spanM" absent={model.uas.spanM == null} />}
            title="Planning factor: wingspan or motor-to-motor diagonal. Sets each EO/IR sensor's range against this threat linearly (Johnson criteria)."
          />
          <Row
            label="Acoustic level"
            value={`${acousticDbFor(model.uas)} dB`}
            tag={<PfTag model={model} field="acousticDb" absent={model.uas.acousticDb == null} />}
            title="Planning factor: broadband source level at 1 m. Sets each acoustic sensor's range by spreading plus absorption."
          />
          <Row
            label="IR signature"
            value={irSignatureFor(model.uas)}
            unit={model.uas.irSignature == null ? 'default' : undefined}
            tag={<PfTag model={model} field="irSignature" absent={model.uas.irSignature == null} />}
            title="Thermal contrast class. Multiplies EO/IR range when the thermal channel carries."
          />
          <Row
            label="Cruise speed"
            value={formatSpeed(model.uas.cruiseSpeedMps, units)}
            tag={<PfTag model={model} field="cruiseSpeedMps" />}
          />
          <Row
            label="Kinetic size factor"
            value={SIZE_PENALTY[model.uas.group]}
            tag={<PfTag model={model} field="sizePenalty" absent />}
            title="Planning factor on every kinetic per-shot Pk against this group."
          />
          {model.uas.airframe === 'fpv' && (
            <Row
              label="Evasion factor"
              value={EVASION_PENALTY}
              tag={<PfTag model={model} field="evasionPenalty" absent />}
            />
          )}
          <Row label="Navigation" value={model.uas.navMode} />
        </Section>
      )}

      {entity.kind === 'asset' && (
        <Section label="Defended area">
          <Field label="Defended radius (m)">
            <input
              type="number"
              min={0}
              step={50}
              placeholder={String(DEFAULT_DEFENDED_RADIUS_M)}
              value={entity.defendedRadiusM ?? ''}
              onChange={(e) =>
                updateEntity(entity.id, {
                  defendedRadiusM:
                    e.target.value === '' ? null : Math.max(0, Number(e.target.value)),
                })
              }
            />
          </Field>
          <Row
            label="In use"
            value={formatDistance(entity.defendedRadiusM ?? DEFAULT_DEFENDED_RADIUS_M, units)}
            unit={
              entity.defendedRadiusM == null || entity.defendedRadiusM <= 0 ? 'default' : undefined
            }
          />
          <p className="muted small">
            A threat that crosses this radius has ARRIVED at the asset. Arrival sets warning time,
            and it separates a defeat that protected the asset from one that landed too late. Leave
            the field empty to use the {formatDistance(DEFAULT_DEFENDED_RADIUS_M, units)} planning
            factor.
          </p>
        </Section>
      )}

      {entity.kind === 'uas' && model?.uas && (
        <Section label="Range">
          <Field label="Show range ring">
            <input
              type="checkbox"
              checked={!!entity.showRange}
              onChange={(e) => updateEntity(entity.id, { showRange: e.target.checked })}
            />
          </Field>
          {(() => {
            const uas = model.uas!
            const env = scenario.environment
            const basis = rangeBasis(uas)
            const windTo = (env.windFromDeg + 180) % 360
            const down = effectiveRadiusM(uas, env, windTo)
            const up = effectiveRadiusM(uas, env, env.windFromDeg)
            return (
              <>
                <Row
                  label="Basis"
                  value={`${basis.source}, ${basis.oneWay ? 'one-way' : 'return-to-home'}`}
                />
                <Row label="Radius, calm" value={formatDistance(basis.radiusM, units)} />
                <Row label="Downwind" value={formatDistance(down, units)} />
                <Row label="Upwind" value={formatDistance(up, units)} />
                {basis.source === 'estimated' && (
                  <p className="muted small">
                    No reported employment radius. This is an estimate from endurance and cruise
                    speed. Enter a known radius in the model editor to replace it.
                  </p>
                )}
                {uas.rangeNote && <p className="muted small">{uas.rangeNote}</p>}
              </>
            )
          })()}
        </Section>
      )}

      {entity.kind === 'uas' && (
        <Section label="Formation / swarm">
          <Field label="Known construct">
            <select
              value=""
              onChange={(e) => {
                const c = SEED_FORMATIONS.find((f) => f.name === e.target.value)
                if (c) updateEntity(entity.id, { formation: { ...c.formation } })
              }}
            >
              <option value="">apply a reported construct…</option>
              {SEED_FORMATIONS.map((f) => (
                <option key={f.name} value={f.name} title={f.description}>
                  {f.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fly as formation">
            <input
              type="checkbox"
              checked={!!formation}
              onChange={(e) =>
                updateEntity(entity.id, {
                  formation: e.target.checked ? { count: 3, shape: 'wedge', spacingM: 50 } : null,
                })
              }
            />
          </Field>
          {formation && (
            <>
              <div className="field-row">
                <Field label="Ships">
                  <input
                    type="number"
                    min={2}
                    max={60}
                    value={formation.count}
                    onChange={(e) =>
                      updateEntity(entity.id, {
                        formation: { ...formation, count: Math.max(2, Number(e.target.value)) },
                      })
                    }
                  />
                </Field>
                <Field label="Spacing (m)">
                  <input
                    type="number"
                    min={5}
                    step={5}
                    value={formation.spacingM}
                    onChange={(e) =>
                      updateEntity(entity.id, {
                        formation: { ...formation, spacingM: Math.max(5, Number(e.target.value)) },
                      })
                    }
                  />
                </Field>
              </div>
              <Field label="Shape">
                <select
                  value={formation.shape}
                  onChange={(e) =>
                    updateEntity(entity.id, {
                      formation: { ...formation, shape: e.target.value as FormationShape },
                    })
                  }
                >
                  {FORMATION_SHAPES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}
        </Section>
      )}

      {entity.kind === 'uas' && (
        <Section label="Flight path">
          {path ? (
            <>
              <Row label="Waypoints" value={path.points.length} />
              <Row label="Track length" value={formatDistance(pathLength(path.points), units)} />
              <div className="field-row">
                {(() => {
                  const cruise = model?.uas?.cruiseSpeedMps
                  const max = model?.uas?.maxSpeedMps
                  if (cruise == null || max == null) {
                    return (
                      <Field label="Speed (m/s)">
                        <input
                          type="number"
                          placeholder="15"
                          value={path.speedMps ?? ''}
                          onChange={(e) =>
                            updatePath(path.id, {
                              speedMps: e.target.value === '' ? null : Number(e.target.value),
                            })
                          }
                        />
                      </Field>
                    )
                  }
                  return <PathSpeedField key={path.id} path={path} cruise={cruise} max={max} />
                })()}
                <Field label="Start delay (s)">
                  <input
                    type="number"
                    min={0}
                    value={path.startDelayS}
                    onChange={(e) => updatePath(path.id, { startDelayS: Number(e.target.value) })}
                  />
                </Field>
              </div>
              <Actions>
                <button onClick={() => deletePathForEntity(entity.id)}>Delete path</button>
              </Actions>
            </>
          ) : (
            prepare && (
              <Actions>
                <button onClick={() => beginPath(entity.id)}>Draw flight path</button>
              </Actions>
            )
          )}
        </Section>
      )}

      {entity.kind === 'uas' && (
        <Section label="Raid wave">
          {(() => {
            const waves = scenario.raid?.waves ?? []
            const waveIndex = waveIndexFor(scenario.raid, entity.id)
            return (
              <>
                <Field label="Wave">
                  <select
                    value={waveIndex ?? ''}
                    onChange={(e) =>
                      assignToWave(entity.id, e.target.value === '' ? null : Number(e.target.value))
                    }
                  >
                    <option value="">none</option>
                    {waves.map((w, i) => (
                      <option key={i} value={i}>
                        Wave {i + 1} (T+{w.startDelayS} s)
                      </option>
                    ))}
                    <option value={waves.length}>new wave</option>
                  </select>
                </Field>
                {path && waveIndex != null && (
                  <Row
                    label="Effective start delay"
                    value={effectivePathDelayS(scenario, path)}
                    unit="s"
                    title={`Path ${path.startDelayS} s + wave ${waves[waveIndex].startDelayS} s`}
                  />
                )}
              </>
            )
          })()}
        </Section>
      )}

      {blue && <IntegrationSection entity={entity} />}

      <Section label="Notes">
        <textarea
          rows={3}
          aria-label="Notes"
          placeholder="Configuration, siting, or test notes"
          value={entity.notes}
          onChange={(e) => updateEntity(entity.id, { notes: e.target.value })}
        />
      </Section>

      <Actions>
        {prepare && (
          <button
            onClick={() => {
              select({ entityIds: [entity.id] })
              setTool('connect')
            }}
          >
            Connect from here
          </button>
        )}
        <button
          className="danger"
          onClick={() => {
            select({ entityIds: [entity.id] })
            deleteSelection()
          }}
        >
          Delete
        </button>
      </Actions>
    </div>
  )
}

function BoundaryInspector({ boundary }: { boundary: Boundary }) {
  const { updateBoundary, deleteSelection } = useStore.getState()
  return (
    <div className="inspector-body insp">
      <ObjectHeader
        name={boundary.name || 'Unnamed boundary'}
        type={`Airspace boundary · ${boundary.type}`}
      />

      <Section label="Definition">
        <Field label="Name">
          <input
            list="boundary-name-options"
            value={boundary.name}
            onChange={(e) => updateBoundary(boundary.id, { name: e.target.value })}
          />
        </Field>
        <Options id="boundary-name-options" values={BOUNDARY_NAME_SUGGESTIONS[boundary.type]} />
        <Field label="Type">
          <select
            value={boundary.type}
            onChange={(e) => updateBoundary(boundary.id, { type: e.target.value as BoundaryType })}
          >
            <option value="range">range</option>
            <option value="restricted">restricted</option>
            <option value="asset">asset</option>
            <option value="corridor">corridor</option>
          </select>
        </Field>
      </Section>

      <Section label="Geometry">
        <div className="field-row">
          <Field label="Floor (ft)">
            <input
              type="number"
              list="boundary-alt-options"
              value={boundary.altBandFt?.[0] ?? ''}
              onChange={(e) =>
                updateBoundary(boundary.id, {
                  altBandFt: [Number(e.target.value), boundary.altBandFt?.[1] ?? 0],
                })
              }
            />
          </Field>
          <Field label="Ceiling (ft)">
            <input
              type="number"
              list="boundary-alt-options"
              value={boundary.altBandFt?.[1] ?? ''}
              onChange={(e) =>
                updateBoundary(boundary.id, {
                  altBandFt: [boundary.altBandFt?.[0] ?? 0, Number(e.target.value)],
                })
              }
            />
          </Field>
        </div>
        <Options id="boundary-alt-options" values={BOUNDARY_ALT_SUGGESTIONS_FT} />
        <Row label="Vertices" value={boundary.points.length} />
      </Section>

      <Actions>
        <button className="danger" onClick={deleteSelection}>
          Delete
        </button>
      </Actions>
    </div>
  )
}

/** Read-only view of one kill-chain link and the evidence behind it. */
function ConnectionInspector({ connection }: { connection: Connection }) {
  const scenario = useStore((s) => s.scenario)
  const { updateConnection, deleteSelection } = useStore.getState()
  const from = scenario.entities.find((e) => e.id === connection.fromId)
  const to = scenario.entities.find((e) => e.id === connection.toId)
  // The source citation is not stored on the connection; re-judge the pair.
  const fromSpec = from?.specId ? scenario.library.find((m) => m.id === from.specId) : undefined
  const toSpec = to?.specId ? scenario.library.find((m) => m.id === to.specId) : undefined
  const verdict = fromSpec && toSpec ? evaluateIntegration(fromSpec, toSpec) : null
  const source = connection.confidence != null && verdict?.ok ? verdict.source : undefined

  return (
    <div className="inspector-body insp">
      <ObjectHeader
        name={`${from?.name ?? '?'} → ${to?.name ?? '?'}`}
        type={connection.label ? `Link · ${connection.label}` : 'Kill-chain link'}
      />

      <Section label="Link">
        <Row label="Source" value={from?.name} title={from?.name} />
        <Row label="Destination" value={to?.name} title={to?.name} />
        <Field label="Label">
          <input
            list="connection-label-options"
            value={connection.label}
            onChange={(e) => updateConnection(connection.id, { label: e.target.value })}
          />
        </Field>
        <Options
          id="connection-label-options"
          values={[...new Set(scenario.connections.map((c) => c.label).filter(Boolean))]}
        />
      </Section>

      {connection.confidence != null && (
        <Section label="Integration">
          <Row label="Medium" value={connection.medium ?? 'unspecified'} />
          <Row label="Confidence" value={connection.confidence} />
          <Row label="Route latency" value={connection.latencyS ?? 0} unit="s" />
          {source && <Row label="Source" value={source} stacked />}
        </Section>
      )}

      {connection.note && (
        <Section label="Note">
          <p className="muted small">{connection.note}</p>
        </Section>
      )}

      <Actions>
        <button className="danger" onClick={deleteSelection}>
          Delete
        </button>
      </Actions>
    </div>
  )
}

/** Two or more entities selected: only what applies to all of them. */
function MultiInspector({ ids }: { ids: string[] }) {
  const scenario = useStore((s) => s.scenario)
  const { deleteSelection, rotateSystem } = useStore.getState()
  const selected = scenario.entities.filter((e) => ids.includes(e.id))
  const systemId = selected[0]?.systemId
  const wholeSystem = !!systemId && selected.every((e) => e.systemId === systemId)
  const byKind = (Object.keys(KIND_LABEL) as EntityKind[])
    .map((k) => [k, selected.filter((e) => e.kind === k).length] as const)
    .filter(([, n]) => n > 0)

  return (
    <div className="inspector-body insp">
      <ObjectHeader
        name={`${ids.length} entities selected`}
        type={wholeSystem ? 'One placed system' : 'Mixed selection'}
      />

      <Section label="Composition">
        {byKind.map(([kind, n]) => (
          <Row key={kind} label={KIND_LABEL[kind]} value={n} />
        ))}
      </Section>

      {wholeSystem && (
        <Section label="System orientation">
          <p className="muted small">
            Drag the amber handle on the canvas to face any direction, or slew in steps.
          </p>
          <div className="insp-slew">
            {[-90, -45, 45, 90].map((d) => (
              <button key={d} onClick={() => rotateSystem(systemId!, d)}>
                {d > 0 ? `${d}°→` : `←${-d}°`}
              </button>
            ))}
          </div>
        </Section>
      )}

      <Actions>
        <button className="danger" onClick={deleteSelection}>
          Delete all
        </button>
      </Actions>
    </div>
  )
}

export function Inspector({ entityId }: { entityId?: string } = {}) {
  const scenario = useStore((s) => s.scenario)
  const selection = useStore((s) => s.selection)
  const raidDraft = useStore((s) => s.ui.raidDraft)

  // The armed raid builder replaces the whole Inspector body.
  if (raidDraft) return <RaidBuilderCard draft={raidDraft} />

  if (entityId != null) {
    const explicitEntity = scenario.entities.find((e) => e.id === entityId)
    return explicitEntity ? (
      <EntityInspector entity={explicitEntity} />
    ) : (
      <div className="inspector-body insp">
        <EmptyState title="Entity unavailable" body="This entity is no longer on the board." />
      </div>
    )
  }

  const entity =
    selection.entityIds.length === 1
      ? scenario.entities.find((e) => e.id === selection.entityIds[0])
      : undefined
  const boundary = selection.boundaryId
    ? scenario.boundaries.find((b) => b.id === selection.boundaryId)
    : undefined
  const connection = selection.connectionId
    ? scenario.connections.find((c) => c.id === selection.connectionId)
    : undefined

  if (entity) return <EntityInspector entity={entity} />
  if (boundary) return <BoundaryInspector boundary={boundary} />
  if (connection) return <ConnectionInspector connection={connection} />
  if (selection.entityIds.length > 1) return <MultiInspector ids={selection.entityIds} />

  return (
    <div className="inspector-body insp">
      <Section label="Selection">
        <EmptyState
          title="No object selected"
          body="Select an object on the board to configure it."
        />
      </Section>
    </div>
  )
}
