import React, { useState } from 'react';
import { VisualStep, TableData } from '../types';

interface Props { steps: VisualStep[]; tables: TableData[]; }

const STAGE_ICONS: Record<string, string> = {
  FROM: '📂', JOIN: '🔗', SUBQUERY: '🔄', WHERE: '🔍',
  GROUP_BY: '📦', HAVING: '🎯', SELECT: '✨', ORDER_BY: '🔢',
  LIMIT: '✂️', INSERT: '➕', UPDATE: '✏️', DELETE: '🗑️',
};

const ORDER_FLOW = ['FROM','JOIN','SUBQUERY','WHERE','GROUP_BY','HAVING','SELECT','ORDER_BY','LIMIT','INSERT','UPDATE','DELETE'];

function MiniTable({ data, limit = 8 }: { data: TableData; limit?: number }) {
  if (!data || data.rows.length === 0) return <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '6px 0' }}>No data</div>;
  const rows = data.rows.slice(0, limit);
  return (
    <div className="mini-table-wrap">
      <table className="mini-table">
        <thead><tr>{data.columns.map(c => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>{rows.map((row, i) => (
          <tr key={i}>{data.columns.map(c => <td key={c}>{row[c] === null ? <i style={{ color: 'var(--text-muted)' }}>NULL</i> : String(row[c])}</td>)}</tr>
        ))}</tbody>
      </table>
      {data.rows.length > limit && <div style={{ padding: '4px 10px', fontSize: 11, color: 'var(--text-muted)' }}>+{data.rows.length - limit} more rows…</div>}
    </div>
  );
}

function JoinVisual({ step, tables }: { step: VisualStep; tables: TableData[] }) {
  if (!step.joinInfo?.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {step.joinInfo.map((ji, i) => {
        const leftTable = tables[0];
        const rightTableName = ji.table.replace(/[^a-z0-9_]/gi, '').split(' ')[0];
        const rightTable = tables.find(t => t.name.toLowerCase() === rightTableName.toLowerCase()) || tables[i + 1];
        return (
          <div key={i}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
              <span className="tag tag-purple">{ji.type}</span> ON <code className="expl-code">{ji.condition}</code>
            </div>
            <div className="join-visual">
              <div className="join-table-box">
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>LEFT: {leftTable?.name}</div>
                {leftTable && <MiniTable data={leftTable} limit={5} />}
              </div>
              <div className="join-arrow">⟺</div>
              <div className="join-table-box">
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>RIGHT: {ji.alias || rightTableName}</div>
                {rightTable && <MiniTable data={rightTable} limit={5} />}
              </div>
            </div>
            <div className="join-condition-pill">ON {ji.condition}</div>
          </div>
        );
      })}
    </div>
  );
}

function GroupByVisual({ step, tables }: { step: VisualStep; tables: TableData[] }) {
  // Find likely source table
  const bankTable = tables.find(t => t.name === 'bank_statements') || tables[0];
  if (!bankTable) return null;
  // Group by person
  const groups: Record<string, { rows: Record<string, unknown>[]; income: number[] }> = {};
  for (const row of bankTable.rows) {
    const person = String(row['person'] || row[bankTable.columns[1]] || '?');
    const date = String(row['date'] || row[bankTable.columns[2]] || '');
    const year = date.slice(0, 4) || '?';
    const key = `person=${person}, year=${year}`;
    if (!groups[key]) groups[key] = { rows: [], income: [] };
    groups[key].rows.push(row);
    const inc = Number(row['income'] || row[bankTable.columns[bankTable.columns.length - 1]] || 0);
    groups[key].income.push(inc);
  }
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
        Grouping by: <code className="expl-code">{step.groupByClause}</code>
      </div>
      <div className="group-buckets">
        {Object.entries(groups).map(([key, g]) => (
          <div key={key} className="group-bucket">
            <div className="group-bucket-key">🪣 {key}</div>
            {g.income.map((v, i) => <div key={i} className="group-bucket-row">income = {v}</div>)}
            <div className="group-bucket-agg">SUM = {g.income.reduce((a, b) => a + b, 0)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StageCard({ step, tables, index: _index }: { step: VisualStep; index: number; tables: TableData[] }) {
  const [open, setOpen] = useState(true);
  return (
    <div className={`stage-card stage-${step.stage}`}>
      <div className="stage-header" onClick={() => setOpen(o => !o)}>
        <div className="stage-badge">{STAGE_ICONS[step.stage] || '⚙️'}</div>
        <div style={{ flex: 1 }}>
          <div className="stage-title">{step.title}</div>
        </div>
        <span className={`stage-chevron ${open ? 'open' : ''}`}>▼</span>
      </div>
      {open && (
        <div className="stage-body">
          <div className="stage-explanation">{step.explanation}</div>

          {step.stage === 'FROM' && step.tables && step.tables.map(t => (
            <div key={t.name} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                Table: <code className="expl-code">{t.name}</code> — {t.rows.length} rows
              </div>
              <MiniTable data={t} />
            </div>
          ))}

          {step.stage === 'JOIN' && <JoinVisual step={step} tables={tables} />}

          {step.stage === 'GROUP_BY' && <GroupByVisual step={step} tables={tables} />}

          {step.condition && (
            <div className="formula-box">Condition: {step.condition}</div>
          )}
          {step.columns && step.stage === 'SELECT' && (
            <div className="formula-box">Columns: {step.columns}</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function QueryPipeline({ steps, tables }: Props) {
  if (!steps.length) {
    return (
      <div>
        <div className="pipeline-label">Logical Query Pipeline</div>
        <div className="empty-state" style={{ marginTop: 20 }}>
          <div className="icon">🚀</div>
          <p>Run a query to see the pipeline visualized here</p>
        </div>
      </div>
    );
  }

  // Show execution order flow
  const stageNames = steps.map(s => s.stage);
  return (
    <div className="pipeline-container">
      <div className="pipeline-label">
        Logical Query Pipeline — {steps.length} stage{steps.length !== 1 ? 's' : ''}
      </div>

      {/* Step dots */}
      <div className="step-counter">
        {ORDER_FLOW.filter(s => stageNames.includes(s as VisualStep['stage'])).map((s, i) => (
          <React.Fragment key={s}>
            <div className="step-dot done" title={s} />
            {i < stageNames.length - 1 && <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>→</div>}
          </React.Fragment>
        ))}
      </div>

      {steps.map((step, i) => (
        <React.Fragment key={i}>
          {i > 0 && <div className="pipeline-arrow">↓</div>}
          <StageCard step={step} tables={tables} index={i} />
        </React.Fragment>
      ))}

      {/* Show expected execution order reminder */}
      <div className="info-banner" style={{ fontSize: 11 }}>
        📚 <strong>SQL Execution Order:</strong> FROM → JOIN → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT
      </div>
    </div>
  );
}
