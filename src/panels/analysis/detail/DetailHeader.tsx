import { useContext, type CSSProperties } from 'react'
import type { ModelTag } from '../../../analysis/fidelity'
import type { Entity } from '../../../model/types'
import { Glyph } from '../../Glyph'
import { useStore } from '../../../state/store'
import { IconInfo } from '../../../ui/icons'
import { State } from '../../../ui/kit'
import type { StateTone } from '../../../ui/kit'
import { DetailOverviewContext } from './DetailNavigation'

/** The state: the word, its tone, and an inline colour for a track phase. */
interface DetailPill {
  word: string
  tone?: StateTone
  style?: CSSProperties
}

/** A 24 px (i): the title holds the text. */
export function InfoButton({ label, title }: { label: string; title: string }) {
  return (
    <button type="button" className="det-info" aria-label={label} title={title}>
      <IconInfo />
    </button>
  )
}

/**
 * The pane header: Back, glyph, name, state and the model line, then one Model basis
 * row whose (i) lists the models behind this entity.
 */
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
  /** Fidelity tags of the models behind this entity. Empty or absent draws no row. */
  tags?: ModelTag[]
}) {
  const clearSelection = useStore((s) => s.clearSelection)
  const onOverview = useContext(DetailOverviewContext)
  const basis = [...new Set((tags ?? []).flatMap((tag) => [tag.tier, tag.validation]))].join(' · ')
  return (
    <>
      <div className="det-h">
        <button
          className="mini det-back"
          aria-label="Back to overview"
          onClick={onOverview ?? clearSelection}
        >
          ‹ Back
        </button>
        <Glyph kind={entity.kind} color={color} size={16} />
        <span className="det-n">{entity.name}</span>
        <State tone={pill.tone ?? 'inactive'} style={pill.style}>
          {pill.word}
        </State>
        <span className="det-m">{modelLine}</span>
      </div>
      {tags != null && tags.length > 0 ? (
        <div className="row det-basis">
          <span className="rl">Model basis</span>
          <span className="det-basis-v">{basis}</span>
          <InfoButton
            label="About model basis"
            title={tags.map((tag) => `${tag.label} · ${tag.tier} · ${tag.validation}`).join('\n')}
          />
        </div>
      ) : null}
    </>
  )
}
