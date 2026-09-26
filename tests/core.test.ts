import { beforeAll, describe, expect, it } from 'vitest'
import initSqlJs, { type SqlJsStatic } from 'sql.js'
import { createDatabase, execute, inspect, validate } from '../src/engine/database'
import { selectSql, tokens } from '../src/engine/sql-text'
import { exercises } from '../src/exercises'
import { compareResults, rowKey } from '../src/features/validation/compare'
import { deriveXRay } from '../src/features/query-xray/xray'
import { lintExam } from '../src/features/exam-mode/lint'
import type { ResultSet } from '../src/types'

let SQL: SqlJsStatic
beforeAll(async () => {
  SQL = await initSqlJs()
})
const result = (rows: ResultSet['rows'], columns = ['value']): ResultSet => ({ columns, rows })

describe('semantic result comparison', () => {
  it('ignores row order and aliases by default', () =>
    expect(compareResults(result([[2], [1]], ['x']), result([[1], [2]], ['y'])).correct).toBe(true))
  it('keeps duplicates and emits multiset differences', () => {
    expect(compareResults(result([[1], [1], [3]]), result([[1], [2]]))).toMatchObject({
      correct: false,
      missing: [[2]],
      extra: [[1], [3]],
    })
  })
  it('honors required order', () =>
    expect(compareResults(result([[2], [1]]), result([[1], [2]]), true).correct).toBe(false))
  it('distinguishes NULL, string and number values', () => {
    expect(new Set([null, 'null', 0, '0', ''].map((v) => rowKey([v]))).size).toBe(5)
  })
  it('compares blobs by bytes', () =>
    expect(
      compareResults(result([[new Uint8Array([1, 2])]]), result([[new Uint8Array([1, 2])]]))
        .correct,
    ).toBe(true))
  it('rejects extra columns even on empty results', () =>
    expect(compareResults(result([], ['a', 'b']), result([])).correct).toBe(false))
  it('rejects truncated results', () =>
    expect(compareResults({ ...result([[1]]), truncated: true }, result([[1]])).correct).toBe(
      false,
    ))
  it('preserves column positions', () =>
    expect(compareResults(result([[1, 2]], ['a', 'b']), result([[2, 1]], ['b', 'a'])).correct).toBe(
      false,
    ))
})

describe('exercise fixtures and reset', () => {
  it.each(exercises)('canonical solution passes: $id', (exercise) =>
    expect(validate(SQL, exercise, exercise.reference).correct).toBe(true),
  )
  it.each(exercises.filter((e) => e.alternative))('alternative solution passes: $id', (exercise) =>
    expect(validate(SQL, exercise, exercise.alternative!).correct).toBe(true),
  )
  it('inspects real primary keys, foreign keys and row counts', () => {
    const db = createDatabase(SQL, exercises[0])
    const tables = inspect(db)
    expect(tables.map((t) => [t.name, t.count])).toEqual([
      ['CLIENTE', 7],
      ['ORDINE', 37],
      ['PRODOTTO', 5],
    ])
    expect(tables[0].columns[0].pk).toBe(true)
    expect(tables[1].columns.find((c) => c.name === 'CFCliente')?.fk).toBe('CLIENTE.CF')
    db.close()
  })
  it('reconstruction restores seed data after an internal destructive change', () => {
    let db = createDatabase(SQL, exercises[0])
    db.run('PRAGMA query_only = OFF; DELETE FROM ORDINE;')
    expect(execute(db, 'SELECT * FROM ORDINE').rows).toHaveLength(0)
    db.close()
    db = createDatabase(SQL, exercises[0])
    expect(execute(db, 'SELECT * FROM ORDINE').rows).toHaveLength(37)
    db.close()
  })
  it('guards the student database and requires a single read-only query', () => {
    const db = createDatabase(SQL, exercises[0])
    expect(() => execute(db, 'DELETE FROM ORDINE')).toThrow(/read-only/)
    expect(() => execute(db, 'SELECT 1; DELETE FROM ORDINE')).toThrow(/one query/)
    expect(() => execute(db, 'WITH X AS (SELECT 1) DELETE FROM ORDINE')).toThrow(/readonly/)
    expect(execute(db, 'SELECT * FROM ORDINE').rows).toHaveLength(37)
    db.close()
  })
  it('caps previews without pretending they are complete', () => {
    const db = createDatabase(SQL, exercises[0])
    const preview = execute(
      db,
      'WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<1100) SELECT x FROM n',
    )
    expect(preview.rows).toHaveLength(1000)
    expect(preview.truncated).toBe(true)
    db.close()
  })
  it('bounds large cells and SQLite memory, then remains usable', () => {
    const db = createDatabase(SQL, exercises[0])
    expect(execute(db, 'SELECT zeroblob(3000000)').truncated).toBe(true)
    expect(() => execute(db, 'SELECT zeroblob(100000000)')).toThrow(/memory/i)
    expect(execute(db, 'SELECT 1').rows).toEqual([[1]])
    db.close()
  })
})

