/** The headless load boundary; the fill it shares with the Board lives in `io/scenarioFill.ts`. */
import type { Scenario } from '../model/types'
import { fillScenarioReport } from '../io/scenarioFill'

/** Validate the shape, fill fields a save may omit, then check the references. */
export function loadScenario(parsed: unknown): Scenario {
  return fillScenarioReport(parsed).scenario
}

/** Parse a scenario JSON text through the load boundary. */
export function parseScenarioJson(raw: string): Scenario {
  return loadScenario(JSON.parse(raw))
}
