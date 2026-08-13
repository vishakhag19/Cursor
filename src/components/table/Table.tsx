import type { ReactNode } from 'react'

export interface TableColumn {
  key: string
  header: string
}

export interface TableProps {
  columns: TableColumn[]
  rows: Record<string, ReactNode>[]
}

export function Table({ columns, rows }: TableProps) {
  return (
    <table className="ds-table">
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.key} scope="col">
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {columns.map((col) => (
              <td key={col.key}>{row[col.key]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
