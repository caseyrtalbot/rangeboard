/**
 * Decision evidence package (MASTER-FORMS). Title
 * block, acceptance statuses, then each section's resolved text (frozen once
 * delivered) as preformatted text.
 */

import { runEvidenceLabel } from '../validate'
import { previewPackage } from '../calc/package'
import type { TeCampaign } from '../model/types'
import { PRow, PSection } from './PrintOverlay'

export function PackagePrint({ campaign }: { campaign: TeCampaign }) {
  const pkg = campaign.evidencePackage

  return (
    <article className="p-doc">
      <div className="p-ribbon">
        <span>
          <b>DECISION EVIDENCE PACKAGE</b> {campaign.code}
        </span>
        <span>{campaign.name}</span>
        <span>Delivered: {pkg.deliveredAt ?? 'not delivered'}</span>
      </div>
      <h2>Decision evidence package</h2>
      {campaign.illustrative && <p className="p-illustrative">ILLUSTRATIVE: every value is notional.</p>}

      <PSection title="Title page">
        <PRow label="Campaign" value={`${campaign.code}: ${campaign.name}`} />
        <PRow label="Decision owner" value={campaign.decision.authorizedDecisionOwner} />
        <PRow label="Decision date" value={campaign.decision.decisionDate} />
        <PRow label="Method acceptance" value={pkg.methodAcceptance || 'not recorded'} />
        <PRow label="Evidence acceptance" value={pkg.evidenceAcceptance || 'not recorded'} />
        <PRow label="Final authority and date" value={pkg.finalAuthorityAndDate || 'not recorded'} />
      </PSection>

      <PSection title="Finding evidence status">
        {campaign.findings.map(f => <div key={f.id}>
          <h3>{f.id}</h3>
          {[...new Set([...f.supportingRunIds, ...f.contradictingRunIds])].map(id => {
            const run = campaign.runs.find(r => r.id === id)
            return <PRow key={id} label={id} value={run ? runEvidenceLabel(run) : 'missing run'} />
          })}
        </div>)}
      </PSection>
      {previewPackage(campaign).map((s) => (
        <PSection key={s.n} n={s.n} title={s.title}>
          <div className="p-value">{s.text || 'Not completed.'}</div>
        </PSection>
      ))}
    </article>
  )
}
