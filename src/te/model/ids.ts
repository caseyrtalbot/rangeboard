/**
 * Controlled-record identifier grammar (MASTER-DATAMODEL section 2).
 * Canonical pattern: VLK-<campaign code>-<type code>-<sequence>.
 * The version lives on the record ('v1.0' style), not inside the id, so links
 * stay stable across versions. Runs are versionless by doctrine.
 * Sequences are per campaign and per type, monotonic, and never reused.
 */

export const TYPE_CODES = [
  'DEC',
  'Q',
  'CLM',
  'UNK',
  'ASM',
  'HYP',
  'M',
  'THR',
  'COND',
  'CFG',
  'FAC',
  'MTX',
  'TC',
  'RUN',
  'DEV',
  'ANOM',
  'CHG',
  'FIND',
  'ACT',
  'CHK',
  'GNG',
  'DBF',
  'FRM',
  'ROLE',
  'AUTH',
  'REG',
  'SCH',
  'FEA',
] as const

export type TypeCode = (typeof TYPE_CODES)[number]

/** Sequence width per the worked examples: TC-014, RUN-0037 style. */
function pad(n: number, code: TypeCode): string {
  return String(n).padStart(code === 'RUN' ? 4 : 3, '0')
}

export interface IdAllocation {
  id: string
  seq: Record<string, number>
}

/**
 * Allocate the next identifier for a record type. Returns the id and the
 * updated sequence map; the caller stores the map back on the campaign.
 */
export function nextId(
  seq: Record<string, number>,
  campaignCode: string,
  code: TypeCode,
): IdAllocation {
  const n = (seq[code] ?? 0) + 1
  const clean = campaignCode.replace(/[^A-Za-z0-9]+/g, '').toUpperCase() || 'CAMP'
  return {
    id: `VLK-${clean}-${code}-${pad(n, code)}`,
    seq: { ...seq, [code]: n },
  }
}

/** Version strings are 'v<major>.<minor>'. */
export function parseVersion(v: string): { major: number; minor: number } {
  const m = /^v(\d+)\.(\d+)$/.exec(v)
  if (!m) return { major: 1, minor: 0 }
  return { major: Number(m[1]), minor: Number(m[2]) }
}

/** Major bump: the planned method or meaning changed. */
export function bumpMajor(v: string): string {
  return `v${parseVersion(v).major + 1}.0`
}

/** Minor bump: clarity improved without changing meaning or execution. */
export function bumpMinor(v: string): string {
  const { major, minor } = parseVersion(v)
  return `v${major}.${minor + 1}`
}

/** Display form joins the stable id with the record's current version. */
export function displayId(id: string, version?: string | null): string {
  return version ? `${id}-${version}` : id
}
