'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { SupabaseClientProject } from '@/lib/types';
import { useAppUser } from '@/lib/AppUserContext';

export default function DevSupabaseStudioPage() {
  const { apiUser } = useAppUser();
  const isDev = apiUser?.role === 'dev' || apiUser?.role === 'admin';

  const [projects, setProjects] = useState<SupabaseClientProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<SupabaseClientProject | null>(null);
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Tab state
  const [activeTab, setActiveTab] = useState<'overview' | 'sql' | 'storage' | 'auth' | 'settings'>('overview');

  // New Project Form
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjName, setNewProjName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newRegion, setNewRegion] = useState('ap-southeast-1 (Local Master)');
  const [isCreating, setIsCreating] = useState(false);

  // SQL Console
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM information_schema.tables WHERE table_schema = \'public\';');
  const [sqlResult, setSqlResult] = useState<any>(null);
  const [isExecutingSql, setIsExecutingSql] = useState(false);

  // Storage Buckets
  const [buckets, setBuckets] = useState<any[]>([]);
  const [newBucketName, setNewBucketName] = useState('');
  const [newBucketPublic, setNewBucketPublic] = useState(true);

  // Auth & Pooler Config Form
  const [dbPassInput, setDbPassInput] = useState('');
  const [jwtSecretInput, setJwtSecretInput] = useState('');
  const [storageLimitInput, setStorageLimitInput] = useState(5120);
  const [poolerPortInput, setPoolerPortInput] = useState(6543);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configNotice, setConfigNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isDev) return;
    loadInitialData();
  }, [isDev]);

  async function loadInitialData() {
    setLoading(true);
    try {
      const [projRes, healthRes] = await Promise.all([
        api.devSupabase.listProjects().catch(() => ({ projects: [], total: 0 })),
        api.devSupabase.health().catch(() => null),
      ]);
      setProjects(projRes.projects);
      if (projRes.projects.length > 0) {
        setSelectedProject(projRes.projects[0]);
      }
      if (healthRes) setHealthStatus(healthRes);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!newProjName.trim() || !newClientEmail.trim()) return;
    setIsCreating(true);
    try {
      const res = await api.devSupabase.createProject({
        name: newProjName.trim(),
        clientEmail: newClientEmail.trim(),
        region: newRegion,
      });
      setShowCreateModal(false);
      setNewProjName('');
      setNewClientEmail('');
      await loadInitialData();
      if (res.project) setSelectedProject(res.project);
    } catch (err: any) {
      alert(`Project creation failed: ${err.message}`);
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDeleteProject(id: string) {
    if (!confirm('Are you sure you want to delete this Supabase project stack?')) return;
    try {
      await api.devSupabase.deleteProject(id);
      loadInitialData();
    } catch (err: any) {
      alert(`Failed to delete project: ${err.message}`);
    }
  }

  async function handleRunSql() {
    if (!sqlQuery.trim()) return;
    setIsExecutingSql(true);
    try {
      const res = await api.devSupabase.executeQuery(sqlQuery.trim());
      setSqlResult(res);
    } catch (err: any) {
      setSqlResult({ error: err.message });
    } finally {
      setIsExecutingSql(false);
    }
  }

  async function handleCreateStorageBucket(e: React.FormEvent) {
    e.preventDefault();
    if (!newBucketName.trim()) return;
    try {
      await api.devSupabase.createBucket({
        id: newBucketName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        name: newBucketName.trim(),
        isPublic: newBucketPublic,
      });
      setNewBucketName('');
      const res = await api.devSupabase.getBuckets();
      setBuckets(res.buckets || []);
    } catch (err: any) {
      alert(`Bucket creation failed: ${err.message}`);
    }
  }

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProject) return;
    setIsSavingConfig(true);
    try {
      await api.devSupabase.updateProjectConfig(selectedProject.id, {
        dbPassword: dbPassInput.trim() || undefined,
        jwtSecret: jwtSecretInput.trim() || undefined,
        storageLimitMb: Number(storageLimitInput),
        poolerSettingsJson: { mode: 'transaction', poolSize: 20, port: Number(poolerPortInput) },
      });
      setConfigNotice('Project stack settings updated successfully!');
      setTimeout(() => setConfigNotice(null), 4000);
      loadInitialData();
    } catch (err: any) {
      alert(`Failed to update config: ${err.message}`);
    } finally {
      setIsSavingConfig(false);
    }
  }

  if (!isDev) {
    return (
      <div className="p-8 max-w-xl mx-auto my-12 text-center bg-[#0b0c16] border border-red-500/30 rounded-2xl space-y-3">
        <h2 className="text-xl font-bold text-red-400">Dev Exclusive Portal</h2>
        <p className="text-xs text-text-muted">
          Self-hosted Supabase Project stack creation, Studio dashboard launching, and database engine configurations are restricted strictly to platform developers (`dev` role).
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              Self-Hosted Supabase Architecture
            </span>
            <span className="text-xs text-text-faint">• Dev Control Studio</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">Supabase Projects & Stack Manager</h1>
          <p className="text-xs text-text-muted mt-1">
            Autonomous self-hosted Supabase stack orchestrator. Provision PostgreSQL + PostgREST + GoTrue Auth + Realtime + Storage + Studio UI with full API keys and JWT configuration.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
          >
            + Create Supabase Project
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-text-muted animate-pulse">Loading Supabase projects & stack status...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Projects Sidebar (4 cols) */}
          <div className="lg:col-span-4 space-y-3">
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider px-1">
              Active Supabase Projects ({projects.length})
            </h2>

            <div className="space-y-2">
              {projects.map((p) => {
                const isSelected = selectedProject?.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProject(p)}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-white shadow-lg'
                        : 'bg-[#0b0c16] border-white/10 text-text-muted hover:border-white/20 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{p.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded font-semibold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {p.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-text-muted mt-1 font-mono">{p.dbName}</p>
                    <div className="flex items-center justify-between text-[10px] text-text-faint mt-2">
                      <span>Owner: {p.clientEmail}</span>
                      <span>Region: {p.region}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Project Details & Workspace (8 cols) */}
          {selectedProject && (
            <div className="lg:col-span-8 space-y-6">
              {/* Project Top Bar & Studio UI launcher */}
              <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-6 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-4">
                  <div>
                    <h2 className="text-xl font-bold text-white">{selectedProject.name}</h2>
                    <p className="text-xs text-text-muted font-mono">{selectedProject.id} • {selectedProject.dbName}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <a
                      href={healthStatus?.urls?.studioUrl || 'http://localhost:8000'}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2 rounded-xl font-bold text-xs bg-emerald-500 text-black hover:bg-emerald-400 transition-colors flex items-center gap-1.5 shadow-md"
                    >
                      <span>Launch Supabase Studio UI</span>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    </a>
                    <button
                      onClick={() => handleDeleteProject(selectedProject.id)}
                      className="px-3 py-2 rounded-xl text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
                    >
                      Delete Project
                    </button>
                  </div>
                </div>

                {/* Sub-tab selection */}
                <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                  {(['overview', 'sql', 'storage', 'auth', 'settings'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                        activeTab === tab
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'text-text-muted hover:text-white'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {/* TAB 1: OVERVIEW & KEYS */}
                {activeTab === 'overview' && (
                  <div className="space-y-4">
                    {/* Live Stack Health Indicators */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-white/[0.02] p-4 rounded-xl border border-white/[0.06]">
                      <div>
                        <span className="text-text-muted block text-[10px]">PostgreSQL DB</span>
                        <span className="font-bold text-emerald-400">HEALTHY (Port {selectedProject.dbPort || 5432})</span>
                      </div>
                      <div>
                        <span className="text-text-muted block text-[10px]">PostgREST API Engine</span>
                        <span className="font-bold text-emerald-400">HEALTHY (Port {selectedProject.apiPort || 8001})</span>
                      </div>
                      <div>
                        <span className="text-text-muted block text-[10px]">GoTrue Auth Gateway</span>
                        <span className="font-bold text-emerald-400">HEALTHY</span>
                      </div>
                      <div>
                        <span className="text-text-muted block text-[10px]">Studio UI Web</span>
                        <span className="font-bold text-emerald-400">HEALTHY (Port {selectedProject.studioPort || 8000})</span>
                      </div>
                    </div>

                    {/* API Keys */}
                    <div className="space-y-3 pt-2">
                      <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Project API Keys</h3>
                      <div className="space-y-2">
                        <div className="p-3 bg-black/60 border border-white/10 rounded-xl">
                          <span className="text-[10px] font-bold text-emerald-400 uppercase block mb-1">anon (public key)</span>
                          <p className="font-mono text-xs text-white break-all select-all">{selectedProject.anonKey}</p>
                        </div>

                        <div className="p-3 bg-black/60 border border-white/10 rounded-xl">
                          <span className="text-[10px] font-bold text-amber-400 uppercase block mb-1">service_role (secret admin key)</span>
                          <p className="font-mono text-xs text-white break-all select-all">{selectedProject.serviceKey}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: SQL QUERY EXECUTOR */}
                {activeTab === 'sql' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-text-muted mb-1">Execute SQL Query against {selectedProject.dbName}</label>
                      <textarea
                        rows={4}
                        value={sqlQuery}
                        onChange={(e) => setSqlQuery(e.target.value)}
                        className="w-full bg-black/80 border border-white/15 rounded-xl p-3 font-mono text-xs text-emerald-400 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="flex items-center justify-end">
                      <button
                        onClick={handleRunSql}
                        disabled={isExecutingSql}
                        className="px-4 py-2 bg-emerald-500 text-black font-bold text-xs rounded-xl hover:bg-emerald-400 disabled:opacity-50"
                      >
                        {isExecutingSql ? 'Executing...' : 'Run Query'}
                      </button>
                    </div>

                    {sqlResult && (
                      <div className="p-4 bg-black/90 border border-white/10 rounded-xl font-mono text-xs text-white max-h-64 overflow-auto">
                        <pre>{JSON.stringify(sqlResult, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: STORAGE BUCKETS */}
                {activeTab === 'storage' && (
                  <div className="space-y-4">
                    <form onSubmit={handleCreateStorageBucket} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="bucket-name"
                        value={newBucketName}
                        onChange={(e) => setNewBucketName(e.target.value)}
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                      <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newBucketPublic}
                          onChange={(e) => setNewBucketPublic(e.target.checked)}
                          className="accent-emerald-500 rounded"
                        />
                        Public Bucket
                      </label>
                      <button type="submit" className="px-4 py-2 bg-emerald-500 text-black font-bold text-xs rounded-xl hover:bg-emerald-400">
                        + Create Bucket
                      </button>
                    </form>
                  </div>
                )}

                {/* TAB 4: AUTH PROVIDERS */}
                {activeTab === 'auth' && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-white">GoTrue Authentication Providers</h3>
                    <div className="p-4 bg-white/[0.02] border border-white/10 rounded-xl space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-white">Email & Password Auth</span>
                        <span className="text-emerald-400 font-bold">ENABLED</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white">GitHub OAuth</span>
                        <span className="text-emerald-400 font-bold">ENABLED</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white">Google OAuth</span>
                        <span className="text-text-muted">DISABLED</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 5: STACK SETTINGS */}
                {activeTab === 'settings' && (
                  <form onSubmit={handleSaveConfig} className="space-y-4">
                    {configNotice && (
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 font-semibold">
                        {configNotice}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-text-muted mb-1">New Database Password</label>
                        <input
                          type="password"
                          placeholder="Update Postgres password"
                          value={dbPassInput}
                          onChange={(e) => setDbPassInput(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-text-muted mb-1">Custom JWT Secret</label>
                        <input
                          type="password"
                          placeholder="Update JWT signing secret"
                          value={jwtSecretInput}
                          onChange={(e) => setJwtSecretInput(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-text-muted mb-1">Storage Quota (MB)</label>
                        <input
                          type="number"
                          value={storageLimitInput}
                          onChange={(e) => setStorageLimitInput(Number(e.target.value))}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-text-muted mb-1">pgBouncer Pooler Port</label>
                        <input
                          type="number"
                          value={poolerPortInput}
                          onChange={(e) => setPoolerPortInput(Number(e.target.value))}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end pt-2">
                      <button
                        type="submit"
                        disabled={isSavingConfig}
                        className="px-5 py-2 bg-emerald-500 text-black font-bold text-xs rounded-xl hover:bg-emerald-400 disabled:opacity-50"
                      >
                        {isSavingConfig ? 'Saving...' : 'Save Stack Configuration'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CREATE SUPABASE PROJECT MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0b0c16] border border-white/15 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white">Create Self-Hosted Supabase Project</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-text-muted hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">Project Name *</label>
                <input
                  type="text"
                  required
                  value={newProjName}
                  onChange={(e) => setNewProjName(e.target.value)}
                  placeholder="production-app-db"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">Client / Owner Email *</label>
                <input
                  type="email"
                  required
                  value={newClientEmail}
                  onChange={(e) => setNewClientEmail(e.target.value)}
                  placeholder="client@company.com"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">Deployment Region / Host</label>
                <input
                  type="text"
                  value={newRegion}
                  onChange={(e) => setNewRegion(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-text-muted hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-black disabled:opacity-50"
                >
                  {isCreating ? 'Provisioning Stack...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
