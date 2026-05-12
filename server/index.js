import express from 'express';
import cors from 'cors';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// sql.js uses CommonJS, load via require
const initSqlJs = require('sql.js');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

let SQL = null;
let db = null;

async function initDb() {
  SQL = await initSqlJs();
  db = new SQL.Database();
  runDemo();
}

const DEMO_SQL = `
CREATE TABLE IF NOT EXISTS persons (id INTEGER PRIMARY KEY, name TEXT, birth_year INTEGER);
CREATE TABLE IF NOT EXISTS tax (person INTEGER, year INTEGER, stated_income INTEGER);
CREATE TABLE IF NOT EXISTS bank_statements (id INTEGER PRIMARY KEY, person INTEGER, date TEXT, income INTEGER);
INSERT INTO persons VALUES (1, 'Ali', 2000);
INSERT INTO persons VALUES (2, 'Sara', 1998);
INSERT INTO persons VALUES (3, 'Max', 1996);
INSERT INTO tax VALUES (1, 2024, 1000);
INSERT INTO tax VALUES (2, 2024, 2000);
INSERT INTO tax VALUES (3, 2024, 3000);
INSERT INTO bank_statements VALUES (1, 1, '2024-01-10', 700);
INSERT INTO bank_statements VALUES (2, 1, '2024-03-15', 900);
INSERT INTO bank_statements VALUES (3, 2, '2024-02-20', 1500);
INSERT INTO bank_statements VALUES (4, 2, '2024-05-01', 900);
INSERT INTO bank_statements VALUES (5, 3, '2024-04-12', 2500);
`;

function runDemo() {
  const stmts = DEMO_SQL.split(';').map(s => s.trim()).filter(Boolean);
  for (const s of stmts) {
    try { db.run(s); } catch(e) { /* ignore */ }
  }
}

// sql.js query helper — returns {columns, rows}
function query(sql) {
  const results = db.exec(sql);
  if (!results.length) return { columns: [], rows: [] };
  const { columns, values } = results[0];
  const rows = values.map(v => {
    const row = {};
    columns.forEach((c, i) => row[c] = v[i]);
    return row;
  });
  return { columns, rows };
}

function run(sql) {
  db.run(sql);
  return { changes: db.getRowsModified() };
}

function getTableNames() {
  const { rows } = query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  return rows.map(r => r.name);
}

function getTableData(name) {
  try {
    const { columns, rows } = query(`SELECT * FROM "${name}"`);
    return { name, columns, rows };
  } catch(e) { return { name, columns: [], rows: [] }; }
}

function getAllTables() {
  return getTableNames().map(getTableData);
}

// MySQL → SQLite compatibility
function adaptMySQL(sql) {
  return sql
    .replace(/\bYEAR\s*\(\s*([^)]+)\s*\)/gi, "CAST(strftime('%Y', $1) AS INTEGER)")
    .replace(/\bMONTH\s*\(\s*([^)]+)\s*\)/gi, "CAST(strftime('%m', $1) AS INTEGER)")
    .replace(/\bDAY\s*\(\s*([^)]+)\s*\)/gi, "CAST(strftime('%d', $1) AS INTEGER)")
    .replace(/\bNOW\s*\(\s*\)/gi, "datetime('now')")
    .replace(/\bCURDATE\s*\(\s*\)/gi, "date('now')")
    .replace(/\bIFNULL\s*\(/gi, "COALESCE(")
    .replace(/AUTO_INCREMENT/gi, "AUTOINCREMENT")
    .replace(/\bINT\s+PRIMARY\s+KEY\b/gi, "INTEGER PRIMARY KEY")
    .replace(/\bVARCHAR\s*\(\d+\)/gi, "TEXT")
    .replace(/(\s)DATE(\s*(?:,|\)|NOT NULL|DEFAULT|PRIMARY|UNIQUE|CHECK|\s*$))/gi, "$1TEXT$2");
}

