/**
 * Public API — runs entirely in-browser using sql.js.
 * Integrates with the session system to persist DB history per project.
 */
import { initDb, replayHistory, run, query, resetDb, getAllTables } from './db';
import { adaptMySQL, splitStatements } from './adapter';
import { analyzeQuery, detectMistakes } from './analyzer';
import {
  getActiveProjectId, getProject,
  recordStatement, updateProject,
} from './session';
import type { RunResponse, TableData } from '../types';

let ready = false;

/** Load the database — fresh or from saved project history. */
export async function loadProject(projectId: string): Promise<{ tables: TableData[] }> {
  const project = getProject(projectId);
  if (project && project.history.length > 0) {
    await replayHistory(project.history);
  } else {
    await initDb();
  }
  ready = true;
  return { tables: getAllTables() };
}

async function ensureReady() {
  if (ready) return;
  await initDb();
  ready = true;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getTables(): Promise<{ tables: TableData[] }> {
  await ensureReady();
  return { tables: getAllTables() };
}

export async function runSql(sql: string): Promise<RunResponse> {
  await ensureReady();

  const adapted = adaptMySQL(sql);
  const stmts = splitStatements(adapted);
  const originalStmts = splitStatements(sql);

  const results = [];
  const errors  = [];

  const projectId = getActiveProjectId();

  for (let i = 0; i < stmts.length; i++) {
    const stmt  = stmts[i];
    const upper = stmt.toUpperCase().trim();
    try {
      if (upper.startsWith('SELECT')) {
        const { columns, rows } = query(stmt);
        results.push({ type: 'SELECT' as const, columns, rows, rowCount: rows.length, sql: stmt });
      } else {
        const { changes } = run(stmt);
        const type = upper.startsWith('INSERT') ? 'INSERT' as const
          : upper.startsWith('UPDATE') ? 'UPDATE' as const
          : upper.startsWith('DELETE') ? 'DELETE' as const
          : 'DDL' as const;
        results.push({ type, changes, sql: stmt });

        // Persist to project history (DDL + DML only, not SELECT)
        if (projectId) {
          recordStatement(projectId, stmt);
        }
      }
    } catch (e) {
      errors.push({ sql: originalStmts[i] || stmt, error: (e as Error).message });
    }
  }

  const tables   = getAllTables();
  const mainStmt = originalStmts.find(s => s.toUpperCase().trim().startsWith('SELECT'))
    ?? originalStmts[originalStmts.length - 1] ?? '';

  // Update project metadata
  if (projectId) {
    updateProject(projectId, {
      tableCount: tables.length,
      runCount: (getProject(projectId)?.runCount ?? 0) + 1,
    });
  }

  const { type: queryType, steps } = analyzeQuery(mainStmt, tables);
  const mistakes = detectMistakes(mainStmt);

  return { results, errors, tables, steps, queryType, mistakes };
}

export async function resetDatabase(): Promise<{ tables: TableData[] }> {
  await resetDb();
  ready = true;

  // Clear the history for the active project too
  const projectId = getActiveProjectId();
  if (projectId) {
    updateProject(projectId, { history: [], tableCount: 0, runCount: 0 });
  }

  return { tables: getAllTables() };
}

export function markReady() {
  ready = true;
}

export function markNotReady() {
  ready = false;
}

export async function getStepAnalysis(sql: string) {
  await ensureReady();
  const tables = getAllTables();
  return {
    steps: analyzeQuery(sql, tables).steps,
    queryType: analyzeQuery(sql, tables).type,
    mistakes: detectMistakes(sql),
  };
}
