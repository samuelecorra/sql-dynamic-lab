import { selectSql, tokens } from '../../engine/sql-text'
import type { ResultSet, XRay, XRayStage } from '../../types'

type Execute = (sql: string) => ResultSet
const unsupported =
  'X-Ray cannot safely derive this query. Supported: simple SELECT/JOIN, row filters, column-based GROUP BY, HAVING (including nested averages), and a two-branch EXCEPT. Your final result is still executed by SQLite.'
const identifier = '[A-Za-z_][A-Za-z_0-9]*'
const column = `${identifier}(?:\\.${identifier})?`

export function deriveXRay(input: string, execute: Execute, final: ResultSet): XRay {
  try {
    const sql = selectSql(input),
      all = tokens(sql),
      top = all.filter((t) => t.depth === 0)
    if (
      top[0]?.upper !== 'SELECT' ||
      all.some((t) => t.kind === 'quoted' && !t.text.startsWith("'")) ||
      all.some(
        (t) =>
          t.kind === 'word' &&
          [
            'OVER',
            'WINDOW',
            'RANDOM',
            'RANDOMBLOB',
            'CURRENT_TIMESTAMP',
            'CURRENT_DATE',
            'CURRENT_TIME',
            'DATE',
            'TIME',
            'DATETIME',
            'JULIANDAY',
            'UNIXEPOCH',
            'STRFTIME',
          ].includes(t.upper),
      )
    )
      return { stages: [], unavailable: unsupported }
    const setOps = top.filter((t) => ['EXCEPT', 'UNION', 'INTERSECT'].includes(t.upper))
    if (setOps.length) {
      if (
        setOps.length !== 1 ||
        setOps[0].upper !== 'EXCEPT' ||
        top.some((t) => ['LIMIT', 'ORDER'].includes(t.upper))
      )
        return { stages: [], unavailable: unsupported }
      const left = sql.slice(0, setOps[0].start),
        right = sql.slice(setOps[0].end)
      return {
        stages: [
          {
            id: 'candidates',
            label: 'CANDIDATES',
            note: 'Distinct rows in the first set, before subtracting the second set.',
            result: execute(`SELECT DISTINCT * FROM (${left})`),
            unit: 'rows',
          },
          {
            id: 'excluded',
            label: 'EXCLUDED',
            note: 'Distinct rows in the second set. EXCEPT removes any matching row from the first set.',
            result: execute(`SELECT DISTINCT * FROM (${right})`),
            unit: 'rows',
          },
          {
            id: 'final',
            label: 'FINAL',
            note: 'Set difference: candidates minus excluded rows. EXCEPT also removes duplicates.',
            result: final,
            unit: 'rows',
          },
        ],
      }
    }
    const at = (word: string) => top.find((t) => t.upper === word && t.kind === 'word')
    const from = at('FROM'),
      where = at('WHERE'),
      group = at('GROUP'),
      having = at('HAVING'),
      order = at('ORDER'),
      limit = at('LIMIT')
    if (!from) return { stages: [], unavailable: unsupported }
    const end = (start: number) =>
      Math.min(
        ...[where, group, having, order, limit]
          .filter((t) => t && t.start > start)
          .map((t) => t!.start),
        sql.length,
      )
    const projection = sql
      .slice(top[0].end, from.start)
      .trim()
      .replace(/^DISTINCT\s+/i, '')
    const projectionPattern = new RegExp(
      `^(?:\\*|${column}|(?:COUNT|SUM|AVG|MIN|MAX)\\(\\s*(?:\\*|${column})\\s*\\))(?:\\s+AS\\s+${identifier})?$`,
      'i',
    )
    if (!projection.split(',').every((p) => projectionPattern.test(p.trim())))
      return { stages: [], unavailable: unsupported }
    const aliases = [...projection.matchAll(/\bAS\s+(\w+)/gi)].map((m) => m[1].toUpperCase())
    if (all.some((t) => t.start > from.start && aliases.includes(t.upper)))
      return {
        stages: [],
        unavailable: `${unsupported} Projection aliases in earlier clauses are ambiguous.`,
      }
    const source = sql.slice(from.start, end(from.start))
    if (tokens(source).some((t) => ['SELECT', 'WITH'].includes(t.upper)))
      return { stages: [], unavailable: unsupported }
    const filter = where ? sql.slice(where.start, end(where.start)) : ''
    const grouping = group ? sql.slice(group.start, end(group.start)) : ''
    const keys = grouping.replace(/^GROUP\s+BY\s+/i, '').trim()
    if (group && !keys.split(',').every((k) => new RegExp(`^${column}$`).test(k.trim())))
      return {
        stages: [],
        unavailable: `${unsupported} Grouping expressions, positions and aliases are not expanded.`,
      }
    if (!group && (having || /\b(COUNT|SUM|AVG|MIN|MAX)\s*\(/i.test(projection)))
      return { stages: [], unavailable: unsupported }
    if (having) {
      // Bare HAVING columns can depend on SQLite's arbitrary representative row.
      // Keep this MVP deliberately narrow: one outer aggregate versus a literal
      // or an independent scalar SELECT, which covers the bundled exercises.
      const ht = sql.slice(having.end, end(having.start)).trim()
      const safeHaving = new RegExp(
        `^(?:COUNT|SUM|AVG|MIN|MAX)\\(\\s*(?:\\*|${column})\\s*\\)\\s*(?:>=|<=|<>|!=|=|>|<)\\s*(?:-?\\d+(?:\\.\\d+)?|\\(\\s*SELECT\\b[\\s\\S]*\\))$`,
        'i',
      )
      if (!safeHaving.test(ht))
        return {
          stages: [],
          unavailable: `${unsupported} This HAVING condition needs a richer parser.`,
        }
      const nested = ht.match(/\(\s*SELECT\b[\s\S]*$/i)?.[0]
      if (nested) {
        const sourceNames = [
          ...source.matchAll(/\b(?:FROM|JOIN)\s+(\w+)(?:\s+(?:AS\s+)?(\w+))?/gi),
        ].flatMap((match) => [match[1], match[2]].filter(Boolean))
        const nestedTokens = tokens(nested)
        const mayCorrelate = nestedTokens.some(
          (token, i) =>
            nestedTokens[i + 1]?.text === '.' &&
            sourceNames.some((name) => name.toUpperCase() === token.upper),
        )
        const syntax = new Set(
          'SELECT DISTINCT ALL FROM JOIN INNER LEFT RIGHT OUTER CROSS ON WHERE BETWEEN AND OR NOT IS NULL AS GROUP BY HAVING COUNT SUM AVG MIN MAX'.split(
            ' ',
          ),
        )
        const hasBareReference = nestedTokens.some((token, i) => {
          if (token.kind !== 'word' || /^\d/.test(token.text) || syntax.has(token.upper))
            return false
          const previous = nestedTokens[i - 1],
            beforePrevious = nestedTokens[i - 2],
            next = nestedTokens[i + 1]
          return (
            previous?.text !== '.' &&
            next?.text !== '.' &&
            previous?.text !== ')' &&
            !['FROM', 'JOIN', 'AS'].includes(previous?.upper ?? '') &&
            !['FROM', 'JOIN'].includes(beforePrevious?.upper ?? '')
          )
        })
        if (mayCorrelate || hasBareReference)
          return {
            stages: [],
            unavailable: `${unsupported} Potentially correlated HAVING subqueries are not expanded.`,
          }
      }
    }
    const stages: XRayStage[] = []
    const stage = (
      id: string,
      label: string,
      note: string,
      query: string,
      unit: 'rows' | 'groups' = 'rows',
    ) => stages.push({ id, label, note, result: execute(query), unit })
    stage(
      'from',
      'FROM / JOIN',
      'Build the source rows. Each matching pair in a join becomes a row.',
      `SELECT * ${source}`,
    )
    stage(
      'where',
      'WHERE',
      where ? 'WHERE filters ROWS before grouping.' : 'No WHERE clause: all source rows continue.',
      `SELECT * ${source} ${filter}`,
    )
    if (group) {
      // Only display supported aggregate expressions; never fabricate bare-column values.
      const aggregateExpressions = [
        ...sql
          .slice(0, from.start)
          .matchAll(
            /\b(?:COUNT|SUM|AVG|MIN|MAX)\(\s*(?:\*|[A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)?)\s*\)/gi,
          ),
      ].map((m) => m[0])
      // Outer HAVING aggregates are useful even when absent from the final projection.
      if (having) {
        const havingText = sql.slice(having.end, end(having.start)),
          ht = tokens(havingText)
        for (let i = 0; i < ht.length; i++) {
          if (
            ht[i].depth === 0 &&
            ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'].includes(ht[i].upper) &&
            ht[i + 1]?.text === '('
          ) {
            const close = ht.slice(i + 2).find((t) => t.text === ')' && t.depth === 0)
            if (close) aggregateExpressions.push(havingText.slice(ht[i].start, close.end))
          }
        }
      }
      const extras = [...new Set(aggregateExpressions)].filter(
        (s) => !/^COUNT\(\s*\*\s*\)$/i.test(s),
      )
      const groupSelect = `${keys}, COUNT(*) AS "Source rows"${extras.length ? ', ' + extras.join(', ') : ''}`
      stage(
        'group',
        'GROUP BY',
        'GROUP BY creates GROUPS. “Source rows” is the number of input rows in each group.',
        `SELECT ${groupSelect} ${source} ${filter} ${grouping}`,
        'groups',
      )
      stage(
        'having',
        'HAVING',
        having
          ? 'HAVING filters GROUPS after aggregation. Only passing groups remain.'
          : 'No HAVING clause: every group continues.',
        `SELECT ${groupSelect} ${source} ${filter} ${grouping} ${having ? sql.slice(having.start, end(having.start)) : ''}`,
        'groups',
      )
    }
    stages.push({
      id: 'final',
      label: 'FINAL',
      note: 'SELECT projects the requested columns. DISTINCT, ORDER BY and LIMIT apply here if present.',
      result: final,
      unit: 'rows',
    })
    return { stages }
  } catch {
    return { stages: [], unavailable: unsupported }
  }
}
