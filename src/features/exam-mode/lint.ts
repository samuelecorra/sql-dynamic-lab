import { tokens } from '../../engine/sql-text'
export interface ExamWarning {
  code: string
  message: string
}
const keywords = new Set(
  'SELECT FROM WHERE JOIN LEFT RIGHT INNER OUTER CROSS ON USING GROUP BY HAVING ORDER ASC DESC LIMIT OFFSET AS AND OR NOT NULL IS IN EXISTS BETWEEN LIKE DISTINCT ALL UNION EXCEPT INTERSECT WITH CASE WHEN THEN ELSE END COUNT SUM AVG MIN MAX CREATE VIEW'.split(
    ' ',
  ),
)
export function lintExam(sql: string, noCte = false): ExamWarning[] {
  try {
    const list = tokens(sql).filter((t) => t.kind === 'word'),
      words = list.map((t) => t.upper),
      warnings: ExamWarning[] = []
    if (list.some((t) => keywords.has(t.upper) && t.text !== t.upper))
      warnings.push({
        code: 'uppercase',
        message: 'Write SQL keywords in UPPERCASE for exam consistency.',
      })
    if (words.includes('DISTINCT'))
      warnings.push({
        code: 'distinct',
        message:
          'Check whether DISTINCT is necessary. It may hide duplicate-producing joins; it can also be legitimate.',
      })
    if (list.some((t, i) => t.upper === 'SELECT' && list[i + 1]?.text === '1'))
      warnings.push({
        code: 'select-one',
        message:
          'Course convention: prefer a meaningful column to SELECT 1. In EXISTS, either is semantically valid.',
      })
    if (words.includes('VIEW'))
      warnings.push({
        code: 'view',
        message: 'Avoid VIEW-based solutions. Submit one self-contained SELECT.',
      })
    if (noCte && words.includes('WITH'))
      warnings.push({
        code: 'no-cte',
        message:
          'NO CTE exercise: use a nested query in the exam. A WITH solution may still be semantically correct.',
      })
    const top = list.filter((t) => t.depth === 0).map((t) => t.upper)
    if (top.includes('GROUP'))
      warnings.push({
        code: 'group',
        message:
          'Review GROUP BY: include the customer identity and all non-aggregated selected columns. SQLite permits ambiguous bare columns.',
      })
    return warnings
  } catch {
    return []
  }
}
