import { useState, useEffect } from 'react';
import {
  getProjects, createProject, deleteProject, Project,
  setActiveProjectId, clearActiveProject,
} from '../engine/session';

interface Props {
  onOpenProject: (project: Project) => void;
}

export default function HomePage({ onOpenProject }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setProjects(getProjects());
    clearActiveProject(); // make sure no stale session on home page
  }, []);

  function handleCreate() {
    if (!newName.trim()) return;
    const project = createProject(newName);
    setActiveProjectId(project.id);
    onOpenProject(project);
  }

  function handleOpen(project: Project) {
    setActiveProjectId(project.id);
    onOpenProject(project);
  }

  function handleDelete(id: string) {
    deleteProject(id);
    setProjects(getProjects());
    setDeletingId(null);
  }

  function fmtDate(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return (
    <div className="home-root">
      {/* ── Background decoration ── */}
      <div className="home-bg">
        <div className="home-bg-orb home-bg-orb-1" />
        <div className="home-bg-orb home-bg-orb-2" />
        <div className="home-bg-orb home-bg-orb-3" />
      </div>

      {/* ── Header ── */}
      <header className="home-header">
        <div className="home-logo">
          <span className="home-logo-icon">🗄️</span>
          <div>
            <div className="home-logo-title">MySQL Visualizer</div>
            <div className="home-logo-sub">Interactive SQL Learning Platform</div>
          </div>
        </div>
        <div className="home-header-badges">
          <span className="home-badge">🧠 SQLite in Browser</span>
          <span className="home-badge">⚡ No Backend</span>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="home-hero">
        <h1 className="home-hero-title">
          Your SQL <span className="home-hero-accent">Projects</span>
        </h1>
        <p className="home-hero-sub">
          Each project has its own isolated database. Tables you create in one project stay in that project.
          Open a project in multiple tabs? Each tab is completely independent.
        </p>
      </section>

      {/* ── New Project ── */}
      <section className="home-new-section">
        {creating ? (
          <div className="home-new-form">
            <input
              className="home-new-input"
              placeholder="Project name, e.g. University SQL Lab"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false); }}
            />
            <button className="btn btn-primary" onClick={handleCreate} disabled={!newName.trim()}>
              🚀 Create & Open
            </button>
            <button className="btn btn-ghost" onClick={() => { setCreating(false); setNewName(''); }}>
              Cancel
            </button>
          </div>
        ) : (
          <button className="home-new-btn" onClick={() => setCreating(true)}>
            <span className="home-new-btn-plus">+</span>
            <span>New Project</span>
          </button>
        )}
      </section>

      {/* ── Project Grid ── */}
      <section className="home-grid-section">
        {projects.length === 0 ? (
          <div className="home-empty">
            <div className="home-empty-icon">🗂️</div>
            <p className="home-empty-title">No projects yet</p>
            <p className="home-empty-sub">Create your first project to start writing SQL</p>
          </div>
        ) : (
          <div className="home-grid">
            {projects.map(p => (
              <div key={p.id} className="home-card" onClick={() => handleOpen(p)}>
                {/* Card top */}
                <div className="home-card-top">
                  <div className="home-card-icon">🗄️</div>
                  <div className="home-card-menu">
                    {deletingId === p.id ? (
                      <div className="home-card-confirm" onClick={e => e.stopPropagation()}>
                        <span className="home-card-confirm-label">Delete?</span>
                        <button className="home-card-confirm-yes" onClick={() => handleDelete(p.id)}>Yes</button>
                        <button className="home-card-confirm-no" onClick={() => setDeletingId(null)}>No</button>
                      </div>
                    ) : (
                      <button
                        className="home-card-delete"
                        title="Delete project"
                        onClick={e => { e.stopPropagation(); setDeletingId(p.id); }}
                      >🗑️</button>
                    )}
                  </div>
                </div>

                {/* Card body */}
                <div className="home-card-name">{p.name}</div>
                <div className="home-card-updated">Updated {fmtDate(p.updatedAt)}</div>

                {/* Stats */}
                <div className="home-card-stats">
                  <div className="home-card-stat">
                    <span className="home-card-stat-val">{p.tableCount}</span>
                    <span className="home-card-stat-label">tables</span>
                  </div>
                  <div className="home-card-stat">
                    <span className="home-card-stat-val">{p.history.length}</span>
                    <span className="home-card-stat-label">statements</span>
                  </div>
                  <div className="home-card-stat">
                    <span className="home-card-stat-val">{p.runCount}</span>
                    <span className="home-card-stat-label">runs</span>
                  </div>
                </div>

                {/* Open button */}
                <div className="home-card-footer">
                  <span className="home-card-open">Open →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Footer ── */}
      <footer className="home-footer">
        MySQL Visualizer · SQLite runs 100% in your browser · Data stored locally
      </footer>
    </div>
  );
}