describe('adversarial wrong solutions', () => {
  const e1 = exercises[0],
    e2 = exercises[1],
    e3 = exercises[2]
  it.each([
    ['inclusive threshold', e1.reference.replace('COUNT(*) > 5', 'COUNT(*) >= 5')],
    ['missing delivery filter', e1.reference.replace('  AND O.DataRicezione IS NULL', '')],
    ['missing shipment filter', e1.reference.replace('O.DataSpedizione IS NOT NULL\n  AND ', '')],
  ])('rejects %s', (_, query) => expect(validate(SQL, e1, query).correct).toBe(false))
  it('rejects a hardcoded visible answer on the second dataset', () => {
    expect(validate(SQL, e1, "SELECT 'Mario', 'Rossi', 'mario.rossi@example.test'")).toMatchObject({
      correct: false,
      failedDataset: 2,
    })
  })
  it('rejects an average of individual purchase prices', () => {
    const wrong = `SELECT O.CFCliente FROM ORDINE O JOIN PRODOTTO P ON O.CodProdotto=P.Codice
    WHERE O.Data BETWEEN '2025-01-01' AND '2025-12-31' GROUP BY O.CFCliente
    HAVING SUM(P.Prezzo) > (SELECT AVG(P2.Prezzo) FROM ORDINE O2 JOIN PRODOTTO P2 ON O2.CodProdotto=P2.Codice WHERE O2.Data BETWEEN '2025-01-01' AND '2025-12-31')`
    expect(validate(SQL, e2, wrong).correct).toBe(false)
  })
  it('excludes mixed payments and the customer without orders', () => {
    const db = createDatabase(SQL, e3)
    expect(execute(db, e3.reference).rows.flat()).toEqual([
      'BNCNNA85B42F205Y',
      'RCCGIA88G07F205T',
      'RSSMRA80A01F205X',
    ])
    expect(
      validate(
        SQL,
        e3,
        "SELECT DISTINCT CFCliente FROM ORDINE WHERE MetodoPagamento = 'Carta di credito'",
      ).correct,
    ).toBe(false)
    expect(
      validate(
        SQL,
        e3,
        "SELECT CF FROM CLIENTE EXCEPT SELECT CFCliente FROM ORDINE WHERE MetodoPagamento <> 'Carta di credito'",
      ).correct,
    ).toBe(false)
    db.close()
  })
  it('rejects omitting the year filter from both spending calculations', () => {
    const wrong = e2.reference.replaceAll(
      /WHERE O2?\.Data BETWEEN '2025-01-01' AND '2025-12-31'/g,
      '',
    )
    expect(validate(SQL, e2, wrong).correct).toBe(false)
  })
  it('rejects including customers without 2025 orders in the average', () => {
    const wrong =
      e2.reference.split('HAVING')[0] +
      `HAVING SUM(P.Prezzo) > (
      SELECT SUM(P2.Prezzo) / (SELECT COUNT(*) FROM CLIENTE)
      FROM ORDINE O2 JOIN PRODOTTO P2 ON O2.CodProdotto = P2.Codice
      WHERE O2.Data BETWEEN '2025-01-01' AND '2025-12-31'
    )`
    expect(validate(SQL, e2, wrong)).toMatchObject({ correct: false, failedDataset: 2 })
  })
})

