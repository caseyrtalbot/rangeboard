/**
 * Adaptive next-run priority, Field Guide ratio form (MASTER-CALCULATIONS 3.9).
 * Advisory only; the score informs judgment and never overrides mission or
 * safety context. Inputs are High/Medium/Low scores on a 1..3 scale.
 */

export function adaptivePriority(
  importance: number,
  uncertaintyReduction: number,
  likelihood: number,
  burden: number,
): number {
  return (importance * uncertaintyReduction * likelihood) / burden
}