function splitStatements(sql) {
  const stmts = [];
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

function analyzeQuery(sql) {
  const upper = sql.toUpperCase().trim();
  const type = upper.startsWith('SELECT') ? 'SELECT'
    : upper.startsWith('INSERT') ? 'INSERT'
    : upper.startsWith('UPDATE') ? 'UPDATE'
    : upper.startsWith('DELETE') ? 'DELETE'
    : upper.startsWith('CREATE') ? 'CREATE' : 'OTHER';

  const steps = [];

  if (type === 'SELECT') {
    const fromMatch = sql.match(/\bFROM\s+(\w+)(?:\s+(?:AS\s+)?(\w+))?/i);
    if (fromMatch) {
      const tableName = fromMatch[1];
      let tableData = { name: tableName, columns: [], rows: [] };
      try { tableData = getTableData(tableName); } catch(e) {}
      steps.push({
        stage: 'FROM',
        title: 'Step 1: FROM — Load base table',
        explanation: `The query starts by loading all rows from "${tableName}". Every row is a candidate at this stage — no filtering has happened yet. Think of it as dumping the whole table onto the work desk.`,
        tables: [tableData]
      });
    }

    const hasSubquery = /\(\s*SELECT/i.test(sql);
    if (hasSubquery) {
      steps.push({
        stage: 'SUBQUERY',
        title: 'Step 2a: Subquery — Execute inner query first',
        explanation: `A subquery inside FROM is executed before the outer query. Its result becomes a temporary table (like a virtual table with an alias). The outer query then joins against this result as if it were a real table.`,
        tables: []
      });
    }

    const joinMatches = [...sql.matchAll(/\b(LEFT\s+OUTER\s+|LEFT\s+|RIGHT\s+|INNER\s+)?JOIN\s+(?!\s*\()(\w+)\s+(?:AS\s+)?(\w+)?\s+ON\s+([\s\S]+?)(?=\b(?:LEFT|RIGHT|INNER|JOIN|WHERE|GROUP|HAVING|ORDER|LIMIT)\b|$)/gi)];
    if (joinMatches.length || /JOIN\s*\(/i.test(sql)) {
      const joinInfo = joinMatches.map(m => ({
        type: (m[1] || '').trim().toUpperCase().includes('LEFT') ? 'LEFT JOIN' : 'INNER JOIN',
        table: m[2] || '?',
        alias: m[3] || null,
        condition: (m[4] || '').trim()
      }));
      if (/JOIN\s*\(/i.test(sql)) {
        joinInfo.push({ type: 'INNER JOIN', table: '(subquery)', alias: 'bank', condition: 'p.id = bank.person AND t.year = bank.year' });
      }
      steps.push({
        stage: 'JOIN',
        title: `Step 2: JOIN — Combine matching rows`,
        explanation: `JOIN combines rows from two tables where the ON condition is TRUE. INNER JOIN: only rows that match appear. LEFT JOIN: all left rows appear; unmatched right rows get NULL. No match = row is discarded (INNER) or NULLed (LEFT).`,
        joinInfo,
        tables: []
      });
    }

    if (/\bWHERE\b/i.test(sql)) {
      const whereMatch = sql.match(/\bWHERE\s+([\s\S]+?)(?=\bGROUP\b|\bHAVING\b|\bORDER\b|\bLIMIT\b|$)/i);
      const cond = whereMatch ? whereMatch[1].trim() : '';
      steps.push({
        stage: 'WHERE',
        title: 'Step 3: WHERE — Filter rows',
        explanation: `WHERE is applied BEFORE GROUP BY. Each row from the join is tested: "${cond}". Rows where this is FALSE are removed. WHERE cannot use aggregate functions (SUM, COUNT etc.) — use HAVING for that.`,
        condition: cond,
        tables: []
      });
    }

    if (/\bGROUP\s+BY\b/i.test(sql)) {
      const gbMatch = sql.match(/\bGROUP\s+BY\s+([\s\S]+?)(?=\bHAVING\b|\bORDER\b|\bLIMIT\b|$)/i);
      const gb = gbMatch ? gbMatch[1].trim() : '';
      steps.push({
        stage: 'GROUP_BY',
        title: 'Step 4: GROUP BY — Create groups',
        explanation: `GROUP BY creates "buckets" of rows that share the same values for: ${gb}. All rows within a group are collapsed into one output row. Aggregate functions (SUM, COUNT, AVG, MIN, MAX) compute values across each bucket. Important: you CANNOT select a non-grouped column without an aggregate!`,
        groupByClause: gb,
        tables: []
      });
    }

    if (/\bHAVING\b/i.test(sql)) {
      const havingMatch = sql.match(/\bHAVING\s+([\s\S]+?)(?=\bORDER\b|\bLIMIT\b|$)/i);
      const cond = havingMatch ? havingMatch[1].trim() : '';
      steps.push({
        stage: 'HAVING',
        title: 'Step 5: HAVING — Filter groups',
        explanation: `HAVING filters GROUPS (after GROUP BY), while WHERE filters ROWS (before GROUP BY). Condition: "${cond}". Groups that fail this condition are removed from the output.`,
        condition: cond,
        tables: []
      });
    }

    const selectMatch = sql.match(/^SELECT\s+([\s\S]+?)\s+FROM/i);
    const cols = selectMatch ? selectMatch[1].trim() : '*';
    steps.push({
      stage: 'SELECT',
      title: 'Step 6: SELECT — Project columns',
      explanation: `SELECT picks which columns appear in the final output. Aliases (AS) rename columns. Expressions like SUM(income) are evaluated here. This step happens AFTER filtering and grouping — remember, the written order is not the execution order!`,
      columns: cols,
      tables: []
    });

    if (/\bORDER\s+BY\b/i.test(sql)) {
      const obMatch = sql.match(/\bORDER\s+BY\s+([\s\S]+?)(?=\bLIMIT\b|$)/i);
      steps.push({
        stage: 'ORDER_BY',
        title: 'Step 7: ORDER BY — Sort results',
        explanation: `ORDER BY sorts the final result. It runs AFTER SELECT, so you can sort by aliases. By: ${obMatch ? obMatch[1].trim() : '?'}`,
        tables: []
      });
    }

    if (/\bLIMIT\b/i.test(sql)) {
      const limMatch = sql.match(/\bLIMIT\s+(\d+)/i);
      steps.push({
        stage: 'LIMIT',
        title: 'Step 8: LIMIT — Restrict row count',
        explanation: `LIMIT is the very last step. It truncates the output to ${limMatch ? limMatch[1] : 'N'} rows. Only use it after ORDER BY if you want the top-N specifically.`,
        tables: []
      });
    }
  } else if (type === 'INSERT') {
    steps.push({ stage: 'INSERT', title: 'INSERT — Add new row', explanation: 'INSERT adds a new row to the table. The row is appended to the table. If a PRIMARY KEY constraint is violated, the insert fails.', tables: [] });
  } else if (type === 'UPDATE') {
    const whereMatch = sql.match(/\bWHERE\s+([\s\S]+?)$/i);
    steps.push({ stage: 'WHERE', title: 'UPDATE Step 1: WHERE — Find rows', explanation: `WHERE scans every row and marks those matching: ${whereMatch ? whereMatch[1].trim() : '(all rows)'}`, tables: [], condition: whereMatch?.[1]?.trim() });
    steps.push({ stage: 'UPDATE', title: 'UPDATE Step 2: Apply new values', explanation: 'Matching rows have their SET columns updated in place. Old values are overwritten permanently.', tables: [] });
  } else if (type === 'DELETE') {
    const whereMatch = sql.match(/\bWHERE\s+([\s\S]+?)$/i);
    steps.push({ stage: 'WHERE', title: 'DELETE Step 1: WHERE — Find rows', explanation: `WHERE identifies rows to remove: ${whereMatch ? whereMatch[1].trim() : '(all rows — DANGEROUS!)'}`, tables: [], condition: whereMatch?.[1]?.trim() });
    steps.push({ stage: 'DELETE', title: 'DELETE Step 2: Remove rows', explanation: 'Matching rows are permanently deleted. Without WHERE, all rows are deleted!', tables: [] });
  } else if (type === 'CREATE') {
    steps.push({ stage: 'CREATE', title: 'CREATE TABLE — Define schema', explanation: 'CREATE TABLE defines a new table with its columns and types. It does not insert any data.', tables: [] });
  }

  return { type, steps };
}

function detectMistakes(sql) {
  const mistakes = [];

  if (/\bWHERE\b[\s\S]*(SUM|COUNT|AVG|MIN|MAX)\s*\(/i.test(sql)) {
    mistakes.push({ level: 'error', title: 'Aggregate function in WHERE clause', detail: 'You cannot use SUM(), COUNT(), AVG() etc. in WHERE. WHERE filters rows before grouping. Use HAVING to filter after aggregation.' });
  }

  if (/\bGROUP\s+BY\b/i.test(sql)) {
    const selectMatch = sql.match(/SELECT\s+([\s\S]+?)\s+FROM/i);
    const gbMatch = sql.match(/GROUP\s+BY\s+([\s\S]+?)(?=HAVING|ORDER|LIMIT|$)/i);
    if (selectMatch && gbMatch) {
      if (/YEAR\s*\(/i.test(selectMatch[1]) && !/YEAR\s*\(/i.test(gbMatch[1])) {
        mistakes.push({ level: 'error', title: 'YEAR() in SELECT but missing from GROUP BY', detail: 'You used YEAR(date) in SELECT but did not include it in GROUP BY. Every non-aggregate in SELECT must appear in GROUP BY.' });
      }
    }
  }

  if (/FROM\s*\(\s*SELECT/i.test(sql) && !/FROM\s*\([\s\S]+?\)\s+(?:AS\s+)?\w+/i.test(sql)) {
    mistakes.push({ level: 'error', title: 'Subquery missing alias', detail: 'Every subquery in FROM needs an alias: (...) AS alias_name. Without it, SQL cannot reference its columns.' });
  }

  if (/SELECT\s+\*/i.test(sql) && /GROUP\s+BY/i.test(sql)) {
    mistakes.push({ level: 'warning', title: 'SELECT * with GROUP BY', detail: 'SELECT * with GROUP BY is almost always wrong. Specify only the grouped columns and aggregate functions.' });
  }

  const joinCount = (sql.match(/\bJOIN\b/gi) || []).length;
  const onCount = (sql.match(/\bON\b/gi) || []).length;
  if (joinCount > onCount) {
    mistakes.push({ level: 'warning', title: 'JOIN without ON condition', detail: 'A JOIN without ON creates a Cartesian product (every row × every row). This is almost always a mistake.' });
  }

  if (/\bJOIN\b/i.test(sql) && !/\b[a-zA-Z_]\w*\.[a-zA-Z_]\w*/i.test(sql)) {
    mistakes.push({ level: 'warning', title: 'No table-prefixed columns in JOIN query', detail: 'When joining tables, always prefix columns with the table alias (e.g. p.name, t.year) to avoid ambiguous column name errors.' });
  }

  mistakes.push({ level: 'info', title: '📚 SQL Logical Execution Order', detail: 'SQL runs in this order — NOT written order: FROM → JOIN → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT. This is why you cannot use a SELECT alias in WHERE!' });

  return mistakes;
}

// ── ROUTES ──────────────────────────────────────────────────────────────────

app.get('/api/tables', (req, res) => {
  try { res.json({ tables: getAllTables() }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/run', (req, res) => {
  const { sql } = req.body;
  if (!sql) return res.status(400).json({ error: 'No SQL provided' });

  const adapted = adaptMySQL(sql);
  const stmts = splitStatements(adapted);
  const originalStmts = splitStatements(sql);
  const results = [];
  const errors = [];

  for (let i = 0; i < stmts.length; i++) {
    const stmt = stmts[i];
    const upper = stmt.toUpperCase().trim();
    try {
      if (upper.startsWith('SELECT')) {
        const { columns, rows } = query(stmt);
        results.push({ type: 'SELECT', columns, rows, rowCount: rows.length, sql: stmt });
      } else {
        const { changes } = run(stmt);
        const type = upper.startsWith('INSERT') ? 'INSERT'
          : upper.startsWith('UPDATE') ? 'UPDATE'
          : upper.startsWith('DELETE') ? 'DELETE' : 'DDL';
        results.push({ type, changes, sql: stmt });
      }
    } catch(e) {
      errors.push({ sql: originalStmts[i] || stmt, error: e.message });
    }
  }

  const mainStmt = originalStmts.find(s => s.toUpperCase().trim().startsWith('SELECT')) || originalStmts[originalStmts.length - 1] || '';
  const analysis = analyzeQuery(mainStmt);
  const mistakes = detectMistakes(mainStmt);

  res.json({ results, errors, tables: getAllTables(), steps: analysis.steps, queryType: analysis.type, mistakes });
});

app.post('/api/reset', (req, res) => {
  try {
    db = new SQL.Database();
    runDemo();
    res.json({ success: true, tables: getAllTables() });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/step-analysis', (req, res) => {
  const { sql } = req.body;
  if (!sql) return res.status(400).json({ error: 'No SQL provided' });
  res.json({ steps: analyzeQuery(sql).steps, queryType: analyzeQuery(sql).type, mistakes: detectMistakes(sql) });
});

const PORT = 3001;
initDb().then(() => {
  app.listen(PORT, () => console.log(`\n🗄️  MySQL Visualizer Backend → http://localhost:${PORT}\n`));
}).catch(e => { console.error('DB init failed:', e); process.exit(1); });
