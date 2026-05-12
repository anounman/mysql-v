/**
 * Browser-side SQL engine using sql.js (SQLite compiled to WebAssembly).
 * Runs 100% in-browser — no backend server required.
 * Each call to initDb() / resetDb() creates a fresh in-memory DB for the tab.
 */
import type { TableData } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let SQL: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any = null;

/** Load sql.js WASM and return the SQL class (cached after first load). */
async function getSql() {
  if (SQL) return SQL;
  // @ts-ignore — sql.js CJS/ESM interop varies by bundler
  const mod = await import('sql.js');
  const initSqlJs = mod.default ?? mod;
  SQL = await initSqlJs({ locateFile: (_file: string) => '/sql-wasm.wasm' });
  return SQL;
}

/** Create a fresh empty database. */
export async function initDb(): Promise<void> {
  const S = await getSql();
  if (db) { try { db.close(); } catch { /* ignore */ } }
  db = new S.Database();
}

/** Replay a list of DDL/DML statements to rebuild DB state from history. */
export async function replayHistory(statements: string[]): Promise<void> {
  await initDb();
  for (const stmt of statements) {
    try { db.run(stmt); } catch { /* ignore errors in history replay */ }
  }
}

/** Run a non-SELECT statement. Returns rows changed. */
export function run(sql: string): { changes: number } {
  if (!db) throw new Error('Database not initialised');
  db.run(sql);
  return { changes: db.getRowsModified() };
}

/** Run a SELECT statement. Returns columns + rows. */
export function query(sql: string): { columns: string[]; rows: Record<string, unknown>[] } {
  if (!db) throw new Error('Database not initialised');
  const results = db.exec(sql);
  if (!results.length) return { columns: [], rows: [] };
  const { columns, values } = results[0];
  const rows = (values as unknown[][]).map(v => {
    const row: Record<string, unknown> = {};
    (columns as string[]).forEach((c, i) => { row[c] = v[i]; });
    return row;
  });
  return { columns, rows };
}

/** Drop everything and reinitialise with an empty database. */
export async function resetDb(): Promise<void> {
  await initDb();
}

/** All user table names (excludes SQLite internals). */
export function getTableNames(): string[] {
  const { rows } = query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  );
  return rows.map(r => r.name as string);
}

/** Schema + data for one table. Uses PRAGMA so empty tables return column names. */
export function getTableData(name: string): TableData {
  try {
    const { rows: pr } = query(`PRAGMA table_info("${name}")`);
    const columns = pr.map(r => r.name as string);
    const { rows } = query(`SELECT * FROM "${name}"`);
    return { name, columns, rows };
  } catch {
    return { name, columns: [], rows: [] };
  }
}

/** All tables with their data. */
export function getAllTables(): TableData[] {
  return getTableNames().map(getTableData);
}
