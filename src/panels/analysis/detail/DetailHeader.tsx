import type { CSSProperties } from 'react'
import type { ModelTag } from '../../../analysis/fidelity'
import type { Entity } from '../../../model/types'
import { Glyph } from '../../Glyph'
import { useStore } from '../../../state/store'

/** The state pill: the word, its `.status` modifier, and an inline color for a phase. */
export interface DetailPill {
  word: string
  className?: string
  style?: CSSProperties
}

/** The pane header: Back, glyph, name, state pill, the model line and the fidelity tags. */
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
  const pillClass = ['status', pill.className, 'det-pill'].filter(Boolean).join(' ')
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
      <span className={pillClass} style={pill.style}>
        {pill.word}
      </span>
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
