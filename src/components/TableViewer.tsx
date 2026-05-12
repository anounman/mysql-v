import { useState } from 'react';
import { TableData } from '../types';

interface Props { tables: TableData[]; lastChangedTable?: string; lastChangeType?: string; }

export default function TableViewer({ tables, lastChangedTable, lastChangeType }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (name: string) => setExpanded(p => ({ ...p, [name]: !p[name] }));

  if (!tables.length) return (
    <div className="empty-state"><div className="icon">🗄️</div><p>No tables yet</p></div>
  );

  return (
    <div>
      {tables.map(table => {
        const isOpen = expanded[table.name] !== false; // default open
        const isChanged = table.name === lastChangedTable;
        return (
          <div key={table.name} className="table-card" style={isChanged ? { borderColor: 'var(--accent-orange)' } : {}}>
            <div className="table-card-header" onClick={() => toggle(table.name)} style={{ cursor: 'pointer' }}>
              <span className="table-card-name">📋 {table.name}</span>
              {isChanged && (
                <span className="tag tag-orange" style={{ fontSize: 9 }}>
                  {lastChangeType || 'changed'}
                </span>
              )}
              <span className="table-card-count">{table.rows.length} rows</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 4 }}>
                {isOpen ? '▲' : '▼'}
              </span>
            </div>
            {isOpen && (
              <div className="table-overflow">
                {table.rows.length === 0 ? (
                  <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>Empty table</div>
                ) : (
                  <table className="mini-table">
                    <thead>
                      <tr>{table.columns.map(c => <th key={c}>{c}</th>)}</tr>
                    </thead>
                    <tbody>
                      {table.rows.map((row, i) => (
                        <tr key={i}>
                          {table.columns.map(c => (
                            <td key={c}>{row[c] === null ? <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>NULL</span> : String(row[c])}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
