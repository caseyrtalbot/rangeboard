import type { CSSProperties } from 'react'
import type { ModelTag } from '../../../analysis/fidelity'
import type { Entity } from '../../../model/types'
import { Glyph } from '../../Glyph'
import { useStore } from '../../../state/store'
import { State } from '../../../ui/kit'
import type { StateTone } from '../../../ui/kit'

/** The state: the word, its tone, and an inline colour for a track phase. */
export interface DetailPill {
  word: string
  tone?: StateTone
  style?: CSSProperties
}

/** The pane header: Back, glyph, name, state, the model line and the fidelity tags. */
export function DetailHeader({
  entity,
  color,
  pill,
  modelLine,
  tags,
}: {
  entity: Entity
  color: string
  pill: DetailPill
  modelLine: string
  /** Fidelity tags of the models behind this entity. Empty or absent draws none. */
  tags?: ModelTag[]
}) {
  const clearSelection = useStore((s) => s.clearSelection)
  return (
    <div className="det-h">
      <button
        className="mini det-back"
        aria-label="Back to the lens stack"
        onClick={clearSelection}
      >
        ‹ Back
      </button>
      <Glyph kind={entity.kind} color={color} size={16} />
      <span className="det-n">{entity.name}</span>
      <State tone={pill.tone ?? 'inactive'} style={pill.style}>
        {pill.word}
      </State>
      <span className="det-m">{modelLine}</span>
      {tags != null && tags.length > 0 ? (
        <div className="fid-tags">
          {tags.map((tag) => (
            <span
              className="fid-tag"
              key={tag.id}
              data-tier={tag.tier}
              data-validation={tag.validation}
              title={tag.note}
            >
              {tag.label} · {tag.tier} · {tag.validation}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
