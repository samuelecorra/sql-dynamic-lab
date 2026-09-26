import type { Database, SqlJsStatic } from 'sql.js'
import type { Exercise, ResultSet, TableInfo, Validation } from '../types'
import { selectSql } from './sql-text'
import { compareResults } from '../features/validation/compare'

export const ROW_LIMIT = 1000
const BYTE_LIMIT = 2 * 1024 * 1024
const CELL_LIMIT = 20000
export function createDatabase(
  SQL: SqlJsStatic,
  exercise: Exercise,
  seed = exercise.seedSql,
): Database {
  const db = new SQL.Database()
  try {
    db.run(
      'PRAGMA foreign_keys = ON; PRAGMA hard_heap_limit = 33554432; PRAGMA temp_store = MEMORY;',
    )
    db.run(exercise.schemaSql)
    db.run(seed)
    db.run('PRAGMA query_only = ON;')
    return db
  } catch (error) {
    db.close()
    throw error
  }
}
export function execute(db: Database, input: string): ResultSet {
  const sql = selectSql(input)
  const statement = db.prepare(sql)
  try {
    const columns = statement.getColumnNames(),
      rows: ResultSet['rows'] = []
    let bytes = 0
    while (statement.step()) {
      if (rows.length === ROW_LIMIT) return { columns, rows, truncated: true }
      const row = statement.get()
      bytes += row.reduce<number>(
        (total, value) =>
          total +
          (typeof value === 'string'
            ? value.length * 2
            : value instanceof Uint8Array
              ? value.byteLength
              : 8),
        0,
      )
      if (bytes > BYTE_LIMIT || (rows.length + 1) * columns.length > CELL_LIMIT)
        return { columns, rows, truncated: true }
      rows.push(row)
    }
    return { columns, rows }
  } finally {
    statement.free()
  }
}
export function inspect(db: Database): TableInfo[] {
  const tables =
    db.exec(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )[0]?.values ?? []
  return tables.map(([name]) => {
    const quoted = '"' + String(name).replaceAll('"', '""') + '"'
    const info = db.exec(`PRAGMA table_info(${quoted})`)[0].values
    const fks = db.exec(`PRAGMA foreign_key_list(${quoted})`)[0]?.values ?? []
    return {
      name: String(name),
      count: Number(db.exec(`SELECT COUNT(*) FROM ${quoted}`)[0].values[0][0]),
      columns: info.map((row) => ({
        name: String(row[1]),
        type: String(row[2]),
        pk: !!row[5],
        fk: fks
          .find((fk) => fk[3] === row[1])
          ?.slice(2, 5)
          .filter((_, i) => i !== 1)
          .join('.'),
      })),
    }
  })
}
export function validate(SQL: SqlJsStatic, exercise: Exercise, query: string): Validation {
  const seeds = [exercise.seedSql, ...exercise.validationSeeds]
  for (let i = 0; i < seeds.length; i++) {
    const db = createDatabase(SQL, exercise, seeds[i])
    try {
      const actual = execute(db, query),
        expected = execute(db, exercise.reference)
      const comparison = compareResults(actual, expected, exercise.orderMatters)
      if (!comparison.correct)
        return { ...comparison, datasets: seeds.length, failedDataset: i + 1 }
    } finally {
      db.close()
    }
  }
  return {
    correct: true,
    missing: [],
    extra: [],
    message: `Correct on all ${seeds.length} datasets. Your query matches the expected values and duplicate counts.`,
    datasets: seeds.length,
  }
}
