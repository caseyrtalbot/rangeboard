import { useState } from 'react'
import type { LibraryGrade, LibraryLayer, Override } from '../../model/libraryField'
import type { Provenance, SpecModel, Spread } from '../../model/types'
import { basisFor, specFields } from '../../model/types'
import { modelsInUse, spreadFor } from '../../analysis/parameterBasis'
import type { LoadNotice } from '../../io/persist'
import { loadNoticeFor } from '../../io/persist'
import { useOverrides } from '../../state/overrides'
import { useStore } from '../../state/store'
import { Field } from '../../ui/kit'

/** Columns of the field table; the edit form spans them. */
const COLUMNS = 8

/** A library field value: the contract split is number, tuple of numbers, or null. */
type FieldValue = number | number[] | null

/** Grade and layer of a value with no lineage of its own, by the row's basis. */
const DERIVED: Record<Provenance['basis'], { grade: LibraryGrade; layer: LibraryLayer }> = {
  datasheet: { grade: 'MANUFACTURER_CLAIM', layer: 'L1' },
  reference: { grade: 'REPORTED', layer: 'L1' },
  pf: { grade: 'INFERRED', layer: 'L2' },
}

function isFieldValue(value: unknown): value is FieldValue {
  if (value === null || typeof value === 'number') return true
  return Array.isArray(value) && value.length > 0 && value.every((v) => typeof v === 'number')
}

/** The spec keys this tab lists, in spec order: every key the contract calls a field. */
function fieldsOf(model: SpecModel): Array<[string, FieldValue]> {
  const entries = Object.entries(specFields(model))
  return entries.filter((entry): entry is [string, FieldValue] => isFieldValue(entry[1]))
}

/** The provenance row of one field, when the model records one. */
function rowFor(model: SpecModel, field: string): Provenance | undefined {
  return model.provenance?.find((r) => r.field === field)
}

/** Recorded grade and layer, else derived: a null value is unknown, otherwise the basis decides. */
function lineage(model: SpecModel, field: string, value: FieldValue, row: Provenance | undefined) {
  const derived: { grade: LibraryGrade; layer: LibraryLayer } =
    value === null ? { grade: 'UNKNOWN', layer: 'L3' } : DERIVED[basisFor(model, field)]
  return { grade: row?.grade ?? derived.grade, layer: row?.layer ?? derived.layer }
}

/** Where the value comes from: the row's source, else a planning factor, else nothing at all. */
function sourceText(row: Provenance | undefined, value: FieldValue): string {
  if (row?.source) return row.source
  return value === null ? 'unknown' : 'planning factor'
}

/** What a total-uncertainty replicate samples for this field. */
function spreadLabel(spread: Spread | null): string {
  if (!spread) return 'fixed'
  if (spread.kind === 'lognormal') return `lognormal ±${spread.sigmaDb} dB`
  if (spread.kind === 'triangular') return `triangular ${spread.lo}..${spread.hi}`
  return `beta ${spread.successes}/${spread.trials}`
}

function valueText(value: unknown, unit?: string): string {
  if (value === null || value === undefined) return '—'
  const text = Array.isArray(value) ? value.join(', ') : String(value)
  return unit ? `${text} ${unit}` : text
}

/**
 * The fields the load filled from the seed library, as `modelId/field`
 * keys (`loadNoticeFor`). Each one gets a chip naming the data package the
 * value came from, so an adopted value is never read as the user's own.
 */
function adoptedFields(notice: LoadNotice | null): Set<string> {
  const out = new Set<string>()
  for (const entry of notice?.adopted ?? []) {
    for (const key of entry.keys) out.add(`${entry.modelId}/${key}`)
  }
  return out
}

/** Draft parts of a field: one number for a scalar, one per element for a tuple. */
function draftParts(value: FieldValue): string[] {
  if (Array.isArray(value)) return value.map(String)
  return [value === null ? '' : String(value)]
}

/**
 * The edit form of one field: a number input per element, a required reason and
 * Apply. Mounted per field, so the draft never survives a different field.
 */
function EditRow({
  model,
  field,
  value,
  onDone,
}: {
  model: SpecModel
  field: string
  value: FieldValue
  onDone: () => void
}) {
  const [parts, setParts] = useState(() => draftParts(value))
  const [reason, setReason] = useState('')
  const setOverride = useOverrides((s) => s.setOverride)
  const numbers = parts.map(Number)
  const ready = reason.trim() !== '' && parts.every((p) => p.trim() !== '') && numbers.every(Number.isFinite)

  function apply(event: React.FormEvent) {
    event.preventDefault()
    if (!ready) return
    setOverride(model.id, field, numbers.length === 1 ? numbers[0] : numbers, reason)
    onDone()
  }

  return (
    <tr>
      <td colSpan={COLUMNS}>
        <form className="field-row systems-edit" onSubmit={apply}>
          {parts.map((part, i) => (
            <Field key={i} label={parts.length === 1 ? `${field} value` : `${field} value ${i + 1}`}>
              <input
                type="number"
                step="any"
                value={part}
                onChange={(e) => setParts(parts.map((p, at) => (at === i ? e.target.value : p)))}
              />
            </Field>
          ))}
          <Field label={`Reason for the ${field} override`}>
            <input type="text" required value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <button type="submit" className="mini" disabled={!ready}
            aria-label={`Apply the ${field} override on ${model.name}`}>
            Apply
          </button>
          <button type="button" className="mini" onClick={onDone}
            aria-label={`Cancel the ${field} override on ${model.name}`}>
            Cancel
          </button>
        </form>
      </td>
    </tr>
  )
}

