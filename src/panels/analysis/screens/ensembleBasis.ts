import { formatTime } from '../../../geometry/geo'
import { runSettings } from '../../../model/types'
import { useStore } from '../../../state/store'
import { currentSummary } from '../widgets/mc'

export function useEnsembleBasis(): string {
  const mcState = useStore(state => state.mc)
  const runId = useStore(state => state.playback.runId)
  const scenario = useStore(state => state.scenario)
  const mc = currentSummary(mcState, runId)
  return mc
    ? `Monte Carlo · ${mc.replicates} replicates · ${runSettings(scenario).uncertainty === 'total' ? 'Total uncertainty' : 'Aleatory uncertainty'} · seed ${mc.seed} · full run ${formatTime(mc.durationS)}`
    : 'Monte Carlo · No current ensemble result.'
}
