'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Project } from '@/lib/types';

interface ManagedDatabase {
  id: string;
  projectId: string;
  type: string;
  internalHost: string;
  port: number;
  status: string;
  storageMb: number;
  connectionsCount?: number;
}

export default function DevProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [databases, setDatabases] = useState<ManagedDatabase[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'overview' | 'supabase' | 'databases' | 'env'>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal / Provision DB state
  const [showNewDbModal, setShowNewDbModal] = useState(false);
  const [newDbName, setNewDbName] = useState('');
  const [newDbType, setNewDbType] = useState<'postgresql' | 'mysql' | 'redis' | 'mongodb'>('postgresql');
  const [provisioningDb, setProvisioningDb] = useState(false);

  function loadData() {
    setLoading(true);
    Promise.all([
      api.projects.list().catch(() => ({ projects: [] })),
      apiFetch('/api/managed-databases').then((r) => r.json()).catch(() => ({ databases: [] })),
    ])
      .then(([projRes, dbRes]) => {
        setProjects(projRes.projects);
        setDatabases(dbRes.databases || []);
        if (projRes.projects.length > 0 && !selectedProjectId) {
          setSelectedProjectId(projRes.projects[0].id);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(loadData, []);

  const selectedProject = projects.find((p) => p.id === selectedProjectId) || projects[0];
  const projectDbs = databases.filter((db) => db.projectId === selectedProjectId);

  async function handleCreateDb(e: React.FormEvent) {
    e.preventDefault();
    if (!newDbName.trim() || !selectedProjectId) return;

    setProvisioningDb(true);
    try {
      await apiFetch('/api/managed-databases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProjectId,
          name: newDbName.trim(),
          type: newDbType,
        }),
      });
      setNewDbName('');
      setShowNewDbModal(false);
      loadData();
    } catch (err: any) {
      alert(`Failed to provision database: ${err.message}`);
    } finally {
      setProvisioningDb(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 max-w-6xl mx-auto space-y-4">
        <div className="h-8 w-48 bg-white/10 rounded animate-pulse" />
        <div className="h-64 bg-white/5 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-violet-500/10 text-violet-300 border border-violet-500/20">
              Dev Portal
            </span>
            <span className="text-xs text-text-faint">• Live Database Engine</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">Managed Projects & Databases</h1>
          <p className="text-xs text-text-muted mt-1">
            Unified environment management combining Supabase stack, managed database clusters, and per-project environment variables into one single workspace.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowNewDbModal(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 text-xs font-bold text-white shadow-lg shadow-violet-500/25 transition-all"
          >
            + Provision Database Engine
          </button>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-8 text-center space-y-3">
          <p className="text-sm text-text-muted">No managed projects found in database.</p>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-violet-500/20 text-violet-300 border border-violet-500/30 rounded-xl text-xs font-bold"
          >
            Refresh Projects
          </button>
        </div>
      ) : (
        <>
          {/* Project Selector Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0b0c16] border border-white/10 p-3 rounded-2xl">
            <div className="flex items-center gap-2 overflow-x-auto">
              <span className="text-xs text-text-faint font-semibold uppercase tracking-wider px-2">Project:</span>
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProjectId(p.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    selectedProjectId === p.id
                      ? 'bg-violet-500/20 text-violet-300 border-violet-500/40 shadow-sm'
                      : 'bg-white/[0.02] text-text-muted hover:text-white border-white/5'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>

            {selectedProject && (
              <div className="text-xs text-text-muted px-2">
                ID: <span className="text-white font-mono">{selectedProject.id}</span>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2 border-b border-white/10 pb-3">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                activeTab === 'overview'
                  ? 'bg-white/10 text-white border-white/20'
                  : 'text-text-muted hover:text-white border-transparent'
              }`}
            >
              Overview Stack
            </button>
            <button
              onClick={() => setActiveTab('supabase')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                activeTab === 'supabase'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'text-text-muted hover:text-white border-transparent'
              }`}
            >
              Supabase Stack
            </button>
            <button
              onClick={() => setActiveTab('databases')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                activeTab === 'databases'
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                  : 'text-text-muted hover:text-white border-transparent'
              }`}
            >
              Managed DBs ({projectDbs.length})
            </button>
          </div>

          {/* TAB CONTENT */}
          {selectedProject && (
            <>
              {activeTab === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-text-muted uppercase">Project Details</h3>
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">
                        Active
                      </span>
                    </div>
                    <p className="text-lg font-bold text-white">{selectedProject.name}</p>
                    <div className="space-y-1.5 text-xs text-text-muted font-mono">
                      <p>ID: {selectedProject.id}</p>
                      <p>Node: {selectedProject.nodeId || 'Cluster Host'}</p>
                      <p>Created: {new Date(selectedProject.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-text-muted uppercase">Supabase Integration</h3>
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-semibold">
                        Connected
                      </span>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-bold text-white">Studio UI Active</p>
                      <p className="text-xs text-emerald-400 font-mono truncate">
                        https://supabase-{selectedProject.id}.shanutechx.internal
                      </p>
                    </div>
                  </div>

                  <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-text-muted uppercase">Managed Databases</h3>
                      <span className="text-xs text-cyan-400 font-bold">{projectDbs.length} Active</span>
                    </div>
                    <div className="space-y-1.5">
                      {projectDbs.length > 0 ? (
                        projectDbs.map((db) => (
                          <div key={db.id} className="flex items-center justify-between text-xs p-2 bg-white/[0.02] rounded-lg border border-white/5">
                            <span className="font-semibold text-white font-mono">{db.internalHost || db.id}</span>
                            <span className="font-mono text-text-muted uppercase">{db.type}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-text-muted">No database clusters provisioned for this project.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'supabase' && (
                <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div>
                      <h2 className="text-base font-bold text-white flex items-center gap-2">
                        Supabase Project Stack
                      </h2>
                      <p className="text-xs text-text-muted">Self-hosted Supabase engine with Postgres, Auth, GoTrue, and Storage Buckets.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-white/[0.02] border border-white/10 rounded-xl space-y-2">
                      <label className="text-xs font-semibold text-text-muted">REST API Endpoint</label>
                      <input
                        type="text"
                        readOnly
                        value={`https://api-supabase-${selectedProject.id}.shanutechx.internal`}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                      />
                    </div>

                    <div className="p-4 bg-white/[0.02] border border-white/10 rounded-xl space-y-2">
                      <label className="text-xs font-semibold text-text-muted">Studio Web UI</label>
                      <input
                        type="text"
                        readOnly
                        value={`https://supabase-${selectedProject.id}.shanutechx.internal`}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'databases' && (
                <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      Managed Database Clusters
                    </h2>
                    <button
                      onClick={() => setShowNewDbModal(true)}
                      className="px-3.5 py-1.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold hover:bg-cyan-500/30 transition-all"
                    >
                      + Add Database
                    </button>
                  </div>

                  {projectDbs.length === 0 ? (
                    <p className="text-xs text-text-muted py-4 text-center">No database instances found for this project.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {projectDbs.map((db) => (
                        <div key={db.id} className="p-4 bg-white/[0.02] border border-white/10 rounded-xl space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white font-mono">{db.id}</span>
                            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-semibold uppercase">
                              {db.status || 'Active'}
                            </span>
                          </div>
                          <div className="space-y-1 text-xs font-mono text-text-muted">
                            <p>Host: <span className="text-white">{db.internalHost}</span></p>
                            <p>Port: <span className="text-white">{db.port}</span></p>
                            <p>Engine: <span className="text-cyan-400 font-bold uppercase">{db.type}</span></p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* PROVISION NEW DB MODAL */}
      {showNewDbModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0f1021] border border-white/15 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              Provision Database Engine
            </h3>

            <form onSubmit={handleCreateDb} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">Database Cluster Name</label>
                <input
                  type="text"
                  placeholder="production-pg-db"
                  value={newDbName}
                  onChange={(e) => setNewDbName(e.target.value)}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">Engine Type</label>
                <select
                  value={newDbType}
                  onChange={(e: any) => setNewDbType(e.target.value)}
                  className="w-full bg-[#121324] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                >
                  <option value="postgresql">PostgreSQL 16 Engine</option>
                  <option value="mysql">MySQL 8.0 Engine</option>
                  <option value="redis">Redis Stack Server</option>
                  <option value="mongodb">MongoDB Community</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewDbModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-text-muted hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={provisioningDb}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 text-xs font-bold text-white shadow-lg shadow-violet-500/25 disabled:opacity-50"
                >
                  {provisioningDb ? 'Provisioning...' : 'Provision Engine'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function apiFetch(url: string, init?: RequestInit) {
  return fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
}
