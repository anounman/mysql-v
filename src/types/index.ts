export interface TableData {
  name: string;
  columns: string[];
  rows: Record<string, unknown>[];
}

export interface QueryResult {
  type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'DDL';
  columns?: string[];
  rows?: Record<string, unknown>[];
  rowCount?: number;
  changes?: number;
  lastInsertRowid?: number;
  sql: string;
}

export interface QueryError {
  sql: string;
  error: string;
}

export interface VisualStep {
  stage: 'FROM' | 'JOIN' | 'WHERE' | 'GROUP_BY' | 'HAVING' | 'SELECT' | 'ORDER_BY' | 'LIMIT'
    | 'INSERT' | 'UPDATE' | 'DELETE' | 'SUBQUERY' | 'CREATE';
  title: string;
  explanation: string;
  tables?: TableData[];
  joinInfo?: {
    type: string;
    table: string;
    alias: string | null;
    condition: string;
  }[];
  condition?: string;
  groupByClause?: string;
  columns?: string;
  highlight?: string | null;
}

export interface SqlMistake {
  level: 'error' | 'warning' | 'info';
  title: string;
  detail: string;
}

export interface RunResponse {
  results: QueryResult[];
  errors: QueryError[];
  tables: TableData[];
  steps: VisualStep[];
  queryType: string;
  mistakes: SqlMistake[];
}
