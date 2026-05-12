import { QueryResult, QueryError, TableData } from '../types';

interface Props {
  results: QueryResult[];
  errors: QueryError[];
  tables: TableData[];
}

export default function ResultTable({ results, errors }: Props) {
  return (
    <div className="result-section">
      {errors.map((e, i) => (
        <div key={i} className="error-banner">
          ❌ <strong>Error:</strong> {e.error}<br />
          <span style={{ color: 'var(--text-muted)', fontSize: 11, fontFamily: "'JetBrains Mono',monospace" }}>{e.sql}</span>
        </div>
      ))}

      {results.map((r, i) => (
        <div key={i} style={{ marginBottom: 16 }}>
          {r.type === 'SELECT' && r.rows && (
            <>
              <div className="result-header">
                <span className="result-title">📊 Query Result</span>
                <span className="result-count">{r.rowCount} row{r.rowCount !== 1 ? 's' : ''}</span>
                {r.rowCount === 0 && <span className="tag tag-orange">Empty result</span>}
              </div>
              {r.rows.length > 0 ? (
                <div className="result-table-wrap">
                  <table className="result-table">
                    <thead>
                      <tr>{r.columns!.map(c => <th key={c}>{c}</th>)}</tr>
                    </thead>
                    <tbody>
                      {r.rows.map((row, ri) => (
                        <tr key={ri}>
                          {r.columns!.map(c => (
                            <td key={c} className={row[c] === null ? 'null-val' : ''}>
                              {row[c] === null ? 'NULL' : String(row[c])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="info-banner">ℹ️ Query ran successfully but returned 0 rows.</div>
              )}
            </>
          )}

          {r.type === 'INSERT' && (
            <div className="success-banner">
              ✅ <strong>INSERT</strong> — 1 row added (rowid: {String(r.lastInsertRowid)})
            </div>
          )}
          {r.type === 'UPDATE' && (
            <div className="success-banner">
              ✅ <strong>UPDATE</strong> — {r.changes} row{r.changes !== 1 ? 's' : ''} modified
            </div>
          )}
          {r.type === 'DELETE' && (
            <div className="success-banner">
              ✅ <strong>DELETE</strong> — {r.changes} row{r.changes !== 1 ? 's' : ''} removed
            </div>
          )}
          {r.type === 'DDL' && (
            <div className="success-banner">✅ <strong>DDL</strong> statement executed successfully</div>
          )}
        </div>
      ))}

      {results.length === 0 && errors.length === 0 && (
        <div className="empty-state">
          <div className="icon">⬆️</div>
          <p>Run a query to see results here</p>
        </div>
      )}

      {/* Trace */}
      {(results.length > 0 || errors.length > 0) && (
        <div style={{ marginTop: 14 }}>
          <div className="trace-label">Query Trace</div>
          <div className="trace-list">
            {results.map((r, i) => (
              <div key={i} className="trace-item">
                <span className="trace-step">#{i + 1}</span>
                <span className="trace-sql">{r.type}</span>
                <span className="trace-ok">✓ ok</span>
              </div>
            ))}
            {errors.map((e, i) => (
              <div key={`e${i}`} className="trace-item">
                <span className="trace-step">ERR</span>
                <span className="trace-sql">{e.sql.slice(0, 60)}...</span>
                <span className="trace-err">✗ {e.error.slice(0, 40)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
