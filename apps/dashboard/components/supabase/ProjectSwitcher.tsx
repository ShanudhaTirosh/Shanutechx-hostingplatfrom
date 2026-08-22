'use client';

import React, { useEffect, useState } from 'react';
import { supabaseAdmin, ClientSupabaseProject } from '@/lib/supabaseAdmin';

interface ProjectSwitcherProps {
  activeProject: ClientSupabaseProject | null;
  onSelectProject: (proj: ClientSupabaseProject) => void;
}

export function ProjectSwitcher({ activeProject, onSelectProject }: ProjectSwitcherProps) {
  const [projects, setProjects] = useState<ClientSupabaseProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // New Project Form
  const [name, setName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [creating, setCreating] = useState(false);

  const loadProjects = () => {
    supabaseAdmin.projects
      .list()
      .then((res) => {
        setProjects(res.projects);
        if (res.projects.length > 0 && !activeProject) {
          onSelectProject(res.projects[0]);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !clientEmail) return;
    setCreating(true);
    supabaseAdmin.projects
      .create({ name, clientEmail })
      .then((res) => {
        setName('');
        setClientEmail('');
        setShowModal(false);
        setProjects((prev) => [...prev, res.project]);
        onSelectProject(res.project);
      })
      .catch((err) => alert(err.message))
      .finally(() => setCreating(false));
  };

  return (
    <div className="flex items-center justify-between glass p-3 rounded-xl border border-white/[0.06]">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-brand-gradient flex items-center justify-center text-white text-xs font-bold shrink-0">
          ⚡
        </div>
        <div>
          <p className="text-[10px] uppercase font-semibold text-text-faint tracking-wider">Active Supabase Project</p>
          <div className="flex items-center gap-2">
            <select
              value={activeProject?.id || ''}
              onChange={(e) => {
                const found = projects.find((p) => p.id === e.target.value);
                if (found) onSelectProject(found);
              }}
              className="bg-transparent text-sm font-bold text-text-primary focus:outline-none cursor-pointer"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id} className="bg-[#0f111a] text-text-primary">
                  {p.name} ({p.clientEmail})
                </option>
              ))}
            </select>
            {activeProject && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                {activeProject.dbName}
              </span>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={() => setShowModal(true)}
        className="px-3 py-1.5 rounded-lg bg-accent-violet/20 hover:bg-accent-violet/30 text-accent-violet-light border border-accent-violet/30 text-xs font-semibold transition-all flex items-center gap-1.5"
      >
        <span>+ New Client Project</span>
      </button>

      {/* New Project Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in p-4">
          <div className="glass rounded-2xl p-6 border border-white/[0.1] max-w-md w-full space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <h3 className="font-semibold text-sm text-text-primary">Create Supabase Client Project</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-text-muted hover:text-text-primary text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-3">
              <div>
                <label className="text-[10px] uppercase text-text-faint block mb-1">Project / App Name</label>
                <input
                  type="text"
                  placeholder="e.g. Client Mobile App"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg bg-black/40 border border-white/[0.08] p-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-violet/50"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] uppercase text-text-faint block mb-1">Client / Owner Email</label>
                <input
                  type="email"
                  placeholder="e.g. client@company.com"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  className="w-full rounded-lg bg-black/40 border border-white/[0.08] p-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-violet/50"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg bg-white/[0.06] text-text-muted text-xs font-medium hover:bg-white/[0.1]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 rounded-lg bg-accent-violet text-white text-xs font-medium hover:opacity-90 transition-all shadow-glow-violet"
                >
                  {creating ? 'Provisioning...' : 'Provision Supabase Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
