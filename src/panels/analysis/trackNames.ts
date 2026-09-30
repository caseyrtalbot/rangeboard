/**
 * D3: when every track name in a table shares a prefix, the head shows it once and
 * each row shows the rest. The prefix ends at the last space or hyphen inside the
 * shared text, so a row keeps a whole word or number. Fewer than two names, or no
 * shared break, give an empty prefix and the names unchanged.
 */
export function splitCommonPrefix(names: readonly string[]): { prefix: string; rest: string[] } {
  const none = { prefix: '', rest: [...names] }
  if (names.length < 2) return none
  let shared = names[0]
  for (const name of names) {
    let i = 0
    while (i < shared.length && i < name.length && shared[i] === name[i]) i++
    shared = shared.slice(0, i)
  }
  const cut = Math.max(shared.lastIndexOf(' '), shared.lastIndexOf('-')) + 1
  // A cut that would leave a row empty keeps the whole names.
  if (cut === 0 || names.some((name) => name.length <= cut)) return none
  return { prefix: names[0].slice(0, cut), rest: names.map((name) => name.slice(cut)) }
}
