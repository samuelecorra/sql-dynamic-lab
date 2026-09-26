export interface Token {
  text: string
  upper: string
  start: number
  end: number
  depth: number
  kind: 'word' | 'quoted' | 'symbol'
}

// A lexical scanner, not a SQL parser. Clause boundaries must ignore strings,
// comments and nested SELECTs; unsupported grammar stays SQLite's responsibility.
export function tokens(sql: string): Token[] {
  if (sql.length > 64000)
    throw new Error('Query exceeds the 64,000-character limit. Use a smaller query.')
  const result: Token[] = []
  let i = 0,
    depth = 0
  while (i < sql.length) {
    const start = i,
      c = sql[i]
    if (/\s/.test(c)) {
      i++
      continue
    }
    if (sql.startsWith('--', i)) {
      while (i < sql.length && sql[i] !== '\n') i++
      continue
    }
    if (sql.startsWith('/*', i)) {
      const end = sql.indexOf('*/', i + 2)
      if (end < 0) throw new Error('Incomplete SQL comment.')
      i = end + 2
      continue
    }
    let kind: Token['kind'] = 'symbol'
    if (["'", '"', '`', '['].includes(c)) {
      const close = c === '[' ? ']' : c
      i++
      let closed = false
      while (i < sql.length) {
        if (sql[i] === close) {
          if (sql[i + 1] === close && c !== '[') {
            i += 2
            continue
          }
          i++
          closed = true
          break
        }
        i++
      }
      if (!closed) throw new Error('Incomplete quoted text.')
      kind = 'quoted'
    } else if (/[A-Za-z_0-9]/.test(c)) {
      i++
      while (i < sql.length && /[A-Za-z_0-9$]/.test(sql[i])) i++
      kind = 'word'
    } else {
      i++
    }
    if (c === ')') depth--
    if (depth < 0) throw new Error('Unexpected closing parenthesis.')
    const text = sql.slice(start, i)
    result.push({ text, upper: text.toUpperCase(), start, end: i, depth, kind })
    if (c === '(') depth++
  }
  if (depth) throw new Error('Incomplete parentheses.')
  return result
}

export function selectSql(sql: string): string {
  const list = tokens(sql)
  if (!list.length) throw new Error('Write a SELECT query to begin.')
  if (!['SELECT', 'WITH'].includes(list[0].upper))
    throw new Error(
      'This lab accepts read-only SELECT or WITH queries. The exercise database is protected.',
    )
  const separators = list.filter((t) => t.text === ';')
  if (separators.length > 1 || (separators.length === 1 && separators[0] !== list.at(-1)))
    throw new Error('Run one query at a time.')
  return sql.slice(0, separators[0]?.start ?? sql.length).trim()
}

export function isIncomplete(message: string): boolean {
  return /incomplete|syntax error|write a SELECT/i.test(message)
}
