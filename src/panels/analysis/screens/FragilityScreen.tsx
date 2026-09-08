import { useEnsembleBasis } from './ensembleBasis'

export function FragilityScreen() {
  const basis = useEnsembleBasis()
  return (
    <section className="analysis-primary" aria-label="Fragility">
      <h3>Fragility</h3>
      <p className="analysis-scope">{basis}</p>
      <p className="muted small">Ensemble and sensitivity details will appear here.</p>
    </section>
  )
}
