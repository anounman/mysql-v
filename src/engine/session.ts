/**
 * Project/Session persistence.
 * - Each "project" = named workspace with its own isolated DB.
 * - Projects are stored in localStorage so they survive page refresh.
 * - Each browser tab tracks its active project in sessionStorage,
 *   so two tabs can have different projects open simultaneously.
 * - DB state is reconstructed by replaying the saved SQL history (DDL + DML only).
 */

export interface Project {
  id: string;
  name: string;
  createdAt: string;   // ISO string
  updatedAt: string;
  history: string[];   // Ordered DDL+DML statements that were successfully run
  editorContent: string;
  tableCount: number;  // snapshot for display on home page
  runCount: number;
}

const STORE_KEY = 'mysql-visualizer-projects';
const SESSION_KEY = 'mysql-visualizer-active-project';

// ── CRUD ─────────────────────────────────────────────────────────────────────

function loadAll(): Record<string, Project> {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function saveAll(projects: Record<string, Project>): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(projects));
}

export function getProjects(): Project[] {
  const all = loadAll();
  return Object.values(all).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function getProject(id: string): Project | null {
  return loadAll()[id] ?? null;
}

export function createProject(name: string): Project {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const project: Project = {
    id, name: name.trim() || 'Untitled Project',
    createdAt: now, updatedAt: now,
    history: [], editorContent: '', tableCount: 0, runCount: 0,
  };
  const all = loadAll();
  all[id] = project;
  saveAll(all);
  return project;
}

export function updateProject(id: string, patch: Partial<Project>): void {
  const all = loadAll();
  if (!all[id]) return;
  all[id] = { ...all[id], ...patch, updatedAt: new Date().toISOString() };
  saveAll(all);
}

export function deleteProject(id: string): void {
  const all = loadAll();
  delete all[id];
  saveAll(all);
}

/** Append a successfully-run DDL/DML statement to the project history. */
export function recordStatement(id: string, sql: string): void {
  const all = loadAll();
  if (!all[id]) return;
  all[id].history = [...all[id].history, sql];
  all[id].updatedAt = new Date().toISOString();
  saveAll(all);
}

// ── Active tab session ────────────────────────────────────────────────────────

/** Which project is active in THIS browser tab (sessionStorage = per-tab). */
export function getActiveProjectId(): string | null {
  return sessionStorage.getItem(SESSION_KEY);
}

export function setActiveProjectId(id: string): void {
  sessionStorage.setItem(SESSION_KEY, id);
}

export function clearActiveProject(): void {
  sessionStorage.removeItem(SESSION_KEY);
}