describe('Query X-Ray and scanner', () => {
  const trace = (query: string) => {
    const db = createDatabase(SQL, exercises[0])
    try {
      return deriveXRay(query, (sql) => execute(db, sql), execute(db, query))
    } finally {
      db.close()
    }
  }
  it('tracks the exact row/group pipeline for exercise 1', () => {
    const xray = trace(exercises[0].reference)
    expect(xray.unavailable).toBeUndefined()
    expect(xray.stages.map((s) => [s.id, s.result.rows.length])).toEqual([
      ['from', 37],
      ['where', 19],
      ['group', 5],
      ['having', 1],
      ['final', 1],
    ])
    expect(xray.stages[2].unit).toBe('groups')
    expect(xray.stages[2].result.rows.find((r) => r[0] === 'RSSMRA80A01F205X')?.at(-1)).toBe(6)
  })
  it('keeps nested average clauses within HAVING and exposes spending totals', () => {
    const xray = trace(exercises[1].reference)
    expect(xray.unavailable).toBeUndefined()
    expect(xray.stages.map((s) => s.result.rows.length)).toEqual([37, 35, 5, 2, 2])
    expect(xray.stages[2].result.columns).toContain('SUM(P.Prezzo)')
    expect(
      xray.stages[2].result.rows.map((r) => r[2]).sort((a, b) => Number(a) - Number(b)),
    ).toEqual([50, 70, 240, 640, 1800])
  })
  it('shows candidate and excluded sets for EXCEPT', () =>
    expect(trace(exercises[2].reference).stages.map((s) => s.result.rows.length)).toEqual([
      6, 3, 3,
    ]))
  it('does not mistake literals, escaped strings or comments for clauses', () => {
    expect(
      tokens("SELECT 'WHERE ''GROUP BY''', \"FROM\" /* HAVING */ FROM CLIENTE -- EXCEPT\n")
        .filter((t) => t.kind === 'word')
        .map((t) => t.upper),
    ).toEqual(['SELECT', 'FROM', 'CLIENTE'])
    const query = `SELECT C.Nome FROM CLIENTE C WHERE C.Nome <> 'GROUP BY' /* HAVING */`
    expect(trace(query).stages.map((s) => s.result.rows.length)).toEqual([7, 7, 7])
    expect(selectSql("SELECT ';'; -- comment")).toBe("SELECT ';'")
  })
  it.each([
    'SELECT Nome, ROW_NUMBER() OVER () FROM CLIENTE',
    'SELECT Nome FROM CLIENTE GROUP BY 1',
    'SELECT Nome AS Person FROM CLIENTE GROUP BY Person',
    'SELECT Nome FROM CLIENTE UNION SELECT Nome FROM CLIENTE',
    exercises[1].alternative!,
    'SELECT COUNT(*) FROM ORDINE',
    'SELECT * FROM (SELECT * FROM CLIENTE)',
    "SELECT Nome FROM CLIENTE GROUP BY Nome HAVING Cognome = 'Rossi'",
    "SELECT Nome FROM CLIENTE WHERE DATE('now') > '2020-01-01'",
    'SELECT O.CFCliente FROM ORDINE O GROUP BY O.CFCliente HAVING COUNT(*) > (SELECT COUNT(*) FROM ORDINE O2 WHERE O2.CodProdotto = O.CodProdotto)',
    'SELECT O.CFCliente FROM ORDINE O GROUP BY O.CFCliente HAVING COUNT(*) > (SELECT Id)',
  ])('safely declines unsupported grammar: %s', (query) =>
    expect(trace(query).unavailable).toBeTruthy(),
  )
  it('rejects unbalanced text', () => {
    expect(() => tokens("SELECT 'hi")).toThrow(/Incomplete/)
    expect(() => tokens('SELECT (1')).toThrow(/Incomplete/)
  })
})

describe('Exam Mode warnings', () => {
  it('flags lowercase without changing semantic correctness', () => {
    const query = exercises[0].reference.toLowerCase()
    expect(lintExam(query).map((w) => w.code)).toContain('uppercase')
    expect(validate(SQL, exercises[0], query).correct).toBe(true)
  })
  it('keeps a semantically valid CTE correct under NO CTE', () => {
    expect(lintExam(exercises[1].alternative!, true).map((w) => w.code)).toContain('no-cte')
    expect(validate(SQL, exercises[1], exercises[1].alternative!).correct).toBe(true)
  })
  it('checks DISTINCT, SELECT 1, GROUP BY and VIEW as warnings', () => {
    expect(lintExam('SELECT DISTINCT 1 FROM CLIENTE GROUP BY Nome').map((w) => w.code)).toEqual([
      'distinct',
      'group',
    ])
    expect(lintExam('SELECT 1 FROM CLIENTE').map((w) => w.code)).toContain('select-one')
    expect(lintExam('CREATE VIEW X AS SELECT * FROM CLIENTE').map((w) => w.code)).toContain('view')
  })
  it('ignores keywords in strings and comments', () =>
    expect(lintExam("SELECT 'select with distinct' FROM CLIENTE -- select 1\n")).toEqual([]))
})
