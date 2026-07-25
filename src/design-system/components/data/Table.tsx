import type { ReactNode } from "react";

export interface TableColumn<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  rows: (T & { id?: string | number })[];
  className?: string;
}

/** Table — glass data table. Pass a `render` per column for custom cells (avatars, status dots, etc.). */
export function Table<T extends Record<string, unknown>>({ columns, rows, className = "" }: TableProps<T>) {
  return (
    <div className={`bd-table-wrap ${className}`.trim()}>
      <table className="bd-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id ?? i}>
              {columns.map((c) => (
                <td key={c.key}>{c.render ? c.render(row) : (row[c.key] as ReactNode)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
