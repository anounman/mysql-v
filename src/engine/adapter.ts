/**
 * MySQL → SQLite SQL adapter.
 * Translates MySQL-specific syntax so it runs on sql.js (SQLite).
 */

export function adaptMySQL(sql: string): string {
  return sql
    // Backtick identifiers → double-quote (SQLite standard)
    .replace(/`([^`]+)`/g, '"$1"')
    // Date functions
    .replace(/\bYEAR\s*\(\s*([^)]+)\s*\)/gi, "CAST(strftime('%Y', $1) AS INTEGER)")
    .replace(/\bMONTH\s*\(\s*([^)]+)\s*\)/gi, "CAST(strftime('%m', $1) AS INTEGER)")
    .replace(/\bDAY\s*\(\s*([^)]+)\s*\)/gi, "CAST(strftime('%d', $1) AS INTEGER)")
    .replace(/\bNOW\s*\(\s*\)/gi, "datetime('now')")
    .replace(/\bCURDATE\s*\(\s*\)/gi, "date('now')")
    // MySQL-specific functions
    .replace(/\bIFNULL\s*\(/gi, 'COALESCE(')
    // DDL compatibility
    .replace(/AUTO_INCREMENT/gi, 'AUTOINCREMENT')
    .replace(/\bINT\s+PRIMARY\s+KEY\b/gi, 'INTEGER PRIMARY KEY')
    .replace(/\bVARCHAR\s*\(\d+\)/gi, 'TEXT')
    // DATE type in column definitions (not column references like b.date)
    .replace(/(\s)DATE(\s*(?:,|\)|NOT NULL|DEFAULT|PRIMARY|UNIQUE|CHECK|\s*$))/gi, '$1TEXT$2')
    // Remove LIMIT from UPDATE/DELETE — not supported by sql.js
    .replace(/(\bUPDATE\b[\s\S]+?)\s+LIMIT\s+\d+\s*;/gi, '$1;')
    .replace(/(\bDELETE\b[\s\S]+?)\s+LIMIT\s+\d+\s*;/gi, '$1;');
}

/** Split a multi-statement SQL string into individual statements. */
export function splitStatements(sql: string): string[] {
  const stmts: string[] = [];
  let current = '';
  let depth = 0;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ';' && depth === 0) {
      if (current.trim()) stmts.push(current.trim());
      current = '';
    } else { current += ch; }
  }
  if (current.trim()) stmts.push(current.trim());
  return stmts;
}
