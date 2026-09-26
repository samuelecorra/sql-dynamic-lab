import type { ResultSet } from '../types'
import { Table2 } from 'lucide-react'
export function DataGrid({
  data,
  empty = 'No rows returned. Try adjusting your filters.',
}: {
  data: ResultSet
  empty?: string
}) {
  return (
    <div className="data-grid">
      <table>
        <thead>
          <tr>
            <th className="row-index">#</th>
            {data.columns.map((column, i) => (
              <th key={i}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, i) => (
            <tr key={i}>
              <td className="row-index">{i + 1}</td>
              {row.map((cell, j) => (
                <td key={j}>
                  {cell === null ? (
                    <span className="null-value">NULL</span>
                  ) : cell instanceof Uint8Array ? (
                    `[BLOB ${cell.length} bytes]`
                  ) : (
                    String(cell)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!data.rows.length && (
        <div className="empty-state small">
          <Table2 size={25} />
          <span>{empty}</span>
        </div>
      )}
      {data.truncated && (
        <p className="notice warning">
          Preview truncated at a safety limit: 1,000 rows, 20,000 cells or 2 MiB. Narrow your query.
        </p>
      )}
    </div>
  )
}
