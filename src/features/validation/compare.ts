import type { Cell, Comparison, ResultSet } from '../../types'

export function rowKey(row: Cell[]): string {
  // Type tags prevent NULL, "null", 0 and "0" from collapsing together.
  return JSON.stringify(
    row.map((v) =>
      v instanceof Uint8Array ? ['blob', Array.from(v)] : [v === null ? 'null' : typeof v, v],
    ),
  )
}
function subtract(a: Cell[][], b: Cell[][]): Cell[][] {
  const counts = new Map<string, number>()
  b.forEach((row) => {
    const key = rowKey(row)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  })
  return a.filter((row) => {
    const key = rowKey(row),
      count = counts.get(key) ?? 0
    if (count) {
      counts.set(key, count - 1)
      return false
    }
    return true
  })
}
export function compareResults(
  actual: ResultSet,
  expected: ResultSet,
  orderMatters = false,
): Comparison {
  if (actual.truncated || expected.truncated)
    return {
      correct: false,
      missing: [],
      extra: [],
      message:
        'Result exceeds a grading safety limit (1,000 rows, 20,000 cells or 2 MiB). Narrow your query.',
    }
  if (actual.columns.length !== expected.columns.length)
    return {
      correct: false,
      missing: expected.rows,
      extra: actual.rows,
      message: `Expected ${expected.columns.length} columns, received ${actual.columns.length}. Return the requested columns in the stated order.`,
    }
  const missing = subtract(expected.rows, actual.rows),
    extra = subtract(actual.rows, expected.rows)
  const sameOrder =
    !orderMatters || actual.rows.every((r, i) => rowKey(r) === rowKey(expected.rows[i] ?? []))
  const correct = !missing.length && !extra.length && sameOrder
  return {
    correct,
    missing,
    extra,
    message: correct
      ? 'Your result matches the reference.'
      : !sameOrder && !missing.length && !extra.length
        ? 'The rows match, but their order does not.'
        : `${missing.length} missing · ${extra.length} unexpected. Duplicates count as separate rows.`,
  }
}
