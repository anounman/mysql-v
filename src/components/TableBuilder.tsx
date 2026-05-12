import React, { useState } from 'react';
import { TableData } from '../types';

const SQL_TYPES = ['INTEGER', 'TEXT', 'REAL', 'BLOB', 'NUMERIC', 'VARCHAR(255)', 'BOOLEAN', 'DATE', 'FLOAT', 'BIGINT'];

interface ColumnDef {
  id: number;
  name: string;
  type: string;
  primaryKey: boolean;
  autoIncrement: boolean;
  notNull: boolean;
  unique: boolean;
  defaultVal: string;
  fkTable: string;   // foreign key → references this table
  fkColumn: string;  // foreign key → references this column
}

interface InsertRow { [col: string]: string; }

interface Props {
  tables: TableData[];
  onExecute: (sql: string) => Promise<void>;
  disabled?: boolean;
}

let colIdCounter = 1;
function newCol(): ColumnDef {
  return { id: colIdCounter++, name: '', type: 'INTEGER', primaryKey: false, autoIncrement: false, notNull: false, unique: false, defaultVal: '', fkTable: '', fkColumn: '' };
}

export default function TableBuilder({ tables, onExecute, disabled }: Props) {
  const [mode, setMode] = useState<'create' | 'insert' | 'drop' | null>(null);

  // CREATE state
  const [tableName, setTableName] = useState('');
  const [columns, setColumns] = useState<ColumnDef[]>([newCol()]);

  // INSERT state
  const [insertTarget, setInsertTarget] = useState('');
  const [insertRow, setInsertRow] = useState<InsertRow>({});

  // DROP state
  const [dropTarget, setDropTarget] = useState('');
  const [confirmDrop, setConfirmDrop] = useState(false);

  // FK expand state per column
  const [fkOpen, setFkOpen] = useState<Record<number, boolean>>({});

  function updateCol(id: number, patch: Partial<ColumnDef>) {
    setColumns(cs => cs.map(c => c.id === id ? { ...c, ...patch } : c));
  }
  function removeCol(id: number) { setColumns(cs => cs.filter(c => c.id !== id)); }
  function addCol() { setColumns(cs => [...cs, newCol()]); }
  function moveCol(id: number, dir: -1 | 1) {
    setColumns(cs => {
      const idx = cs.findIndex(c => c.id === id);
      const next = idx + dir;
      if (next < 0 || next >= cs.length) return cs;
      const copy = [...cs];
      [copy[idx], copy[next]] = [copy[next], copy[idx]];
      return copy;
    });
  }

  function buildCreateSQL(): string {
    if (!tableName.trim()) return '';
    const validCols = columns.filter(c => c.name.trim());
    if (!validCols.length) return '';

    const colDefs = validCols.map(c => {
      // Use double-quotes (SQLite standard) not backticks
      let def = `  "${c.name.trim()}" ${c.type}`;
      if (c.primaryKey) def += ' PRIMARY KEY';
      if (c.autoIncrement && c.type === 'INTEGER') def += ' AUTOINCREMENT';
      if (c.notNull && !c.primaryKey) def += ' NOT NULL';
      if (c.unique && !c.primaryKey) def += ' UNIQUE';
      if (c.defaultVal.trim()) def += ` DEFAULT ${c.defaultVal.trim()}`;
      if (c.fkTable && c.fkColumn) def += ` REFERENCES "${c.fkTable}"("${c.fkColumn}")`;
      return def;
    });
    return `CREATE TABLE "${tableName.trim()}" (\n${colDefs.join(',\n')}\n);`;
  }

  async function handleCreate() {
    const sql = buildCreateSQL();
    if (!sql) return;
    await onExecute(sql);
    setTableName('');
    setColumns([newCol()]);
    setFkOpen({});
    setMode(null);
  }

  function buildInsertSQL(): string {
    const tbl = tables.find(t => t.name === insertTarget);
    if (!tbl) return '';
    const cols = tbl.columns.filter(c => (insertRow[c] ?? '') !== '');
    if (!cols.length) return '';
    const vals = cols.map(c => {
      const v = insertRow[c] || '';
      return /^-?\d+(\.\d+)?$/.test(v) ? v : `'${v.replace(/'/g, "''")}'`;
    });
    // Use double-quotes for identifiers (SQLite standard)
    return `INSERT INTO "${insertTarget}" (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${vals.join(', ')});`;
  }

  async function handleInsert() {
    const sql = buildInsertSQL();
    if (!sql) return;
    await onExecute(sql);
    setInsertRow({});
    setMode(null);
  }

  async function handleDrop() {
    if (!dropTarget || !confirmDrop) return;
    await onExecute(`DROP TABLE IF EXISTS "${dropTarget}";`);
    setDropTarget(''); setConfirmDrop(false); setMode(null);
  }

  const createSQL = buildCreateSQL();

  return (
    <div className="table-builder">

      {/* ── ACTION BAR ──────────────────────────────── */}
      <div className="tb-action-bar">
        {[
          { id: 'create' as const, icon: '➕', label: 'New Table', danger: false, dis: false },
          { id: 'insert' as const, icon: '📝', label: 'Insert Row', danger: false, dis: tables.length === 0 },
          { id: 'drop'   as const, icon: '🗑️', label: 'Drop Table', danger: true,  dis: tables.length === 0 },
        ].map(({ id, icon, label, danger, dis }) => (
          <button
            key={id}
            className={`tb-action-btn${danger ? ' tb-danger' : ''}${mode === id ? (danger ? ' active-danger' : ' active') : ''}`}
            onClick={() => setMode(mode === id ? null : id)}
            disabled={disabled || dis}
          >
            <span className="tb-action-icon">{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* ── CREATE TABLE ─────────────────────────────── */}
      {mode === 'create' && (
        <div className="tb-form">
          <div className="tb-form-title">🏗️ Create New Table</div>

          <div className="tb-field-row">
            <label className="tb-label">Table Name</label>
            <input className="tb-input" placeholder="e.g. students" value={tableName} onChange={e => setTableName(e.target.value)} />
          </div>

          <div className="tb-columns-header">
            <span className="tb-label">Columns</span>
            <button className="btn btn-ghost btn-sm" onClick={addCol}>+ Add Column</button>
          </div>

          <div className="tb-columns-table">
            {/* Header */}
            <div className="tb-col-header-row">
              <span style={{ width: 22 }}></span>
              <span className="tbc tbc-name">Name</span>
              <span className="tbc tbc-type">Type</span>
              <span className="tbc tbc-flag" title="Primary Key">PK</span>
              <span className="tbc tbc-flag" title="Auto Increment">AI</span>
              <span className="tbc tbc-flag" title="Not Null">NN</span>
              <span className="tbc tbc-flag" title="Unique">UQ</span>
              <span className="tbc tbc-flag" title="Foreign Key">FK</span>
              <span className="tbc tbc-def">Default</span>
              <span style={{ width: 28 }}></span>
            </div>

            {columns.map((col, idx) => (
              <React.Fragment key={col.id}>
                <div className="tb-col-row">
                  <div className="tb-reorder">
                    <button className="tb-reorder-btn" onClick={() => moveCol(col.id, -1)} disabled={idx === 0}>▲</button>
                    <button className="tb-reorder-btn" onClick={() => moveCol(col.id, 1)} disabled={idx === columns.length - 1}>▼</button>
                  </div>

                  <input className="tb-input tbc-name" placeholder="col_name" value={col.name}
                    onChange={e => updateCol(col.id, { name: e.target.value })} />

                  <select className="tb-select tbc-type" value={col.type}
                    onChange={e => updateCol(col.id, { type: e.target.value, autoIncrement: e.target.value !== 'INTEGER' ? false : col.autoIncrement })}>
                    {SQL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>

                  {/* PK */}
                  <label className="tb-checkbox tbc-flag" title="Primary Key">
                    <input type="checkbox" checked={col.primaryKey}
                      onChange={e => updateCol(col.id, { primaryKey: e.target.checked })} />
                  </label>
                  {/* AI */}
                  <label className="tb-checkbox tbc-flag" title="Auto Increment">
                    <input type="checkbox" checked={col.autoIncrement} disabled={col.type !== 'INTEGER'}
                      onChange={e => updateCol(col.id, { autoIncrement: e.target.checked })} />
                  </label>
                  {/* NN */}
                  <label className="tb-checkbox tbc-flag" title="Not Null">
                    <input type="checkbox" checked={col.notNull} disabled={col.primaryKey}
                      onChange={e => updateCol(col.id, { notNull: e.target.checked })} />
                  </label>
                  {/* UQ */}
                  <label className="tb-checkbox tbc-flag" title="Unique">
                    <input type="checkbox" checked={col.unique} disabled={col.primaryKey}
                      onChange={e => updateCol(col.id, { unique: e.target.checked })} />
                  </label>
                  {/* FK toggle */}
                  <button
                    className={`tb-fk-toggle tbc-flag${col.fkTable ? ' has-fk' : ''}`}
                    title="Foreign Key"
                    onClick={() => setFkOpen(p => ({ ...p, [col.id]: !p[col.id] }))}
                  >
                    {col.fkTable ? '🔑' : '🔗'}
                  </button>

                  <input className="tb-input tbc-def" placeholder="default…" value={col.defaultVal}
                    onChange={e => updateCol(col.id, { defaultVal: e.target.value })} />

                  <button className="tb-remove-col" onClick={() => removeCol(col.id)} disabled={columns.length === 1} title="Remove">✕</button>
                </div>

                {/* FK row */}
                {fkOpen[col.id] && (
                  <div className="tb-fk-row">
                    <span className="tb-fk-label">🔑 REFERENCES</span>
                    <select
                      className="tb-select"
                      value={col.fkTable}
                      onChange={e => updateCol(col.id, { fkTable: e.target.value, fkColumn: '' })}
                      style={{ flex: 1 }}
                    >
                      <option value="">— table —</option>
                      {tables.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                    </select>
                    <span className="tb-fk-label">.</span>
                    <select
                      className="tb-select"
                      value={col.fkColumn}
                      onChange={e => updateCol(col.id, { fkColumn: e.target.value })}
                      style={{ flex: 1 }}
                      disabled={!col.fkTable}
                    >
                      <option value="">— column —</option>
                      {(tables.find(t => t.name === col.fkTable)?.columns || []).map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    {col.fkTable && col.fkColumn && (
                      <button className="tb-fk-clear" onClick={() => updateCol(col.id, { fkTable: '', fkColumn: '' })} title="Remove FK">✕</button>
                    )}
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>

          {createSQL && (
            <div className="tb-sql-preview">
              <div className="tb-preview-label">SQL Preview</div>
              <pre className="tb-preview-code">{createSQL}</pre>
            </div>
          )}

          <div className="tb-form-actions">
            <button className="btn btn-primary" onClick={handleCreate}
              disabled={!tableName.trim() || columns.every(c => !c.name.trim())}>
              ✅ Create Table
            </button>
            <button className="btn btn-ghost" onClick={() => setMode(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── INSERT ROW ───────────────────────────────── */}
      {mode === 'insert' && (
        <div className="tb-form">
          <div className="tb-form-title">📝 Insert Row</div>
          <div className="tb-field-row">
            <label className="tb-label">Table</label>
            <select className="tb-select" value={insertTarget} style={{ flex: 1 }}
              onChange={e => { setInsertTarget(e.target.value); setInsertRow({}); }}>
              <option value="">— select table —</option>
              {tables.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
            </select>
          </div>
          {insertTarget && (() => {
            const tbl = tables.find(t => t.name === insertTarget);
            if (!tbl) return null;
            return (<>
              <div className="tb-insert-grid">
                {tbl.columns.map(col => (
                  <div key={col} className="tb-field-row">
                    <label className="tb-label" style={{ minWidth: 90 }}>{col}</label>
                    <input className="tb-input" placeholder={`value for ${col}`}
                      value={insertRow[col] ?? ''}
                      onChange={e => setInsertRow(r => ({ ...r, [col]: e.target.value }))} />
                  </div>
                ))}
              </div>
              {buildInsertSQL() && (
                <div className="tb-sql-preview">
                  <div className="tb-preview-label">SQL Preview</div>
                  <pre className="tb-preview-code">{buildInsertSQL()}</pre>
                </div>
              )}
              <div className="tb-form-actions">
                <button className="btn btn-success" onClick={handleInsert}>➕ Insert Row</button>
                <button className="btn btn-ghost" onClick={() => setMode(null)}>Cancel</button>
              </div>
            </>);
          })()}
        </div>
      )}

      {/* ── DROP TABLE ───────────────────────────────── */}
      {mode === 'drop' && (
        <div className="tb-form">
          <div className="tb-form-title" style={{ color: 'var(--accent-red)' }}>🗑️ Drop Table</div>
          <div className="tb-field-row">
            <label className="tb-label">Table</label>
            <select className="tb-select" value={dropTarget} style={{ flex: 1 }}
              onChange={e => { setDropTarget(e.target.value); setConfirmDrop(false); }}>
              <option value="">— select table —</option>
              {tables.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
            </select>
          </div>
          {dropTarget && (<>
            <label className="tb-confirm-label">
              <input type="checkbox" checked={confirmDrop} onChange={e => setConfirmDrop(e.target.checked)} />
              <span>I confirm — drop <strong style={{ color: 'var(--accent-red)' }}>{dropTarget}</strong> and all its data permanently</span>
            </label>
            <div className="tb-form-actions">
              <button className="btn btn-danger" onClick={handleDrop} disabled={!confirmDrop}>🗑️ Drop Table</button>
              <button className="btn btn-ghost" onClick={() => setMode(null)}>Cancel</button>
            </div>
          </>)}
        </div>
      )}

      {/* ── TABLE LIST ───────────────────────────────── */}
      {tables.length > 0 && (
        <div className="tb-table-list">
          <div className="tb-section-label">📊 Tables in database</div>
          {tables.map(tbl => (
            <TableCard key={tbl.name} table={tbl}
              allTables={tables}
              onInsertHere={() => { setInsertTarget(tbl.name); setInsertRow({}); setMode('insert'); }}
              onDropHere={() => { setDropTarget(tbl.name); setConfirmDrop(false); setMode('drop'); }}
              onExecute={onExecute} disabled={disabled} />
          ))}
        </div>
      )}

      {tables.length === 0 && mode === null && (
        <div className="empty-state" style={{ padding: '30px 20px' }}>
          <div className="icon">🗄️</div>
          <p>No tables yet.<br />Click <strong>New Table</strong> to create one.</p>
        </div>
      )}
    </div>
  );
}

// ── Inline-editable table card ────────────────────────────────────────────────
const AC_TYPES = ['INTEGER', 'TEXT', 'REAL', 'BLOB', 'NUMERIC', 'VARCHAR(255)', 'BOOLEAN', 'DATE', 'FLOAT', 'BIGINT'];

interface AddColDef { name: string; type: string; notNull: boolean; defaultVal: string; }

interface TableCardProps {
  table: TableData;
  allTables: TableData[];
  onInsertHere: () => void;
  onDropHere: () => void;
  onExecute: (sql: string) => Promise<void>;
  disabled?: boolean;
}

function TableCard({ table, onInsertHere, onDropHere, onExecute, disabled }: TableCardProps) {
  const [open, setOpen] = useState(true);
  const [editingCell, setEditingCell] = useState<{ rowIdx: number; col: string } | null>(null);
  const [cellValue, setCellValue] = useState('');
  const [deletingRow, setDeletingRow] = useState<number | null>(null);

  // Add Column state
  const [addColOpen, setAddColOpen] = useState(false);
  const [addColDef, setAddColDef] = useState<AddColDef>({ name: '', type: 'TEXT', notNull: false, defaultVal: '' });
  const [addColLoading, setAddColLoading] = useState(false);

  async function handleAddColumn() {
    if (!addColDef.name.trim()) return;
    // SQLite ALTER TABLE ADD COLUMN limitations:
    // • Cannot have PRIMARY KEY or UNIQUE
    // • NOT NULL requires a DEFAULT value
    let colDef = `"${addColDef.name.trim()}" ${addColDef.type}`;
    if (addColDef.notNull) colDef += ' NOT NULL';
    if (addColDef.defaultVal.trim()) {
      const isNum = /^-?\d+(\.\d+)?$/.test(addColDef.defaultVal.trim());
      colDef += ` DEFAULT ${isNum ? addColDef.defaultVal.trim() : `'${addColDef.defaultVal.trim().replace(/'/g, "''")}'`}`;
    }
    setAddColLoading(true);
    await onExecute(`ALTER TABLE "${table.name}" ADD COLUMN ${colDef};`);
    setAddColLoading(false);
    setAddColDef({ name: '', type: 'TEXT', notNull: false, defaultVal: '' });
    setAddColOpen(false);
  }

  function startEdit(rowIdx: number, col: string, currentVal: unknown) {
    setEditingCell({ rowIdx, col });
    setCellValue(currentVal === null ? '' : String(currentVal));
  }

  function commitEdit(rowIdx: number) {
    if (!editingCell) return;
    const row = table.rows[rowIdx];
    // Build a unique WHERE using rowid if possible, else all columns
    // Use double-quotes for identifiers; drop LIMIT (not supported by sql.js)
    const whereParts = Object.entries(row).map(([k, v]) =>
      v === null ? `"${k}" IS NULL` : `"${k}" = '${String(v).replace(/'/g, "''")}'`
    );
    const isNum = /^-?\d+(\.\d+)?$/.test(cellValue);
    const newVal = cellValue === '' ? 'NULL' : isNum ? cellValue : `'${cellValue.replace(/'/g, "''")}'`;
    // No LIMIT — sql.js SQLite doesn't support UPDATE...LIMIT without special compile flag
    onExecute(`UPDATE "${table.name}" SET "${editingCell.col}" = ${newVal} WHERE ${whereParts.join(' AND ')};`);
    setEditingCell(null);
  }

  function deleteRow(rowIdx: number) {
    const row = table.rows[rowIdx];
    const whereParts = Object.entries(row).map(([k, v]) =>
      v === null ? `"${k}" IS NULL` : `"${k}" = '${String(v).replace(/'/g, "''")}'`
    );
    // No LIMIT — sql.js SQLite doesn't support DELETE...LIMIT without special compile flag
    onExecute(`DELETE FROM "${table.name}" WHERE ${whereParts.join(' AND ')};`);
    setDeletingRow(null);
  }

  return (
    <div className="tb-card">
      <div className="tb-card-header">
        <button className="tb-card-toggle" onClick={() => setOpen(o => !o)}>
          <span style={{ color: 'var(--accent-cyan)', fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
            {open ? '▼' : '▶'} {table.name}
          </span>
          <span className="tb-card-meta">{table.rows.length} rows · {table.columns.length} cols</span>
        </button>
        <div className="tb-card-actions">
          <button className="tb-icon-btn" title="Add column" onClick={() => setAddColOpen(o => !o)} disabled={disabled}
            style={{ color: addColOpen ? 'var(--accent-cyan)' : undefined }}>⊕</button>
          <button className="tb-icon-btn" title="Insert row" onClick={onInsertHere} disabled={disabled}>➕</button>
          <button className="tb-icon-btn tb-icon-danger" title="Drop table" onClick={onDropHere} disabled={disabled}>🗑️</button>
        </div>
      </div>

      {open && (
        <div className="tb-schema-bar">
          {table.columns.map(col => (
            <span key={col} className="tb-schema-pill">{col}</span>
          ))}
        </div>
      )}

      {/* Add Column inline form */}
      {addColOpen && (
        <div className="tb-addcol-form">
          <div className="tb-addcol-title">⊕ Add Column to <em>{table.name}</em></div>
          <div className="tb-addcol-note">
            ⚠️ SQLite limitation: new columns cannot be PRIMARY KEY or UNIQUE. NOT NULL requires a Default value.
          </div>
          <div className="tb-addcol-row">
            <input
              className="tb-input tb-addcol-name"
              placeholder="column_name"
              value={addColDef.name}
              onChange={e => setAddColDef(d => ({ ...d, name: e.target.value }))}
            />
            <select
              className="tb-select tb-addcol-type"
              value={addColDef.type}
              onChange={e => setAddColDef(d => ({ ...d, type: e.target.value }))}
            >
              {AC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <label className="tb-checkbox" title="Not Null" style={{ gap: 4, fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={addColDef.notNull}
                onChange={e => setAddColDef(d => ({ ...d, notNull: e.target.checked }))} />
              NN
            </label>
            <input
              className="tb-input tb-addcol-default"
              placeholder="default value"
              value={addColDef.defaultVal}
              onChange={e => setAddColDef(d => ({ ...d, defaultVal: e.target.value }))}
            />
            <button
              className="btn btn-primary btn-sm"
              onClick={handleAddColumn}
              disabled={!addColDef.name.trim() || addColLoading || disabled
                || (addColDef.notNull && !addColDef.defaultVal.trim())}
            >
              {addColLoading ? <span className="loading-ring" style={{ width: 12, height: 12, borderWidth: 1 }} /> : '✓'}
              Add
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setAddColOpen(false)}>✕</button>
          </div>
          {addColDef.name.trim() && (
            <div className="tb-addcol-preview">
              <code>ALTER TABLE "{table.name}" ADD COLUMN "{addColDef.name.trim()}" {addColDef.type}
                {addColDef.notNull ? ' NOT NULL' : ''}
                {addColDef.defaultVal.trim() ? ` DEFAULT ${addColDef.defaultVal.trim()}` : ''}
              </code>
            </div>
          )}
        </div>
      )}

      {open && (
        <div className="tb-data-wrap">
          {table.rows.length === 0 ? (
            <div className="tb-empty-rows">No rows — click ➕ to insert</div>
          ) : (
            <table className="tb-data-table">
              <thead>
                <tr>
                  <th className="tb-row-num">#</th>
                  {table.columns.map(c => <th key={c}>{c}</th>)}
                  <th style={{ width: 36 }}></th>
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, ri) => (
                  <tr key={ri} className={deletingRow === ri ? 'row-deleted' : ''}>
                    <td className="tb-row-num">{ri + 1}</td>
                    {table.columns.map(col => {
                      const isEditing = editingCell?.rowIdx === ri && editingCell.col === col;
                      return (
                        <td key={col} className={`tb-data-cell${isEditing ? ' editing' : ''}`}
                          onDoubleClick={() => !disabled && startEdit(ri, col, row[col])}
                          title="Double-click to edit">
                          {isEditing ? (
                            <input className="tb-cell-input" autoFocus value={cellValue}
                              onChange={e => setCellValue(e.target.value)}
                              onBlur={() => commitEdit(ri)}
                              onKeyDown={e => { if (e.key === 'Enter') commitEdit(ri); if (e.key === 'Escape') setEditingCell(null); }} />
                          ) : row[col] === null ? (
                            <span className="tb-null">NULL</span>
                          ) : String(row[col])}
                        </td>
                      );
                    })}
                    <td>
                      {deletingRow === ri ? (
                        <span style={{ display: 'flex', gap: 2 }}>
                          <button className="tb-icon-btn tb-icon-danger" onClick={() => deleteRow(ri)} style={{ fontSize: 10 }}>✓</button>
                          <button className="tb-icon-btn" onClick={() => setDeletingRow(null)} style={{ fontSize: 10 }}>✕</button>
                        </span>
                      ) : (
                        <button className="tb-icon-btn tb-icon-danger" onClick={() => setDeletingRow(ri)}
                          title="Delete row" disabled={disabled} style={{ opacity: 0.5 }}>✕</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
