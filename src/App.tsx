import React, { useState, useEffect, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';
import './index.css';
import {
  runSql, resetDatabase, loadProject, markNotReady,
} from './engine/apiClient';
import {
  getActiveProjectId, getProject, updateProject, clearActiveProject,
} from './engine/session';
import type { Project } from './engine/session';
import { TableData, QueryResult, QueryError, VisualStep, SqlMistake } from './types';
import TableBuilder from './components/TableBuilder';
import QueryPipeline from './components/QueryPipeline';
import MistakePanel from './components/MistakePanel';
import ResultTable from './components/ResultTable';
import { useDragResize } from './hooks/useResize';
import HomePage from './pages/HomePage';

type RightTab  = 'builder' | 'mistakes';
type AppView   = 'home' | 'editor';

const MIN_LEFT   = 240;
const MIN_CENTER = 300;
const MIN_RIGHT  = 220;
const MIN_BOTTOM = 80;
const MAX_BOTTOM = 520;

export default function App() {
  const [view,     setView]     = useState<AppView>('home');
  const [project,  setProject]  = useState<Project | null>(null);

  // Panel sizes
  const [leftW,   setLeftW]   = useState(380);
  const [rightW,  setRightW]  = useState(320);
  const [bottomH, setBottomH] = useState(220);

  // Editor state
  const [code,      setCode]      = useState('');
  const [loading,   setLoading]   = useState(false);
  const [dbReady,   setDbReady]   = useState(false);
  const [tables,    setTables]    = useState<TableData[]>([]);
  const [results,   setResults]   = useState<QueryResult[]>([]);
  const [errors,    setErrors]    = useState<QueryError[]>([]);
  const [steps,     setSteps]     = useState<VisualStep[]>([]);
  const [mistakes,  setMistakes]  = useState<SqlMistake[]>([]);
  const [rightTab,  setRightTab]  = useState<RightTab>('builder');
  const [runCount,  setRunCount]  = useState(0);

  // On mount — resume the session tab had active (if any)
  useEffect(() => {
    const pid = getActiveProjectId();
    if (pid) {
      const p = getProject(pid);
      if (p) openProject(p);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openProject(p: Project) {
    setProject(p);
    setView('editor');
    setDbReady(false);
    setTables([]);
    setResults([]);
    setErrors([]);
    setSteps([]);
    setMistakes([]);
    setCode(p.editorContent ?? '');
    markNotReady();

    // Load & replay history to restore DB state
    try {
      const data = await loadProject(p.id);
      setTables(data.tables);
      setDbReady(true);
    } catch (e) {
      setErrors([{ sql: '', error: (e as Error).message }]);
    }
  }

  function goHome() {
    clearActiveProject();
    setView('home');
    setProject(null);
    setDbReady(false);
    setTables([]);
    setResults([]);
    setErrors([]);
    setSteps([]);
    setMistakes([]);
    setCode('');
    markNotReady();
  }

  // ── Drag-resize ─────────────────────────────────────────────────────────
  const dragLeft   = useDragResize('horizontal', useCallback((d: number) => setLeftW(w   => Math.max(MIN_LEFT,   w + d)), []));
  const dragRight  = useDragResize('horizontal', useCallback((d: number) => setRightW(w  => Math.max(MIN_RIGHT,  w - d)), []));
  const dragBottom = useDragResize('vertical',   useCallback((d: number) => setBottomH(h => Math.min(MAX_BOTTOM, Math.max(MIN_BOTTOM, h - d))), []));

  // ── SQL execution ────────────────────────────────────────────────────────
  const handleRun = useCallback(async (sqlOverride?: string) => {
    const q = sqlOverride ?? code;
    if (!q.trim()) return;
    setLoading(true);
    setErrors([]);
    setResults([]);
    try {
      const data = await runSql(q);
      setResults(data.results || []);
      setErrors(data.errors || []);
      setTables(data.tables || []);
      setSteps(data.steps || []);
      setMistakes(data.mistakes || []);
      setRunCount(c => c + 1);
    } catch (e: unknown) {
      setErrors([{ sql: q, error: (e as Error).message || 'Execution error' }]);
    } finally {
      setLoading(false);
    }
  }, [code]);

  const handleBuilderExec = useCallback(async (sqlStr: string) => {
    setLoading(true);
    try {
      const data = await runSql(sqlStr);
      setTables(data.tables || []);
      setErrors(data.errors || []);
      setResults(data.results || []);
    } catch (e: unknown) {
      setErrors([{ sql: sqlStr, error: (e as Error).message }]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleReset = useCallback(async () => {
    if (!confirm('Reset database? This will drop ALL tables and data from this project.')) return;
    setLoading(true);
    try {
      const data = await resetDatabase();
      setTables(data.tables || []);
      setResults([]); setErrors([]); setSteps([]); setMistakes([]);
      setCode('');
    } catch (e: unknown) {
      setErrors([{ sql: '', error: (e as Error).message }]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Save editor content on change
  const handleCodeChange = useCallback((val: string) => {
    setCode(val);
    if (project) updateProject(project.id, { editorContent: val });
  }, [project]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleRun(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleRun]);

  // ── HOME VIEW ────────────────────────────────────────────────────────────
  if (view === 'home') {
    return <HomePage onOpenProject={openProject} />;
  }

  // ── EDITOR VIEW ──────────────────────────────────────────────────────────
  const errorCount = mistakes.filter(m => m.level === 'error').length;
  const warnCount  = mistakes.filter(m => m.level === 'warning').length;

  const TABS: { id: RightTab; icon: string; label: string }[] = [
    { id: 'builder',  icon: '🏗️', label: 'Tables'  },
    { id: 'mistakes', icon: '🔎', label: 'Mistakes' },
  ];

  return (
    <div className="app-root">
      {/* ── TOP BAR ── */}
      <header className="top-bar">
        <button className="home-back-btn" onClick={goHome} title="Back to projects">
          ← Projects
        </button>
        <div className="logo">
          <span className="logo-icon">🗄️</span>
          <span className="logo-text">{project?.name ?? 'MySQL Visualizer'}</span>
          <span className="subtitle">Interactive SQL Learning</span>
        </div>
        <div className="spacer" />
        <div className="status-badge">
          <span className="status-dot" style={{
            background: dbReady ? 'var(--accent-green)' : 'var(--accent-orange)',
            animation: dbReady ? 'pulse 2s infinite' : 'spin .7s linear infinite',
          }} />
          {dbReady ? 'SQLite ready' : 'Loading WASM…'}
        </div>
        {runCount > 0 && <span className="tag tag-blue">{runCount} run{runCount !== 1 ? 's' : ''}</span>}
      </header>

      {/* ── MAIN AREA ── */}
      <div
        className="main-layout-flex"
        style={{ '--left-w': `${leftW}px`, '--right-w': `${rightW}px` } as React.CSSProperties}
      >
        {/* LEFT: Editor */}
        <aside className="left-panel" style={{ width: leftW, minWidth: MIN_LEFT }}>
          <div className="panel-header">
            <div className="panel-title">✏️ SQL Editor</div>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Ctrl+Enter to run</span>
          </div>
          <div className="editor-wrap">
            <CodeMirror
              value={code}
              height="100%"
              extensions={[sql()]}
              theme={oneDark}
              onChange={handleCodeChange}
              style={{ height: '100%' }}
              placeholder={"-- Write MySQL here…\nSELECT * FROM your_table;"}
            />
          </div>
          <div className="editor-actions">
            <button id="btn-run" className="btn btn-primary"
              onClick={() => handleRun()}
              disabled={loading || !dbReady || !code.trim()}>
              {loading ? <span className="loading-ring" /> : '▶'}
              {loading ? 'Running…' : 'Run Query'}
            </button>
            <button id="btn-reset" className="btn btn-danger" onClick={handleReset} disabled={loading}>
              🔄 Reset DB
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setCode('')}>Clear</button>
          </div>
        </aside>

        <div className="resize-divider resize-divider-v" onMouseDown={dragLeft} />

        {/* CENTER: Pipeline */}
        <main className="center-panel" style={{ minWidth: MIN_CENTER }}>
          {!dbReady && (
            <div className="info-banner">⏳ Loading SQLite WASM engine…</div>
          )}
          <QueryPipeline steps={steps} tables={tables} />
        </main>

        <div className="resize-divider resize-divider-v" onMouseDown={dragRight} />

        {/* RIGHT: Tables + Mistakes */}
        <aside className="right-panel" style={{ width: rightW, minWidth: MIN_RIGHT }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setRightTab(tab.id)}
                style={{
                  flex: 1, padding: '10px 6px', border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 11, fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '.5px',
                  background: rightTab === tab.id ? 'var(--bg-3)' : 'transparent',
                  color: rightTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
                  borderBottom: rightTab === tab.id ? '2px solid var(--accent-blue)' : '2px solid transparent',
                  transition: 'all .15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                }}>
                <span>{tab.icon}</span><span>{tab.label}</span>
                {tab.id === 'mistakes' && errorCount > 0 && <span className="tag tag-orange" style={{ marginLeft: 2 }}>{errorCount}</span>}
                {tab.id === 'mistakes' && warnCount  > 0 && <span className="tag tag-blue"   style={{ marginLeft: 2 }}>{warnCount}</span>}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {rightTab === 'builder' ? (
              <TableBuilder tables={tables} onExecute={handleBuilderExec} disabled={loading || !dbReady} />
            ) : (
              <>
                <MistakePanel mistakes={mistakes} />
                {steps.length > 0 && (
                  <>
                    <div className="section-divider" />
                    <div className="panel-header"><div className="panel-title">💡 Explanation</div></div>
                    <div className="expl-content">
                      {steps.map((step, i) => (
                        <div key={i} className="expl-item">
                          <span className="expl-stage-name">{step.stage.replace(/_/g, ' ')}:</span>
                          <span>{step.explanation}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </aside>
      </div>

      <div className="resize-divider resize-divider-h" onMouseDown={dragBottom} />

      {/* BOTTOM: Results */}
      <div className="bottom-bar" style={{ height: bottomH, minHeight: MIN_BOTTOM, maxHeight: MAX_BOTTOM }}>
        <ResultTable results={results} errors={errors} tables={tables} />
      </div>
    </div>
  );
}
