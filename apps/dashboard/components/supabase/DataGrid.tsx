'use client';

import React from 'react';

interface DataGridProps {
  columns: string[];
  rows: Record<string, any>[];
  loading?: boolean;
  onRowClick?: (row: Record<string, any>) => void;
}

export function DataGrid({ columns, rows, loading, onRowClick }: DataGridProps) {
  if (loading) {
    return (
      <div className="glass rounded-xl p-8 flex flex-col items-center justify-center border border-white/[0.06] text-text-muted text-xs">
        <div className="h-6 w-6 border-2 border-accent-violet border-t-transparent rounded-full animate-spin mb-3" />
        Fetching database records...
      </div>
    );
  }

  if (!columns.length) {
    return (
      <div className="glass rounded-xl py-12 px-4 text-center border border-white/[0.06] text-text-muted text-xs">
        No columns or rows returned from this query.
      </div>
    );
  }


  return (
    <div className="glass rounded-xl border border-white/[0.06] overflow-hidden">
      <div className="overflow-x-auto max-h-[480px]">
        <table className="w-full text-left text-xs text-text-primary border-collapse">
          <thead className="sticky top-0 bg-[#0d0f17] border-b border-white/[0.08] text-text-muted uppercase text-[10px] tracking-wider z-10">
            <tr>
              {columns.map((col) => (
                <th key={col} className="px-4 py-3 font-semibold whitespace-nowrap border-r border-white/[0.04] last:border-r-0">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-text-faint italic font-sans text-xs">
                  0 rows returned from this table / query result.
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr
                  key={idx}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`hover:bg-white/[0.04] transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                >

                {columns.map((col) => {
                  const val = row[col];
                  const displayVal =
                    val === null
                      ? 'null'
                      : typeof val === 'object'
                      ? JSON.stringify(val)
                      : String(val);

                  return (
                    <td
                      key={col}
                      className="px-4 py-2.5 max-w-xs truncate border-r border-white/[0.04] last:border-r-0 font-mono text-[11px]"
                    >
                      {val === null ? (
                        <span className="italic text-text-faint text-[10px]">null</span>
                      ) : (
                        displayVal
                      )}
                    </td>
                  );
                })}
              </tr>
            ))
            )}
          </tbody>

        </table>
      </div>
    </div>
  );
}
