const API_BASE = 'http://localhost:3001/api';

export async function runSql(sql: string) {
  const res = await fetch(`${API_BASE}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
  });
  if (!res.ok) throw new Error(`Server error: ${res.status}`);
  return res.json();
}

export async function resetDatabase() {
  const res = await fetch(`${API_BASE}/reset`, { method: 'POST' });
  if (!res.ok) throw new Error(`Server error: ${res.status}`);
  return res.json();
}

export async function getTables() {
  const res = await fetch(`${API_BASE}/tables`);
  if (!res.ok) throw new Error(`Server error: ${res.status}`);
  return res.json();
}

export async function getStepAnalysis(sql: string) {
  const res = await fetch(`${API_BASE}/step-analysis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
  });
  if (!res.ok) throw new Error(`Server error: ${res.status}`);
  return res.json();
}
