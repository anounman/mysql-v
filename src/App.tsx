import React, { useState, useEffect, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';
import './index.css';
import { runSql, resetDatabase, getTables } from './engine/apiClient';
import { DEMO_QUERY, EXAMPLE_QUERIES } from './engine/demoDatabase';
import { TableData, QueryResult, QueryError, VisualStep, SqlMistake } from './types';
import TableViewer from './components/TableViewer';
import QueryPipeline from './components/QueryPipeline';
import MistakePanel from './components/MistakePanel';
import ResultTable from './components/ResultTable';

export default function App() {
  const [code, setCode] = useState(DEMO_QUERY);
  const [loading, setLoading] = useState(false);
  const [tables, setTables] = useState<TableData[]>([]);
  const [results, setResults] = useState<QueryResult[]>([]);
  const [errors, setErrors] = useState<QueryError[]>([]);
  const [steps, setSteps] = useState<VisualStep[]>([]);
  const [mistakes, setMistakes] = useState<SqlMistake[]>([]);
  const [queryType, setQueryType] = useState('');
  const [serverOk, setServerOk] = useState(false);
  const [lastChanged, setLastChanged] = useState<{ table?: string; type?: string }>({});
  const [rightTab, setRightTab] = useState<'tables' | 'mistakes'>('tables');
  const [runCount, setRunCount] = useState(0);

  // Check server and load tables on mount
  useEffect(() => {
    getTables()
      .then(data => { setTables(data.tables); setServerOk(true); })
      .catch(() => setServerOk(false));
  }, []);

  const handleRun = useCallback(async () => {
    if (!code.trim()) return;
    setLoading(true);
    setErrors([]);
    setResults([]);
    try {
      const data = await runSql(code);
      setResults(data.results || []);
      setErrors(data.errors || []);
      setTables(data.tables || []);
      setSteps(data.steps || []);
      setMistakes(data.mistakes || []);
      setQueryType(data.queryType || '');
      setRunCount(c => c + 1);

      // Detect what changed for highlighting
      const changeResult = data.results?.find((r: QueryResult) =>
        r.type === 'INSERT' || r.type === 'UPDATE' || r.type === 'DELETE'
      );
      if (changeResult) {
        setLastChanged({ type: changeResult.type });
      }

      // Auto-switch to tables tab after DML
      if (data.queryType !== 'SELECT') setRightTab('tables');
    } catch (e: unknown) {
      setErrors([{ sql: code, error: (e as Error).message || 'Backend unreachable' }]);
    } finally {
      setLoading(false);
    }
  }, [code]);

  const handleReset = useCallback(async () => {
    setLoading(true);
    try {
      const data = await resetDatabase();
      setTables(data.tables || []);
      setResults([]);
      setErrors([]);
      setSteps([]);
      setMistakes([]);
      setCode(DEMO_QUERY);
      setLastChanged({});
    } catch (e: unknown) {
      setErrors([{ sql: '', error: (e as Error).message }]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleRun();
    }
  }, [handleRun]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const errorCount = mistakes.filter(m => m.level === 'error').length;
  const warnCount = mistakes.filter(m => m.level === 'warning').length;

  return (
    <div className="app-root">
      {/* ── TOP BAR ── */}
      <header className="top-bar">
        <div className="logo">
          <span className="logo-icon">🗄️</span>
          <span className="logo-text">MySQL Visualizer</span>
          <span className="subtitle">Interactive SQL Learning</span>
        </div>
        <div className="spacer" />
        <div className="status-badge">
          <span className="status-dot" style={{ background: serverOk ? 'var(--accent-green)' : 'var(--accent-red)' }} />
          {serverOk ? 'Backend connected' : 'Backend offline — start with npm run dev'}
        </div>
        {runCount > 0 && (
          <span className="tag tag-blue">{runCount} run{runCount !== 1 ? 's' : ''}</span>
        )}
      </header>

      <div className="main-layout">
        {/* ══ LEFT: Editor ══ */}
        <aside className="left-panel">
          <div className="panel-header">
            <div className="panel-title">✏️ SQL Editor</div>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Ctrl+Enter to run</span>
          </div>

          {/* Example queries */}
          <div className="examples-bar">
            {EXAMPLE_QUERIES.map((q, i) => (
              <span key={i} className="example-chip" onClick={() => setCode(q.sql)} title={q.sql}>
                {q.label}
              </span>
            ))}
          </div>

          {/* Editor */}
          <div className="editor-wrap">
            <CodeMirror
              value={code}
              height="100%"
              extensions={[sql()]}
              theme={oneDark}
              onChange={setCode}
              style={{ height: '100%' }}
            />
          </div>

          {/* Actions */}
          <div className="editor-actions">
            <button
              id="btn-run"
              className="btn btn-primary"
              onClick={handleRun}
              disabled={loading || !serverOk}
            >
              {loading ? <span className="loading-ring" /> : '▶'}
              {loading ? 'Running…' : 'Run Query'}
            </button>
            <button
              id="btn-reset"
              className="btn btn-danger"
              onClick={handleReset}
              disabled={loading}
            >
              🔄 Reset DB
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setCode('')}>Clear</button>
          </div>
        </aside>

        {/* ══ CENTER: Pipeline ══ */}
        <main className="center-panel">
          {!serverOk && (
            <div className="error-banner">
              ⚠️ Backend not running. Open a terminal and run: <code style={{ fontFamily: "'JetBrains Mono',monospace", marginLeft: 6 }}>npm run dev</code>
            </div>
          )}
          <QueryPipeline steps={steps} tables={tables} />
        </main>

        {/* ══ RIGHT: Tables + Mistakes ══ */}
        <aside className="right-panel">
          {/* Tab switcher */}
          <div className="panel-header" style={{ padding: '0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', width: '100%' }}>
              {(['tables', 'mistakes'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setRightTab(tab)}
                  style={{
                    flex: 1, padding: '10px 8px', border: 'none', cursor: 'pointer',
                    fontFamily: 'inherit', fontSize: 11, fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: '.6px',
                    background: rightTab === tab ? 'var(--bg-3)' : 'transparent',
                    color: rightTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
                    borderBottom: rightTab === tab ? '2px solid var(--accent-blue)' : '2px solid transparent',
                    transition: 'all .15s',
                  }}
                >
                  {tab === 'tables' ? '🗄️ Tables' : (
                    <span>
                      🔎 Mistakes
                      {errorCount > 0 && <span className="tag tag-orange" style={{ marginLeft: 4 }}>{errorCount}</span>}
                      {warnCount > 0 && <span className="tag tag-blue" style={{ marginLeft: 2 }}>{warnCount}</span>}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {rightTab === 'tables' ? (
            <TableViewer
              tables={tables}
              lastChangedTable={lastChanged.table}
              lastChangeType={lastChanged.type}
            />
          ) : (
            <MistakePanel mistakes={mistakes} />
          )}

          {/* Explanation always shown below */}
          <div className="section-divider" />
          <div className="panel-header">
            <div className="panel-title">💡 Explanation</div>
          </div>
          <div className="expl-content">
            {steps.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Run a query to see stage-by-stage explanations here.</div>
            ) : (
              steps.map((step, i) => (
                <div key={i} className="expl-item">
                  <span className="expl-stage-name">{step.stage.replace('_', ' ')}:</span>
                  <span>{step.explanation}</span>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>

      {/* ══ BOTTOM: Results ══ */}
      <div className="bottom-bar">
        <ResultTable results={results} errors={errors} tables={tables} />
      </div>
    </div>
  );
}