/** One field row: the library value and its lineage, then the override beside it. */
function FieldRow({
  model,
  field,
  value,
  override,
  editing,
  onEdit,
  seedVersion,
}: {
  model: SpecModel
  field: string
  value: FieldValue
  override: Override | undefined
  editing: boolean
  onEdit: (field: string | null) => void
  /** Data package version when this load adopted the value, else null. */
  seedVersion: number | null
}) {
  const resetField = useOverrides((s) => s.resetField)
  const row = rowFor(model, field)
  const { grade, layer } = lineage(model, field, value, row)
  return (
    <>
      <tr>
        <td className="prose">{field}</td>
        <td>
          {valueText(value, row?.unit)}
          {seedVersion != null && (
            <> <span className="chip det" title="This load filled the field from the seed library">
              seed v{seedVersion}
            </span></>
          )}
        </td>
        <td>{override ? `override ${valueText(override.value, row?.unit)}` : '—'}</td>
        <td className="prose">{grade}</td>
        <td>{layer}</td>
        <td className="prose" title={row?.date}>{sourceText(row, value)}</td>
        <td className="prose">{spreadLabel(spreadFor(model, field))}</td>
        <td className="systems-actions">
          <button type="button" className="mini" aria-label={`Edit ${field} on ${model.name}`}
            onClick={() => onEdit(editing ? null : field)}>
            Edit
          </button>
          {override && (
            <button type="button" className="mini" aria-label={`Reset ${field} on ${model.name}`}
              onClick={() => resetField(model.id, field)}>
              Reset
            </button>
          )}
        </td>
      </tr>
      {editing && <EditRow model={model} field={field} value={value} onDone={() => onEdit(null)} />}
    </>
  )
}

/** One library model in use, with every field the contract calls a field. */
function ModelGroup({ model, overrides, notice }: {
  model: SpecModel
  overrides: Override[]
  notice: LoadNotice | null
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const resetModel = useOverrides((s) => s.resetModel)
  const fields = fieldsOf(model)
  const mine = overrides.filter((o) => o.modelId === model.id)
  const adopted = adoptedFields(notice)
  return (
    <section className="systems-group" aria-label={model.name}>
      <div className="systems-head">
        <h4>{model.name}</h4>
        <button type="button" className="mini" disabled={mine.length === 0}
          aria-label={`Reset every override on ${model.name}`} onClick={() => resetModel(model.id)}>
          Reset system
        </button>
      </div>
      {fields.length === 0 && <p className="systems-empty">This model carries no numeric field.</p>}
      {fields.length > 0 && (
        <table className="tb tb-dense systems-tb" aria-label={`${model.name} fields`}>
          <thead>
            <tr>
              <th>Field</th>
              <th>Value</th>
              <th>Override</th>
              <th>Grade</th>
              <th>Layer</th>
              <th>Source</th>
              <th>Spread</th>
              <th>Edit</th>
            </tr>
          </thead>
          <tbody>
            {fields.map(([field, value]) => (
              <FieldRow key={field} model={model} field={field} value={value} editing={editing === field}
                override={mine.find((o) => o.field === field)} onEdit={setEditing}
                seedVersion={adopted.has(`${model.id}/${field}`) ? notice!.dataPackageVersion : null} />
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

/**
 * Systems: every library field of every model an active entity uses, with its
 * grade, layer, source and spread. An override never edits the scenario
 * library; it sits beside the source value and carries the reason it was made.
 */
export function SystemsTab() {
  const scenario = useStore((s) => s.scenario)
  const overrides = useOverrides((s) => s.overrides)
  const resetAll = useOverrides((s) => s.resetAll)
  const inUse = modelsInUse(scenario)
  const models = scenario.library.filter((m) => inUse.has(m.id))
  // The load notice is not scenario state: persist.ts keeps it by model object,
  // so it follows the installed library and clears with New or another load.
  const notice = loadNoticeFor(scenario.library)

  return (
    <>
      {notice && (
        <p className="systems-count">
          Load adopted {notice.fields} seed {notice.fields === 1 ? 'field' : 'fields'} on{' '}
          {notice.models} builtin {notice.models === 1 ? 'model' : 'models'} from data package v
          {notice.dataPackageVersion}
        </p>
      )}
      <div className="systems-head">
        <span className="systems-count">
          {models.length} {models.length === 1 ? 'system' : 'systems'} in use, {overrides.length}{' '}
          {overrides.length === 1 ? 'override' : 'overrides'}
        </span>
        <button type="button" className="mini" disabled={overrides.length === 0}
          aria-label="Reset every override" onClick={resetAll}>
          Reset all
        </button>
      </div>
      {models.length === 0 ? (
        <p className="systems-empty">No system is in use. Place a sensor, effector or threat on the board.</p>
      ) : (
        models.map((model) => (
          <ModelGroup key={model.id} model={model} overrides={overrides} notice={notice} />
        ))
      )}
    </>
  )
}
